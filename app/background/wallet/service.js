import { WalletClient } from 'hs-client';
import BigNumber from 'bignumber.js';
import crypto from 'crypto';
const secp256k1 = require('bcrypto/lib/secp256k1');
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
  SET_WALLET_NETWORK,
  SET_RESCAN_HEIGHT,
  SET_FIND_NONCE_PROGRESS,
} from '../../ducks/walletReducer';
import {STOP, SET_CUSTOM_RPC_STATUS} from '../../ducks/nodeReducer';
import {getNamesForRegisterAll} from "./create-register-all";
import {getStats} from "./stats";
import {get, put} from "../db/service";
import hsdLedger from 'hsd-ledger';
import {NAME_STATES} from "../../constants/names";

const WalletNode = require('hsd/lib/wallet/node');
const TX = require('hsd/lib/primitives/tx');
const {Output, MTX, Address, Coin} = require('hsd/lib/primitives');
const Script = require('hsd/lib/script/script');
const MasterKey = require('hsd/lib/wallet/masterkey');
const Account = require('hsd/lib/wallet/account');
const Mnemonic = require('hsd/lib/hd/mnemonic');
const HDPublicKey = require('hsd/lib/hd/public');
const HDPrivateKey = require('hsd/lib/hd/private');
const Covenant = require('hsd/lib/primitives/covenant');
const consensus = require('hsd/lib/protocol/consensus');
const common = require('hsd/lib/wallet/common');
const {Rules} = require('hsd/lib/covenants');
const {hashName, types} = Rules;
const ipc = require('electron').ipcMain;

const randomAddrs = {
  [NETWORKS.TESTNET]: 'ts1qfcljt5ylsa9rcyvppvl8k8gjnpeh079drfrmzq',
  [NETWORKS.REGTEST]: 'rs1qh57neh8npuxeyxfsl35373vshs0d40cvxx57aj',
  [NETWORKS.MAINNET]: 'hs1q5e06h2fcwx9sx38k6skzwkzmm54meudhphkytx',
  [NETWORKS.SIMNET]: 'ss1qfrfg6pg7emnx5m53zf4fe24vdtt8thljhyekhj',
};

const {LedgerHSD, LedgerChange, LedgerCovenant, LedgerInput} = hsdLedger;
const {Device} = hsdLedger.HID;
const ONE_MINUTE = 60000;

const WALLET_API_KEY = 'walletApiKey';

class WalletService {
  constructor() {
    nodeService.on('start remote', this._useWalletNode);
    nodeService.on('start local', this._usePlugin);
    nodeService.on('stopped', this._onNodeStop);
    this.nodeService = nodeService;
    this.lastProgressUpdate = 0;
    this.lastKnownChainHeight = 0;
    this.heightBeforeRescan = null; // null = not rescanning
    this.conn = {type: null};
    this.findNonceStop = false;
  }

  /**
   * Wallet as a plugin to the hsd full node is the default configuration
   * @param {import('hsd/lib/wallet/plugin')} plugin
   * @param {string} apiKey
   */
  _usePlugin = async (plugin, apiKey) => {
    if (this.node) {
      // The app was restarted but the nodes are already running,
      // just re-dispatch to redux store.
      dispatchToMainWindow({
        type: SET_WALLET_NETWORK,
        payload: this.networkName,
      });
      const wallets = await this.listWallets();
      dispatchToMainWindow({
        type: SET_WALLETS,
        payload: createPayloadForSetWallets(wallets),
      });
      return;
    }

    this.conn = await getConnection();
    assert(this.conn.type === ConnectionTypes.P2P);

    this.node = plugin;
    this.network = plugin.network;
    this.networkName = this.network.type;
    this.walletApiKey = apiKey;

    dispatchToMainWindow({
      type: SET_WALLET_NETWORK,
      payload: this.networkName,
    });
    dispatchToMainWindow({
      type: SET_API_KEY,
      payload: this.walletApiKey,
    });

    // TODO: This may not work because the plugin is open() already by now
    this.node.http.post('/unsafe-update-account-depth', this.handleUnsafeUpdateAccountDepth);

    this.node.wdb.on('error', e => {
      console.error('walletdb error', e);
    });

    this.node.wdb.on('block connect', this.onNewBlock);

    this.client = new WalletClient({
      network: this.network,
      port: this.network.walletPort,
      apiKey: this.walletApiKey,
      timeout: 10000,
    });

    const wallets = await this.listWallets();
    dispatchToMainWindow({
      type: SET_WALLETS,
      payload: createPayloadForSetWallets(wallets),
    });

    this.lastKnownChainHeight = this.node.wdb.height;
  };

  // Wallet as a separate process only runs in Custom RPC mode
  _useWalletNode = async (network) => {
    if (this.node) {
      // The app was restarted but the nodes are already running,
      // just re-dispatch to redux store.
      dispatchToMainWindow({
        type: SET_WALLET_NETWORK,
        payload: this.networkName,
      });
      dispatchToMainWindow({
        type: SET_API_KEY,
        payload: this.walletApiKey,
      });
      const wallets = await this.listWallets();
      dispatchToMainWindow({
        type: SET_WALLETS,
        payload: createPayloadForSetWallets(wallets),
      });
      return;
    }

    this.conn = await getConnection();
    assert(this.conn.type === ConnectionTypes.Custom);

    this.network = network;
    this.networkName = network.type;
    this.walletApiKey = await this.getAPIKey();

    dispatchToMainWindow({
      type: SET_WALLET_NETWORK,
      payload: this.networkName,
    });
    dispatchToMainWindow({
      type: SET_API_KEY,
      payload: this.walletApiKey,
    });

    // This is an unfortunate work-around for the fact that
    // WalletNode doesn't accept a `nodePath` option to
    // pass to NodeClient which gets passed to bcurl/client.
    const nodeURL =
      this.conn.pathname
      ?
        this.conn.protocol + '://' +
        'username_is_ignored:' + this.conn.apiKey + '@' +
        this.conn.host + ':' + this.conn.port + this.conn.pathname
      :
        null;

    const prefix = await nodeService.getDir();

    this.node = new WalletNode({
      network: this.networkName,
      nodeHost: this.conn.host,
      nodePort: parseInt(this.conn.port, 10),
      nodeApiKey: this.conn.apiKey,
      nodeSSL: this.conn.protocol === 'https',
      nodeURL,
      apiKey: this.walletApiKey,
      memory: false,
      prefix: prefix,
      logFile: true,
      logConsole: false,
      logLevel: 'debug',
    });

    // If the remote node disconnects for whatever reason,
    // we indicate that in the UI here.
    this.node.client.on('disconnect', () => {
      dispatchToMainWindow({type: STOP});
      dispatchToMainWindow({type: SET_CUSTOM_RPC_STATUS, payload: false});
    });

    this.node.http.post('/unsafe-update-account-depth', this.handleUnsafeUpdateAccountDepth);

    this.node.wdb.on('error', e => {
      console.error('walletdb error', e);
    });

    this.node.wdb.on('block connect', this.onNewBlock);

    await this.node.open();

    this.client = new WalletClient({
      network,
      port: network.walletPort,
      apiKey: this.walletApiKey,
      timeout: 10000,
    });

    const wallets = await this.listWallets();
    dispatchToMainWindow({
      type: SET_WALLETS,
      payload: createPayloadForSetWallets(wallets),
    });

  };

