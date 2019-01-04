import { getWalletInfo, generateReceivingAddress } from '../utils/walletClient';

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
  // note: Reimplement once we lock wallet
  // isLocked: true,
  initialized: false,
  balance: {
    confirmed: '0',
    unconfirmed: '0'
  }
};

// Reducer
export default function walletReducer(state = initialState, { type, payload }) {
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
    default:
      return state;
  }
}

// Action Creators
export const setWallet = ({
  initialized = false,
  address = '',
  type = NONE,
  isLocked = false,
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
  dispatch(isInitialized());
  dispatch(fetchWallet());
};

export const fetchWallet = () => async dispatch => {
  const walletInfo = await getWalletInfo();
  const generatedReceivingAddress = await generateReceivingAddress();
  dispatch(
    setWallet({
      initialized: !!localStorage.getItem('initialized'),
      address: generatedReceivingAddress && generatedReceivingAddress.address,
      type: NONE,
      // isLocked: false,
      balance: walletInfo && walletInfo.balance
    })
  );
};
