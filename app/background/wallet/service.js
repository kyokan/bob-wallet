import { WalletClient } from 'hs-client';
import BigNumber from 'bignumber.js';
import path from 'path';
import { app } from 'electron';
import rimraf from 'rimraf';
import crypto from 'crypto';
const Validator = require('bval');
import { ConnectionTypes, getConnection } from '../connections/service';
import { dispatchToMainWindow, getMainWindow } from '../../mainWindow';
import { NETWORKS } from '../../constants/networks';
import { displayBalance, toBaseUnits, toDisplayUnits } from '../../utils/balances';
import { service as nodeService } from '../node/service';
import {
  SET_API_KEY,
  SET_BALANCE,
  SET_WALLETS,
  START_SYNC_WALLET,
  STOP_SYNC_WALLET,
  SYNC_WALLET_PROGRESS,
} from '../../ducks/walletReducer';
import {SET_FEE_INFO, SET_NODE_INFO} from "../../ducks/nodeReducer";
import createRegisterAll from "./create-register-all";
import {finalizeMany, transferMany} from "./bulk-transfer";
import {get, put} from "../db/service";
import hsdLedger from 'hsd-ledger';

const WalletNode = require('hsd/lib/wallet/node');
const TX = require('hsd/lib/primitives/tx');
const {Output, MTX, Address, Coin} = require('hsd/lib/primitives');
const Script = require('hsd/lib/script/script');
const {hashName, types} = require('hsd/lib/covenants/rules');
const MasterKey = require('hsd/lib/wallet/masterkey');
const Mnemonic = require('hsd/lib/hd/mnemonic');
const Covenant = require('hsd/lib/primitives/covenant');
const common = require('hsd/lib/wallet/common');
const ipc = require('electron').ipcMain;


const randomAddrs = {
  [NETWORKS.TESTNET]: 'ts1qfcljt5ylsa9rcyvppvl8k8gjnpeh079drfrmzq',
  [NETWORKS.REGTEST]: 'rs1qh57neh8npuxeyxfsl35373vshs0d40cvxx57aj',
  [NETWORKS.MAINNET]: 'hs1q5e06h2fcwx9sx38k6skzwkzmm54meudhphkytx',
  [NETWORKS.SIMNET]: 'ss1qfrfg6pg7emnx5m53zf4fe24vdtt8thljhyekhj',
};

const {LedgerHSD, LedgerChange, LedgerCovenant, LedgerInput} = hsdLedger;
const {Device} = hsdLedger.USB;
const ONE_MINUTE = 60000;

const HSD_DATA_DIR = path.join(app.getPath('userData'), 'hsd_data');
const WALLET_API_KEY = 'walletApiKey';

class WalletService {
  constructor() {
    nodeService.on('started', this._onNodeStart);
    nodeService.on('stopped', this._onNodeStop);
    this.nodeService = nodeService;
    this.lastProgressUpdate = 0;
    this.lastKnownChainHeight = 0;
    this.closeP = null;
    this.openP = null;
  }

  setWallet = (name) => {
    this.didSelectWallet = false;
    this.name = name;
  };

  async getAPIKey() {
    const apiKey = await get(WALLET_API_KEY);

    if (apiKey) return apiKey;

    const newKey = crypto.randomBytes(20).toString('hex');
    await put(WALLET_API_KEY, newKey);
    return newKey;
  }

  async setAPIKey(apiKey) {
    await put(WALLET_API_KEY, apiKey);
    dispatchToMainWindow({
      type: SET_API_KEY,
      payload: apiKey,
    });
  }