  _onNodeStop = async () => {
    // Wallet as plugin is closed by the full node closing,
    // otherwise we close manually.
    if (this.conn.type === ConnectionTypes.Custom)
      await this.node.close();

    this.node = null;
    this.client = null;
    this.didSelectWallet = false;
    this.conn = {type: null};
  };

  isReady = async () => {
    let attempts = 0;
    return new Promise((resolve, reject) => {
      setInterval(() => {
          if (this.node && this.node.wdb.db.loaded) {
            resolve(this.node.wdb.network.type);
          } else {
            attempts++;
            if (attempts > 10)
              reject();
          }
        },
        500
      );
    });
  };

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

  hasAddress = async (address) => {
    if (!this.name) return false;
    const wallet = await this.node.wdb.get(this.name);
    if (!wallet) return null;

    return wallet.hasPath(new Address(address, this.network));
  };

  getWalletInfo = async () => {
    await this._ensureClient();
    return this.client.getInfo(this.name);
  };

  getAccountInfo = async () => {
    if (!this.name) return null;
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
    const wallet = await this.node.wdb.get(this.name);
    return wallet.getCoin(Buffer.from(hash, 'hex'), index);
  };

  getTX = async (hash) => {
    const wallet = await this.node.wdb.get(this.name);
    return wallet.getTX(Buffer.from(hash, 'hex'));
  };

  getNames = async () => {
    const wallet = await this.node.wdb.get(this.name);
    return wallet.getNames();
  };

  getPublicKey = async (address) => {
    const wallet = await this.node.wdb.get(this.name);
    return wallet.getKey(address);
  };

  /**
   * Remove wallet by wid
   * @param wid
   * @return {Promise<void>}
   */
  removeWalletById = async (wid) => {
    await this.node.wdb.remove(wid);
    this.setWallet(this.name === wid ? null : this.name);

    const wallets = await this.listWallets();

    dispatchToMainWindow({
      type: SET_WALLETS,
      payload: createPayloadForSetWallets(wallets),
    });
  };

  createNewWallet = async (
    name,
    passphrase,
    isLedger,
    xPub,
    m,
    n
  ) => {
    this.setWallet(name);

    let res;
    if (isLedger) {
      res = await this.node.wdb.create({
        id: name,
        passphrase,
        watchOnly: true,
        accountKey: xPub,
        m,
        n,
      });
    } else {
      const mnemonic = new Mnemonic({bits: 256});
      res = await this.node.wdb.create({
        id: name,
        passphrase,
        watchOnly: false,
        mnemonic: mnemonic.getPhrase().trim(),
        m,
        n,
      });
    }

    const wallets = await this.listWallets();
    dispatchToMainWindow({
      type: SET_WALLETS,
      payload: createPayloadForSetWallets(wallets, name),
    });

    return res.getJSON();
  };

  encryptWallet = async (name, passphrase) => {
    this.setWallet(name);

    const res = await this._executeRPC('encryptwallet', [passphrase]);

    const wallets = await this.listWallets();
    dispatchToMainWindow({
      type: SET_WALLETS,
      payload: createPayloadForSetWallets(wallets, name),
    });

    return res;
  };

  backup = async (path) => {
    if (!path) throw new Error('Path is required.');
    return this.node.wdb.backup(path);
  };

  rescan = async (height = 0) => {
    this.heightBeforeRescan = this.lastKnownChainHeight;
    this.lastKnownChainHeight = height;

    dispatchToMainWindow({type: START_SYNC_WALLET});
    dispatchToMainWindow({
      type: SYNC_WALLET_PROGRESS,
      payload: height,
    });
    dispatchToMainWindow({
      type: SET_RESCAN_HEIGHT,
      payload: this.heightBeforeRescan,
    });

    return this.node.wdb.rescan(height);
  };

  deepClean = async () => {
    return this.node.wdb.deepClean();
  };

  importSeed = async (name, passphrase, type, secret, m, n) => {
    this.setWallet(name);

    const options = {
      id: name,
      passphrase,
      m,
      n,
    };
    switch (type) {
      case 'phrase':
        options.mnemonic = secret.trim();
        break;
      case 'xpriv':
        options.master = secret.trim();
        break;
      case 'master':
        const data = secret.master;
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
        options.master = await mk.unlock(secret.passphrase, 10)
        assert(options.master, 'Could not decrypt key.')
        break;
      default:
        throw new Error('Invalid type.')
    }

    const res = await this.node.wdb.create(options);
    const wallets = await this.listWallets();

    dispatchToMainWindow({
      type: SET_WALLETS,
      payload: createPayloadForSetWallets(wallets, name),
    });

    return res.getJSON();
  };

  generateReceivingAddress = async () => {
    await this._ensureClient();
    return this.client.createAddress(this.name, 'default');
  };

  getAuctionInfo = async (name) => {
    return this._executeRPC('getauctioninfo', [name]);
  };

  getTransactionHistory = async () => {
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
    const wallet = await this.node.wdb.get(this.name);
    return wallet.getPending('default');
  };

