import { WalletClient } from 'hsd/lib/client';
import BigNumber from 'bignumber.js';
import crypto from 'crypto';
const secp256k1 = require('bcrypto/lib/secp256k1');
const Validator = require('bval');
import { ConnectionTypes, getConnection } from '../connections/service';
import { dispatchToMainWindow, getMainWindow, isTrustedRendererEvent } from '../../mainWindow';
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
  SET_RESCAN_STATE,
  SET_FIND_NONCE_PROGRESS,
  SET_BASKET_SUBMISSION_PROGRESS,
} from '../../ducks/walletReducer';
import {STOP, SET_CUSTOM_RPC_STATUS} from '../../ducks/nodeReducer';
import {showSuccess, showError} from '../../ducks/notifications';
import {getNamesForRegisterAll} from "./create-register-all";
import {getWalletStats} from "./stats";
import {
  applyRegisterAuthority,
  getRegisterAuthority,
} from './registerValidation';
import {buildRevealActions, isAwaitingReveal} from './revealBatch';
import {get, put} from "../db/service";
import hsdLedger from 'hsd-ledger';
import {NAME_STATES} from "../../constants/names";
import {storageHealth} from '../storage/service';
import {
  WalletMutationCoordinator,
  broadcastAndRecord,
  reserveTransactionInputs,
} from './transactionSafety';
import {createRecoveryAdmission} from './recoveryAdmission';
import {createRescanRiskTracker} from './rescanRisk';
import {basketScope, assertBasketScope, assertBasketEligibility, basketScopeError} from '../../utils/basketScope';
import {reconcileBasketOutputs} from './basketValidation';
import {RegisterAllJournal} from './registerAll';

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
const {Resource} = require('hsd/lib/dns/resource');
const consensus = require('hsd/lib/protocol/consensus');
const common = require('hsd/lib/wallet/common');
const {Rules} = require('hsd/lib/covenants');
const {hashName, types} = Rules;
const ipc = require('electron').ipcMain;
const {
  buildHnsHtlcSpend,
  coinFromJSON,
  createHnsHtlcOutput,
} = require('./liquidityHtlc');

const randomAddrs = {
  [NETWORKS.TESTNET]: 'ts1qfcljt5ylsa9rcyvppvl8k8gjnpeh079drfrmzq',
  [NETWORKS.REGTEST]: 'rs1qh57neh8npuxeyxfsl35373vshs0d40cvxx57aj',
  [NETWORKS.MAINNET]: 'hs1q5e06h2fcwx9sx38k6skzwkzmm54meudhphkytx',
  [NETWORKS.SIMNET]: 'ss1qfrfg6pg7emnx5m53zf4fe24vdtt8thljhyekhj',
};

const {LedgerHSD, LedgerChange, LedgerCovenant, LedgerInput} = hsdLedger;
const {Device} = hsdLedger.HID;
const ONE_MINUTE = 60000;
const ADDRESS_LOOKUP_DERIVATION_LIMIT = 1000;
const SHAKE_RECOVERY_DERIVATION_LIMIT = 5000;
const SHAKE_RECOVERY_ACCOUNT_LIMIT = 100;

const WALLET_API_KEY = 'walletApiKey';
const ADDRESS_META_PREFIX = 'walletAddressMeta';
const SIGNING_KEY_ERROR_MESSAGE = 'No spendable wallet key was found for this transaction. Make sure the selected wallet/account has the funds and private keys needed to sign.';
const PRIVATE_KEY_ERROR_MESSAGE = 'No private key available.';
const TRANSACTION_TIMEOUT_MS = 120000;

function addressMetaKey(network, walletId, account, branch, index) {
  return `${ADDRESS_META_PREFIX}:${network}:${walletId}:${account}:${branch}:${index}`;
}

class WalletService {
  constructor() {
    nodeService.on('start remote', this._useWalletNode);
    nodeService.on('start local', this._usePlugin);
    nodeService.on('stopped', this._onNodeStop);
    this.nodeService = nodeService;
    this.lastProgressUpdate = 0;
    this.lastKnownChainHeight = 0;
    this.heightBeforeRescan = null; // null = not rescanning
    this.rescanBackendGeneration = 0;
    this.walletSelectionGeneration = 0;
    this.rescanListener = null;
    this.conn = {type: null};
    this.findNonceStop = false;
    this.recoveryAdmission = createRecoveryAdmission(() => this.node?.wdb?.bobRescanState);
    this.rescanRisk = createRescanRiskTracker();
    this.walletMutationCoordinator = new WalletMutationCoordinator();
    this.preparedBidManyAttempts = new Map();
    this.didSelectTransactionWallet = false;
    this.pendingTransactionSelection = null;
    this.registerAllJournal = new RegisterAllJournal({get, put});
    this.walletSelectionGeneration = 0;
  }

  _onWalletDBError = (error) => {
    if (!storageHealth.reportError(error, {
      source: 'walletdb',
      transactionAttempted: this.rescanRisk.transactionAttempted,
    })) {
      console.error('walletdb error', error);
    }
  };

