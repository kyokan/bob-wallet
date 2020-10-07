import { WalletClient } from 'hs-client';
import { displayBalance, toBaseUnits, toDisplayUnits } from '../../utils/balances';
import { service as nodeService } from '../node/service';
import BigNumber from 'bignumber.js';
import { NETWORKS } from '../../constants/networks';
import path from 'path';
import { app } from 'electron';
import rimraf from 'rimraf';
import {ConnectionTypes, getConnection, getCustomRPC} from '../connections/service';
import crypto from 'crypto';
import { dispatchToMainWindow } from '../../mainWindow';
import {SET_WALLET_HEIGHT, START_SYNC_WALLET, STOP_SYNC_WALLET, SYNC_WALLET_PROGRESS} from '../../ducks/walletReducer';
import {SET_FEE_INFO, SET_NODE_INFO} from "../../ducks/nodeReducer";
import {setSyncWalletText} from "../../ducks/walletActions";
import {addHeader, getAddresses, getHeader, setAddresses} from "../db/service";
const WalletNode = require('hsd/lib/wallet/node');
const TX = require('hsd/lib/primitives/tx');
const {Output, MTX, Address, Coin} = require('hsd/lib/primitives');
const Script = require('hsd/lib/script/script');
const {hashName, types} = require('hsd/lib/covenants/rules');
const MasterKey = require('hsd/lib/wallet/masterkey');
const Mnemonic = require('hsd/lib/hd/mnemonic');
const Covenant = require('hsd/lib/primitives/covenant');
const rules = require('hsd/lib/covenants/rules');
const ChainEntry = require("hsd/lib/blockchain/chainentry");
const BN = require('bcrypto/lib/bn.js');
const layout = require('hsd/lib/wallet/layout').txdb;


const WALLET_ID = 'allison';
const randomAddrs = {
  [NETWORKS.TESTNET]: 'ts1qfcljt5ylsa9rcyvppvl8k8gjnpeh079drfrmzq',
  [NETWORKS.REGTEST]: 'rs1qh57neh8npuxeyxfsl35373vshs0d40cvxx57aj',
  [NETWORKS.MAINNET]: 'hs1q5e06h2fcwx9sx38k6skzwkzmm54meudhphkytx',
  [NETWORKS.SIMNET]: 'ss1qfrfg6pg7emnx5m53zf4fe24vdtt8thljhyekhj',
};

const HSD_DATA_DIR = path.join(app.getPath('userData'), 'hsd_data');

