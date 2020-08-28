import { WalletClient } from 'hs-client';
const WalletNode = require("hsd/lib/wallet/node");
const TX = require("hsd/lib/primitives/tx");
import { displayBalance, toBaseUnits, toDisplayUnits } from '../../utils/balances';
import { service as nodeService } from '../node/service';
import BigNumber from 'bignumber.js';
import { NETWORKS } from '../../constants/networks';
import path from "path";
import {app} from "electron";
import rimraf from "rimraf";
import {ConnectionTypes, getConnection} from "../connections/service";
import crypto from "crypto";
import {dispatchToMainWindow, getMainWindow} from "../../mainWindow";
import {START_SYNC_WALLET, STOP_SYNC_WALLET, SYNC_WALLET_PROGRESS} from "../../ducks/walletReducer";
import {startWalletSync, stopWalletSync} from "../../ducks/walletActions";
// const {TXRecord} = require("hsd/lib/wallet/records");

const Sentry = require('@sentry/electron');

const MasterKey = require('hsd/lib/wallet/masterkey');
const Mnemonic = require('hsd/lib/hd/mnemonic');
// const Network = require("hsd/lib/protocol/network");
// const Address = require("hsd/lib/primitives/address");
const Covenant = require("hsd/lib/primitives/covenant");

// const walletHeightKey = 'wallet:lastSyncHeight';

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

      await this._onNodeStart(
        this.networkName,
        this.network,
        this.apiKey,
      );

      return true;
    } catch(e) {
      console.error(e);
      return false;
    }
  };

  getAPIKey = async () => {
    await this._ensureClient();
    return this.walletApiKey;
  }

  getWalletInfo = async () => {
    await this._ensureClient();
    return this.client.getInfo(WALLET_ID);
  };


  getAccountInfo = async () => {
    await this._ensureClient();
    return this.client.getAccount(WALLET_ID, 'default');
  };

  getCoin = async (hash, index) => {
    await this._ensureClient();
    return this.client.getCoin(WALLET_ID, hash, index);
  };

  getNames = async () => {
    await this._selectWallet();
    return this.client.execute('getnames');
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
    return this.client.createWallet(WALLET_ID, options);
  };

  checkRescanStatus = async () => {
    await this._ensureClient();
    const wdb = this.node.wdb;
    const {chain: { height: chainHeight}} = await nodeService.getInfo();
    const { height: walletHeight } = await wdb.getTip();

    if (walletHeight < chainHeight) {
      this.rescanStatusIntv = setInterval(async () => {
        const { height: walletHeight } = await wdb.getTip();
        if (walletHeight === chainHeight) {
          clearInterval(this.rescanStatusIntv);
          dispatchToMainWindow({type: STOP_SYNC_WALLET});
          dispatchToMainWindow({
            type: SYNC_WALLET_PROGRESS,
            payload: 100,
          });
          return;
        }
        dispatchToMainWindow({type: START_SYNC_WALLET});
        dispatchToMainWindow({
          type: SYNC_WALLET_PROGRESS,
          payload: parseInt(walletHeight / chainHeight * 100),
        });
      }, 2500);
    }
  };

  rescan = async (height = 0) => {
    await this._ensureClient();
    const wdb = this.node.wdb;
    const {chain: { height: chainHeight}} = await nodeService.getInfo();

    dispatchToMainWindow({type: START_SYNC_WALLET});
    let resetting = true;

    return new Promise(async (resolve, reject) => {
      const intv = setInterval(async () => {
        const { height: walletHeight } = await wdb.getTip();

        if (walletHeight < chainHeight) {
          resetting = false;
        }

        dispatchToMainWindow({
          type: SYNC_WALLET_PROGRESS,
          payload: resetting
            ? 0
            : parseInt(walletHeight / chainHeight * 100),
        });
      }, 2500);

      resetting = false;
      await wdb.rescan(height);

      clearInterval(intv);
      resolve();
      dispatchToMainWindow({
        type: SYNC_WALLET_PROGRESS,
        payload: 100,
      });
      dispatchToMainWindow({ type: STOP_SYNC_WALLET });
    });
  };

  importSeed = async (passphrase, mnemonic) => {
    await this._ensureClient();

    await this.reset();
    this.didSelectWallet = false;
    const options = {
      passphrase,
      // hsd generates different keys for
      // menmonics with trailing whitespace
      mnemonic: mnemonic.trim(),
    };
    const res = await this.client.createWallet(WALLET_ID, options);
    this.rescan(0);
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
    return this.client.getHistory(WALLET_ID, 'default');
  };

  getPendingTransactions = async () => {
    await this._ensureClient();
    return this.client.getPending(WALLET_ID, 'default');
  };

  getBids = async () => {
    return this._executeRPC('getbids');
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
      [name, Number(displayBalance(amount)), Number(displayBalance(lockup))]
    ),
    () => this._executeRPC(
      'sendbid',
      [name, Number(displayBalance(amount)), Number(displayBalance(lockup))]
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
      console.error(e)
    });
    this.node = node;
    this.client = new WalletClient(walletOptions);
    await this.checkRescanStatus();
  };

  _onNodeStop = async () => {
    if (this.node) {
      const node = this.node;
      this.node = null;
      await node.close();
    }
    this.client = null;
    this.didSelectWallet = false;
    if (this.rescanStatusIntv) {
      clearInterval(this.rescanStatusIntv);
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
  getAccountInfo: service.getAccountInfo,
  getAPIKey: service.getAPIKey,
  getCoin: service.getCoin,
  getNames: service.getNames,
  createNewWallet: service.createNewWallet,
  importSeed: service.importSeed,
  generateReceivingAddress: service.generateReceivingAddress,
  getAuctionInfo: service.getAuctionInfo,
  getTransactionHistory: service.getTransactionHistory,
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
