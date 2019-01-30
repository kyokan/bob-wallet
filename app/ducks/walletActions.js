import * as walletClient from '../utils/walletClient';
import BigNumber from 'bignumber.js';
import throttle from 'lodash.throttle';
import * as namesDb from '../db/names';
import { getInitializationState, setInitializationState } from '../db/system';
import {
  getInitialState,
  INCREMENT_IDLE,
  LOCK_WALLET, RESET_IDLE,
  SET_PENDING_TRANSACTIONS,
  SET_TRANSACTIONS,
  SET_WALLET,
  UNLOCK_WALLET,
  NONE
} from './walletReducer';

let idleInterval;

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

export const completeInitialization = (passphrase) => async (dispatch, getState) => {
  const network = getState().node.network;
  const wClient = walletClient.forNetwork(network);
  await wClient.unlock(passphrase);
  await setInitializationState(network, true);
  await dispatch(fetchWallet());
  dispatch({
    type: UNLOCK_WALLET
  });
};

export const fetchWallet = () => async (dispatch, getState) => {
  const network = getState().node.network;

  // TODO: remove the below once we've all pulled master
  const oldInitialized = localStorage.getItem('initialized');
  if (oldInitialized) {
    await setInitializationState(network, true);
    localStorage.removeItem('initialized');
  }

  const isInitialized = await getInitializationState(network);

  if (!isInitialized) {
    return dispatch(setWallet({
      initialized: false,
      address: '',
      type: NONE,
      isLocked: true,
      balance: {
        ...getInitialState().balance
      }
    }))
  }

  const client = walletClient.forNetwork(network);
  const accountInfo = await client.getAccountInfo();
  const isLocked = await client.isLocked();
  dispatch(setWallet({
    initialized: isInitialized,
    address: accountInfo && accountInfo.receiveAddress,
    type: NONE,
    isLocked,
    balance: (accountInfo && accountInfo.balance) || {
      ...getInitialState().balance
    }
  }));
};

export const revealSeed = (passphrase) => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().node.network);
  return client.revealSeed(passphrase);
};

export const unlockWallet = passphrase => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().node.network);
  await client.unlock(passphrase);
  await dispatch(fetchWallet());
};

export const lockWallet = () => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().node.network);
  dispatch({
    type: LOCK_WALLET
  });
  await client.lock();
};

export const removeWallet = () => async (dispatch, getState) => {
  const network = getState().node.network;
  const client = walletClient.forNetwork(network);
  await client.reset();
  await setInitializationState(network, false);
  return dispatch(fetchWallet());
};

export const send = (to, amount, fee) => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().node.network);
  await client.send(to, amount, fee);
  await dispatch(fetchWallet());
};

export const fetchTransactions = () => async (dispatch, getState) => {
  const client = walletClient.forNetwork(getState().node.network);
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

  const client = walletClient.forNetwork(getState().node.network);
  const payload = await client.getPendingTransactions();
  dispatch({
    type: SET_PENDING_TRANSACTIONS,
    payload
  });
};

const incrementIdle = () => ({
  type: INCREMENT_IDLE,
});

export const resetIdle = () => ({
  type: RESET_IDLE,
});

export const watchActivity = () => dispatch => {
  if (!idleInterval) {
    // Increment idle once a minute
    setInterval(() => dispatch(incrementIdle()), 60000);

    // Reset idle time to zero on any activity, throttled by 5 seconds
    const handler = throttle(() => dispatch(resetIdle()), 5000, { leading: true });
    document.addEventListener('mousemove', handler);
    document.addEventListener('keypress', handler);
  }
};

// TODO: Make this method smarter
async function parseInputsOutputs(tx) {
  const correctOutput = tx.outputs.filter(({path}) => !path || !path.change)[0];
  const covenant = correctOutput.covenant;

  if (covenant && covenant.action !== 'NONE') {
    const covData = await parseCovenant(covenant);
    return {
      ...covData,
      fee: tx.fee,
      value: getValueByConvenant(tx, covenant),
    };
  }

  if (!tx.outputs.length) {
    return {
      type: 'UNKNOWN',
      meta: {},
      value: '0'
    };
  }

  for (const input of tx.inputs) {
    if (input.path) {
      return {
        type: 'SEND',
        meta: {
          to: correctOutput.address
        },
        value: correctOutput.value,
        fee: tx.fee
      };
    }
  }

  for (const output of tx.outputs) {
    const isCoinbase = tx.inputs.length === 1 && !tx.inputs[0].address;

    if (output.path) {
      return {
        type: isCoinbase ? 'COINBASE' : 'RECEIVE',
        meta: {
          from: isCoinbase ? '' : tx.inputs[0].address
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
    case 'RENEW':
      return {
        type: 'RENEW',
        meta: {
          domain: await nameByHash(covenant),
        }
      };
    case 'REDEEM':
      return {
        type: 'REDEEM',
        meta: {
          domain: await nameByHash(covenant),
        }
      };
    default:
      return {type: 'UNKNOWN', meta: {}};
  }
}

function getValueByConvenant(tx, covenant) {
  switch (covenant.action) {
    case 'OPEN':
      return 0;
    case 'BID':
      return tx.outputs[0].value;
    case 'REVEAL':
      return 0;
    case 'UPDATE':
      return 0;
    case 'REGISTER':
      return 0;
    default:
      return 0;
  }
}

async function nameByHash(covenant) {
  return await namesDb.findNameByHash(covenant.items[0]);
}