class WalletService {
  constructor() {
    nodeService.on('started', this._onNodeStart);
    nodeService.on('stopped', this._onNodeStop);
    this.nodeService = nodeService;
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

      await wait(5000);

      await this._onNodeStart(
        this.networkName,
        this.network,
        this.apiKey,
      );

      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  getAPIKey = async () => {
    await this._ensureClient();
    return this.walletApiKey;
  };

  getWalletInfo = async () => {
    await this._ensureClient();
    return this.client.getInfo(WALLET_ID);
  };

  getWalletHeight = async () => {
    await this._ensureClient();
    const state = await this.node.wdb.getState();
    return state && state.height;
  };

  getAccountInfo = async () => {
    await this._ensureClient();
    return this.client.getAccount(WALLET_ID, 'default');
  };

  getCoin = async (hash, index) => {
    await this._ensureClient();
    const wallet = await this.node.wdb.get(WALLET_ID);
    return wallet.getCoin(Buffer.from(hash, 'hex'), index);
  };

  getNames = async () => {
    await this._selectWallet();
    const wallet = await this.node.wdb.get(WALLET_ID);
    return wallet.getNames();
  };

  createNewWallet = async (passphraseOrXPub, isLedger) => {
    await this._ensureClient();

    await this.reset();
    this.didSelectWallet = false;

    if (isLedger) {
      return this.client.createWallet(WALLET_ID, {
        watchOnly: true,
        accountKey: passphraseOrXPub,
      });
    }

    const mnemonic = new Mnemonic({bits: 256});
    const options = {
      passphrase: passphraseOrXPub,
      witness: false,
      watchOnly: false,
      mnemonic: mnemonic.getPhrase(),
    };

    await this.client.createWallet(WALLET_ID, options);

    const wallet = await this.node.wdb.get(WALLET_ID);
    await wallet.setLookahead('default', 10000);
    setTimeout(() => this.rescan(0), 1000);
  };

  getAddresses = async (depth = 10000) => {
    await this._ensureClient();

    const cache = await getAddresses(this.networkName, WALLET_ID);

    if (cache) return cache;

    const wdb = this.node.wdb;
    const wallet = await wdb.get(WALLET_ID);
    const account = await wallet.getAccount('default');

    const addresses = Array(depth)
      .fill(0)
      .map((_, i) => {
        const receive = account.deriveReceive(i).getAddress().toString();
        const change = account.deriveChange(i).getAddress().toString();
        return [receive, change];
      })
      .reduce((acc, [receive, change]) => {
        acc.push(receive);
        acc.push(change);
        return acc;
      }, []);

    await setAddresses(this.networkName, WALLET_ID, addresses);

    return addresses;
  };

  getNameStateByName = async (name)  => {
    const wallet = await this.node.wdb.get(WALLET_ID);
    const height = this.node.wdb.height;
    const network = this.network;
    const ns = await wallet.getNameStateByName(name);
    const nameHash = rules.hashName(name);
    const reserved = rules.isReserved(nameHash, height + 1, network);
    const [start, week] = rules.getRollout(nameHash, network);
    let info;

    return {
      start: {
        reserved: reserved,
        week: week,
        start: start
      },
      info: ns.getJSON(height, network),
    };
  };

  getBlockHeader = async (hash) => {
    try {
      const wdb = this.node.wdb;
      const res = await wdb.client.getBlockHeader(hash);
      return res;
    } catch (e) {
      return null;
    }
  };

  getHashes = async (start, end) => {
    const wdb = this.node.wdb;
    return wdb.client.getHashes(start, end);
  };

  getTX = async (txHash) => {
    await this._ensureClient();
    const wallet = await this.node.wdb.get(WALLET_ID);
    return wallet.getTX(Buffer.from(txHash, 'hex'));
  };

  getEntriesByBlocks = async (blocks = []) => {
    const {type} = await getConnection();
    const {apiKey, url} = await getCustomRPC();

    if (type === ConnectionTypes.Custom) {
      // try {
      //   throw new Error('yo')
      //   const {protocol, host, pathname} = new URL(url);
      //
      //   const res = await fetch(
      //     `${protocol}//x:${apiKey}@${host}${pathname}/entry`,
      //     {
      //       method: 'POST',
      //       headers: {'Content-Type': 'application/json'},
      //       body: JSON.stringify({blocks}),
      //     },
      //   );
      //   return await res.json();
      // } catch(e) {
      //   const blockHashes = await this.getHashes(blocks[0], blocks[blocks.length - 1]);
        const entries = [];

        for (let i = 0; i < blocks.length; i++) {
          let entry = await getHeader(this.networkName, blocks[i]);

          if (!entry) {
            entry = await this.getBlockHeader(blocks[i]);
            entry = entry && ChainEntry.fromJSON(entry).format();
          }

          if (entry) {
            entries.push(entry);
            await addHeader(this.networkName, blocks[i], entry);
          } else {
            return entries;
          }
        }

        return entries;
      // }
    } else if (type === ConnectionTypes.P2P) {
      const entries = [];
      const len = blocks[blocks.length - 1] + 1;

      for (let i = blocks[0]; i < len; i++) {
        let entry = await getHeader(this.networkName, i);

        if (!entry) {
          entry = await nodeService.getEntryByHeight(i);
          entry = entry && entry.toJSON();
        }

        if (entry) {
          entries.push(entry);
          await addHeader(this.networkName, i, entry);
        }
      }

      return entries;
    }
  };

  getTXByAddresses = async () => {
    await this._ensureClient();
    const addresses = await this.getAddresses();
    let txs = [];
    const {type} = await getConnection();
    const range = type === ConnectionTypes.Custom ? 200 : 2000;

    for (let i = 0; i < 20000; i = i + range) {
      dispatchToMainWindow(setSyncWalletText(`Fetching transactions (${(i/200).toFixed(0)}%)...`));
      const transactions = await nodeService.getTXByAddresses(addresses.slice(i, i + range));
      txs = txs.concat(transactions);
    }

    return txs;
  };

  rescanBlock = async (entryOption, txs) => {
    await this._ensureClient();

    const wdb = this.node.wdb;

    wdb.rescanning = true;

    const entry = entryOption instanceof ChainEntry
      ? entryOption
      : new ChainEntry({
        ...entryOption,
        version: Number(entryOption.version),
        hash: Buffer.from(entryOption.hash, 'hex'),
        prevBlock: Buffer.from(entryOption.prevBlock, 'hex'),
        merkleRoot: Buffer.from(entryOption.merkleRoot, 'hex'),
        witnessRoot: Buffer.from(entryOption.witnessRoot, 'hex'),
        treeRoot: Buffer.from(entryOption.treeRoot, 'hex'),
        reservedRoot: Buffer.from(entryOption.reservedRoot, 'hex'),
        extraNonce: Buffer.from(entryOption.extraNonce, 'hex'),
        mask: Buffer.from(entryOption.mask, 'hex'),
        chainwork: entryOption.chainwork && BN.from(entryOption.chainwork, 16, 'be'),
      });

    const res = await wdb.rescanBlock(entry, txs);

    wdb.rescanning = false;

    return res;
  };

  rescanFrom = async (height) => {
    if (this.isWalletRescanning) return;

    this.isWalletRescanning = true;

    await this._ensureClient();


    dispatchToMainWindow({type: START_SYNC_WALLET});

    // get blocks
    const {chain: {height: chainHeight}} = await nodeService.getInfo();

    for (let i = height; i <= chainHeight; i++) {
      const block = await nodeService.getBlock(i);
      await this.rescanBlock(block, block.txs.map(txJSON => TX.fromJSON(txJSON)));
      dispatchToMainWindow({
        type: SET_WALLET_HEIGHT,
        payload: block.height,
      });
    }
    // scan blocks


    dispatchToMainWindow({type: STOP_SYNC_WALLET});

    this.isWalletRescanning = false;
  };

  rescan = async (height = 0) => {
    try {
      return await this._rescan(height);
    } catch (e) {
      this.isWalletRescanning = false;
      console.log(e);
      dispatchToMainWindow({type: STOP_SYNC_WALLET});
    }
  };

  _rescan = async (height = 0) => {
    if (height) return this.rescanFrom(height);

    if (this.isWalletRescanning) return;

    this.isWalletRescanning = true;

    await this._ensureClient();

    const wdb = this.node.wdb;

    dispatchToMainWindow({type: START_SYNC_WALLET});
    dispatchToMainWindow(setSyncWalletText('Fetching transactions...'));

    let transactions = await this.getTXByAddresses();

    dispatchToMainWindow(setSyncWalletText(`Processing ${transactions.length} TXs...`));

    transactions = transactions.sort((a, b) => {
      if (a.index > b.index) return 1;
      if (b.index > a.index) return -1;
      return 0;
    });

    const bmap = {};

    for (let j = 0; j < transactions.length; j++) {
      const tx = mapOneTx(transactions[j]);
      bmap[transactions[j].height] = bmap[transactions[j].height] || [];
      bmap[transactions[j].height].push(tx);
    }

    await wdb.rollback(height);

    dispatchToMainWindow(setSyncWalletText(`Fetching block entries...`));

    const entries = [];

    await this.loadEntries(height, entries);

    for (let i = 0; i < entries.length; i++) {
      const entryOption = entries[i];
      await this.rescanBlock(entryOption, bmap[entryOption.height] || []);

      if (!(i % 1000)) {
        dispatchToMainWindow(setSyncWalletText(''));

        dispatchToMainWindow({
          type: SET_WALLET_HEIGHT,
          payload: entryOption.height,
        });
      }
    }

    dispatchToMainWindow({
      type: SET_WALLET_HEIGHT,
      payload: entries[entries.length - 1].height,
    });

    await this.connectNames();

    dispatchToMainWindow({type: STOP_SYNC_WALLET});

    this.isWalletRescanning = false;

    return null;
  };

  connectNames = async () => {
    const names = await this.getNames();
    const wallet = await this.node.wdb.get(WALLET_ID);
    const b = wallet.txdb.bucket.batch();

    for (let nameState of names) {
      const ns = await this.node.wdb.client.getNameStatus(nameState.nameHash);
      b.put(layout.A.encode(nameState.nameHash), ns.encode())
    }

    await b.write();
  };

  loadEntries = async (startHeight = 0, entries = []) => {
    const blocks = [];

    for (let i = startHeight; i < startHeight + 250; i++) {
      blocks.push(i);
    }

    const res = await this.getEntriesByBlocks(blocks);

    for (let entry of res) {
      entries.push(entry);
    }

    dispatchToMainWindow(setSyncWalletText(`Scanning ${entries.length} blocks...`));

    if (res.length === 250) {
      await this.loadEntries(startHeight + 250, entries);
    }
  };

  importSeed = async (passphrase, mnemonic) => {
    await this._ensureClient();

    this.didSelectWallet = false;
    const options = {
      passphrase,
      // hsd generates different keys for
      // menmonics with trailing whitespace
      mnemonic: mnemonic.trim(),
    };
    const res = await this.client.createWallet(WALLET_ID, options);
    const wallet = await this.node.wdb.get(WALLET_ID);
    await wallet.setLookahead('default', 10000);
    setTimeout(() => this.rescan(0), 1000);
    return res;
  };

  generateReceivingAddress = async () => {
    await this._ensureClient();
    return this.client.createAddress(WALLET_ID, 'default');
  };

  getAuctionInfo = async (name) => {
    return this._executeRPC('getauctioninfo', [name]);
  };

  getTransactionHistory = async () => {
    await this._ensureClient();
    const wallet = await this.node.wdb.get(WALLET_ID);
    return wallet.getHistory('default');
  };

  getPendingTransactions = async () => {
    await this._ensureClient();
    return this.client.getPending(WALLET_ID, 'default');
  };

  getBids = async () => {
    await this._ensureClient();
    const wallet = await this.node.wdb.get(WALLET_ID);
    return wallet.getBids();
  };

  getMasterHDKey = () => this._ledgerDisabled(
    'cannot get HD key for watch-only wallet',
    () => this.client.getMaster(WALLET_ID),
  );

  setPassphrase = (newPass) => this._ledgerDisabled(
    'cannot set passphrase for watch-only wallet',
    () => this.client.setPassphrase(WALLET_ID, newPass),
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
    const createdTx = await this.client.createTX(WALLET_ID, {
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
    () => this._executeRPC('sendopen', [name]),
  );

  sendBid = (name, amount, lockup) => this._ledgerProxy(
    () => this._executeRPC(
      'createbid',
      [name, Number(displayBalance(amount)), Number(displayBalance(lockup))],
    ),
    () => this._executeRPC(
      'sendbid',
      [name, Number(displayBalance(amount)), Number(displayBalance(lockup))],
    ),
  );

  sendUpdate = (name, json) => this._ledgerProxy(
    () => this._executeRPC('createupdate', [name, json]),
    () => this._executeRPC('sendupdate', [name, json]),
  );

  sendReveal = (name) => this._ledgerProxy(
    () => this._executeRPC('createreveal', [name]),
    () => this._executeRPC('sendreveal', [name]),
  );

  sendRedeem = (name) => this._ledgerProxy(
    () => this._executeRPC('createredeem', [name]),
    () => this._executeRPC('sendredeem', [name]),
  );

  sendRenewal = (name) => this._ledgerProxy(
    () => this._executeRPC('createrenewal', [name]),
    () => this._executeRPC('sendrenewal', [name]),
  );

  sendTransfer = (name, recipient) => this._ledgerProxy(
    () => this._executeRPC('createtransfer', [name, recipient]),
    () => this._executeRPC('sendtransfer', [name, recipient]),
  );

  cancelTransfer = (name) => this._ledgerProxy(
    () => this._executeRPC('createcancel', [name]),
    () => this._executeRPC('sendcancel', [name]),
  );

  finalizeTransfer = (name) => this._ledgerProxy(
    () => this._executeRPC('createfinalize', [name]),
    () => this._executeRPC('sendfinalize', [name]),
  );

  revokeName = (name) => this._ledgerProxy(
    () => this._executeRPC('createrevoke', [name]),
    () => this._executeRPC('sendrevoke', [name]),
  );

  send = (to, amount, fee) => this._ledgerProxy(
    () => this._executeRPC('createsendtoaddress', [to, Number(amount), '', '', false, 'default']),
    () => this.client.send(WALLET_ID, {
      rate: Number(toBaseUnits(fee)),
      outputs: [{
        value: Number(toBaseUnits(amount)),
        address: to,
      }],
    }),
  );

  lock = () => this._ledgerProxy(
    () => null,
    () => this.client.lock(WALLET_ID),
  );

  unlock = (passphrase) => this._ledgerProxy(
    () => null,
    () => this.client.unlock(WALLET_ID, passphrase),
  );

  isLocked = () => this._ledgerProxy(
    () => false,
    async () => {
      try {
        const info = await this.client.getInfo(WALLET_ID);
        return info === null || info.master.until === 0;
      } catch (e) {
        console.error(e);
        return true;
      }
    },
  );

  getNonce = async (options) => {
    await this._ensureClient();
    return this.client.getNonce(WALLET_ID, options.name, options);
  };

  importNonce = async (options) => {
    return this._executeRPC('importnonce', [options.name, options.address, options.bid]);
  };

  zap = async () => {
    await this._ensureClient();
    return this.client.zap(WALLET_ID, 'default', 1);
  };

  importName = (name, start) => {
    return this._executeRPC('importname', [name, start]);
  };

  rpcGetWalletInfo = async () => {
    return await this._executeRPC('getwalletinfo', []);
  };

  // price is in WHOLE HNS!
  finalizeWithPayment = async (name, fundingAddr, nameReceiveAddr, price) => {
    if (price > 2000) {
      throw new Error('Refusing to create a transfer for more than 2000 HNS.');
    }

    const {wdb} = this.node;
    const wallet = await wdb.get('allison');
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

    const mtx = new MTX();
    mtx.addCoin(coin);
    mtx.outputs.push(output0);
    mtx.outputs.push(output1);

    // Sign
    const rings = await wallet.deriveInputs(mtx);
    assert(rings.length === 1);
    const signed = await mtx.sign(
      rings,
      Script.hashType.SINGLEREVERSE | Script.hashType.ANYONECANPAY,
    );
    assert(signed === 1);
    assert(mtx.verify());
    return mtx.encode().toString('hex');
  };

  claimPaidTransfer = async (txHex) => {
    const {wdb} = this.node;
    const wallet = await wdb.get('allison');
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
    const tx = await wallet.sendMTX(mtx);
    assert(tx.verify(mtx.view));

    const hash = tx.hash();
    // Wait for mempool and check
    for (let i = 0; i < 10; i++) {
      const mp = await this.nodeService.getRawMempool(false);
      if (!mp[hash]) {
        console.log('Transaction did not appear in the mempool, retrying...');
        await new Promise((resolve) => setTimeout(resolve, 3000));
        continue;
      }

      return;
    }

    throw new Error('Transaction never appeared in the mempool.');
  };

  _onNodeStart = async (networkName, network, apiKey) => {
    const conn = await getConnection();

    this.networkName = networkName;
    this.apiKey = apiKey;
    this.walletApiKey = apiKey || crypto.randomBytes(20).toString('hex');
    this.network = network;

    const walletOptions = {
      network: network,
      port: network.walletPort,
      apiKey: this.walletApiKey,
    };

    const node = new WalletNode({
      network: networkName,
      nodeUrl: conn.type === ConnectionTypes.Custom
        ? conn.url || 'http://127.0.0.1:12037'
        : undefined,
      nodeHost: conn.type === ConnectionTypes.Custom
        ? getHost(conn.url || 'http://127.0.0.1:12037')
        : undefined,
      nodePort: conn.type === ConnectionTypes.Custom
        ? getPort(conn.url || 'http://127.0.0.1:12037')
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
    });
    await node.open();
    node.wdb.on('error', e => {
      console.error('walletdb error', e);
    });

    node.wdb.client.socket.unhook('block connect');
    node.wdb.client.socket.unhook('block disconnect');
    node.wdb.client.socket.unhook('block rescan');
    node.wdb.client.socket.unhook('tx');
    node.wdb.client.socket.unhook('chain reset');

    node.wdb.client.hook('block rescan', () => null);
    node.wdb.client.hook('block connect', () => null);
    node.wdb.client.hook('block disconnect', () => null);
    node.wdb.client.hook('tx', () => null);
    node.wdb.client.hook('chain reset', () => null);

    this.node = node;
    this.client = new WalletClient(walletOptions);

    const walletHeight = await this.getWalletHeight();

    dispatchToMainWindow({
      type: SET_WALLET_HEIGHT,
      payload: walletHeight,
    });

    if (nodeService.hsd) {
      nodeService.hsd.chain.on('block', async (block, chainEntry) => {
        const info = await nodeService.getInfo();
        const fees = await nodeService.getFees();

        dispatchToMainWindow({
          type: SET_NODE_INFO,
          payload: { info },
        });

        dispatchToMainWindow({
          type: SET_FEE_INFO,
          payload: { fees },
        });

        const wh = await this.getWalletHeight();

        if (chainEntry.height === wh + 1) {
          await this.rescanBlock(chainEntry, block.txs);
        } else if (chainEntry.height < wh + 100) {
          await this.rescanFrom(wh);
        }
      });
    }

    // const {chain: {height: chainHeight}} = await nodeService.getInfo();
    // if (chainHeight < walletHeight + 100) {
    //   await this.rescanFrom(walletHeight);
    // }
  };

  _onNodeStop = async () => {
    this.client = null;
    this.didSelectWallet = false;
    if (this.node) {
      const node = this.node;
      this.node = null;
      await node.close();
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

    this.pendingSelection = this.client.execute('selectwallet', [WALLET_ID]);
    await this.pendingSelection;
    this.pendingSelection = null;
    this.didSelectWallet = true;
  }

  _ledgerProxy = async (onLedger, onNonLedger, shouldConfirmLedger = true) => {
    const info = await this.getWalletInfo();
    if (info.watchOnly) {
      throw new Error('ledger is not currently enabled');
    }

    return onNonLedger();
  };

  _ledgerDisabled = (message, onNonLedger) => {
    return this._ledgerProxy(() => {
      throw new Error(message);
    }, onNonLedger, false);
  };

  async _executeRPC(method, args) {
    await this._selectWallet();
    return this.client.execute(method, args);
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
  getWalletHeight: service.getWalletHeight,
  getAccountInfo: service.getAccountInfo,
  getAPIKey: service.getAPIKey,
  getCoin: service.getCoin,
  getNames: service.getNames,
  getNameStateByName: service.getNameStateByName,
  createNewWallet: service.createNewWallet,
  importSeed: service.importSeed,
  generateReceivingAddress: service.generateReceivingAddress,
  getAuctionInfo: service.getAuctionInfo,
  getTransactionHistory: service.getTransactionHistory,
  getTX: service.getTX,
  getPendingTransactions: service.getPendingTransactions,
  getBids: service.getBids,
  getMasterHDKey: service.getMasterHDKey,
  setPassphrase: service.setPassphrase,
  revealSeed: service.revealSeed,
  estimateTxFee: service.estimateTxFee,
  estimateMaxSend: service.estimateMaxSend,
  rescan: service.rescan,
  reset: service.reset,
  sendOpen: service.sendOpen,
  sendBid: service.sendBid,
  sendUpdate: service.sendUpdate,
  sendReveal: service.sendReveal,
  sendRedeem: service.sendRedeem,
  sendRenewal: service.sendRenewal,
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
};

export async function start(server) {
  server.withService(sName, methods);
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

function mapOneTx(txOptions) {
  if (txOptions.witnessHash) {
    txOptions.witnessHash = Buffer.from(txOptions.witnessHash, 'hex');
  }

  txOptions.inputs = txOptions.inputs.map(input => {
    if (input?.prevout.hash) {
      input.prevout.hash = Buffer.from(input.prevout.hash, 'hex');
    }

    if (input?.coin && input.coin.covenant) {
      input.coin.covenant = new Covenant(
        input.coin.covenant.type,
        input.coin.covenant.items.map(item => Buffer.from(item, 'hex')),
      );
    }

    if (input?.witness) {
      input.witness = input.witness.map(wit => Buffer.from(wit, 'hex'));
    }

    return input;
  });

  txOptions.outputs = txOptions.outputs.map((output, i) => {
    if (output?.covenant) {
      output.covenant = new Covenant(
        output.covenant.type,
        output.covenant.items.map(item => Buffer.from(item, 'hex')),
      );
    }

    return output;
  });

  const tx = new TX(txOptions);

  return tx;
}

async function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