  makeBidsFilter = async (bids = []) => {
    const index = {
      [NAME_STATES.OPENING]: [],
      [NAME_STATES.BIDDING]: [],
      [NAME_STATES.REVEAL]: [],
      [NAME_STATES.CLOSED]: [],
      [NAME_STATES.TRANSFER]: [],
    };

    const map = {};

    const wallet = await this.node.wdb.get(this.name);

    for (let i = 0; i < bids.length; i++) {
      const bid = bids[i];
      const name = bid.name.toString('utf-8');

      let json;

      if (map[name]) {
        json = map[name];
      } else {
        const ns = await wallet.getNameStateByName(name);
        json = ns?.getJSON(this.lastKnownChainHeight, this.network);
        map[name] = json;
      }

      const { state } = json || {};

      switch (state) {
        case NAME_STATES.OPENING:
        case NAME_STATES.BIDDING:
        case NAME_STATES.REVEAL:
        case NAME_STATES.CLOSED:
        case NAME_STATES.TRANSFER:
          index[state].push(bid.prevout.hash.toString('hex') + bid.prevout.index);
          break;
      }
    }

    return index;
  };

  getBids = async () => {
    const wallet = await this.node.wdb.get(this.name);
    const bids = await wallet.getBids();
    const filter = await this.makeBidsFilter(bids);
    return {bids, filter};
  };

