export const NONE = 'NONE';
export const LEDGER = 'LEDGER';
export const IMPORTED = 'IMPORTED';
export const ELECTRON = 'ELECTRON';

export const SET_WALLET = 'app/wallet/setWallet';
export const SET_BALANCE = 'app/wallet/setBalance';
export const UNLOCK_WALLET = 'app/wallet/unlockWallet';
export const LOCK_WALLET = 'app/wallet/lockWallet';
export const SET_TRANSACTIONS = 'app/wallet/setTransactions';
export const INCREMENT_IDLE = 'app/wallet/incrementIdle';
export const RESET_IDLE = 'app/wallet/resetIdle';
export const SET_PENDING_TRANSACTIONS = 'app/wallet/setPendingTransactions';
export const START_SYNC_WALLET = 'app/wallet/startSyncWallet';
export const STOP_SYNC_WALLET = 'app/wallet/stopSyncWallet';
export const SYNC_WALLET_PROGRESS = 'app/wallet/syncWalletProgress';
export const GET_PASSPHRASE = 'app/wallet/getPassphrase';
export const SET_API_KEY = 'app/wallet/setApiKey';
export const SET_FETCHING = 'app/wallet/setFetching';
export const SET_WALLETS = 'app/wallet/setWallets';

export function getInitialState() {
  return {
    address: '',
    apiKey: '',
    wid: '',
    watchOnly: false,
    type: NONE,
    isLocked: true,
    isFetching: false,
    initialized: false,
    network: '',
    balance: {
      confirmed: 0,
      unconfirmed: 0,
      lockedConfirmed: 0,
      lockedUnconfirmed: 0,
    },
    changeDepth: 0,
    receiveDepth: 0,
    transactions: new Map(),
    idle: 0,
    walletSync: false,
    walletHeight: 0,
    getPassphrase: {get: false},
    wallets: [],
    walletsDetails: {},
  };
}

export default function walletReducer(state = getInitialState(), {type, payload}) {
  switch (type) {
    case SET_WALLET:
      return {
        ...state,
        transactions: state.wid === payload.wid
          ? state.transactions
          : new Map(),
        wid: payload.wid,
        watchOnly: payload.watchOnly,
        address: payload.address,
        type: payload.type,
        balance: {
          ...state.balance,
          confirmed: payload.balance.confirmed,
          unconfirmed: payload.balance.unconfirmed,
          lockedUnconfirmed: payload.balance.lockedUnconfirmed,
          lockedConfirmed: payload.balance.lockedConfirmed,
          spendable: payload.balance.unconfirmed - payload.balance.lockedUnconfirmed,
        },
        changeDepth: payload.changeDepth,
        receiveDepth: payload.receiveDepth,
        initialized: typeof payload.initialized === 'undefined' ? state.initialized : payload.initialized,
        apiKey: payload.apiKey,
      };
    case SET_BALANCE:
      return {
        ...state,
        balance: {
          ...state.balance,
          confirmed: payload.confirmed,
          unconfirmed: payload.unconfirmed,
          lockedUnconfirmed: payload.lockedUnconfirmed,
          lockedConfirmed: payload.lockedConfirmed,
          spendable: payload.unconfirmed - payload.lockedUnconfirmed,
        }
      };
    case SET_API_KEY:
      return {
        ...state,
        apiKey: payload,
      };
    case LOCK_WALLET:
      return {
        ...state,
        isLocked: true,
      };
    case UNLOCK_WALLET:
      return {
        ...state,
        isLocked: false,
      };
    case SET_TRANSACTIONS:
      return {
        ...state,
        transactions: payload,
      };
    case INCREMENT_IDLE:
      return {
        ...state,
        idle: state.idle + 1,
      };
    case RESET_IDLE:
      return {
        ...state,
        idle: 0,
      };
    case START_SYNC_WALLET:
      return {
        ...state,
        walletSync: true,
      };
    case STOP_SYNC_WALLET:
      return {
        ...state,
        walletSync: false,
      };
    case SYNC_WALLET_PROGRESS:
      return {
        ...state,
        walletHeight: payload,
      };
    case GET_PASSPHRASE:
      return {
        ...state,
        getPassphrase: payload,
      };
    case SET_FETCHING:
      return {
        ...state,
        isFetching: payload,
      };
    case SET_WALLETS:
      return {
        ...state,
        wallets: payload.wallets,
        walletsDetails: payload.walletsDetails,
      };
    default:
      return state;
  }
}
