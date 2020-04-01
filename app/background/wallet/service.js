import { WalletClient } from 'hs-client';
import { displayBalance, toBaseUnits, toDisplayUnits } from '../../utils/balances';
import { service as nodeService } from '../node/service';
import BigNumber from 'bignumber.js';
import { NETWORKS } from '../../constants/networks';

const Sentry = require('@sentry/electron');

const MasterKey = require('hsd/lib/wallet/masterkey');
const Mnemonic = require('hsd/lib/hd/mnemonic');

const WALLET_ID = 'allison';
const randomAddrs = {
  [NETWORKS.TESTNET]: 'ts1qfcljt5ylsa9rcyvppvl8k8gjnpeh079drfrmzq',
  [NETWORKS.REGTEST]: 'rs1qh57neh8npuxeyxfsl35373vshs0d40cvxx57aj',
  [NETWORKS.MAINNET]: 'hs1q5e06h2fcwx9sx38k6skzwkzmm54meudhphkytx',
  [NETWORKS.SIMNET]: 'ss1qfrfg6pg7emnx5m53zf4fe24vdtt8thljhyekhj',
};

class WalletService {
  constructor() {
    nodeService.on('started', this._onNodeStart);
    nodeService.on('stopped', this._onNodeStop);
    this.nodeService = nodeService;
  }

  getWalletInfo = async () => {
    this._ensureClient();
    return this.client.getInfo(WALLET_ID);
  };

  getAccountInfo = async () => {
    this._ensureClient();
    return this.client.getAccount(WALLET_ID, 'default');
  };

  getCoin = async (hash, index) => {
    this._ensureClient();
    return this.client.getCoin(WALLET_ID, hash, index);
  };

  getNames = async () => {
    await this._selectWallet();
    return this.client.execute('getnames');
  };

  createNewWallet = async (passphraseOrXPub, isLedger) => {
    this._ensureClient();
    this.didSelectWallet = false;

    await this.nodeService.reset();
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

  importSeed = async (passphrase, mnemonic) => {
    this._ensureClient();
    this.didSelectWallet = false;
    await this.nodeService.reset();

    const options = {
      passphrase,
      // hsd generates different keys for
      // menmonics with trailing whitespace
      mnemonic: mnemonic.trim(),
    };
    const res = await this.client.createWallet(WALLET_ID, options);
    await this.client.rescan(0);
    return res;
  };

  generateReceivingAddress = async () => {
    this._ensureClient();
    return this.client.createAddress(WALLET_ID, 'default');
  };

  getAuctionInfo = async (name) => {
    return this._executeRPC('getauctioninfo', [name]);
  };

  getTransactionHistory = async () => {
    this._ensureClient();
    return this.client.getHistory(WALLET_ID, 'default');
  };

  getPendingTransactions = async () => {
    this._ensureClient();
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

  estimateTxFee = async (to, amount, feeRate) => {
    this._ensureClient();
    const feeRateBaseUnits = Number(toBaseUnits(feeRate));
    const createdTx = await this.client.createTX(WALLET_ID, {
      rate: feeRateBaseUnits,
      outputs: [{
        value: Number(toBaseUnits(amount)),
        address: to,
      }],
    });
    return {
      feeRate,
      amount: Number(toDisplayUnits(createdTx.fee)),
      txSize: Number(new BigNumber(createdTx.fee).div(feeRateBaseUnits).toFixed(3)),
    };
  };

  estimateMaxSend = async (feeRate) => {
    const info = await this.getAccountInfo();
    const confirmedBal = new BigNumber(toDisplayUnits(info.balance.confirmed));
    if (confirmedBal.isZero()) {
      return 0;
    }

    const dummyAddr = randomAddrs[this.networkName];
    let feeFudge = 0.0001;
    while (feeFudge < 10) {
      try {
        const maxBal = confirmedBal.minus(feeFudge);
        await this.estimateTxFee(dummyAddr, maxBal, feeRate);
        return maxBal;
      } catch (e) {
        feeFudge = feeFudge * 10;
      }
    }

    Sentry.captureMessage(`Max send never converged. Balance: ${toDisplayUnits(confirmedBal)}`);
    return confirmedBal;
  };

  sendOpen = (name) => this._ledgerProxy(
    () => this._executeRPC('createopen', [name]),
    () => this._executeRPC('sendopen', [name]),
  );

  sendBid = (name, amount, lockup) => this._ledgerProxy(
    () => this._executeRPC('createbid', [name, Number(displayBalance(amount)), Number(displayBalance(lockup))]),
    () => this._executeRPC('sendbid', [name, Number(displayBalance(amount)), Number(displayBalance(lockup))]),
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
    () => this.client.unlock(WALLET_ID, passphrase, 60 * 60 * 24 * 365),
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
    this._ensureClient();
    return this.client.getNonce(WALLET_ID, options.name, options);
  };

  importNonce = async (options) => {
    return this._executeRPC('importnonce', [options.name, options.address, options.bid]);
  };

  zap = async () => {
    this._ensureClient();
    return this.client.zap(WALLET_ID, 'default', 1);
  };

  importName = (name, start) => {
    return this._executeRPC('importname', [name, start]);
  };

  rpcGetWalletInfo = () => {
    return this._executeRPC('getwalletinfo', []);
  };

  _onNodeStart = async (networkName, network, apiKey) => {
    this.networkName = networkName;
    const walletOptions = {
      network: network,
      port: network.walletPort,
      apiKey,
    };

    this.client = new WalletClient(walletOptions);
  };

  _onNodeStop = async () => {
    this.client = null;
    this.didSelectWallet = false;
  };

  _ensureClient() {
    if (!this.client) {
      throw new Error('no wallet client configured');
    }
  }

  async _selectWallet() {
    this._ensureClient();

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
    this._selectWallet();
    return this.client.execute(method, args);
  }
}

const service = new WalletService();
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
  sendOpen: service.sendOpen,
  sendBid: service.sendBid,
  sendUpdate: service.sendUpdate,
  sendReveal: service.sendReveal,
  sendRedeem: service.sendRedeem,
  sendRenewal: service.sendRenewal,
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
