export const NONE = 'NONE';
export const LEDGER = 'LEDGER';
export const IMPORTED = 'IMPORTED';
export const ELECTRON = 'ELECTRON';

export const SET_WALLET = 'app/wallet/setWallet';
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

export function getInitialState() {
  return {
    address: '',
    type: NONE,
    isLocked: true,
    initialized: false,
    network: '',
    balance: {
      confirmed: 0,
      unconfirmed: 0,
      lockedConfirmed: 0,
      lockedUnconfirmed: 0,
    },
    transactions: new Map(),
    idle: 0,
    walletSync: false,
    walletSyncProgress: 0,
    getPassphrase: {get: false},
  };
}

export default function walletReducer(state = getInitialState(), {type, payload}) {
  switch (type) {
    case SET_WALLET:
      return {
        ...state,
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
        initialized: payload.initialized
      };
    case LOCK_WALLET:
      return {
        ...state,
        isLocked: true
      };
    case UNLOCK_WALLET:
      return {
        ...state,
        isLocked: false
      };
    case SET_TRANSACTIONS:
      return {
        ...state,
        transactions: payload
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
        walletSyncProgress: payload,
      };
    case GET_PASSPHRASE:
      return {
        ...state,
        getPassphrase: payload,
      };
    default:
      return state;
  }
}
