import { getWalletInfo, generateReceivingAddress } from '../utils/walletClient';

const SET_WALLET = 'app/wallet/setWallet';
const UNLOCK_WALLET = 'app/wallet/unlockWallet';
const LOCK_WALLET = 'app/wallet/lockWallet';
const REMOVE_WALLET = 'app/wallet/removeWallet';
const COMPLETE_INITIALIZATION = 'app/wallet/completeInitialization';

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
    case COMPLETE_INITIALIZATION:
      return {
        ...state,
        initialized: true
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
  console.log('setWalletgetsCalled');
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

// side effects, only as applicable
// e.g. thunks, epics, etc

// WIP
export const completeInitialization = () => dispatch => {
  dispatch({ type: COMPLETE_INITIALIZATION });
  dispatch(fetchWallet());
};

export const fetchWallet = () => async dispatch => {
  const walletInfo = await getWalletInfo();
  const generatedReceivingAddress = await generateReceivingAddress();
  console.log(walletInfo);
  dispatch(
    setWallet({
      initialized: true,
      address: generatedReceivingAddress.address,
      type: NONE,
      isLocked: false,
      balance: walletInfo.balance
    })
  );
};

// export const generateWallet = () => {
//   return dispatch =>

// }