  getBlind = async (blind) => {
    const wallet = await this.node.wdb.get(this.name);
    return wallet.getBlind(Buffer.from(blind, 'hex'));
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
      await mk.unlock(passphrase, 10);

      let phrase;
      let phraseMatchesKey = false;
      if (mk.mnemonic) {
        phrase = mk.mnemonic.getPhrase();
        phraseMatchesKey = mk.key.equals(
          HDPrivateKey.fromMnemonic(mk.mnemonic)
        );
      }
      const xpriv = mk.key.xprivkey(this.networkName);

      return {phrase, xpriv, phraseMatchesKey, master: data};
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

  createClaim = async (name) => {
    return this._executeRPC('createclaim', [name])
  }

  sendClaim = async (name) => {
    return this._executeRPC('sendclaim', [name])
  }

  sendOpen = (name) => this._walletProxy(
    () => this._executeRPC('createopen', [name])
  );

  sendBid = (name, amount, lockup) => this._walletProxy(
    () => this._executeRPC(
      'createbid',
      [name, Number(displayBalance(amount)), Number(displayBalance(lockup))],
    ),
  );

  sendRegister = (name) => this._walletProxy(
    () => this._executeRPC('createupdate', [name, {records: []}]),
  );

  sendUpdate = (name, json) => this._walletProxy(
    () => this._executeRPC('createupdate', [name, json]),
  );

  sendReveal = (name) => this._walletProxy(
    () => this._executeRPC('createreveal', [name]),
  );

  sendRedeem = (name) => this._walletProxy(
    () => this._executeRPC('createredeem', [name]),
  );

  sendRegisterAll = async () => {
    const {wdb} = this.node;
    const wallet = await wdb.get(this.name);

    const names = await getNamesForRegisterAll(wallet);
    if (!names.length) {
      throw new Error('Nothing to do.');
    }
    const actions = names.map(name => ['UPDATE', name, {records: []}]);

    // Chunk into multiple batches to stay within consensus limits
    const chunkedActions = [];
    const chunkSize = consensus.MAX_BLOCK_RENEWALS / 6;
    for(let i = 0; i < actions.length; i += chunkSize) {
      chunkedActions.push(actions.slice(i, i + chunkSize));
    }

    // Only call once now, see later about repeated calls
    return this._walletProxy(
      () => this._executeRPC('createbatch', [chunkedActions[0], {paths: true}]),
    );
  };

  transferMany = async (names, address) => {
    if (!names.length) {
      throw new Error('Nothing to do.');
    }
    const actions = names.map(name => ['TRANSFER', name, address]);

    // Chunk into multiple batches to stay within consensus limits
    const chunkedActions = [];
    const chunkSize = consensus.MAX_BLOCK_UPDATES / 6;
    for(let i = 0; i < actions.length; i += chunkSize) {
      chunkedActions.push(actions.slice(i, i + chunkSize));
    }

    // Only call once now, see later about repeated calls
    return this._walletProxy(
      () => this._executeRPC('createbatch', [chunkedActions[0], {paths: true}]),
    );
  };

  finalizeAll = async () => {
    // Only call once now, see later about repeated calls
    return this._walletProxy(
      () => this._executeRPC('createbatch', [[['FINALIZE']], {paths: true}]),
    );
  }

  // not used, but can be in the future
  finalizeMany = async (names) => {
    if (!names.length) {
      throw new Error('Nothing to do.');
    }
    const actions = names.map(name => ['FINALIZE', name]);

    // Chunk into multiple batches to stay within consensus limits
    const chunkedActions = [];
    const chunkSize = consensus.MAX_BLOCK_RENEWALS / 6;
    for(let i = 0; i < actions.length; i += chunkSize) {
      chunkedActions.push(actions.slice(i, i + chunkSize));
    }

    // Only call once now, see later about repeated calls
    return this._walletProxy(
      () => this._executeRPC('createbatch', [chunkedActions[0], {paths: true}]),
    );
  }

  renewAll = async () => {
    // Only call once now, see later about repeated calls
    return this._walletProxy(
      () => this._executeRPC('createbatch', [[['RENEW']], {paths: true}]),
    );
  }

  // not used, but can be in the future
  renewMany = async (names) => {
    if (!names.length) {
      throw new Error('Nothing to do.');
    }
    const actions = names.map(name => ['RENEW', name]);

    // Chunk into multiple batches to stay within consensus limits
    const chunkedActions = [];
    const chunkSize = consensus.MAX_BLOCK_RENEWALS / 6;
    for(let i = 0; i < actions.length; i += chunkSize) {
      chunkedActions.push(actions.slice(i, i + chunkSize));
    }

    // Only call once now, see later about repeated calls
    return this._walletProxy(
      () => this._executeRPC('createbatch', [chunkedActions[0], {paths: true}]),
    );
  }

  sendRevealAll = async () => {
    // Only call once now, see later about repeated calls
    return this._walletProxy(
      () => this._executeRPC('createbatch', [[['REVEAL']], {paths: true}]),
    );
  }

  sendRedeemAll = async () => {
    // Only call once now, see later about repeated calls
    return this._walletProxy(
      () => this._executeRPC('createbatch', [[['REDEEM']], {paths: true}]),
    );
  }

  sendRenewal = (name) => this._walletProxy(
    () => this._executeRPC('createrenewal', [name]),
  );

  sendTransfer = (name, recipient) => this._walletProxy(
    () => this._executeRPC('createtransfer', [name, recipient]),
  );

  cancelTransfer = (name) => this._walletProxy(
    () => this._executeRPC('createcancel', [name]),
  );

  finalizeTransfer = (name) => this._walletProxy(
    () => this._executeRPC('createfinalize', [name]),
  );

  revokeName = (name) => this._walletProxy(
    () => this._executeRPC('createrevoke', [name]),
  );

  send = (to, amount, fee) => this._walletProxy(
    async () => {
      await this._executeRPC('settxfee', [Number(fee)]);
      // createsendtoaddress: "address" amount "comment" "comment-to" subtractfeefromamount "account"
      return this._executeRPC('createsendtoaddress', [to, Number(amount), '', '', false, 'default']);
    },
  );

  signMessageWithName = (name, message) => this._ledgerDisabled(
    'method is not supported on ledger yet',
    () => {
      return this._executeRPC('signmessagewithname', [name, message], this.lock);
    }
  );

  lock = () => {
    return this.client.lock(this.name);
  };

  unlock = (name, passphrase) => {
    this.setWallet(name);
    return this.client.unlock(this.name, passphrase);
  };

  isLocked = async () => {
    const info = await this.getWalletInfo();

    // Ledger is always "unlocked"
    if (info.watchOnly) {
      return false;
    }

    return info === null || info.master.until === 0;
  }

  addSharedKey = async (account, xpub) => {
    return this.client.addSharedKey(this.name, account, xpub);
  };

  removeSharedKey = async (account, xpub) => {
    return this.client.removeSharedKey(this.name, account, xpub);
  };

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

  importName = async (name, start) => {
    await this._executeRPC('importname', [name, null]);

    // wait 1 sec (for filterload to update on peer)
    if (this.nodeService.spv) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // rescan
    this.rescan(start);
  };

  rpcGetWalletInfo = async () => {
    return await this._executeRPC('getwalletinfo', []);
  };

  // price is in WHOLE HNS!
  finalizeWithPayment = async (name, fundingAddr, nameReceiveAddr, price) => {

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

    await wallet.template(mtx);

    // Set sighashType for input0
    const type = Script.hashType.SINGLEREVERSE | Script.hashType.ANYONECANPAY;
    const metadata = {
      inputs: [
        {sighashType: type},
      ],
    }

    // Sign transaction
    mtx = await this._walletProxy(
      () => mtx,
      {
        broadcast: false,
        returnOnlyIfFullySigned: false,
        ledgerOptions: {includeLedgerInputs: true},
        metadata,
      }
    );

    // Check if input0 is signed
    // (if partially signed multisig, return null)
    try {
      mtx.checkInput(0, coin, type);
    } catch (error) {
      return null;
    }

    return mtx.encode().toString('hex');
  };

  claimPaidTransfer = async (txHex) => {
    const {wdb} = this.node;
    const wallet = await wdb.get(this.name);
    let mtx = MTX.decode(Buffer.from(txHex, 'hex'));

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

    await wallet.template(mtx);

    // Sign & Broadcast
    // Bob uses SIGHASHALL. The final TX looks like this:
    //
    // input 0: TRANSFER UTXO --> output 0: FINALIZE covenant
    // input 1: Bob's funds   --- output 1: change to Bob
    //                 (null) --- output 2: payment to Alice

    // With ledger: even though we are signing with SIGHASH_ALL,
    // we still need to provide Ledger with an array of input
    // data, or else it will try to sign all inputs.
    let ledgerInput;
    {
      const input = mtx.inputs[1]
      const coin = mtx.view.getCoinFor(input);
      const key = await wallet.getKey(coin.address);
      const path =
        'm/' +                                    // master
        '44\'/' +                                 // purpose
        `${this.network.keyPrefix.coinType}'/` +  // coin type
        `${key.account}'/` +                      // should be 0 ("default")
        `${key.branch}/` +                        // should be 1 (change)
        `${key.index}`;
      ledgerInput = new LedgerInput({
        index: 1,
        input,
        coin,
        path,
        publicKey: key.publicKey,

        // only provide redeem script
        // if funding input is not a p2pkh
        redeem: key.script ? key.script : null,
      })
    }

    mtx = await this._walletProxy(
      () => mtx,
      {
        returnOnlyIfFullySigned: false,
        ledgerOptions: {inputs: [ledgerInput]}
      }
    );

    // Broadcast if mtx is fully signed
    // (if partially signed multisig, return null)
    if (mtx.verify()) {
      await this.nodeService.broadcastRawTx(mtx.toHex());
      return mtx;
    }

    return null;
  };

  /**
   * Load Transaction (multisig)
   * @param {object} tx JSON object of a tx
   * @param {Metadata} metadata
   * @returns mtx
   */
  loadTransaction = async (tx, metadata) => {
    return this._walletProxy(() => tx, {metadata});
  }

  /**
   * List Wallets
   * @return {Promise<[object]>}
   */
  listWallets = async () => {
    const wdb = this.node.wdb;
    const wallets = await wdb.getWallets();
    const ret = [];

    for (const wid of wallets) {
      const wallet = await wdb.get(wid);
      const account = await wallet.getAccount('default');
      const {master: {encrypted}, watchOnly} = wallet;
      const {type} = account;

      const suffixes = [];
      if (watchOnly)
        suffixes.push('Ledger');
      if (type === Account.types.MULTISIG)
        suffixes.push('Multisig');

      const displayName = suffixes.length ? `${wid} (${suffixes.join(', ')})` : wid;
      ret.push({ wid, encrypted, watchOnly, type, displayName });
    }

    return ret;
  };

  getStats = async () => {
    const {wdb} = this.node;
    const wallet = await wdb.get(this.name);
    return getStats(wallet);
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

  findNonce = async (options) => {
    const {name, address, expectedBlind, rangeStart, rangeEnd, precision} = options;

    await this._ensureClient();

    const nameHash = hashName(name);
    const from = Address.fromString(address, this.network)
    const wallet = await this.node.wdb.get(this.name);

    this.findNonceStop = false;
    dispatchToMainWindow({
      type: SET_FIND_NONCE_PROGRESS,
      payload: {
        expectedBlind: expectedBlind,
        progress: 0,
        isFinding: true,
        found: false,
        bidValue: rangeStart,
      },
    });

    const maxAttempts = (rangeEnd - rangeStart) / 10**(6-precision) + 1;
    let counter = 0;

    for (let value = rangeStart; value <= rangeEnd; value += 10**(6-precision)) {

      // Stop on cancel
      if (this.findNonceStop) {
        this.findNonceStop = false;
        return null;
      };

      if (counter % 10000 === 0) {
        const progress = (counter/maxAttempts)*100;
        dispatchToMainWindow({
          type: SET_FIND_NONCE_PROGRESS,
          payload: {
            expectedBlind: expectedBlind,
            progress: progress,
            isFinding: true,
            found: false,
            bidValue: value,
          },
        });
      }

      counter++;

      const nonce = await wallet.generateNonce(nameHash, from, value);
      const blind = Rules.blind(value, nonce).toString('hex');

      if (blind === expectedBlind) {
        const progress = (counter/maxAttempts)*100;
        dispatchToMainWindow({
          type: SET_FIND_NONCE_PROGRESS,
          payload: {
            expectedBlind: expectedBlind,
            progress: progress,
            isFinding: false,
            found: true,
            bidValue: value,
          },
        });
        return value;
      }
    }

    // Could not find value
    dispatchToMainWindow({
      type: SET_FIND_NONCE_PROGRESS,
      payload: {
        expectedBlind: expectedBlind,
        progress: 100,
        isFinding: false,
        found: false,
        bidValue: null,
      },
    });
    return null;
  }

  findNonceCancel = async () => {
    this.findNonceStop = true;

    dispatchToMainWindow({
      type: SET_FIND_NONCE_PROGRESS,
      payload: {
        expectedBlind: '',
        progress: -1,
        isFinding: false,
        found: false,
        bidValue: null,
      },
    });
  }

  refreshWalletInfo = async () => {
    if (!this.name) return;

    const accountInfo = await this.getAccountInfo();

    if (!accountInfo) return;

    dispatchToMainWindow({
      type: SET_BALANCE,
      payload: accountInfo.balance,
    });
  };

  onNewBlock = async (entry) => {
    await this._ensureClient();

    this.lastKnownChainHeight = entry.height;

    // If wallet rescanning, and has reached
    // height before rescan start, the stop sync.
    if (
      this.heightBeforeRescan !== null
      && this.heightBeforeRescan <= entry.height
    ) {
      // Stop sync
      dispatchToMainWindow({type: STOP_SYNC_WALLET});
      dispatchToMainWindow({
        type: SYNC_WALLET_PROGRESS,
        payload: entry.height,
      });

      // Reset rescan height
      this.heightBeforeRescan = null;
      dispatchToMainWindow({
        type: SET_RESCAN_HEIGHT,
        payload: null,
      });

      // Refresh wallet info
      await this.refreshWalletInfo();
    }

    // debounce for 500 msec
    const now = Date.now();
    if (now - this.lastProgressUpdate > 500) {
      dispatchToMainWindow({
        type: SYNC_WALLET_PROGRESS,
        payload: entry.height,
      });
      await this.refreshWalletInfo();
      this.lastProgressUpdate = now;
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

  /**
   * Wallet Proxy
   * Parses the tx and routes it to signers
   * for hot/ledger, pkh/multisig
   * @param {function} createFn function that returns an mtx
   * @param {object} options options
   * @param {boolean} options.broadcast broadcast tx after sign?
   * @param {boolean} options.returnOnlyIfFullySigned return null if incomplete sigs
   * @param {object} options.ledgerOptions options passed to ledgerProxy
   * @param {Metadata} options.metadata extra info about inputs and outputs
   * @returns {import('hsd/lib/primitives/mtx').MTX | null} mtx or null
   */
  _walletProxy = async (createFn, options) => {
    const {
      broadcast = true,
      returnOnlyIfFullySigned = true, // if we don't have all signatures, return null
      ledgerOptions = {},
      metadata = null,
    } = options || {};

    const wallet = await this.node.wdb.get(this.name);
    const info = await this.getWalletInfo();
    const accountInfo = await this.getAccountInfo();

    // Call createFn to get an mtx
    let mtx = await createFn();

    // Coerce into MTX
    if (!(mtx instanceof MTX)) {
      mtx = MTX.fromJSON(mtx);
    }

    // Parse MTX Data
    const parsedMtxData = await this.parseMtx(wallet, mtx, {metadata});
    mtx = parsedMtxData.mtx;  // mtx is modified (adding coins to view, etc.)

    try {
      // Handle multisig (hot and ledger wallets)
      if (parsedMtxData.containsMultisig) {
        // multisigProxy does not really broadcast, it's just for UI
        mtx = await this._multisigProxy(parsedMtxData, {broadcast});
      } else {
        // Not a multisig

        // Handle Ledger wallets (non-multisig)
        if (info.watchOnly && accountInfo.type !== 'multisig') {
          mtx = await this._ledgerProxy(
            mtx,
            {
              ...ledgerOptions,
              sighashTypes: parsedMtxData.metadata.inputs.map(x => x.sighashType),
            }
          );
        } else {
          // Handle hot wallets (non-multisig)
          const rings = await wallet.deriveInputs(mtx);
          const type = parsedMtxData.metadata?.inputs?.[0]?.sighashType ?? Script.hashType.ALL;
          await mtx.sign(rings, type);
        }
      }

      // Validate tx
      let isValid = true;
      try {
        mtx.check();
      } catch (error) {
        isValid = false;
      }

      if (broadcast && isValid) {
        try {
          await this.nodeService.broadcastRawTx(mtx.toHex());
          return mtx;
        } catch (error) {
          console.error(error);
        }
      }

      if (returnOnlyIfFullySigned) {
        if (isValid) return mtx;
        else return null;
      }

      return mtx;
    } finally {
      this.lock();
    }
  }

  /**
   * Parse Transaction
   * @param {import('hsd/lib/wallet/wallet')} wallet
   * @param {import('hsd/lib/primitives/mtx').MTX} mtx
   * @returns {ParsedTxData}
   */
   parseMtx = async (wallet, mtx, {metadata}={}) => {
    const accountInfo = await this.getAccountInfo();
    const allAccountKeys = [accountInfo.accountKey, ...accountInfo.keys];

    // Calculated from mtx, disposable
    const redeemScripts = [];
    const multisigInfo = [];
    const signerData = [];
    let containsMultisig = false;
    let maxSigsNeeded = 0;
    let canAddOwnSig = false;

    // Metadata is first read and verified,
    // and then copied to newMetadata,
    // which is written to tx file
    const newMetadata = {
      inputs: [],
      outputs: [],
    }

    const view = await wallet.getCoinView(mtx);
    mtx.view = await wallet.getWalletCoinView(mtx, view);

    for (const [inputIdx, input] of mtx.inputs.entries()) {
      newMetadata.inputs[inputIdx] = {};
      newMetadata.inputs[inputIdx].sighashType = metadata?.inputs?.[inputIdx]?.sighashType;

      const {witness} = input;
      const script = Script.decode(witness.items[witness.items.length - 1]);
      let [m, n] = script.getMultisig();
      m = m === -1 ? 1 : m;
      n = n === -1 ? 1 : n;

      redeemScripts[inputIdx] = script;
      multisigInfo[inputIdx] = {m, n};

      // Get input coins to derive our known paths
      let coin = mtx.view.getCoinFor(input);

      if (!coin) {
        const coinData = await this.nodeService.getCoin(
          input.prevout.hash.toString('hex'),
          input.prevout.index
        );
        // ensure that coin exists and is still unspent
        assert(coinData, `Could not find coin for input ${inputIdx}; is it already spent?`);
        coin = new Coin();
        coin.fromJSON(coinData, this.networkName);
        mtx.view.addCoin(coin);
      }

      // Handle multisig input
      if (n > 1) {
        containsMultisig = true;

        // {pubKeyInHex: xpub, ...}
        const accountKeysByPubKey = await getMultisigKeys(
          wallet, coin, script, allAccountKeys, this.network
        );

        // Collect signatures from witness
        const signatures = [];
        for (let i = m>1 ? 1 : 0; i < witness.items.length-1; i++) {
          const item = witness.get(i);
          if (item.length !== 0) {
            signatures.push(item);
          }
        }

        let inputHasOwnPubkey = false;
        let inputHasOwnSig = false;

        // Collect signerData
        // (list of pubkeys matched with account keys, and if they have signed)
        signerData[inputIdx] = [];
        for (const [pubKey, accountKey] of Object.entries(accountKeysByPubKey)) {
          const signed = hasKeySigned(
            mtx, inputIdx, coin, script, signatures, Buffer.from(pubKey, 'hex')
          );
          signerData[inputIdx].push({
            pubKey: pubKey,
            accountKey: accountKey,
            signed: signed,
          })
          if (accountKey === accountInfo.accountKey) {
            inputHasOwnPubkey = true;

            if (signed) {
              inputHasOwnSig = true;
            }
          }
        }

        // Sort by account key for nicer UI
        signerData[inputIdx].sort((a, b) => a.accountKey < b.accountKey ? -1 : 1);

        const sigsNeeded = m - signatures.length;
        if (sigsNeeded > maxSigsNeeded) {
          maxSigsNeeded = sigsNeeded;
        }

        if (inputHasOwnPubkey && !inputHasOwnSig) {
          canAddOwnSig = true;
        }
      } else {
        // Not a multisig input

        const addr = input.getAddress();
        if (addr.isScripthash() || addr.isPubkeyhash()) {
          const signed = !!witness.items[0].length;
          const address = coin.address;
          const key = await this.getPublicKey(address);

          // own wallet's coin
          if (key) {
            signerData[inputIdx] = [
              {
                pubKey: key.publicKey, // for consistency, not really needed
                accountKey: accountInfo.accountKey,
                signed: signed,
              },
            ];
            if (!signed) {
              canAddOwnSig = true;
            }
          }

          if (!signed) {
            if (maxSigsNeeded < 1) {
              maxSigsNeeded = 1;
            }
          }
        }
      }
    }

    for (const [outputIdx, output] of mtx.outputs.entries()) {
      newMetadata.outputs[outputIdx] = {};

      /** @type {import('hsd/lib/primitives/covenant')} */
      const covenant = output.covenant;

      if (covenant.isName()) {
        const nameHash = covenant.getHash(0);
        let name = metadata?.outputs?.[outputIdx]?.name;

        // Verify name with tx if given in metadata
        if (name) {
          assert(Rules.verifyName(name), 'Invalid name.');
          const expectedNameHash = hashName(name);
          assert(
            expectedNameHash.equals(nameHash),
            'Name value does not match transaction name hash.'
          );
        } else {
          // Try to find name from tx or node
          if (covenant.isOpen()) {
            name = covenant.getString(2);
          } else {
            name = await this.nodeService.getNameByHash(nameHash.toString('hex'));
          }
        }

        // Sanity check
        assert(name, 'Name not found.');

        newMetadata.outputs[outputIdx].name = name;
      }

      if (covenant.isBid()) {
        // True bid value from tx file (number, in doos)
        const trueBid = metadata?.outputs?.[outputIdx]?.bid;

        // If importing a file which has trueBid, verify and save blind to txdb
        if (trueBid) {
          // Calculate blind
          const nameHash = covenant.get(0);
          const nonce = await wallet.generateNonce(nameHash, output.address, trueBid);
          const blind = Rules.blind(trueBid, nonce);

          // Ensure tx blind matches
          assert(
            blind.equals(covenant.get(3)),
            'Bid value does not match transaction blind.'
          );

          await wallet.txdb.saveBlind(blind, {value: trueBid, nonce});
          newMetadata.outputs[outputIdx].bid = trueBid;
        } else {
          const blindFromTx = covenant.get(3);
          const blindValue = await wallet.getBlind(blindFromTx);
          assert(blindValue, 'Bid value not found.');
          newMetadata.outputs[outputIdx].bid = blindValue.value;
        }
      }
    }

    return {
      mtx,
      redeemScripts,
      multisigInfo,
      signerData,
      containsMultisig,
      maxSigsNeeded,
      canAddOwnSig,

      metadata: newMetadata,
    }
  };

  /**
   * Multisig Proxy
   * Call _walletProxy, not this directly
   * @param {ParsedTxData} parsedTxData
   * @param {object} options
   * @param {boolean} [options.broadcast=true] does not broadcast, only for UI
   * @returns {import('hsd/lib/primitives/mtx').MTX} signed mtx
   */
  _multisigProxy = async (
    parsedTxData,
    {broadcast} = {broadcast: true}
  ) => {
    const wallet = await this.node.wdb.get(this.name);
    const info = await this.getWalletInfo();

    let {mtx, redeemScripts, metadata} = parsedTxData;

    const mainWindow = getMainWindow();
    return new Promise(async (resolve, reject) => {
      const signHandler = async () => {
        try {
          if (info.watchOnly) {
            const ledgerOptions = {
              includeLedgerInputs: true,
              redeemScripts,
              sighashTypes: metadata.inputs.map(x => x.sighashType),
            };
            mtx = await this._ledgerProxy(mtx, ledgerOptions);
          } else {
            const rings = await wallet.deriveInputs(mtx);
            const type = metadata?.inputs?.[0]?.sighashType ?? null;
            await mtx.sign(rings, type);
          }
          // Refresh mtx data after signing
          const parsedMtxData = await this.parseMtx(wallet, mtx, {metadata});
          ({mtx, redeemScripts, metadata} = parsedMtxData);
          mainWindow.send('MULTISIG/SHOW', {
            tx: await this.injectOutputPaths(wallet, mtx.getJSON(this.network)),
            ...parsedMtxData,
            broadcast,
          });
        } catch (error) {
          console.error(error);
          mainWindow.send('MULTISIG/ERR', error.message);
        }
      }
      const continueHandler = async () => {
        mainWindow.send('MULTISIG/OK');
        ipc.removeListener('MULTISIG/SIGN', signHandler);
        ipc.removeListener('MULTISIG/CONTINUE', continueHandler);
        ipc.removeListener('MULTISIG/CANCEL', cancelHandler);
        resolve(mtx);
      }
      const cancelHandler = () => {
        // User has given up, inform the calling function.
        reject(new Error('Cancelled.'));

        // These messages go to the Multisig modal
        ipc.removeListener('MULTISIG/SIGN', signHandler);
        ipc.removeListener('MULTISIG/CONTINUE', continueHandler);
        ipc.removeListener('MULTISIG/CANCEL', cancelHandler);
      };
      ipc.on('MULTISIG/SIGN', signHandler);
      ipc.on('MULTISIG/CONTINUE', continueHandler);
      ipc.on('MULTISIG/CANCEL', cancelHandler);
      mainWindow.send('MULTISIG/SHOW', {
        tx: await this.injectOutputPaths(wallet, mtx.getJSON(this.network)),
        ...parsedTxData,
        broadcast,
      });
    })
  }

  /**
   * Ledger Proxy
   * Call _walletProxy, not this directly
   * @param {import('hsd/lib/primitives/mtx').MTX} mtx
   * @param {object} ledgerOptions
   * @param {LedgerInput[]} ledgerOptions.inputs
   * @param {boolean} [ledgerOptions.includeLedgerInputs=false] replaces inputs with generated Linputs
   * @param {Script[]=} ledgerOptions.redeemScripts replaces inputs with generated Linputs
   * @param {Script.hashType[]=} ledgerOptions.sighashTypes array of sighash types indexed by input number
   * @returns {import('hsd/lib/primitives/mtx').MTX} signed mtx
   */
  _ledgerProxy = async (mtx, ledgerOptions) => {
    const wallet = await this.node.wdb.get(this.name);
    const accountInfo = await this.getAccountInfo();

    // Prepare extra TX data for Ledger.
    // Unfortunately the MTX returned from the wallet.create____()
    // functions does not include what we need, so we have to compute it.
    const options = {};
    if (ledgerOptions) {
      Object.assign(options, ledgerOptions);
    }

    if (options.includeLedgerInputs) {
      options.inputs = await this._ledgerInputs(
        wallet, mtx, options.sighashTypes, options.redeemScripts
      );
    }

    for (let index = 0; index < mtx.outputs.length; index++) {
      const output = mtx.outputs[index];

      // The user does not have to verify change outputs on the device.
      // What we do is pass metadata about the change output to Ledger,
      // and the app will verify the change address belongs to the wallet.
      const address = output.address;
      const key = await this.getPublicKey(address);

      if (!key)
        continue;

      if (key.branch === 1 && accountInfo.type !== 'multisig') {
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
          const name = await this.nodeService.getNameByHash(hash.toString('hex'));

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

          mainWindow.send('LEDGER/CONNECT_OK');
          ipc.removeListener('LEDGER/CONNECT_RES', resHandler);
          ipc.removeListener('LEDGER/CONNECT_CANCEL', cancelHandler);
          resolve(retMtx);
        } catch (e) {
          console.error(e);
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
  };

  _ledgerDisabled = async (message, fn) => {
    const info = await this.getWalletInfo();
    if (info.watchOnly) {
      throw new Error(message);
    }

    return fn();
  };

  async _ledgerInputs(wallet, tx, sighashTypes = [], redeemScripts = []) {
    // For mtx created in Bob (instead of hsd), the inputs don't include
    // path, so they need to be recreated as LedgerInput
    const ledgerInputs = [];

    for (const [idx, input] of tx.inputs.entries()) {
      const coin = await wallet.getCoin(input.prevout.hash, input.prevout.index);
      if (!coin) continue;
      const key = await wallet.getKey(coin.address);
      if (!key) continue;
      const publicKey = key.publicKey;
      const path =
        'm/' +                                    // master
        '44\'/' +                                 // purpose
        `${this.network.keyPrefix.coinType}'/` +  // coin type
        `${key.account}'/` +                      // should be 0 ("default")
        `${key.branch}/` +                        // should be 1 (change)
        `${key.index}`;
      const ledgerInput = new LedgerInput({
        publicKey,
        path,
        coin,
        input,
        index: idx,
        type: sighashTypes[idx] ?? Script.hashType.ALL,
        redeem: redeemScripts[idx] ?? undefined,
      })
      ledgerInputs.push(ledgerInput)
    }
    return ledgerInputs;
  }

  async _executeRPC(method, args, cb) {
    await this._selectWallet();
    const res = await this.client.execute(method, args);
    if (cb) cb(res);
    return res;
  }

  // Can be removed when hsd starts adding path to output.getJSON()
  async injectOutputPaths(wallet, mtxJSON) {
  if (!mtxJSON?.outputs?.length) return;

  for (const output of mtxJSON.outputs) {
    const {address} = output;
    if (address) {
      output.path = await wallet.getPath(new Address(address, this.networkName));
    }
  }

  return mtxJSON;
}
}

/*
 * UTILITY FUNCTIONS
 */

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

function assert(value, msg) {
  if (!value) {
    throw new Error(msg || 'Assertion failed.');
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

  // array of objects to an object with wid as key
  const walletsDetails = wallets.reduce((obj, wallet) => {
    obj[wallet.wid] = wallet;
    return obj;
  }, {});

  // Remove unencrypted wids from state.wallet.wallets,
  // but not objects from state.wallet.walletsDetails
  wids = wids.filter(
    (wid) => walletsDetails[wid].encrypted || walletsDetails[wid].watchOnly
  );

  if (addName !== null) {
    wids = uniq([...wids, addName]);
  }

  return {
    wallets: wids,
    walletsDetails,
  };
}

/**
 * Get Multisig Keys
 * @param {import('hsd/lib/wallet/wallet')} wallet
 * @param {import('hsd/lib/primitives/coin')} coin
 * @param {import('hsd/lib/script/script')} script
 * @param {string[]} accountKeys
 * @param {import('hsd/lib/protocol/network')|string} network
 * @returns {object} account keys by public key
 */
async function getMultisigKeys(wallet, coin, script, accountKeys, network) {
  const address = coin.address;
  const path = await wallet.getPath(address.hash);

  // key: public key in hex
  // value: account key (string|null)
  const accountKeysByPubKey = {};

  const n = script.getSmall(-2);
  for (let i = 1; i <= n; i++) {
    const key = script.getData(i);
    const keyHex = key.toString('hex');
    accountKeysByPubKey[keyHex] = null;

    // If no path, then we can't derive pubKeys to match to xpub.
    // This is possible when the coin is not from our wallet
    if (!path) {
      continue;
    }

    for (const accountKey of accountKeys) {
      const derivedKey = HDPublicKey
        .fromBase58(accountKey, network)
        .derive(path.branch)
        .derive(path.index);
      if (derivedKey.publicKey.equals(key)) {
        accountKeysByPubKey[keyHex] = accountKey;
        break;
      }
    }
  }

  return accountKeysByPubKey;
}

function hasKeySigned(mtx, inputIdx, coin, script, signatures, key) {
  for (const sig of signatures) {
    const type = sig[sig.length - 1];
    const hash = mtx.signatureHash(
      inputIdx,
      script,
      coin.value,
      type
    );
    const res = secp256k1.verify(hash, sig.slice(0, -1), key);

    if (res) {
      return true;
    }
  }

  return false;
}

/*
 * EXPORT
 */

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
  getBlind: service.getBlind,
  getMasterHDKey: service.getMasterHDKey,
  hasAddress: service.hasAddress,
  setPassphrase: service.setPassphrase,
  revealSeed: service.revealSeed,
  estimateTxFee: service.estimateTxFee,
  estimateMaxSend: service.estimateMaxSend,
  removeWalletById: service.removeWalletById,
  updateAccountDepth: service.updateAccountDepth,
  findNonce: service.findNonce,
  findNonceCancel: service.findNonceCancel,
  encryptWallet: service.encryptWallet,
  backup: service.backup,
  rescan: service.rescan,
  deepClean: service.deepClean,
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
  finalizeAll: service.finalizeAll,
  finalizeMany: service.finalizeMany,
  renewAll: service.renewAll,
  renewMany: service.renewMany,
  sendTransfer: service.sendTransfer,
  cancelTransfer: service.cancelTransfer,
  finalizeTransfer: service.finalizeTransfer,
  finalizeWithPayment: service.finalizeWithPayment,
  claimPaidTransfer: service.claimPaidTransfer,
  signMessageWithName: service.signMessageWithName,
  revokeName: service.revokeName,
  send: service.send,
  lock: service.lock,
  unlock: service.unlock,
  isLocked: service.isLocked,
  addSharedKey: service.addSharedKey,
  removeSharedKey: service.removeSharedKey,
  getNonce: service.getNonce,
  importNonce: service.importNonce,
  zap: service.zap,
  importName: service.importName,
  rpcGetWalletInfo: service.rpcGetWalletInfo,
  loadTransaction: service.loadTransaction,
  listWallets: service.listWallets,
  getStats: service.getStats,
  isReady: service.isReady,
  createClaim: service.createClaim,
  sendClaim: service.sendClaim,
};

export async function start(server) {
  server.withService(sName, methods);
}


/**
 * @typedef MultisigInfo
 * @type {object}
 * @property {number} m
 * @property {number} n
 */

/**
 * @typedef SignerData
 * @type {object}
 * @property {string} pubKey as hex string
 * @property {string} accountKey xpub string
 * @property {boolean} signed if key has signed tx
 */

/**
 * @typedef MetadataInput
 * @type {object}
 * @property {Script.hashType} sighashType
 */
/**
 * @typedef MetadataOutput
 * @type {object}
 * @property {string=} name name if covenant
 * @property {number=} bid true bid value if BID output
 */
/**
 * @typedef Metadata
 * @type {object}
 * @property {MetadataInput[]} inputs
 * @property {MetadataOutput[]} outputs
 */

/**
 * @typedef ParsedTxData
 * @type {object}
 * @property {import('hsd/lib/primitives/mtx').MTX} mtx
 * @property {Script[]} redeemScripts scripts for each input
 * @property {MultisigInfo[]} multisigInfo m and n for each input
 * @property {SignerData[]} multisigInfo signer data for each input
 * @property {boolean} containsMultisig has at least one multisig input?
 * @property {number} maxSigsNeeded max number of sigs needed across all inputs
 * @property {boolean} canAddOwnSig has own pubkey but not signed yet?
 * @property {Metadata} metadata extra info about inputs and outputs
 */
