import * as walletClient from '../utils/walletClient';

const SET_WALLET = 'app/wallet/setWallet';
const UNLOCK_WALLET = 'app/wallet/unlockWallet';
const LOCK_WALLET = 'app/wallet/lockWallet';
const REMOVE_WALLET = 'app/wallet/removeWallet';
const IS_INITIALIZED = 'app/wallet/isInitialized';

export const NONE = 'NONE';
export const LEDGER = 'LEDGER';
export const IMPORTED = 'IMPORTED';
export const ELECTRON = 'ELECTRON';

// Intial State
const initialState = {
  address: '',
  type: NONE,
  isLocked: true,
  initialized: false,
  network: 'simnet',
  balance: {
    confirmed: '0',
    unconfirmed: '0'
  }
};

// Reducer
export default function walletReducer(state = initialState, {type, payload}) {
  switch (type) {
    // do reducer stuff
    case SET_WALLET:
      return {
        ...state,
        address: payload.address,
        type: payload.type,
        isLocked: payload.isLocked,
        balance: {
          ...state.balance,
          confirmed: payload.balance.confirmed || '',
          unconfirmed: payload.balance.unconfirmed || ''
        },
        initialized: payload.initialized
      };
    case IS_INITIALIZED:
      return {
        ...state,
        initialized: !!localStorage.getItem('initialized')
      };
    case LOCK_WALLET:
      return {
        ...state,
        balance: {
          ...initialState.balance
        },
        isLocked: true,
      };
    case UNLOCK_WALLET:
      return {
        ...state,
        isLocked: false,
      };
    default:
      return state;
  }
}

// Action Creators
export const setWallet = ({
  initialized = false,
  address = '',
  type = NONE,
  isLocked = true,
  balance = {}
}) => {
  return {
    type: SET_WALLET,
    payload: {
      initialized,
      address,
      type,
      isLocked,
      balance
    }
  };
};

export const isInitialized = () => {
  return {
    type: IS_INITIALIZED,
    payload: {
      initialized: !!localStorage.getItem('initialized')
    }
  };
};

// side effects, e.g. thunks

export const completeInitialization = () => dispatch => {
  localStorage.setItem('initialized', '1');
  dispatch(fetchWallet());
  dispatch({
    type: UNLOCK_WALLET
  });
};

export const fetchWallet = () => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().wallet.network);
  const walletInfo = await client.getWalletInfo();
  const accountInfo = await client.getAccountInfo();
  dispatch(
    setWallet({
      initialized: !!walletInfo && !!accountInfo && !!localStorage.getItem('initialized'),
      address: accountInfo && accountInfo.receiveAddress,
      type: NONE,
      // isLocked: false,
      balance: accountInfo && accountInfo.balance
    })
  );
};

export const unlockWallet = (passphrase) => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().wallet.network);
  await client.unlock(passphrase);
  dispatch({
    type: UNLOCK_WALLET
  });
};

export const lockWallet = () => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().wallet.network);
  dispatch({
    type: LOCK_WALLET,
  });
  await client.lock();
};