  /**
   * Wallet as a plugin to the hsd full node is the default configuration
   * @param {import('hsd/lib/wallet/plugin')} plugin
   * @param {string} apiKey
   */
  _usePlugin = async (plugin, apiKey) => {
    if (this.node) {
      // The app was restarted but the nodes are already running,
      // just re-dispatch to redux store.
      if (this.node.wdb.bobRescanState) this.onRescanState(this.node.wdb.bobRescanState);
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

    this.rescanBackendGeneration++;
    this.node = plugin;
    const backendGeneration = this.rescanBackendGeneration;
    this.rescanListener = state => {
      if (this.rescanBackendGeneration !== backendGeneration || this.node !== plugin) return;
      this.onRescanState(state);
    };
    this.node.wdb.on('bob rescan', this.rescanListener);
    if (this.node.wdb.bobRescanState) this.rescanListener(this.node.wdb.bobRescanState);
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

    this.node.wdb.on('error', this._onWalletDBError);

    this.node.wdb.on('block connect', this.onNewBlock);

    this.client = new WalletClient({
      network: this.network,
      port: this.nodeService.getWalletPort(this.network),
      apiKey: this.walletApiKey,
      timeout: 10000,
    });
    this.transactionClient = new WalletClient({
      network: this.network,
      port: this.nodeService.getWalletPort(this.network),
      apiKey: this.walletApiKey,
      timeout: TRANSACTION_TIMEOUT_MS,
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

    this.rescanBackendGeneration++;
    this.onRescanState({
      status: 'idle',
      managed: false,
      ready: null,
      height: 0,
      target: null,
      generation: 0,
      activeRequestIds: [],
      completedRequestIds: [],
    });

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

    this.node.wdb.on('error', this._onWalletDBError);

    this.node.wdb.on('block connect', this.onNewBlock);

    await this.node.open();

    this.client = new WalletClient({
      network,
      port: this.nodeService.getWalletPort(network),
      apiKey: this.walletApiKey,
      timeout: 10000,
    });
    this.transactionClient = new WalletClient({
      network,
      port: this.nodeService.getWalletPort(network),
      apiKey: this.walletApiKey,
      timeout: TRANSACTION_TIMEOUT_MS,
    });

    const wallets = await this.listWallets();
    dispatchToMainWindow({
      type: SET_WALLETS,
      payload: createPayloadForSetWallets(wallets),
    });

  };

  onRescanState = state => {
    if (state.status === 'complete') this.recoveryAdmission.finishRescans();
    dispatchToMainWindow({
      type: SET_RESCAN_STATE,
      payload: {...state, backendGeneration: this.rescanBackendGeneration},
    });
  };

  _onNodeStop = async () => {
    if (this.node && this.rescanListener) {
      this.node.wdb.removeListener('bob rescan', this.rescanListener);
    }
    this.rescanListener = null;
    this.rescanBackendGeneration++;
    this.recoveryAdmission.resetBackend();
    this.onRescanState({
      status: 'idle',
      managed: false,
      ready: null,
      height: 0,
      target: null,
      generation: 0,
      activeRequestIds: [],
      completedRequestIds: [],
    });
    // Wallet as plugin is closed by the full node closing,
    // otherwise we close manually.
    if (this.conn.type === ConnectionTypes.Custom)
      await this.node.close();

    this.node = null;
    this.client = null;
    this.transactionClient = null;
    this.didSelectWallet = false;
    this.didSelectTransactionWallet = false;
    this.pendingTransactionSelection = null;
    for (const attempt of this.preparedBidManyAttempts.values()) {
      attempt.releaseReservedInputs?.();
    }
    this.preparedBidManyAttempts.clear();
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
    if (name !== this.name) this.walletSelectionGeneration++;
    this.didSelectWallet = false;
    this.didSelectTransactionWallet = false;
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
    const name = this.name;
    const selectionGeneration = this.walletSelectionGeneration;
    const backendGeneration = this.rescanBackendGeneration;
    const wallet = await this.node.wdb.get(name);
    if (!wallet) return null;

    const account = await wallet.getAccount('default');
    const balance = await wallet.getBalance(account.accountIndex);
    if (name !== this.name || selectionGeneration !== this.walletSelectionGeneration
      || backendGeneration !== this.rescanBackendGeneration) return null;
    return {
      ...account.getJSON(balance),
      wid: name,
      balanceContext: `${backendGeneration}:${selectionGeneration}`,
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

  rescan = async (height = 0, options = {}) => {
    const transactionAttempted = !!options.transactionAttempted;
    const releaseAdmission = this.recoveryAdmission.beginRescan(options.recoveryAdmission);
    const releaseRisk = this.rescanRisk.track(transactionAttempted);
    try {
      const storagePath = await this.nodeService.getDir();
      await storageHealth.preflight(storagePath, {
        source: 'wallet-rescan-preflight',
        transactionAttempted,
      });

      if (!this.node.wdb.bobRescanState) {
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
      }

      if (this.node.wdb.bobRescanState) {
        return await this.node.wdb.rescan(height, {
          requestId: options.recoveryRequestId,
        });
      }
      return await this.node.wdb.rescan(height);
    } catch (error) {
      storageHealth.reportError(error, {
        source: 'wallet-rescan',
        transactionAttempted,
      });
      throw error;
    } finally {
      releaseRisk();
      releaseAdmission();
    }
  };

  deepClean = async () => {
    return this.node.wdb.deepClean();
  };

  importSeed = async (name, passphrase, type, secret, m, n, rescanHeight = 0) => {
    const recoveryAdmission = this.recoveryAdmission.beginImport();
    try {
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

      this.rescan(rescanHeight, {recoveryAdmission}).catch(error => {
        console.error('Imported wallet rescan failed:', error);
      });
      return res.getJSON();
    } catch (error) {
      this.recoveryAdmission.releaseImport(recoveryAdmission);
      throw error;
    }
  };

  generateReceivingAddress = async () => {
    await this._ensureClient();
    return this.client.createAddress(this.name, 'default');
  };

  getReceiveAddresses = async () => {
    if (!this.name) return [];

    const wallet = await this.node.wdb.get(this.name);
    if (!wallet) return [];

    const account = await wallet.getAccount('default');
    if (!account) return [];

    const receiveDepth = Math.max(account.receiveDepth, 1);
    const currentIndex = account.receiveDepth > 0
      ? account.receiveDepth - 1
      : 0;
    const addressesByIndex = new Map();

    for (let index = 0; index < receiveDepth; index++) {
      const address = account.deriveReceive(index).getAddress().toString(this.network);
      addressesByIndex.set(index, {
        address,
        branch: 0,
        index,
        account: 'default',
        current: index === currentIndex,
        used: false,
        txCount: 0,
        balance: 0,
        lastUsed: null,
        label: '',
        pinned: false,
      });
    }

    for (const [index, entry] of addressesByIndex.entries()) {
      const metadata = await this.getAddressMetadata({
        account: 'default',
        branch: 0,
        index,
      });
      entry.label = metadata.label;
      entry.pinned = metadata.pinned;
      entry.updatedAt = metadata.updatedAt;
    }

    const txsByHash = new Map();
    const history = await wallet.getHistory('default');
    const pending = await wallet.getPending('default');

    for (const tx of [...history, ...pending]) {
      txsByHash.set(tx.hash.toString('hex'), tx);
    }

    const details = await wallet.toDetails(Array.from(txsByHash.values()));

    for (const item of details) {
      const tx = item.getJSON(this.network, this.lastKnownChainHeight);
      const touched = new Set();
      const lastUsed = tx.block ? tx.time * 1000 : Date.now();

      for (const output of tx.outputs || []) {
        const receiveIndex = getReceivePathIndex(output.path);
        if (receiveIndex == null || !addressesByIndex.has(receiveIndex)) {
          continue;
        }

        touched.add(receiveIndex);
      }

      for (const receiveIndex of touched) {
        const entry = addressesByIndex.get(receiveIndex);
        entry.used = true;
        entry.txCount += 1;
        entry.lastUsed = Math.max(entry.lastUsed || 0, lastUsed);
      }
    }

    const coins = await wallet.getCoins('default');
    for (const coin of coins) {
      if (!coin.address) continue;

      const path = await wallet.getPath(coin.address.hash);
      if (!path || path.branch !== 0 || !addressesByIndex.has(path.index)) {
        continue;
      }

      addressesByIndex.get(path.index).balance += coin.value;
    }

    return Array.from(addressesByIndex.values()).sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.current !== b.current) return a.current ? -1 : 1;
      if (a.used !== b.used) return a.used ? -1 : 1;
      if (a.txCount !== b.txCount) return b.txCount - a.txCount;
      return a.index - b.index;
    });
  };

  getAddressMetadata = async ({account = 'default', branch = 0, index}) => {
    if (!this.name || typeof index !== 'number') {
      return {
        label: '',
        pinned: false,
        updatedAt: null,
      };
    }

    const metadata = await get(
      addressMetaKey(this.networkName, this.name, account, branch, index)
    );

    return {
      label: metadata && typeof metadata.label === 'string'
        ? metadata.label
        : '',
      pinned: !!(metadata && metadata.pinned),
      updatedAt: metadata && metadata.updatedAt ? metadata.updatedAt : null,
    };
  };

  setAddressMetadata = async ({
    account = 'default',
    branch = 0,
    index,
    label = '',
    pinned = false,
  }) => {
    if (!this.name) throw new Error('No wallet selected.');
    if (typeof index !== 'number') throw new Error('Address index required.');

    const metadata = {
      label: String(label || '').trim().slice(0, 80),
      pinned: !!pinned,
      updatedAt: Date.now(),
    };

    await put(
      addressMetaKey(this.networkName, this.name, account, branch, index),
      metadata
    );

    return metadata;
  };

  lookupWalletAddress = async (address) => {
    if (!this.node || !this.node.wdb) {
      throw new Error('Wallet database is not ready.');
    }

    const parsedAddress = Address.fromString(String(address || '').trim(), this.network);
    const addressString = parsedAddress.toString(this.network);
    const addressHash = parsedAddress.hash.toString('hex');
    const wallets = await this.node.wdb.getWallets();
    const ownerships = [];
    const derivedMatches = [];
    const seen = [];

    for (const walletId of wallets) {
      if (walletId === 'primary') continue;

      const wallet = await this.node.wdb.get(walletId);
      if (!wallet) continue;

      const wid = await this.node.wdb.getWID(walletId);
      const path = await this.node.wdb.getPath(wid, parsedAddress.hash);

      if (path) {
        const accountName = await this.node.wdb.getAccountName(wid, path.account);
        ownerships.push({
          walletId,
          selected: walletId === this.name,
          account: path.account,
          accountName: accountName || path.name || String(path.account),
          branch: path.branch,
          branchName: path.branch === 0
            ? 'receive'
            : path.branch === 1
              ? 'change'
              : String(path.branch),
          index: path.index,
        });
      }

      const accountNames = await wallet.getAccounts();
      for (const accountName of accountNames) {
        const account = await wallet.getAccount(accountName);

        if (account) {
          const branches = [
            {
              id: 0,
              name: 'receive',
              depth: account.receiveDepth || 0,
              derive: index => account.deriveReceive(index),
            },
            {
              id: 1,
              name: 'change',
              depth: account.changeDepth || 0,
              derive: index => account.deriveChange(index),
            },
          ];

          for (const branch of branches) {
            const scanLimit = Math.max(
              ADDRESS_LOOKUP_DERIVATION_LIMIT,
              branch.depth + (account.lookahead || 0)
            );

            for (let index = 0; index < scanLimit; index++) {
              const key = branch.derive(index);
              const derivedAddress = key.getAddress();

              if (!derivedAddress.hash.equals(parsedAddress.hash)) continue;

              derivedMatches.push({
                walletId,
                selected: walletId === this.name,
                accountName,
                branch: branch.id,
                branchName: branch.name,
                index,
                knownDepth: branch.depth,
                scannedTo: scanLimit - 1,
                inKnownDepth: index < branch.depth,
              });
              break;
            }
          }
        }

        const txsByHash = new Map();
        const history = await wallet.getHistory(accountName);
        const pending = await wallet.getPending(accountName);

        for (const tx of [...history, ...pending]) {
          txsByHash.set(tx.hash.toString('hex'), tx);
        }

        if (txsByHash.size === 0) continue;

        const details = await wallet.toDetails(Array.from(txsByHash.values()));
        for (const item of details) {
          const tx = item.getJSON(this.network, this.lastKnownChainHeight);
          for (const [outputIndex, output] of (tx.outputs || []).entries()) {
            const outputAddress = output.address;
            const covenant = output.covenant || {};
            const covenantText = JSON.stringify(covenant);

            if (outputAddress === addressString) {
              seen.push({
                walletId,
                selected: walletId === this.name,
                accountName,
                type: 'output',
                txHash: tx.hash,
                height: tx.height,
                date: tx.date,
                outputIndex,
                action: covenant.action || null,
                address: outputAddress,
              });
            } else if (covenantText.includes(addressHash)) {
              seen.push({
                walletId,
                selected: walletId === this.name,
                accountName,
                type: 'covenant',
                txHash: tx.hash,
                height: tx.height,
                date: tx.date,
                outputIndex,
                action: covenant.action || null,
                address: outputAddress || null,
              });
            }
          }
        }
      }
    }

    const status = ownerships.some(item => item.selected)
      ? 'owned-active'
      : ownerships.length > 0
        ? 'owned-other'
        : derivedMatches.some(item => item.selected)
          ? 'derived-active'
          : derivedMatches.length > 0
            ? 'derived-other'
            : seen.length > 0
              ? 'seen'
              : 'not-found';

    return {
      address: addressString,
      hash: addressHash,
      selectedWallet: this.name,
      status,
      ownerships,
      derivedMatches,
      derivationLimit: ADDRESS_LOOKUP_DERIVATION_LIMIT,
      seen,
    };
  };

  findShakeWalletAddress = async (address, passphrase) => {
    if (!this.name) throw new Error('No wallet selected.');
    if (!this.node || !this.node.wdb) throw new Error('Wallet database is not ready.');
    if (!passphrase) throw new Error('Bob password is required to scan additional accounts.');

    const parsedAddress = Address.fromString(String(address || '').trim(), this.network);
    const addressString = parsedAddress.toString(this.network);
    const wallet = await this.node.wdb.get(this.name);

    if (!wallet) throw new Error('Selected wallet was not found.');
    if (wallet.watchOnly) throw new Error('Cannot derive new accounts for a watch-only wallet.');

    const recoveryAdmission = this.recoveryAdmission.beginImport();
    try {
      await wallet.unlock(passphrase, ONE_MINUTE);

      if (!wallet.master || !wallet.master.key) {
        throw new Error('Bob could not unlock the wallet master key.');
      }

      const existingAccounts = new Map();
      const existingAccountNames = await wallet.getAccounts();

      for (const accountName of existingAccountNames) {
        const account = await wallet.getAccount(accountName);
        if (account) existingAccounts.set(account.accountIndex, account);
      }

      let match = null;
      const accountDepth = Math.max(wallet.accountDepth || 0, existingAccounts.size);

      for (let accountIndex = 0; accountIndex < SHAKE_RECOVERY_ACCOUNT_LIMIT; accountIndex++) {
        const existingAccount = existingAccounts.get(accountIndex);
        const account = existingAccount || this.createVirtualAccount(wallet, accountIndex);
        const branches = [
          {
            id: 0,
            name: 'receive',
            derive: index => account.deriveReceive(index),
          },
          {
            id: 1,
            name: 'change',
            derive: index => account.deriveChange(index),
          },
        ];

        for (const branch of branches) {
          for (let index = 0; index < SHAKE_RECOVERY_DERIVATION_LIMIT; index++) {
            const derivedAddress = branch.derive(index).getAddress();

            if (!derivedAddress.hash.equals(parsedAddress.hash)) continue;

            match = {
              walletId: this.name,
              accountIndex,
              accountName: existingAccount ? existingAccount.name : null,
              branch: branch.id,
              branchName: branch.name,
              index,
              accountExisted: !!existingAccount,
              address: addressString,
            };
            break;
          }

          if (match) break;
        }

        if (match) break;
      }

      if (!match) {
        return {
          status: 'not-found',
          address: addressString,
          selectedWallet: this.name,
          accountLimit: SHAKE_RECOVERY_ACCOUNT_LIMIT,
          derivationLimit: SHAKE_RECOVERY_DERIVATION_LIMIT,
          recoveryScan: true,
          importedAccounts: [],
        };
      }

      const importedAccounts = [];

      if (!match.accountExisted) {
        if (match.accountIndex < accountDepth) {
          throw new Error(`Matching account index ${match.accountIndex} is below Bob's current account depth but was not loaded.`);
        }

        for (let accountIndex = accountDepth; accountIndex <= match.accountIndex; accountIndex++) {
          const accountName = await this.getUniqueAccountName(wallet, accountIndex === match.accountIndex
            ? `shake-account-${accountIndex}`
            : `imported-account-${accountIndex}`);
          const account = await wallet.createAccount({
            name: accountName,
            type: 'pubkeyhash',
          }, passphrase);

          importedAccounts.push({
            accountIndex: account.accountIndex,
            accountName: account.name,
          });

          if (account.accountIndex === match.accountIndex) {
            match.accountName = account.name;
          }
        }

        const wallets = await this.listWallets();
        dispatchToMainWindow({
          type: SET_WALLETS,
          payload: createPayloadForSetWallets(wallets, this.name),
        });

        this.rescan(0, {recoveryAdmission}).catch(e => {
          console.error('Could not start account recovery rescan.', e);
        });
      }

      return {
        status: match.accountExisted ? 'found-existing-account' : 'imported-account',
        address: addressString,
        selectedWallet: this.name,
        accountLimit: SHAKE_RECOVERY_ACCOUNT_LIMIT,
        derivationLimit: SHAKE_RECOVERY_DERIVATION_LIMIT,
        recoveryScan: true,
        match,
        importedAccounts,
        rescanStarted: importedAccounts.length > 0,
      };
    } finally {
      this.recoveryAdmission.releaseImport(recoveryAdmission);
    }
  };

  createVirtualAccount(wallet, accountIndex) {
    const type = this.network.keyPrefix.coinType;
    const accountKey = wallet.master.key
      .deriveAccount(44, type, accountIndex)
      .toPublic();

    return Account.fromOptions(this.node.wdb, {
      wid: wallet.wid,
      id: wallet.id,
      name: accountIndex === 0 ? 'default' : `account-${accountIndex}`,
      watchOnly: false,
      accountKey,
      accountIndex,
      type: 'pubkeyhash',
      m: 1,
      n: 1,
      lookahead: 200,
    });
  }

  getUniqueAccountName = async (wallet, baseName) => {
    if (!(await wallet.hasAccount(baseName))) return baseName;

    for (let suffix = 2; suffix < 100; suffix++) {
      const name = `${baseName}-${suffix}`;
      if (!(await wallet.hasAccount(name))) return name;
    }

    throw new Error(`Could not find an available account name for ${baseName}.`);
  };

  getAuctionInfo = async (name) => {
    return this._executeRPC('getauctioninfo', [name]);
  };

  getTransactionHistory = async () => {
    if (!this.name) {
      return [];
    }

    const wallet = await this.node.wdb.get(this.name);
    const txsByHash = new Map();
    const history = await wallet.getHistory('default');
    const pending = await wallet.getPending('default');

    for (const tx of [...history, ...pending]) {
      txsByHash.set(tx.hash.toString('hex'), tx);
    }

    const txs = Array.from(txsByHash.values());

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
      // Own bids still unrevealed while the auction is in the reveal period.
      NEED_REVEAL: [],
    };

    const map = {};
    const nameStates = new Map();

    const wallet = await this.node.wdb.get(this.name);

    for (let i = 0; i < bids.length; i++) {
      const bid = bids[i];
      const name = bid.name.toString('utf-8');
      const bidId = bid.prevout.hash.toString('hex') + bid.prevout.index;

      let json;
      let ns;

      if (nameStates.has(name)) {
        ns = nameStates.get(name);
        json = map[name];
      } else {
        ns = await wallet.getNameStateByName(name);
        json = ns?.getJSON(this.lastKnownChainHeight, this.network);
        nameStates.set(name, ns || null);
        map[name] = json;
      }

      const { state } = json || {};

      switch (state) {
        case NAME_STATES.OPENING:
        case NAME_STATES.BIDDING:
        case NAME_STATES.REVEAL:
        case NAME_STATES.CLOSED:
        case NAME_STATES.TRANSFER:
          index[state].push(bidId);
          break;
      }

      // Unspent bid coin means the bid has not been revealed yet.
      if (state === NAME_STATES.REVEAL && bid.own) {
        const [bidCoin, bidTx] = await Promise.all([
          wallet.getUnspentCoin(bid.prevout.hash, bid.prevout.index),
          wallet.getTX(bid.prevout.hash),
        ]);
        if (isAwaitingReveal({
          state,
          own: bid.own,
          hasUnspentBid: !!bidCoin,
          bidHeight: bidTx?.height,
          auctionHeight: ns?.height,
        })) {
          index.NEED_REVEAL.push(bidId);
        }
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

  /**
   * Open multiple name auctions in one batch transaction via createbatch.
   * OPEN only — cannot be combined with BID in the same transaction.
   * @param {string[]} names
   */
  sendOpenMany = async (names = []) => {
    if (!Array.isArray(names) || !names.length) {
      throw new Error('Nothing to do.');
    }

    const MAX_BASKET = 20;
    if (names.length > MAX_BASKET) {
      throw new Error(`Open basket is limited to ${MAX_BASKET} names.`);
    }

    const seen = new Set();
    const actions = [];

    for (const raw of names) {
      const name = String(raw || '').trim().toLowerCase();
      if (!name) {
        throw new Error('Every open-basket row needs a name.');
      }
      if (seen.has(name)) {
        throw new Error(`Duplicate name in open basket: ${name}`);
      }
      seen.add(name);
      actions.push(['OPEN', name]);
    }

    return this._walletProxy(
      () => this._executeRPC('createbatch', [actions, {paths: true}]),
      {
        actionName: 'open-many',
        diagnosticContext: {
          count: actions.length,
          names: actions.map((a) => a[1]),
        },
      },
    );
  };

  sendBid = (name, amount, lockup) => this._walletProxy(
    () => this._executeRPC(
      'createbid',
      [name, Number(displayBalance(amount)), Number(displayBalance(lockup))],
    ),
    {
      actionName: 'bid',
      diagnosticContext: {
        name,
        bidAmount: Number(displayBalance(amount)),
        lockup: Number(displayBalance(lockup)),
      },
    },
  );

  /**
   * Place multiple bids in one batch transaction via createbatch.
   * @param {Array<{name: string, bid: number, lockup: number}>} bids
   *   bid/lockup are in base units (same as sendBid).
   */
  _normalizeBidManyActions = (bids = []) => {
    if (!Array.isArray(bids) || !bids.length) {
      throw new Error('Nothing to do.');
    }

    const MAX_BASKET = 20;
    if (bids.length > MAX_BASKET) {
      throw new Error(`Auction basket is limited to ${MAX_BASKET} names.`);
    }

    const seen = new Set();
    const actions = [];

    for (const entry of bids) {
      const name = (entry?.name || '').trim().toLowerCase();
      if (!name) {
        throw new Error('Every basket row needs a name.');
      }
      if (seen.has(name)) {
        throw new Error(`Duplicate name in basket: ${name}`);
      }
      seen.add(name);

      const bidHns = Number(displayBalance(entry.bid));
      const lockupHns = Number(displayBalance(entry.lockup));
      if (!Number.isFinite(bidHns) || bidHns < 0) {
        throw new Error(`Invalid bid amount for ${name}.`);
      }
      if (!Number.isFinite(lockupHns) || lockupHns < bidHns) {
        throw new Error(`Lockup must be at least the bid for ${name}.`);
      }
      if (!(bidHns > 0) && !(lockupHns > 0)) {
        throw new Error(`Bid or lockup must be greater than zero for ${name}.`);
      }

      actions.push(['BID', name, bidHns, lockupHns]);
    }

    return actions;
  };

  _setBasketSubmissionProgress = (attemptId, phase, details = {}) => {
    dispatchToMainWindow({
      type: SET_BASKET_SUBMISSION_PROGRESS,
      payload: {attemptId, phase, ...details},
    });
  };

  _recordBasketTiming = (attempt, phase, startedAt, details = {}) => {
    const durationMs = Date.now() - startedAt;
    attempt.timings[phase] = durationMs;
    console.info('[Auction Basket timing]', {
      attemptId: attempt.attemptId,
      phase,
      durationMs,
      walletId: this.name,
      ...details,
    });
    return durationMs;
  };

  prepareBidMany = async (bids = [], requestedAttemptId, expected) => {
    if (expected?.walletId !== this.name || expected?.network !== this.networkName) {
      throw basketScopeError('The selected wallet or network changed.');
    }
    const actions = this._normalizeBidManyActions(bids);
    const reviewed = basketScope(bids);
    const attemptId = String(requestedAttemptId || crypto.randomBytes(16).toString('hex'));
    if (this.preparedBidManyAttempts.has(attemptId)) {
      const error = new Error('This basket preparation attempt already exists.');
      error.code = 'BASKET_DUPLICATE_BLOCKED';
      throw error;
    }

    const attempt = {
      attemptId,
      walletId: this.name,
      node: this.node,
      selectionGeneration: this.walletSelectionGeneration,
      backendGeneration: this.rescanBackendGeneration,
      entries: reviewed.rows,
      names: actions.map(action => action[1]),
      status: 'preparing',
      currentStage: 'building',
      cancelled: false,
      timings: {},
    };
    this.preparedBidManyAttempts.set(attemptId, attempt);
    attempt.timer = setTimeout(() => {
      if (!['broadcasting', 'submitted', 'uncertain'].includes(attempt.status)) {
        attempt.cancelled = true;
        this._discardBidMany(attempt);
      }
    }, 12 * ONE_MINUTE);
    this._setBasketSubmissionProgress(attemptId, 'building', {
      txid: '',
      broadcastAttempted: false,
      timings: {},
    });

    try {
      // Construct while locked. Approval and unlocking happen only after this
      // exact unsigned transaction and its actual fee have been reviewed.
      return await this.walletMutationCoordinator.run(async () => {
          this._assertBidManyCurrent(attempt);
          await storageHealth.preflight(await this.nodeService.getDir(), {
            source: 'basket-quote', transactionAttempted: false,
          });
          const wallet = await attempt.node.wdb.get(attempt.walletId);
          const info = await this.getWalletInfo();
          const account = await this.getAccountInfo();
          if (info.watchOnly || account.type === 'multisig') {
            throw basketScopeError('Auction Basket requires a standard hot wallet.');
          }
          await this._validateBidManyEligibility(attempt, wallet);
          const startedAt = Date.now();
          let result;
          try {
            this._assertBidManyCurrent(attempt);
            result = await this._executeTransactionRPC('createbatch', [actions, {paths: true}]);
          } finally {
            const duration = this._recordBasketTiming(attempt, 'createbatch', startedAt, {
              count: actions.length,
              includesCoinSelection: true,
            });
            attempt.timings.coinSelection = duration;
          }
          this._assertBidManyCurrent(attempt);
          const mtx = result instanceof MTX ? result : MTX.fromJSON(result);
          const parsed = await this.parseMtx(wallet, mtx);
          attempt.mtx = parsed.mtx;
          attempt.scope = await reconcileBasketOutputs(attempt.mtx, wallet, attempt.entries);
          await this._validateBidManyEligibility(attempt, wallet);
          this._assertBidManyCurrent(attempt);
          attempt.releaseReservedInputs = reserveTransactionInputs(wallet, attempt.mtx);
          attempt.status = 'quoted';
          return {attemptId, scope: attempt.scope, timings: {...attempt.timings}};
      });
    } catch (error) {
      this._discardBidMany(attempt);
      if (!error.code || error.code === -1 || error.code === 'ETIMEDOUT') {
        error.code = attempt.currentStage === 'signing'
          ? 'BASKET_SIGN_FAILED'
          : 'BASKET_BUILD_FAILED';
      }
      throw error;
    }
  };

  _discardBidMany = attempt => {
    clearTimeout(attempt.timer);
    attempt.releaseReservedInputs?.();
    this.preparedBidManyAttempts.delete(attempt.attemptId);
  };

  _assertBidManyCurrent = attempt => {
    if (attempt.cancelled || attempt.node !== this.node || attempt.walletId !== this.name
        || attempt.selectionGeneration !== this.walletSelectionGeneration
        || attempt.backendGeneration !== this.rescanBackendGeneration) {
      throw basketScopeError('Preparation was cancelled or the wallet/network changed.');
    }
  };

  _validateBidManyEligibility = async (attempt, wallet) => {
    const height = wallet.wdb.height;
    for (const entry of attempt.entries) {
      assertBasketEligibility(entry.name, await this.nodeService.getNameInfo(entry.name));
      const state = await wallet.getNameState(hashName(Buffer.from(entry.name, 'ascii')));
      if (!state || !state.isBidding(wallet.wdb.height + 1, wallet.network)) {
        throw basketScopeError(`${entry.name}/ cannot be bid on in the next block.`);
      }
    }
    if (wallet.wdb.height !== height) throw basketScopeError('The chain advanced during auction validation.');
    this._assertBidManyCurrent(attempt);
  };

  signPreparedBidMany = async (attemptId, approvedScope) => {
    const attempt = this.preparedBidManyAttempts.get(String(attemptId || ''));
    if (!attempt || attempt.status !== 'quoted') throw basketScopeError('The prepared basket is no longer available.');
    assertBasketScope(approvedScope, attempt.scope);
    this._assertBidManyCurrent(attempt);
    attempt.status = 'signing';
    attempt.currentStage = 'signing';
    try {
      const result = await this._walletProxy(() => attempt.mtx, {
        broadcast: false,
        reserveInputs: false, // The quote holds these coins until send/cancel.
        actionName: 'bid-many',
        diagnosticContext: {count: attempt.entries.length, names: attempt.names},
        timings: attempt.timings,
        beforeSign: async (mtx, wallet) => {
          this._assertBidManyCurrent(attempt);
          await this._validateBidManyEligibility(attempt, wallet);
          assertBasketScope(await reconcileBasketOutputs(mtx, wallet, attempt.entries), approvedScope);
          this._assertBidManyCurrent(attempt);
          if (wallet.master.encrypted && !wallet.master.key) {
            const error = new Error('The wallet locked before signing. No transaction was sent. Unlock it and review the basket again; auction deadlines may have changed.');
            error.code = 'BASKET_SIGN_FAILED';
            throw error;
          }
        },
      });
      if (!result) throw new Error('The basket could not be fully signed. No transaction was sent.');
      this._assertBidManyCurrent(attempt);
      const wallet = await attempt.node.wdb.get(attempt.walletId);
      assertBasketScope(await reconcileBasketOutputs(result, wallet, attempt.entries), approvedScope);
      this._assertBidManyCurrent(attempt);
      attempt.mtx = result;
      attempt.txid = result.txid();
      attempt.status = 'prepared';
      return {attemptId, txid: attempt.txid, scope: attempt.scope};
    } catch (error) {
      this._discardBidMany(attempt);
      if (error.code !== 'BASKET_SCOPE_CHANGED') error.code = 'BASKET_SIGN_FAILED';
      throw error;
    }
  };

  cancelBidManyAttempt = async (attemptId) => {
    const attempt = this.preparedBidManyAttempts.get(String(attemptId || ''));
    if (!attempt) return {cancelled: true, broadcastAttempted: false};
    if (attempt.status === 'broadcasting' || attempt.status === 'submitted' || attempt.status === 'uncertain') {
      return {cancelled: false, broadcastAttempted: true, txid: attempt.txid || ''};
    }
    attempt.cancelled = true;
    attempt.releaseReservedInputs?.();
    if (attempt.status === 'prepared' || attempt.status === 'quoted') this._discardBidMany(attempt);
    return {cancelled: true, broadcastAttempted: false, txid: attempt.txid || ''};
  };

  broadcastPreparedBidMany = async (attemptId) => {
    const attempt = this.preparedBidManyAttempts.get(String(attemptId || ''));
    if (!attempt || attempt.status !== 'prepared' || !attempt.mtx) {
      const error = new Error('Prepared basket transaction is unavailable or was already used.');
      error.code = 'BASKET_DUPLICATE_BLOCKED';
      throw error;
    }
    // Claim this attempt before any asynchronous validation to prevent two
    // simultaneous broadcast requests from using the same prepared transaction.
    attempt.status = 'validating';
    try {
      this._assertBidManyCurrent(attempt);
      const wallet = await attempt.node.wdb.get(attempt.walletId);
      await this._validateBidManyEligibility(attempt, wallet);
      assertBasketScope(await reconcileBasketOutputs(attempt.mtx, wallet, attempt.entries), attempt.scope);
      if (attempt.mtx.txid() !== attempt.txid) throw basketScopeError('The signed transaction changed.');
      this._assertBidManyCurrent(attempt);
    } catch (error) {
      this._discardBidMany(attempt);
      error.code = 'BASKET_PREBROADCAST_FAILED';
      throw error;
    }

    attempt.status = 'broadcasting';
    this._setBasketSubmissionProgress(attempt.attemptId, 'broadcasting', {
      txid: attempt.txid,
      broadcastAttempted: true,
      timings: {...attempt.timings},
    });
    const startedAt = Date.now();
    try {
      const result = await broadcastAndRecord({
        mtx: attempt.mtx,
        walletDB: attempt.node.wdb,
        broadcast: tx => this.nodeService.broadcastRawTx(tx.toHex(), {
          timeout: TRANSACTION_TIMEOUT_MS,
          assertCurrent: () => {
            try {
              this._assertBidManyCurrent(attempt);
            } catch (error) {
              attempt.prebroadcastFailure = error;
              throw error;
            }
          },
        }),
      });
      this._recordBasketTiming(attempt, 'broadcast', startedAt);
      attempt.status = 'submitted';
      this._setBasketSubmissionProgress(attempt.attemptId, 'verifying', {
        txid: attempt.txid,
        broadcastAttempted: true,
        timings: {...attempt.timings},
      });
      const verifyStartedAt = Date.now();
      const wallet = await attempt.node.wdb.get(attempt.walletId);
      const localTX = await wallet.getTX(result.hash());
      this._recordBasketTiming(attempt, 'reconciliation', verifyStartedAt, {
        foundInWalletDB: !!localTX,
      });
      if (!localTX) {
        console.warn(`Transaction ${attempt.txid} was accepted but is not yet visible in local WalletDB.`);
      }
      this._discardBidMany(attempt);
      return {txid: attempt.txid, scope: attempt.scope, timings: {...attempt.timings}};
    } catch (error) {
      this._recordBasketTiming(attempt, 'broadcast', startedAt, {failed: true});
      if (attempt.prebroadcastFailure) {
        this._discardBidMany(attempt);
        attempt.prebroadcastFailure.code = 'BASKET_PREBROADCAST_FAILED';
        throw attempt.prebroadcastFailure;
      }
      if (error.code === 'ETXREJECTED') {
        this._discardBidMany(attempt);
      } else {
        attempt.status = 'uncertain';
      }
      throw error;
    }
  };

  sendBidMany = async (bids = []) => {
    throw basketScopeError('Basket submission requires an explicit review of its exact transaction fee.');
  };

  findBasketBidTransactions = async (names = []) => {
    if (!this.name || !Array.isArray(names) || !names.length) {
      return [];
    }

    const targetHashes = new Set(names.map(name => (
      hashName(Buffer.from(String(name || '').trim().toLowerCase(), 'ascii')).toString('hex')
    )));
    const history = await this.getTransactionHistory();
    const matches = [];
    for (const tx of history) {
      const bidHashes = new Set();
      for (const output of tx.outputs) {
        if (output.covenant.action !== 'BID' || !output.covenant.items[0]) {
          continue;
        }
        bidHashes.add(String(output.covenant.items[0]).toLowerCase());
      }

      if ([...targetHashes].every(hash => bidHashes.has(hash))) {
        matches.push({
          txid: tx.hash,
          pending: !tx.block,
          height: tx.height,
        });
      }
    }

    return matches;
  };

  sendRegister = async (name) => {
    const {wdb} = this.node;
    const wallet = await wdb.get(this.name);

    return this._walletProxy(
      () => this._createVerifiedRegisterMTX(wallet, name),
    );
  };

  sendUpdate = (name, json) => this._walletProxy(
    () => this._executeRPC('createupdate', [name, json]),
  );

  sendReveal = (name) => this._walletProxy(
    () => this._executeRPC('createreveal', [name]),
  );

  sendRedeem = (name) => this._walletProxy(
    () => this._executeRPC('createredeem', [name]),
  );

  _registerAllContext = (expected) => {
    const context = {walletId: this.name, network: this.networkName};
    if (!context.walletId || !this.node || (expected &&
      (expected.walletId !== context.walletId || expected.network !== context.network))) {
      throw new Error('The selected wallet or network changed. Register All was not started.');
    }
    return context;
  };

  getRegisterAllStatus = async (expected) => {
    const context = this._registerAllContext(expected);
    const node = this.node;
    const generation = this.walletSelectionGeneration;
    const backendGeneration = this.rescanBackendGeneration;
    const assertCurrent = () => {
      this._registerAllContext(context);
      if (this.node !== node || this.walletSelectionGeneration !== generation
          || this.rescanBackendGeneration !== backendGeneration)
        throw new Error('The wallet changed while checking registrations.');
    };
    const wallet = await node.wdb.get(context.walletId);
    assertCurrent();
    const findTransaction = async txid => {
      assertCurrent();
      const tx = await wallet.getTX(Buffer.from(txid, 'hex'));
      assertCurrent();
      return tx;
    };
    const operation = await this.registerAllJournal.status(context, findTransaction,
      async txid => {
        const tx = await findTransaction(txid);
        return !!tx && Number.isInteger(tx.height) && tx.height >= 0;
      });
    assertCurrent();
    if (!expected?.preflight && operation?.status !== 'complete') return operation;
    const eligible = await getNamesForRegisterAll(wallet);
    assertCurrent();
    if (!expected?.preflight) return {...operation, eligibleCount: eligible.length};
    return {operation, eligibleCount: eligible.length};
  };

  cancelRegisterAll = (context) => this.registerAllJournal.cancel(context);

  sendRegisterAll = async (passphrase, expected) => {
    const context = {...this._registerAllContext(expected), operationId: expected?.operationId};
    if (!context.operationId) throw new Error('Register All requires a cancellable operation ID.');
    const node = this.node;
    const client = this.client;
    const generation = this.rescanBackendGeneration;
    const selectionGeneration = this.walletSelectionGeneration;
    const assertCurrent = () => {
      this._registerAllContext(context);
      if (this.node !== node || this.rescanBackendGeneration !== generation
          || this.walletSelectionGeneration !== selectionGeneration) {
        throw new Error('The wallet backend changed. Register All has stopped.');
      }
    };
    let wallet;
    return this.registerAllJournal.run(context, {
      assertCurrent,
      getNames: async () => {
        wallet = await node.wdb.get(context.walletId);
        return getNamesForRegisterAll(wallet);
      },
      submit: (name, hooks) => this._walletProxy(
        () => this._createVerifiedRegisterMTX(wallet, name),
        {
          ...hooks,
          beforePrepare: async () => {
            hooks.assertCurrent();
            if (passphrase) await client.unlock(context.walletId, passphrase);
            hooks.assertCurrent();
          },
          actionName: 'register-all',
          diagnosticContext: {name},
        },
      ),
    });
  };

  _createVerifiedRegisterMTX = async (wallet, name) => {
    const options = {paths: true};
    const unlock = await wallet.fundLock.lock();

    try {
      const mtx = await wallet.makeUpdate(
        name,
        Resource.fromJSON({records: []}),
      );
      const nameHash = hashName(Buffer.from(name, 'ascii'));
      const outputIndex = mtx.outputs.findIndex((output) => {
        return output.covenant
          && output.covenant.type === types.REGISTER
          && output.covenant.getHash(0).equals(nameHash);
      });

      if (outputIndex === -1)
        throw new Error(`Cannot safely register ${name}/: the local wallet did not create a REGISTER covenant.`);

      const nameInfo = await this.nodeService.getNameInfo(name);
      const authority = getRegisterAuthority(
        name,
        nameHash.toString('hex'),
        nameInfo,
      );

      applyRegisterAuthority(name, mtx, outputIndex, authority);

      await wallet.fill(mtx, options);
      return wallet.finalize(mtx, options);
    } finally {
      unlock();
    }
  }

  transferMany = async (names, address) => {
    if (!names.length) {
      throw new Error('Nothing to do.');
    }
    const chunkSize = consensus.MAX_BLOCK_UPDATES / 6;

    if (names.length > chunkSize) {
      throw new Error(`One transaction can contain up to ${chunkSize} name transfers.`);
    }

    const actions = names.map(name => ['TRANSFER', name, address]);

    return this._walletProxy(
      () => this._executeRPC('createbatch', [actions, {paths: true}]),
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

  sendRevealMany = async (names) => {
    const actions = buildRevealActions(names);

    return this._walletProxy(
      () => this._executeRPC('createbatch', [actions, {paths: true}]),
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

  createLiquidityHnsSwapKey = async () => {
    await this._ensureClient();
    const wallet = await this.node.wdb.get(this.name);
    const created = await this.client.createAddress(this.name, 'default');
    const address = created.address || created;
    const key = await wallet.getKey(Address.fromString(address, this.network));

    assert(key, 'Could not derive key for generated address.');

    return {
      address,
      publicKey: key.publicKey.toString('hex'),
    };
  };

  createLiquidityHnsLock = async (options = {}) => {
    const wallet = await this.node.wdb.get(this.name);
    const lockOptions = this._normalizeLiquidityHnsOptions(options);
    const refundKey = lockOptions.refundPublicKey
      ? null
      : await this.createLiquidityHnsSwapKey();
    const htlc = createHnsHtlcOutput({
      amountDollary: lockOptions.amountDollary,
      amountHns: lockOptions.amountHns,
      secretHash: lockOptions.secretHash,
      claimPublicKey: lockOptions.claimPublicKey,
      refundPublicKey: lockOptions.refundPublicKey || refundKey.publicKey,
      refundLocktime: lockOptions.refundLocktime,
    }, this.network);

    const mtx = new MTX();
    mtx.outputs.push(htlc.output);

    const changeAddress = await wallet.changeAddress();
    const rate = options.rate || await this.node.wdb.estimateFee();
    const coins = await wallet.getSmartCoins();
    await mtx.fund(coins, {changeAddress, rate});
    await wallet.template(mtx);

    const signed = await this._walletProxy(
      () => mtx,
      {broadcast: options.broadcast !== false},
    );

    assert(signed, 'Could not sign HNS HTLC lock transaction.');

    const htlcOutputIndex = signed.outputs.findIndex(output => (
      output.address
      && output.address.toString(this.network) === htlc.addressString
      && output.value === htlc.value
    ));
    assert(htlcOutputIndex >= 0, 'Could not locate HTLC output in signed transaction.');

    return {
      txid: signed.txid(),
      txHex: signed.toHex(),
      htlcAddress: htlc.addressString,
      htlcScript: htlc.scriptHex,
      htlcOutputIndex,
      refundLocktime: lockOptions.refundLocktime,
      refundPublicKey: lockOptions.refundPublicKey || refundKey.publicKey,
      refundAddress: refundKey?.address || null,
      value: htlc.value,
    };
  };

  createLiquidityHnsClaim = async (options = {}) => {
    return this._createLiquidityHnsSpend({
      ...options,
      path: 'claim',
    });
  };

  createLiquidityHnsRefund = async (options = {}) => {
    return this._createLiquidityHnsSpend({
      ...options,
      path: 'refund',
    });
  };

  _createLiquidityHnsSpend = async (options) => {
    const spendOptions = this._normalizeLiquidityHnsOptions(options);
    const wallet = await this.node.wdb.get(this.name);
    const signerAddress = options.signerAddress;
    assert(signerAddress, 'signerAddress is required.');

    const signerKey = await wallet.getKey(Address.fromString(signerAddress, this.network));
    assert(signerKey && signerKey.privateKey, 'The signerAddress is not available for local hot-wallet signing.');

    let coin;
    if (options.coin) {
      coin = coinFromJSON(options.coin, this.networkName);
    } else {
      assert(options.txid, 'txid is required when coin is not supplied.');
      assert(Number.isSafeInteger(options.index), 'index is required when coin is not supplied.');
      const coinData = await this.nodeService.getCoin(options.txid, options.index);
      assert(coinData, 'Could not find the HNS HTLC coin.');
      coin = coinFromJSON(coinData, this.networkName);
    }

    const destinationAddress = options.destinationAddress
      || (await wallet.receiveAddress()).toString(this.network);
    const spend = buildHnsHtlcSpend({
      coin,
      destinationAddress,
      network: this.network,
      privateKey: signerKey.privateKey,
      feeDollary: options.feeDollary || 0,
      path: options.path,
      secretHash: spendOptions.secretHash,
      secret: spendOptions.secret,
      claimPublicKey: spendOptions.claimPublicKey,
      refundPublicKey: spendOptions.refundPublicKey,
      refundLocktime: spendOptions.refundLocktime,
    });

    if (options.broadcast !== false)
      await this.nodeService.broadcastRawTx(spend.txHex);

    return {
      txid: spend.txid,
      txHex: spend.txHex,
      htlcScript: spend.scriptHex,
      destinationAddress,
    };
  };

  _normalizeLiquidityHnsOptions = (options = {}) => {
    const timelockBlocks =
      options.timelockBlocksEstimate
      || options.timelock_blocks_estimate
      || options.timelockBlocks
      || options.timelock_blocks;
    const refundLocktime =
      options.refundLocktime
      || options.refund_locktime
      || (timelockBlocks ? this.lastKnownChainHeight + Number(timelockBlocks) : null);

    return {
      amountDollary: options.amountDollary || options.amount_dollary,
      amountHns: options.amountHns || options.amount_hns,
      secretHash: options.secretHash || options.secret_hash_sha256,
      secret: options.secret || options.revealed_secret,
      claimPublicKey: options.claimPublicKey || options.claim_public_key || options.bob_hns_claim_public_key,
      refundPublicKey: options.refundPublicKey || options.refund_public_key || options.alice_hns_refund_public_key,
      refundLocktime,
    };
  };

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

  importName = async (name, start, options = {}) => {
    const recoveryAdmission = this.recoveryAdmission.beginImport();
    try {
      await this._executeRPC('importname', [name, null]);

      // wait 1 sec (for filterload to update on peer)
      if (this.nodeService.spv) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // rescan
      return await this.rescan(start, {...options, recoveryAdmission});
    } catch (error) {
      this.recoveryAdmission.releaseImport(recoveryAdmission);
      throw error;
    }
  };

  /**
   * Import several names for SPV auction tracking, then run ONE rescan
   * from the earliest height. Calling importName() in a loop is harmful:
   * each call starts its own rescan and rewinds the wallet repeatedly.
   *
   * @param {Array<{name: string, height: number}>} entries
   */
  importNames = async (entries = [], options = {}) => {
    if (!Array.isArray(entries) || !entries.length) {
      return null;
    }

    const recoveryAdmission = this.recoveryAdmission.beginImport();
    try {
      let minHeight = null;
      const seen = new Set();

      for (const entry of entries) {
        const name = (entry?.name || '').trim().toLowerCase();
        if (!name || seen.has(name)) {
          continue;
        }
        seen.add(name);

        await this._executeRPC('importname', [name, null]);

        const h = Number(entry.height);
        if (Number.isFinite(h)) {
          if (minHeight == null || h < minHeight) {
            minHeight = h;
          }
        }
      }

      if (this.nodeService.spv) {
        // Allow bloom filter / peer filterload to update once for all names.
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // Start one rescan from the earliest auction height. Completion is observed
      // through durable backend state rather than this IPC request's promise.
      this.rescan(minHeight == null ? 0 : minHeight, {
        ...options,
        recoveryRequestId: this.node.wdb.bobRescanState
          ? options.recoveryRequestId
          : undefined,
        recoveryAdmission,
      }).catch(error => {
        console.error('Bulk name import rescan failed:', error);
      });
      return {
        rescanStarted: true,
        height: minHeight == null ? 0 : minHeight,
        recoveryRequestId: this.node.wdb.bobRescanState
          ? options.recoveryRequestId || null
          : null,
      };
    } catch (error) {
      this.recoveryAdmission.releaseImport(recoveryAdmission);
      throw error;
    }
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

    assert(mtx.inputs.length >= 1, 'Paid transfer payload is missing the transfer input.');
    assert(mtx.outputs.length >= 2, 'Paid transfer payload is missing required outputs.');
    const finalizeOutput = mtx.outputs[0];
    const paymentOutput = mtx.outputs[1];
    assert(finalizeOutput.covenant.type === types.FINALIZE, 'Paid transfer payload must finalize the name in output 0.');
    assert(paymentOutput.covenant.type === types.NONE, 'Paid transfer payload payment output must be a plain HNS output.');
    assert(paymentOutput.value > 0, 'Paid transfer payload must include a positive seller payment.');

    const input0 = mtx.input(0).clone(); // copy input with Alice's signature
    const sellerSignature = input0.witness && input0.witness.items && input0.witness.items[0];
    assert(sellerSignature && sellerSignature.length, 'Paid transfer payload is missing the seller signature.');
    assert(
      sellerSignature[sellerSignature.length - 1] === (Script.hashType.SINGLEREVERSE | Script.hashType.ANYONECANPAY),
      'Paid transfer payload has an invalid seller signature type.',
    );

    const prevoutJSON = input0.prevout.toJSON();
    const coinData = await this.nodeService.getCoin(prevoutJSON.hash, prevoutJSON.index);
    assert(coinData, 'Paid transfer coin was not found or has already been spent.');
    const coin = new Coin();
    coin.fromJSON(coinData, this.networkName);
    assert(coin.covenant.type === types.TRANSFER, 'Paid transfer coin is not a TRANSFER covenant.');
    assert(
      finalizeOutput.covenant.items[0].equals(coin.covenant.items[0]),
      'Paid transfer payload finalizes a different name than the transfer coin.',
    );
    assert(coin.height >= 0, 'Paid transfer coin is not confirmed yet.');
    const blocksUntilFinalize = (coin.height + this.network.names.transferLockup) - this.lastKnownChainHeight;
    assert(blocksUntilFinalize <= 0, `Transfer lockup is not complete. Try again in ${blocksUntilFinalize} block(s).`);

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

  getStats = async (context = {}) => {
    const {wdb} = this.node;
    return getWalletStats(wdb, this.name, {
      requestId: context.requestId,
      generation: context.generation,
      selectionContext: `${this.rescanBackendGeneration}:${this.walletSelectionGeneration}:${wdb.height}`,
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
    const name = this.name;
    const selectionGeneration = this.walletSelectionGeneration;
    const backendGeneration = this.rescanBackendGeneration;
    const network = this.networkName;
    const accountInfo = await this.getAccountInfo();

    if (!accountInfo || accountInfo.wid !== name || this.name !== name
      || this.walletSelectionGeneration !== selectionGeneration
      || this.rescanBackendGeneration !== backendGeneration) return;

    dispatchToMainWindow({
      type: SET_BALANCE,
      payload: {...accountInfo.balance, walletId: name, network,
        balanceContext: accountInfo.balanceContext},
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

  async _selectTransactionWallet() {
    await this._ensureClient();
    if (!this.transactionClient) throw new Error('Transaction wallet client is unavailable.');
    if (this.didSelectTransactionWallet) return;
    if (this.pendingTransactionSelection) return this.pendingTransactionSelection;

    this.pendingTransactionSelection = this.transactionClient.execute('selectwallet', [this.name]);
    await this.pendingTransactionSelection;
    this.pendingTransactionSelection = null;
    this.didSelectTransactionWallet = true;
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
  _createSigningDiagnostics = async ({
    wallet,
    mtx,
    parsedMtxData,
    info,
    accountInfo,
    rings = [],
    actionName,
    diagnosticContext,
  }) => {
    let inputPathCount = null;
    let inputPathError = null;

    try {
      const inputPaths = await wallet.getInputPaths(mtx);
      inputPathCount = inputPaths.filter(Boolean).length;
    } catch (error) {
      inputPathError = error.message;
    }

    const signerInputCount = parsedMtxData.signerData
      .filter((input) => input && input.length)
      .length;
    const master = info.master || {};
    const unlockedUntil = master.until || 0;

    return {
      actionName,
      diagnosticContext,
      walletId: this.name,
      accountName: accountInfo.name,
      accountType: accountInfo.type,
      watchOnly: !!info.watchOnly,
      encrypted: !!master.encrypted,
      unlocked: !master.encrypted || unlockedUntil > 0,
      unlockedUntil,
      inputCount: mtx.inputs.length,
      outputCount: mtx.outputs.length,
      inputPathCount,
      inputPathError,
      signerInputCount,
      ringCount: rings.length,
      containsMultisig: !!parsedMtxData.containsMultisig,
    };
  };

  _throwSigningKeyError = async (context) => {
    const diagnostics = await this._createSigningDiagnostics(context);
    console.error('[WalletService._walletProxy] Signing key unavailable', diagnostics);

    const {actionName, diagnosticContext} = context;
    const name = diagnosticContext?.name;
    const error = new Error(
      actionName === 'bid-many'
        ? 'Basket signing failed. No transaction was sent. The wallet could not provide signing keys for its inputs; it may have locked during preparation. Unlock the correct wallet/account and review the entire basket again, including auction deadlines.'
        : actionName === 'bid'
        ? `Bid was not submitted${name ? ` for ${name}/` : ''}: Bob could build the bid transaction, but the selected wallet/account could not provide signing keys for its inputs. Unlock the correct wallet/account, confirm it is not watch-only, then rescan the auction before retrying.`
        : SIGNING_KEY_ERROR_MESSAGE
    );

    error.diagnostics = diagnostics;
    throw error;
  };

  _walletProxy = async (createFn, options) => {
    return this.walletMutationCoordinator.run(async () => {
      const transactionAttempted = options?.broadcast !== false;
      const transactionClient = this.client;
      const transactionWalletId = this.name;
      let preparationStarted = false;
      try {
        const storagePath = await this.nodeService.getDir();
        await storageHealth.preflight(storagePath, {
          source: 'transaction-preflight',
          transactionAttempted,
        });
        options?.assertCurrent?.();
        preparationStarted = true;
        await options?.beforePrepare?.();
        return await this._walletProxyUnchecked(createFn, options);
      } catch (error) {
        if (options?.actionName === 'register-all' && preparationStarted) {
          // Preparation may throw after unlocking, before the inner proxy's finally.
          try { await transactionClient.lock(transactionWalletId); }
          catch (lockError) { console.error('Could not relock interrupted registration wallet:', lockError); }
        }
        storageHealth.reportError(error, {
          source: 'transaction-preparation',
          transactionAttempted,
        });
        throw error;
      }
    });
  };

  _walletProxyUnchecked = async (createFn, options) => {
    const {
      broadcast = true,
      returnOnlyIfFullySigned = true, // if we don't have all signatures, return null
      ledgerOptions = {},
      metadata = null,
      actionName = 'transaction',
      diagnosticContext = {},
      timings = {},
      onStage = () => {},
      beforeSign = async () => {},
      reserveInputs = true,
      beforeBroadcast = async () => {},
      assertCurrent = () => {},
    } = options || {};

    assertCurrent();
    const walletId = this.name;
    const client = this.client;
    const wallet = await this.node.wdb.get(walletId);
    const info = await this.getWalletInfo();
    const accountInfo = await this.getAccountInfo();
    assertCurrent();
    if (actionName === 'register-all' && accountInfo.type === 'multisig') {
      throw new Error('Register All recovery does not yet support multisig wallets. Register names individually.');
    }

    // Call createFn to get an mtx
    let mtx = await createFn();

    // Coerce into MTX
    if (!(mtx instanceof MTX)) {
      mtx = MTX.fromJSON(mtx);
    }

    // Parse MTX Data
    await onStage('signing');
    const derivationStartedAt = Date.now();
    const parsedMtxData = await this.parseMtx(wallet, mtx, {metadata});
    mtx = parsedMtxData.mtx;  // mtx is modified (adding coins to view, etc.)
    assertCurrent();
    const releaseReservedInputs = reserveInputs ? reserveTransactionInputs(wallet, mtx) : () => {};
    let broadcastAttempted = false;
    let operationFailed = false;

    try {
      await beforeSign(mtx, wallet);
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
          assertCurrent();
          timings.inputDerivation = Date.now() - derivationStartedAt;
          if (actionName === 'bid-many') {
            console.info('[Auction Basket timing]', {
              phase: 'input-derivation',
              durationMs: timings.inputDerivation,
              walletId: this.name,
              inputCount: mtx.inputs.length,
            });
          }
          if (!rings.length) {
            await this._throwSigningKeyError({
              wallet,
              mtx,
              parsedMtxData,
              info,
              accountInfo,
              rings,
              actionName,
              diagnosticContext,
            });
          }
          const type = parsedMtxData.metadata?.inputs?.[0]?.sighashType ?? Script.hashType.ALL;
          try {
            const signingStartedAt = Date.now();
            await beforeSign(mtx, wallet);
            await mtx.sign(rings, type);
            timings.signing = Date.now() - signingStartedAt;
            if (actionName === 'bid-many') {
              console.info('[Auction Basket timing]', {
                phase: 'signing',
                durationMs: timings.signing,
                walletId: this.name,
                inputCount: mtx.inputs.length,
              });
            }
          } catch (error) {
            if (error && error.message === PRIVATE_KEY_ERROR_MESSAGE) {
              await this._throwSigningKeyError({
                wallet,
                mtx,
                parsedMtxData,
                info,
                accountInfo,
                rings,
                actionName,
                diagnosticContext,
              });
            }
            throw error;
          }
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
        assertCurrent();
        await beforeBroadcast(mtx.txid());
        try { assertCurrent(); }
        catch (error) { error.broadcastNotAttempted = true; throw error; }
        broadcastAttempted = true;
        const walletDB = wallet.wdb || this.node.wdb;
        let guardRejected = false;
        let result;
        try {
          result = await broadcastAndRecord({
            mtx,
            walletDB,
            broadcast: tx => this.nodeService.broadcastRawTx(tx.toHex(), {assertCurrent: () => {
              try { assertCurrent(); }
              catch (error) { guardRejected = true; throw error; }
            }}),
          });
        } catch (error) {
          // Only our synchronous pre-send guard proves transport was not entered.
          if (guardRejected) error.broadcastNotAttempted = true;
          throw error;
        }
        try {
          await this.refreshWalletInfo();
        } catch (error) {
          console.error('Could not refresh wallet state after accepted transaction:', error);
        }
        return result;
      }

      if (returnOnlyIfFullySigned) {
        if (isValid) return mtx;
        else return null;
      }

      return mtx;
    } catch (error) {
      operationFailed = true;
      throw error;
    } finally {
      releaseReservedInputs();
      try {
        await client.lock(walletId);
      } catch (error) {
        // Cleanup must never replace an accepted/uncertain transaction outcome
        // with an unrelated lock error that could invite a duplicate retry.
        console.error('Could not relock the transaction wallet:', error);
        if (!broadcastAttempted && !operationFailed) throw error;
      }
    }
  }

  /**
   * Parse Transaction
   * @param {import('hsd/lib/wallet/wallet')} wallet
   * @param {import('hsd/lib/primitives/mtx').MTX} mtx
   * @param {object} [options={}]
   * @param {Metadata} options.metadata
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
        if (trueBid !== undefined && !isNaN(Number(trueBid))) {
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

    // Validate tx
    let isValid = true;
    try {
      mtx.check();
    } catch (error) {
      isValid = false;
    }

    return {
      mtx,
      redeemScripts,
      multisigInfo,
      signerData,
      containsMultisig,
      maxSigsNeeded,
      canAddOwnSig,
      isValid,

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
      const signHandler = async (event) => {
        if (!isTrustedRendererEvent(event)) return;
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
            justSigned: true,
          });
        } catch (error) {
          console.error(error);
          mainWindow.send('MULTISIG/ERR', error.message);
        }
      }
      const continueHandler = async (event, options = {}) => {
        if (!isTrustedRendererEvent(event)) return;
        ipc.removeListener('MULTISIG/SIGN', signHandler);
        ipc.removeListener('MULTISIG/CONTINUE', continueHandler);
        ipc.removeListener('MULTISIG/CANCEL', cancelHandler);
        if (broadcast && !options.hideSuccessNotification) {
          dispatchToMainWindow(
            showSuccess(
              'Your request is submitted! Please wait around 15 minutes for it to be confirmed.'
            )
          );
        }
        resolve(mtx);
      }
      const cancelHandler = (event) => {
        if (!isTrustedRendererEvent(event)) return;
        // User has given up, inform the calling function.
        resolve(null);

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
      const resHandler = async (event) => {
        if (!isTrustedRendererEvent(event)) return;
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
      const cancelHandler = (event) => {
        if (!isTrustedRendererEvent(event)) return;
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

  async _executeTransactionRPC(method, args, cb) {
    await this._selectTransactionWallet();
    const res = await this.transactionClient.execute(method, args);
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

function getReceivePathIndex(path) {
  if (!path || path.change) {
    return null;
  }

  if (!path.derivation || typeof path.derivation !== 'string') {
    return null;
  }

  const index = Number(path.derivation.split('/').pop());
  if (!Number.isInteger(index) || index < 0) {
    return null;
  }

  return index;
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
service.findShakeWalletAddress.suppressLogging = true;
service.unlock.suppressLogging = true;
service.sendRegisterAll.suppressLogging = true;

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
  getReceiveAddresses: service.getReceiveAddresses,
  setAddressMetadata: service.setAddressMetadata,
  lookupWalletAddress: service.lookupWalletAddress,
  findShakeWalletAddress: service.findShakeWalletAddress,
  getAuctionInfo: service.getAuctionInfo,
  getTransactionHistory: service.getTransactionHistory,
  findBasketBidTransactions: service.findBasketBidTransactions,
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
  sendOpenMany: service.sendOpenMany,
  sendBid: service.sendBid,
  sendRegister: service.sendRegister,
  sendUpdate: service.sendUpdate,
  sendReveal: service.sendReveal,
  sendRedeem: service.sendRedeem,
  sendRevealAll: service.sendRevealAll,
  sendRevealMany: service.sendRevealMany,
  sendBidMany: service.sendBidMany,
  prepareBidMany: service.prepareBidMany,
  signPreparedBidMany: service.signPreparedBidMany,
  cancelBidManyAttempt: service.cancelBidManyAttempt,
  broadcastPreparedBidMany: service.broadcastPreparedBidMany,
  sendRedeemAll: service.sendRedeemAll,
  sendRegisterAll: service.sendRegisterAll,
  getRegisterAllStatus: service.getRegisterAllStatus,
  cancelRegisterAll: service.cancelRegisterAll,
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
  createLiquidityHnsSwapKey: service.createLiquidityHnsSwapKey,
  createLiquidityHnsLock: service.createLiquidityHnsLock,
  createLiquidityHnsClaim: service.createLiquidityHnsClaim,
  createLiquidityHnsRefund: service.createLiquidityHnsRefund,
  lock: service.lock,
  unlock: service.unlock,
  isLocked: service.isLocked,
  addSharedKey: service.addSharedKey,
  removeSharedKey: service.removeSharedKey,
  getNonce: service.getNonce,
  importNonce: service.importNonce,
  zap: service.zap,
  importName: service.importName,
  importNames: service.importNames,
  rpcGetWalletInfo: service.rpcGetWalletInfo,
  loadTransaction: service.loadTransaction,
  listWallets: service.listWallets,
  getStats: service.getStats,
  isReady: service.isReady,
  createClaim: service.createClaim,
  sendClaim: service.sendClaim,
};

export async function start(server) {
  const {wrapAcceptanceWalletMethods} = require('../packagedAcceptance/policy');
  server.withService(sName, wrapAcceptanceWalletMethods(
    methods,
    process.env.BOB_PACKAGED_ACCEPTANCE_TEST === 'true'
  ));
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
 * @property {boolean} isValid whether tx is fully signed and valid
 */