  reset = async () => {
    await this._ensureClient();

    try {
      await this._onNodeStop();

      const walletDir = this.networkName === 'main'
        ? HSD_DATA_DIR
        : path.join(HSD_DATA_DIR, this.networkName);

      await new Promise((resolve, reject) => rimraf(path.join(walletDir, 'wallet'), error => {
        if (error) {
          return reject(error);
        }
        resolve();
      }));

      await this._onNodeStart(
        this.networkName,
        this.network,
        this.apiKey,
      );
      this.setWallet(null);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  hasAddress = async (addressHash) => {
    if (!this.name) return false;
    await this._ensureClient();
    const wallet = await this.node.wdb.get(this.name);

    if (!wallet) return null;

    return wallet.hasPath(new Address(addressHash, this.network));
  };

  getWalletInfo = async () => {
    await this._ensureClient();
    return this.client.getInfo(this.name);
  };

  getAccountInfo = async () => {
    if (!this.name) return null;

    await this._ensureClient();
    const wallet = await this.node.wdb.get(this.name);

    if (!wallet) return null;

    const account = await wallet.getAccount('default');
    const balance = await wallet.getBalance(account.accountIndex);
    return {
      wid: this.name,
      ...account.getJSON(balance),
    };
  };

  getCoin = async (hash, index) => {
    await this._ensureClient();
    const wallet = await this.node.wdb.get(this.name);
    return wallet.getCoin(Buffer.from(hash, 'hex'), index);
  };

  getTX = async (hash) => {
    await this._ensureClient();
    const wallet = await this.node.wdb.get(this.name);
    return wallet.getTX(Buffer.from(hash, 'hex'));
  };

  getNames = async () => {
    await this._selectWallet();
    const wallet = await this.node.wdb.get(this.name);
    return wallet.getNames();
  };

  getPublicKey = async (address) => {
    await this._ensureClient();
    const wallet = await this.node.wdb.get(this.name);
    return wallet.getKey(address);
  };

  /**
   * Remove wallet by wid
   * @param wid
   * @return {Promise<void>}
   */
  removeWalletById = async (wid) => {
    await this._ensureClient();
    await this.node.wdb.remove(wid);
    this.setWallet(this.name === wid ? null : this.name);

    const wallets = await this.listWallets(false, true);

    dispatchToMainWindow({
      type: SET_WALLETS,
      payload: createPayloadForSetWallets(wallets),
    });
  };

  createNewWallet = async (name, passphraseOrXPub, isLedger) => {
    await this._ensureClient();
    this.setWallet(name);
    this.didSelectWallet = false;

    let res;
    if (isLedger) {
      res = this.client.createWallet(name, {
        watchOnly: true,
        accountKey: passphraseOrXPub,
      });
    } else {
      const mnemonic = new Mnemonic({bits: 256});
      const options = {
        passphrase: passphraseOrXPub,
        watchOnly: false,
        mnemonic: mnemonic.getPhrase().trim(),
      };

      res = await this.client.createWallet(this.name, options);
    }

    const wallets = await this.listWallets(false, true);
    dispatchToMainWindow({
      type: SET_WALLETS,
      payload: createPayloadForSetWallets(wallets, name),
    });

    return res;
  };

  backup = async (path) => {
    if (!path) throw new Error('path must not be undefined');
    await this._ensureClient();
    return this.client.execute('backupwallet', [path]);
  };

  rescan = async (height = 0) => {
    await this._ensureClient();
    const wdb = this.node.wdb;

    dispatchToMainWindow({type: START_SYNC_WALLET});
    dispatchToMainWindow({
      type: SYNC_WALLET_PROGRESS,
      payload: 0,
    });

    await wdb.rescan(height);
  };

  deepClean = async () => {
    await this._ensureClient();
    const wdb = this.node.wdb;

    await wdb.deepClean();
  };

  importSeed = async (name, passphrase, mnemonic) => {
    await this._ensureClient();
    this.setWallet(name);
    this.didSelectWallet = false;

    const options = {
      passphrase,
      // hsd generates different keys for
      // menmonics with trailing whitespace
      mnemonic: mnemonic.trim(),
    };

    const res = await this.client.createWallet(this.name, options);
    const wallets = await this.listWallets(false, true);

    dispatchToMainWindow({
      type: SET_WALLETS,
      payload: createPayloadForSetWallets(wallets, name),
    });

    return res;
  };

  generateReceivingAddress = async () => {
    await this._ensureClient();
    return this.client.createAddress(this.name, 'default');
  };

  getAuctionInfo = async (name) => {
    return this._executeRPC('getauctioninfo', [name]);
  };

  getTransactionHistory = async () => {
    await this._ensureClient();

    if (!this.name) {
      return [];
    }

    const wallet = await this.node.wdb.get(this.name);
    const txs = await wallet.getHistory('default');

    common.sortTX(txs);

    const details = await wallet.toDetails(txs);

    const result = [];

    for (const item of details) {
      result.push(item.getJSON(this.network, this.lastKnownChainHeight));
    }

    return result;
  };

  getPendingTransactions = async () => {
    await this._ensureClient();
    const wallet = await this.node.wdb.get(this.name);
    return wallet.getPending('default');
  };

  getBids = async () => {
    await this._ensureClient();
    const wallet = await this.node.wdb.get(this.name);
    return wallet.getBids();
  };

  getMasterHDKey = () => this._ledgerDisabled(
    'cannot get HD key for watch-only wallet',
    () => this.client.getMaster(this.name),
  );

  setPassphrase = (newPass) => this._ledgerDisabled(
    'cannot set passphrase for watch-only wallet',
    () => this.client.setPassphrase(this.name, newPass),
  );

  revealSeed = (passphrase) => this._ledgerDisabled(
    'cannot reveal seed phrase for watch-only wallet',
    async () => {
      const data = await this.getMasterHDKey();

      // should always be encrypted - seed cannot be revealed via the UI until
      // the user has finished onboarding. checking here for completeness' sake
      if (!data.encrypted) {
        return data.key.mnemonic.phrase;
      }

      const parsedData = {
        encrypted: data.encrypted,
        alg: data.algorithm,
        iv: Buffer.from(data.iv, 'hex'),
        ciphertext: Buffer.from(data.ciphertext, 'hex'),
        n: data.n,
        r: data.r,
        p: data.p,
      };

      const mk = new MasterKey(parsedData);
      await mk.unlock(passphrase, 100);
      return mk.mnemonic.getPhrase();
    },
  );

  estimateTxFee = async (to, amount, feeRate, subtractFee = false) => {
    await this._ensureClient();
    const feeRateBaseUnits = Number(toBaseUnits(feeRate));
    const createdTx = await this.client.createTX(this.name, {
      rate: feeRateBaseUnits,
      outputs: [{
        value: Number(toBaseUnits(amount)),
        address: to,
      }],
      subtractFee,
      sign: false,
    });
    return {
      feeRate,
      amount: Number(toDisplayUnits(createdTx.fee)),
      txSize: Number(new BigNumber(createdTx.fee).div(feeRateBaseUnits).toFixed(3)),
    };
  };

  estimateMaxSend = async (feeRate) => {
    const info = await this.getAccountInfo();
    const spendable = info.balance.unconfirmed - info.balance.lockedUnconfirmed;
    const value = new BigNumber(toDisplayUnits(spendable));
    if (value.isZero()) {
      return 0;
    }

    const dummyAddr = randomAddrs[this.networkName];
    // Estiamte a 1-output TX consuming entire spendable balance minus fee
    const {amount} = await this.estimateTxFee(dummyAddr, value, feeRate, true);
    return value - amount;
  };

  sendOpen = (name) => this._ledgerProxy(
    () => this._executeRPC('createopen', [name]),
    () => this._executeRPC('sendopen', [name], this.lock),
  );

  sendBid = (name, amount, lockup) => this._ledgerProxy(
    () => this._executeRPC(
      'createbid',
      [name, Number(displayBalance(amount)), Number(displayBalance(lockup))],
    ),
    () => this._executeRPC(
      'sendbid',
      [name, Number(displayBalance(amount)), Number(displayBalance(lockup))],
      this.lock,
    ),
  );

  sendRegister = (name) => this._ledgerProxy(
    () => this._executeRPC('createupdate', [name, {records: []}]),
    () => this._executeRPC('sendupdate', [name, {records: []}], this.lock),
  );

  sendUpdate = (name, json) => this._ledgerProxy(
    () => this._executeRPC('createupdate', [name, json]),
    () => this._executeRPC('sendupdate', [name, json], this.lock),
  );

  sendReveal = (name) => this._ledgerProxy(
    () => this._executeRPC('createreveal', [name]),
    () => this._executeRPC('sendreveal', [name], this.lock),
  );

  sendRedeem = (name) => this._ledgerProxy(
    () => this._executeRPC('createredeem', [name]),
    () => this._executeRPC('sendredeem', [name], this.lock),
  );

  sendRegisterAll = async () => {
    const {wdb} = this.node;
    const wallet = await wdb.get(this.name);
    const mtx = await createRegisterAll(wallet);
    const unlock = await wallet.fundLock.lock();

    try {
      await wallet.fill(mtx);
      const finalizedTX = await wallet.finalize(mtx);
      await wallet.sendMTX(finalizedTX, null);
    } finally {
      unlock();
    }
  };

  transferMany = async (names, address) => {
    const {wdb} = this.node;
    const wallet = await wdb.get(this.name);
    await transferMany(wallet, names, address);
  };

  finalizeMany = async (names) => {
    const {wdb} = this.node;
    const wallet = await wdb.get(this.name);
    await finalizeMany(wallet, names);
  };

  sendRevealAll = () => this._ledgerProxy(
    () => this._executeRPC('createreveal', ['']),
    () => this._executeRPC('sendreveal', [''], this.lock),
  );

  sendRedeemAll = () => this._ledgerProxy(
    () => this._executeRPC('createredeem', ['']),
    () => this._executeRPC('sendredeem', [''], this.lock),
  );

  sendRenewal = (name) => this._ledgerProxy(
    () => this._executeRPC('createrenewal', [name]),
    () => this._executeRPC('sendrenewal', [name], this.lock),
  );

  sendTransfer = (name, recipient) => this._ledgerProxy(
    () => this._executeRPC('createtransfer', [name, recipient]),
    () => this._executeRPC('sendtransfer', [name, recipient], this.lock),
  );

  cancelTransfer = (name) => this._ledgerProxy(
    () => this._executeRPC('createcancel', [name]),
    () => this._executeRPC('sendcancel', [name], this.lock),
  );

  finalizeTransfer = (name) => this._ledgerProxy(
    () => this._executeRPC('createfinalize', [name]),
    () => this._executeRPC('sendfinalize', [name], this.lock),
  );

  revokeName = (name) => this._ledgerProxy(
    () => this._executeRPC('createrevoke', [name]),
    () => this._executeRPC('sendrevoke', [name], this.lock),
  );

  send = (to, amount, fee) => this._ledgerProxy(
    () => this._executeRPC('createsendtoaddress', [to, Number(amount), '', '', false, 'default']),
    async () => {
      const res = await this.client.send(this.name, {
        rate: Number(toBaseUnits(fee)),
        outputs: [{
          value: Number(toBaseUnits(amount)),
          address: to,
        }],
      });
      await this.lock();
      return res;
    },
  );

  lock = () => this._ledgerProxy(
    () => null,
    () => this.client.lock(this.name),
    false
  );

  unlock = (name, passphrase) => {
    this.setWallet(name);
    return this._ledgerProxy(
      () => null,
      () => this.client.unlock(this.name, passphrase),
      false
    );
  };

  isLocked = () => this._ledgerProxy(
    () => false,
    async () => {
      try {
        const info = await this.client.getInfo(this.name);
        return info === null || info.master.until === 0;
      } catch (e) {
        console.error(e);
        return true;
      }
    },
    false,
  );

  getNonce = async (options) => {
    await this._ensureClient();
    return this.client.getNonce(this.name, options.name, options);
  };

  importNonce = async (options) => {
    return this._executeRPC('importnonce', [options.name, options.address, options.bid]);
  };

  zap = async () => {
    await this._ensureClient();
    return this.client.zap(this.name, 'default', 1);
  };

  importName = (name, start) => {
    return this._executeRPC('importname', [name, start]);
  };

  rpcGetWalletInfo = async () => {
    return await this._executeRPC('getwalletinfo', []);
  };

  // price is in WHOLE HNS!
  finalizeWithPayment = async (name, fundingAddr, nameReceiveAddr, price) => {
    await this._ensureClient();

    if (price > 2000) {
      throw new Error('Refusing to create a transfer for more than 2000 HNS.');
    }

    const {wdb} = this.node;
    const wallet = await wdb.get(this.name);
    const ns = await wallet.getNameStateByName(name);
    const owner = ns.owner;
    const coin = await wallet.getCoin(owner.hash, owner.index);
    const nameHash = hashName(name);

    let flags = 0;
    if (ns.weak) {
      flags = flags |= 1;
    }

    const output0 = new Output();
    output0.value = coin.value;
    output0.address = new Address().fromString(nameReceiveAddr);
    output0.covenant.type = types.FINALIZE;
    output0.covenant.pushHash(nameHash);
    output0.covenant.pushU32(ns.height);
    output0.covenant.push(Buffer.from(name, 'ascii'));
    output0.covenant.pushU8(flags); // flags, may be required if name was CLAIMed
    output0.covenant.pushU32(ns.claimed);
    output0.covenant.pushU32(ns.renewals);
    output0.covenant.pushHash(await wdb.getRenewalBlock());

    const output1 = new Output();
    output1.address = new Address().fromString(fundingAddr);
    output1.value = price * 1e6;

    let mtx = new MTX();
    mtx.addCoin(coin);
    mtx.outputs.push(output0);
    mtx.outputs.push(output1);

    // Sign
    mtx = await this._ledgerProxy(
      // With ledger: this function is a little funny because it's
      // stubbing the wallet.create____() - type functions and must return
      // an MTX to the guts of _ledgerProxy() for verification & signing.
      async () => {
        const key = await wallet.getKey(coin.address);
        const publicKey = key.publicKey;
        const path =
          'm/' +                                    // master
          '44\'/' +                                 // purpose
          `${this.network.keyPrefix.coinType}'/` +  // coin type
          `${key.account}'/` +                      // should be 0 ("default")
          `${key.branch}/` +                        // should be 1 (change)
          `${key.index}`;

        const options = {
          inputs: [
            new LedgerInput({
              publicKey,
              path,
              coin,
              input: mtx.inputs[0],
              index: 0,
              type: Script.hashType.SINGLEREVERSE | Script.hashType.ANYONECANPAY
            })
          ]
        };

        return [mtx.getJSON(this.network), options];
      },
      // No ledger
      async () => {
        const rings = await wallet.deriveInputs(mtx);
        assert(rings.length === 1);
        const signed = await mtx.sign(
          rings,
          Script.hashType.SINGLEREVERSE | Script.hashType.ANYONECANPAY,
        );
        assert(signed === 1);
        assert(mtx.verify());
        return mtx;
      },
      true,    // shouldConfirmLedger (ledger only)
      false    // broadcast (ledger only)
    );

    return mtx.encode().toString('hex');
  };

  claimPaidTransfer = async (txHex) => {
    await this._ensureClient();

    const {wdb} = this.node;
    const wallet = await wdb.get(this.name);
    const mtx = MTX.decode(Buffer.from(txHex, 'hex'));

    // Bob should verify all the data in the MTX to ensure everything is valid,
    // but this is the minimum.
    const input0 = mtx.input(0).clone(); // copy input with Alice's signature
    const prevoutJSON = input0.prevout.toJSON();
    const coinData = await this.nodeService.getCoin(prevoutJSON.hash, prevoutJSON.index);
    assert(coinData); // ensures that coin exists and is still unspent
    const coin = new Coin();
    coin.fromJSON(coinData, this.networkName);
    assert(coin.covenant.type === types.TRANSFER);

    // Fund the TX.
    // The hsd wallet is not designed to handle partially-signed TXs
    // or coins from outside the wallet, so a little hacking is needed.
    const changeAddress = await wallet.changeAddress();
    const rate = await wdb.estimateFee();
    const coins = await wallet.getSmartCoins();
    // Add the external coin to the coin selector so we don't fail assertions
    coins.push(coin);
    await mtx.fund(coins, {changeAddress, rate});
    // The funding mechanism starts by wiping out existing inputs
    // which for us includes Alice's signature. Replace it from our backup.
    mtx.inputs[0].inject(input0);

    // Rearrange outputs.
    // Since we added a change output, the SINGELREVERSE is now broken:
    //
    // input 0: TRANSFER UTXO --> output 0: FINALIZE covenant
    // input 1: Bob's funds   --- output 1: payment to Alice
    //                 (null) --- output 2: change to Bob
    const outputs = mtx.outputs.slice();
    if (outputs.length === 3) {
      mtx.outputs = [outputs[0], outputs[2], outputs[1]];
    }

    // Sign & Broadcast
    // Bob uses SIGHASHALL. The final TX looks like this:
    //
    // input 0: TRANSFER UTXO --> output 0: FINALIZE covenant
    // input 1: Bob's funds   --- output 1: change to Bob
    //                 (null) --- output 2: payment to Alice
    await this._ledgerProxy(
      // With ledger: even though we are signing with SIGHASH_ALL,
      // we still need to provide Ledger with an array of input
      // data, or else it will try to sign all inputs.
      async () => {
        const coin = mtx.view.getCoinFor(mtx.inputs[1]);
        const key = await wallet.getKey(coin.address);
        const publicKey = key.publicKey;
        const path =
          'm/' +                                    // master
          '44\'/' +                                 // purpose
          `${this.network.keyPrefix.coinType}'/` +  // coin type
          `${key.account}'/` +                      // should be 0 ("default")
          `${key.branch}/` +                        // should be 1 (change)
          `${key.index}`;

        const options = {
          inputs: [
            new LedgerInput({
              publicKey,
              path,
              coin,
              input: mtx.inputs[1],
              index: 1
            })
          ]
        };

        return [mtx.getJSON(this.network), options];
      },
      // No ledger.
      async () => {
        await wallet.sendMTX(mtx);
      }
    );
  };

  /**
   * List Wallet IDs (exclude unencrypted wallets)
   * @return {Promise<[string]>}
   */
  listWallets = async (includeUnencrypted = false, returnObjects = false) => {
    await this._ensureClient();

    const wdb = this.node.wdb;
    const wallets = await wdb.getWallets();
    const ret = [];

    for (const wid of wallets) {
      const info = await wdb.get(wid);
      const {master: {encrypted}, watchOnly} = info;
      if (includeUnencrypted === true || encrypted || watchOnly) {
        if (returnObjects) {
          ret.push({ wid, encrypted, watchOnly });
        } else {
          ret.push(wid);
        }
      }
    }

    return ret;
  };

  _onNodeStart = async (networkName, network, apiKey) => {
    const conn = await getConnection();

    this.networkName = networkName;
    this.apiKey = apiKey;
    this.walletApiKey = await this.getAPIKey();
    this.network = network;

    const walletOptions = {
      network: network,
      port: network.walletPort,
      apiKey: this.walletApiKey,
      timeout: 10000,
    };

    const node = new WalletNode({
      network: networkName,
      nodeHost: conn.type === ConnectionTypes.Custom
        ? conn.host
        : undefined,
      nodePort: conn.type === ConnectionTypes.Custom
        ? conn.port || undefined
        : undefined,
      nodeApiKey: conn.type === ConnectionTypes.Custom
        ? conn.apiKey
        : apiKey,
      apiKey: walletOptions.apiKey,
      httpPort: walletOptions.port,
      memory: false,
      prefix: networkName === 'main'
        ? HSD_DATA_DIR
        : path.join(HSD_DATA_DIR, networkName),
      migrate: 0,
      logFile: true,
      logConsole: false,
      logLevel: 'debug',
    });

    node.http.post('/unsafe-update-account-depth', this.handleUnsafeUpdateAccountDepth);

    if (this.closeP) await this.closeP;

    await node.open();
    this.node = node;

    node.wdb.on('error', e => {
      console.error('walletdb error', e);
    });

    node.wdb.client.bind('block connect', this.onNewBlock);
    node.wdb.client.unhook('block rescan');
    node.wdb.client.hook('block rescan', this.onRescanBlock);

    this.client = new WalletClient(walletOptions);
    await this.refreshNodeInfo();
    const wallets = await this.listWallets(false, true);

    dispatchToMainWindow({
      type: SET_WALLETS,
      payload: createPayloadForSetWallets(wallets),
    });
    await this.refreshWalletInfo();
  };

  _onNodeStop = async () => {
    const node = this.node;
    this.node = null;
    this.client = null;
    this.didSelectWallet = false;
    this.closeP = new Promise(async resolve => {
      if (node) {
        await node.close();
      }
      resolve();
    });

  };

  handleUnsafeUpdateAccountDepth = async (req, res) => {
    if (!req.admin) {
      res.json(403);
      return;
    }

    const valid = Validator.fromRequest(req);

    const disclaimer = valid.bool('I_KNOW_WHAT_IM_DOING', false);

    enforce(
      disclaimer,
      'Unsafe endpoints requires I_KNOW_WHAT_IM_DOING=true'
    );

    const changeDepth = valid.u64('changeDepth');
    const receiveDepth = valid.u64('receiveDepth');


    await this.updateAccountDepth(changeDepth, receiveDepth);
    res.json(200, { success: true });
  };


  updateAccountDepth = async (changeDepth, receiveDepth) => {
    if (!this.name) return null;

    await this._ensureClient();
    const wallet = await this.node.wdb.get(this.name);

    if (!wallet) return null;

    const account = await wallet.getAccount('default');
    const initChange = account.changeDepth;
    const initReceive = account.receiveDepth;
    const b = this.node.wdb.db.batch();

    account.changeDepth = changeDepth;
    account.receiveDepth = receiveDepth;
    await account.save(b);

    if (changeDepth) {
      for (let i = initChange; i <= changeDepth; i++) {
        const key = account.deriveChange(i);
        await account.saveKey(b, key);
      }
    }

    if (receiveDepth) {
      for (let j = initReceive; j <= receiveDepth; j++) {
        const key = account.deriveReceive(j);
        await account.saveKey(b, key);
      }
    }

    await b.write();
  };

  refreshWalletInfo = async () => {
    if (!this.name) return;

    const accountInfo = await this.getAccountInfo();

    if (!accountInfo) return;

    dispatchToMainWindow({
      type: SET_BALANCE,
      payload: accountInfo.balance,
    });
  };

  refreshNodeInfo = async () => {
    const info = await nodeService.getInfo().catch(() => null);
    const fees = await nodeService.getFees().catch(() => null);

    if (info) {
      const {chain: {height: chainHeight}} = info;

      this.lastKnownChainHeight = chainHeight;

      dispatchToMainWindow({
        type: SET_NODE_INFO,
        payload: {info},
      });
    }

    if (fees) {
      dispatchToMainWindow({
        type: SET_FEE_INFO,
        payload: {fees},
      });
    }
  };

  onNewBlock = async (entry, txs) => {
    await this._ensureClient();
    await this.refreshNodeInfo();
    await this.refreshWalletInfo();

    if (entry && txs) {
      await this.node.wdb.addBlock(entry, txs);
    }
  };

  /**
   * Stub handler for rescan block
   *
   * @param {ChainEntry} entry
   * @param {TX[]} txs
   * @returns {Promise}
   */

  onRescanBlock = async (entry, txs) => {
    await this._ensureClient();
    const wdb = this.node.wdb;

    try {
      await wdb.rescanBlock(entry, txs);
      const walletHeight = entry.height;
      const chainHeight = this.lastKnownChainHeight;

      if (walletHeight === chainHeight) {
        dispatchToMainWindow({type: STOP_SYNC_WALLET});
        dispatchToMainWindow({
          type: SYNC_WALLET_PROGRESS,
          payload: walletHeight,
        });
        await this.refreshWalletInfo();
        return;
      }

      const now = Date.now();

      // debounce wallet sync update
      if (now - this.lastProgressUpdate > 500) {
        dispatchToMainWindow({type: START_SYNC_WALLET});
        dispatchToMainWindow({
          type: SYNC_WALLET_PROGRESS,
          payload: walletHeight,
        });
        await this.refreshWalletInfo();
        this.lastProgressUpdate = now;
      }
    } catch (e) {
      wdb.emit('error', e);
    }
  };

  async _ensureClient() {
    return new Promise((resolve, reject) => {
      if (this.client) {
        resolve();
        return;
      }

      setTimeout(async () => {
        await this._ensureClient();
        resolve();
      }, 500);
    });
  }

  async _selectWallet() {
    await this._ensureClient();

    if (this.didSelectWallet) {
      return;
    }
    if (this.pendingSelection) {
      return this.pendingSelection;
    }

    this.pendingSelection = this.client.execute('selectwallet', [this.name]);
    await this.pendingSelection;
    this.pendingSelection = null;
    this.didSelectWallet = true;
  }

  _ledgerProxy = async (onLedger, onNonLedger, shouldConfirmLedger = true, broadcast = true) => {
    const info = await this.getWalletInfo();
    if (info.watchOnly) {
      // I feel terrible about this, but...
      let res, extra;
      const oneOrMoreReturnValues = await onLedger();
      if (!Array.isArray(oneOrMoreReturnValues)) {
        res = oneOrMoreReturnValues;
      } else {
        [res, extra] = oneOrMoreReturnValues;
      }

      if (shouldConfirmLedger) {
        const mtx = MTX.fromJSON(res);
        // Prepare extra TX data for Ledger.
        // Unfortunately the MTX returned from the wallet.create____()
        // functions does not include what we need, so we have to compute it.
        const options = {};
        if (extra)
          Object.assign(options, extra);
        for (let index = 0; index < res.outputs.length; index++) {
          const output = res.outputs[index];

          // The user does not have to verify change outputs on the device.
          // What we do is pass metadata about the change output to Ledger,
          // and the app will verify the change address belongs to the wallet.
          const address = Address.fromString(output.address, this.network);
          const key = await this.getPublicKey(address);

          if (!key)
            continue;

          if (key.branch === 1) {
            if (options.change)
              throw new Error('Transaction should only have one change output.');

            const path =
              'm/' +                                  // master
              '44\'/' +                               // purpose
              `${this.network.keyPrefix.coinType}'/` +    // coin type
              `${key.account}'/` +                    // should be 0 ("default")
              `${key.branch}/` +                      // should be 1 (change)
              `${key.index}`;

            options.change = new LedgerChange({
              index,
              version: address.version,
              path
            });
          }

          // The user needs to verify the raw ASCII name for every covenant.
          // Because some covenants contain a name's hash but not the preimage,
          // we must pass the device the name as an extra virtual covenant item.
          // The device will confirm the nameHash before asking the user to verify.
          switch (output.covenant.type) {
            case types.NONE:
            case types.OPEN:
            case types.BID:
            case types.FINALIZE:
              break;

            case types.REVEAL:
            case types.REDEEM:
            case types.REGISTER:
            case types.UPDATE:
            case types.RENEW:
            case types.TRANSFER:
            case types.REVOKE: {
              if (options.covenants == null)
                options.covenants = [];

              // We could try to just pass the name in from the functions that
              // call _ledgerProxy(), but that wouldn't work for send____All()
              const hash = output.covenant.items[0];
              const name = await this.nodeService.getNameByHash(hash);

              options.covenants.push(new LedgerCovenant({index, name}));
              break;
            }
            default:
              throw new Error('Unrecognized covenant type.');
          }
        }

        const mainWindow = getMainWindow();
        return new Promise((resolve, reject) => {
          const resHandler = async () => {
            let device;
            try {
              device = await Device.requestDevice();
              device.set({
                timeout: ONE_MINUTE,
              });
              await device.open();
              const ledger = new LedgerHSD({device, network: this.networkName});

              // Ensure the correct device is connected.
              // This assumes everything in our world is "default" account (0).
              const {accountKey} = await this.getAccountInfo();
              const deviceKey = await ledger.getAccountXPUB(0);
              if (accountKey !== deviceKey.xpubkey(this.network))
                throw new Error('Ledger public key does not match wallet. (Wrong device?)')

              const retMtx = await ledger.signTransaction(mtx, options);
              retMtx.check();

              if (broadcast)
                await this.nodeService.broadcastRawTx(retMtx.toHex());

              mainWindow.send('LEDGER/CONNECT_OK');
              ipc.removeListener('LEDGER/CONNECT_RES', resHandler);
              ipc.removeListener('LEDGER/CONNECT_CANCEL', cancelHandler);
              resolve(retMtx);
            } catch (e) {
              // This ipc message goes to the Ledger modal
              mainWindow.send('LEDGER/CONNECT_ERR', e.message);

              // If we reject from this Promise, it will go to whatever
              // function is trying to send a transaction. We don't need
              // errors in two places and it messes up the UI. The Ledger modal
              // is in charge now and all the errors should be displayed there.
              // If the user gives up they click CANCEL on the Ledger modal,
              // which is when the "Cancelled." error (below) is sent to the
              // calling function.
              // SO, leave this next line commented out but keep for reference:
              // reject(e);
            } finally {
              if (device) {
                try {
                  await device.close();
                } catch (e) {
                  console.error('failed to close ledger', e);
                }
              }
            }
          };
          const cancelHandler = () => {
            // User has given up on Ledger, inform the calling function.
            reject(new Error('Cancelled.'));

            // These messages go to the Ledger modal
            ipc.removeListener('LEDGER/CONNECT_RES', resHandler);
            ipc.removeListener('LEDGER/CONNECT_CANCEL', cancelHandler);
          };
          ipc.on('LEDGER/CONNECT_RES', resHandler);
          ipc.on('LEDGER/CONNECT_CANCEL', cancelHandler);
          mainWindow.send('LEDGER/CONNECT', mtx.txid());
        });
      }

      return res;
    }

    return onNonLedger();
  };

  _ledgerDisabled = (message, onNonLedger) => {
    return this._ledgerProxy(() => {
      throw new Error(message);
    }, onNonLedger, false);
  };

  async _executeRPC(method, args, cb) {
    await this._selectWallet();
    const res = await this.client.execute(method, args);
    if (cb) cb(res);
    return res;
  }
}

export const service = new WalletService();
service.createNewWallet.suppressLogging = true;
service.importSeed.suppressLogging = true;
service.getMasterHDKey.suppressLogging = true;
service.setPassphrase.suppressLogging = true;
service.revealSeed.suppressLogging = true;
service.unlock.suppressLogging = true;

const sName = 'Wallet';
const methods = {
  // stub the start method in case we need it later
  start: async () => null,
  getWalletInfo: service.getWalletInfo,
  getAccountInfo: service.getAccountInfo,
  getAPIKey: service.getAPIKey,
  setAPIKey: service.setAPIKey,
  getCoin: service.getCoin,
  getTX: service.getTX,
  getNames: service.getNames,
  createNewWallet: service.createNewWallet,
  importSeed: service.importSeed,
  generateReceivingAddress: service.generateReceivingAddress,
  getAuctionInfo: service.getAuctionInfo,
  getTransactionHistory: service.getTransactionHistory,
  getPendingTransactions: service.getPendingTransactions,
  getBids: service.getBids,
  getMasterHDKey: service.getMasterHDKey,
  hasAddress: service.hasAddress,
  setPassphrase: service.setPassphrase,
  revealSeed: service.revealSeed,
  estimateTxFee: service.estimateTxFee,
  estimateMaxSend: service.estimateMaxSend,
  removeWalletById: service.removeWalletById,
  updateAccountDepth: service.updateAccountDepth,
  backup: service.backup,
  rescan: service.rescan,
  deepClean: service.deepClean,
  reset: service.reset,
  sendOpen: service.sendOpen,
  sendBid: service.sendBid,
  sendRegister: service.sendRegister,
  sendUpdate: service.sendUpdate,
  sendReveal: service.sendReveal,
  sendRedeem: service.sendRedeem,
  sendRevealAll: service.sendRevealAll,
  sendRedeemAll: service.sendRedeemAll,
  sendRegisterAll: service.sendRegisterAll,
  sendRenewal: service.sendRenewal,
  transferMany: service.transferMany,
  finalizeMany: service.finalizeMany,
  sendTransfer: service.sendTransfer,
  cancelTransfer: service.cancelTransfer,
  finalizeTransfer: service.finalizeTransfer,
  finalizeWithPayment: service.finalizeWithPayment,
  claimPaidTransfer: service.claimPaidTransfer,
  revokeName: service.revokeName,
  send: service.send,
  lock: service.lock,
  unlock: service.unlock,
  isLocked: service.isLocked,
  getNonce: service.getNonce,
  importNonce: service.importNonce,
  zap: service.zap,
  importName: service.importName,
  rpcGetWalletInfo: service.rpcGetWalletInfo,
  listWallets: service.listWallets,
};

export async function start(server) {
  server.withService(sName, methods);
}

function mapTXs(txs) {
  const ret = [];
  for (let i = 0; i < txs.length; i++) {
    const txOptions = txs[i];
    const tx = mapOneTx(txOptions);
    ret.push(tx);
  }
  return ret;
}

function mapOneTx(txOptions) {
  if (txOptions.witnessHash) {
    txOptions.witnessHash = Buffer.from(txOptions.witnessHash, 'hex');
  }

  txOptions.inputs = txOptions.inputs.map(input => {
    if (input.prevout.hash) {
      input.prevout.hash = Buffer.from(input.prevout.hash, 'hex');
    }

    if (input.coin && input.coin.covenant) {
      input.coin.covenant = new Covenant(
        input.coin.covenant.type,
        input.coin.covenant.items.map(item => Buffer.from(item, 'hex')),
      );
    }

    if (input.witness) {
      input.witness = input.witness.map(wit => Buffer.from(wit, 'hex'));
    }

    return input;
  });

  txOptions.outputs = txOptions.outputs.map(output => {
    if (output.covenant) {
      output.covenant = new Covenant(
        output.covenant.type,
        output.covenant.items.map(item => Buffer.from(item, 'hex')),
      );

    }
    return output;
  });
  return new TX(txOptions);
}

function getHost(url = '') {
  const {host} = new URL(url);
  return host;
}

function getPort(url = '') {
  const {port} = new URL(url);
  return Number(port) || 80;
}

function assert(value) {
  if (!value) {
    throw new Error('Assertion failed.');
  }
}

function uniq(list) {
  const mapping = {};
  const ret = [];

  for (const item of list) {
    if (!mapping[item]) {
      ret.push(item);
      mapping[item] = true;
    }
  }

  return ret;
}

function enforce(value, msg) {
  if (!value) {
    const err = new Error(msg);
    err.statusCode = 400;
    throw err;
  }
}

function createPayloadForSetWallets(wallets, addName = null) {
  let wids = wallets.map((wallet) => wallet.wid);
  if (addName !== null) {
    wids = uniq([...wids, addName]);
  }

  return {
    wallets: wids,
    walletsDetails: wallets.reduce((obj, wallet) => {
      obj[wallet.wid] = wallet;
      return obj;
    }, {}), // array of objects to a single object with wid as key
  };
}