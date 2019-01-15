import * as walletClient from '../utils/walletClient';
import BigNumber from 'bignumber.js';
import * as namesDb from '../db/names';

const SET_WALLET = 'app/wallet/setWallet';
const UNLOCK_WALLET = 'app/wallet/unlockWallet';
const LOCK_WALLET = 'app/wallet/lockWallet';
const SET_TRANSACTIONS = 'app/wallet/setTransactions';
export const SET_PENDING_TRANSACTIONS = 'app/wallet/setPendingTransactions';

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
  transactions: []
};

export default function walletReducer(state = initialState, { type, payload }) {
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
          unconfirmed: payload.balance.unconfirmed || '',
          lockedUnconfirmed: payload.balance.lockedUnconfirmed || 0,
          lockedConfirmed: payload.balance.lockedConfirmed || 0,
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
        transactions: []
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
    default:
      return state;
  }
}

export const setWallet = opts => {
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

export const completeInitialization = () => async dispatch => {
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
  const isLocked = await client.isLocked();

  dispatch(
    setWallet({
      initialized:
        !!walletInfo && !!accountInfo && !!localStorage.getItem('initialized'),
      address: accountInfo && accountInfo.receiveAddress,
      type: NONE,
      isLocked,
      balance: (accountInfo && accountInfo.balance) || {
        ...initialState.balance
      }
    })
  );
};

let lockStateTimeout;
export const pollLockState = () => async (dispatch, getState) => {
  const poller = async () => {
    try {
      const client = walletClient.forNetwork(getState().wallet.network);
      const isLocked = await client.isLocked();

      if (isLocked) {
        dispatch({
          type: LOCK_WALLET
        });
      }
    } catch (e) {
      console.error(e);
    }

    lockStateTimeout = setTimeout(poller, 5000);
  };

  poller();
};

export const stopPollingLockState = () => {
  clearTimeout(lockStateTimeout);
};

export const unlockWallet = passphrase => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().wallet.network);
  await client.unlock(passphrase);
  dispatch({
    type: UNLOCK_WALLET
  });
};

export const lockWallet = () => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().wallet.network);
  dispatch({
    type: LOCK_WALLET
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
};

export const fetchTransactions = () => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().wallet.network);
  const txs = await client.getTransactionHistory();
  let aggregate = new BigNumber(0);
  let payload = [];
  for (const tx of txs) {
    const ios = await parseInputsOutputs(tx);
    aggregate =
      ios.type !== 'RECEIVE'
        ? aggregate.minus(ios.value)
        : aggregate.plus(ios.value);
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
    payload
  });
};

export const fetchPendingTransactions = () => async (dispatch, getState) => {
  if (!getState().wallet.initialized) {
    return;
  }

  const client = walletClient.forNetwork(getState().wallet.network);
  const payload = await client.getPendingTransactions();
  dispatch({
    type: SET_PENDING_TRANSACTIONS,
    payload
  });
};

let isPolling = false;
export const pollPendingTransactions = force => async dispatch => {
  if (!force && isPolling) {
    return;
  }
  isPolling = true;
  await dispatch(fetchPendingTransactions());
  setTimeout(() => dispatch(pollPendingTransactions(true)), 1000);
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
      value: tx.fee
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
          from: tx.inputs[0].address
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
      return { type: 'OPEN', meta: { domain: await nameByHash(covenant) } };
    case 'BID':
      return { type: 'BID', meta: { domain: await nameByHash(covenant) } };
    case 'REVEAL':
      return { type: 'REVEAL', meta: { domain: await nameByHash(covenant) } };
    case 'UPDATE':
      return {
        type: 'UPDATE',
        meta: {
          domain: await nameByHash(covenant),
          data: covenant.items[2],
        },
      };
    case 'REGISTER':
      return {
        type: 'UPDATE',
        meta: {
          domain: await nameByHash(covenant),
          data: covenant.items[2],
        },
      };
    default:
      return { type: 'UNKNOWN', meta: {} };
  }
}

async function nameByHash(covenant) {
  return await namesDb.findNameByHash(covenant.items[0]);
}
