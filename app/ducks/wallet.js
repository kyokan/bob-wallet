import WalletClient from '../utils/walletClient';

const SET_WALLET = 'app/wallet/setWallet';
const UNLOCK_WALLET = 'app/wallet/unlockWallet';
const LOCK_WALLET = 'app/wallet/lockWallet';
const REMOVE_WALLET = 'app/wallet/removeWallet';

export const NONE = 'NONE';
export const LEDGER = 'LEDGER';
export const IMPORTED = 'IMPORTED';
export const EXTENSION = 'EXTENSION';

// Intial State
const initialState = {
  address: '',
  type: NONE,
  isLocket: true,
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

// side effects, only as applicable
// e.g. thunks, epics, etc

// (async () => {
//   const resp = await fetch('http://127.0.0.1:15037');
//   const json = await resp.json();
//   console.log(json);
// })();

// WIP
export const createWallet = async () => {
  const res = await WalletClient.getPrivateKeyByAddress(
    'two',
    'ss1q0svwnsu7yxsgtyj5nsrkv880ca5ylf80gq7le7',
    'michael'
  );
  console.log(res);
  // get('/widget').then(widget => dispatch(updateWidget(widget)));
};

// export const generateWallet = () => {
//   return dispatch =>

// }
