import * as walletClient from '../utils/walletClient';
import { showSuccess } from './notifications';
import ellipsify from '../utils/ellipsify';
import BigNumber from 'bignumber.js';
import * as namesDb from '../db/names';

const SET_WALLET = 'app/wallet/setWallet';
const UNLOCK_WALLET = 'app/wallet/unlockWallet';
const LOCK_WALLET = 'app/wallet/lockWallet';
const SET_TRANSACTIONS = 'app/wallet/setTransactions';

export const NONE = 'NONE';
export const LEDGER = 'LEDGER';
export const IMPORTED = 'IMPORTED';
export const ELECTRON = 'ELECTRON';

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

export default function walletReducer(state = initialState, {type, payload}) {
  switch (type) {
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

  dispatch(setWallet({
    initialized: !!walletInfo && !!accountInfo && !!localStorage.getItem('initialized'),
    address: accountInfo && accountInfo.receiveAddress,
    type: NONE,
    balance: (accountInfo && accountInfo.balance) || {
      ...initialState.balance
    }
  }));
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
    const ios = await parseInputsOutputs(tx);
    aggregate = ios.type !== 'RECEIVE' ? aggregate.minus(ios.value) : aggregate.plus(ios.value);
    payload.push({
      id: tx.hash,
      date: tx.mtime,
      pending: tx.block > -1,
      balance: aggregate.toString(),
      ...ios
    });
  }

  payload = payload.reverse();
  dispatch({
    type: SET_TRANSACTIONS,
    payload,
  });
};


// TODO: Make this method smarter
async function parseInputsOutputs(tx) {
  if (tx.outputs.length !== 2) {
    return {
      type: 'UNKNOWN',
      meta: {},
      value: '0'
    };
  }

  const covenant = tx.outputs[0].covenant;
  if (covenant && covenant.action !== 'NONE') {
    const covData = await parseCovenant(covenant);
    return {
      ...covData,
      fee: tx.fee,
      value: tx.fee,
    };
  }


  for (const input of tx.inputs) {
    if (input.path) {
      return {
        type: 'SEND',
        meta: {
          to: tx.outputs[0].address
        },
        value: tx.outputs[0].value,
        fee: tx.fee
      };
    }
  }

  for (const output of tx.outputs) {
    if (output.path) {
      return {
        type: 'RECEIVE',
        meta: {
          from: tx.inputs[0].address,
        },
        value: output.value,
        fee: tx.fee
      };
    }
  }

  return {
    type: 'UNKNOWN',
    meta: {},
    value: '0'
  };
}

async function parseCovenant(covenant) {
  switch (covenant.action) {
    case 'OPEN':
      return {type: 'OPEN', meta: {domain: await nameByHash(covenant)}};
    case 'BID':
      return {type: 'BID', meta: {domain: await nameByHash(covenant)}};
    case 'REVEAL':
      return {type: 'REVEAL', meta: {domain: await nameByHash(covenant)}};
    default:
      return {type: 'UNKNOWN', meta: {}}
  }
}

async function nameByHash(covenant) {
  return await namesDb.findNameByHash(covenant.items[0])
}
