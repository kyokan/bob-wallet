import * as walletClient from '../utils/walletClient';
import { showSuccess } from './notifications';
import ellipsify from '../utils/ellipsify';
import BigNumber from 'bignumber.js';

const SET_WALLET = 'app/wallet/setWallet';
const UNLOCK_WALLET = 'app/wallet/unlockWallet';
const LOCK_WALLET = 'app/wallet/lockWallet';
const SET_TRANSACTIONS = 'app/wallet/setTransactions';

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
  },
  transactions: [],
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
    case LOCK_WALLET:
      return {
        ...state,
        balance: {
          ...initialState.balance
        },
        isLocked: true,
        transactions: [],
      };
    case UNLOCK_WALLET:
      return {
        ...state,
        isLocked: false,
      };
    case SET_TRANSACTIONS:
      return {
        ...state,
        transactions: payload
      };
    default:
      return state;
  }
}

// Action Creators
export const setWallet = (opts) => {
  const {
    initialized = false,
    address = '',
    type = NONE,
    isLocked = true,
    balance = {}
  } = opts;

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

// side effects, e.g. thunks

export const completeInitialization = () => async (dispatch) => {
  localStorage.setItem('initialized', '1');
  await dispatch(fetchWallet());
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
      balance: (accountInfo && accountInfo.balance) || {
        ...initialState.balance
      }
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

export const removeWallet = () => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().wallet.network);
  await client.reset();
  return dispatch(fetchWallet());
};

export const send = (to, amount, fee) => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().wallet.network);
  await client.send(to, amount, fee);
  await dispatch(fetchWallet());
  await dispatch(showSuccess(`Successfully sent ${amount} HNS to ${ellipsify(to, 10)}.`));
};

export const fetchTransactions = () => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().wallet.network);
  const txs = await client.getTransactionHistory();
  let aggregate = new BigNumber(0);
  let payload = [];
  for (const tx of txs) {
    const {value, type, sender, receiver} = parseInputsOutputs(tx);
    aggregate = type === 'sent' ? aggregate.minus(value) : aggregate.plus(value);
    payload.push({
      id: tx.hash,
      type,
      date: tx.mtime,
      pending: tx.block > -1,
      receiver,
      sender,
      value,
      balance: aggregate.toString()
    });
  }

  payload = payload.reverse();

  dispatch({
    type: SET_TRANSACTIONS,
    payload,
  });
};

function parseInputsOutputs(tx) {
  let type = 'received';
  let receiver = '';
  let sender;
  for (const input of tx.inputs) {
    if (input.path) {
      type = 'sent';
      break;
    }

    sender = input.address;
  }

  const aggOutputs = tx.outputs.reduce((total, output) => {
    // ignore change outputs
    if ((type === 'sent' && output.path) || (type === 'received' && !output.path)) {
      return total;
    }

    if (type === 'sent' && !output.path) {
      receiver = output.address;
    }

    return total.plus(output.value);
  }, new BigNumber(0));

  // TODO: handle sending funds to yourself (shouldn't happen, but need to support anyway)
  // TODO: display fee

  return {
    value: aggOutputs.toString(),
    type,
    receiver,
    sender,
  }
}
