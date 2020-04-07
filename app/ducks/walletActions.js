import walletClient from '../utils/walletClient';
import nodeClient from '../utils/nodeClient';
import BigNumber from 'bignumber.js';
import throttle from 'lodash.throttle';
import { getInitializationState, setInitializationState } from '../db/system';
import {
  getInitialState,
  INCREMENT_IDLE,
  LOCK_WALLET,
  NONE,
  RESET_IDLE,
  SET_PENDING_TRANSACTIONS,
  SET_TRANSACTIONS,
  SET_WALLET,
  UNLOCK_WALLET,
  START_SYNC_WALLET,
  STOP_SYNC_WALLET,
  SYNC_WALLET_PROGRESS,
} from './walletReducer';

let idleInterval;

export const setWallet = opts => {
  const {
    initialized = false,
    address = '',
    type = NONE,
    isLocked = true,
    balance = {},
  } = opts;

  return {
    type: SET_WALLET,
    payload: {
      initialized,
      address,
      type,
      isLocked,
      balance,
    },
  };
};

export const completeInitialization = (passphrase) => async (dispatch, getState) => {
  const network = getState().node.network;
  await walletClient.unlock(passphrase);
  await setInitializationState(network, true);
  await dispatch(fetchWallet());
  dispatch({
    type: UNLOCK_WALLET,
  });
};

export const fetchWallet = () => async (dispatch, getState) => {
  const network = getState().node.network;
  const isInitialized = await getInitializationState(network);

  if (!isInitialized) {
    return dispatch(setWallet({
      initialized: false,
      address: '',
      type: NONE,
      isLocked: true,
      balance: {
        ...getInitialState().balance,
      },
    }));
  }

  const accountInfo = await walletClient.getAccountInfo();
  const isLocked = await walletClient.isLocked();
  dispatch(setWallet({
    initialized: isInitialized,
    address: accountInfo && accountInfo.receiveAddress,
    type: NONE,
    isLocked,
    balance: (accountInfo && accountInfo.balance) || {
      ...getInitialState().balance,
    },
  }));
};

export const revealSeed = (passphrase) => async () => {
  return walletClient.revealSeed(passphrase);
};

export const unlockWallet = passphrase => async (dispatch) => {
  await walletClient.unlock(passphrase);
  await dispatch(fetchWallet());
};

export const lockWallet = () => async (dispatch) => {
  await walletClient.lock();
  dispatch({
    type: LOCK_WALLET,
  });
};

export const removeWallet = () => async (dispatch, getState) => {
  const network = getState().node.network;
  await walletClient.reset();
  await setInitializationState(network, false);
  return dispatch(fetchWallet());
};

export const send = (to, amount, fee) => async (dispatch) => {
  const res = await walletClient.send(to, amount, fee);
  await dispatch(fetchWallet());
  return res;
};

export const startWalletSync = () => async (dispatch) => {
  await dispatch({type: START_SYNC_WALLET});
};

export const stopWalletSync = () => async (dispatch) => {
  await dispatch({type: STOP_SYNC_WALLET});
};

export const waitForWalletSync = () => async (dispatch, getState) => {
  let lastProgress = 0;
  let stall = 0;

  for (;;) {
    const nodeInfo = await nodeClient.getInfo();
    const wdbInfo = await walletClient.rpcGetWalletInfo();

    if (nodeInfo.chain.height === 0) {
      dispatch({type: STOP_SYNC_WALLET});
      break;
    }

    const progress = parseInt(wdbInfo.height / nodeInfo.chain.height * 100);

    // If we go 5 seconds without any progress, throw an error
    if (lastProgress === progress) {
      stall++;
    } else {
      lastProgress = progress;
      stall = 0;
    }

    if (stall >= 5) {
      dispatch({type: STOP_SYNC_WALLET});
      throw new Error('Wallet sync progress has stalled.');
      break;
    }

    if (progress === 100) {
      dispatch({type: STOP_SYNC_WALLET});
      break;
    } else {
      dispatch({type: SYNC_WALLET_PROGRESS, payload: progress});
    }

    await new Promise((r) => setTimeout(r, 1000));
  }
};

export const fetchTransactions = () => async (dispatch, getState) => {
  const net = getState().node.network;
  const txs = await walletClient.getTransactionHistory();
  let aggregate = new BigNumber(0);
  let payload = [];

  for (const tx of txs) {
    const ios = await parseInputsOutputs(net, tx);
    aggregate =
      ios.type !== 'RECEIVE'
        ? aggregate.minus(ios.value)
        : aggregate.plus(ios.value);
    const isPending = tx.block === null;
    const txData = {
      id: tx.hash,
      date: isPending ? Date.now() : Date.parse(tx.date),
      pending: isPending,
      balance: aggregate.toString(),
      ...ios,
    };

    if (isPending) {
      payload.unshift(txData);
      continue;
    }

    payload.push(txData);
  }

  payload = payload.sort((a, b) => b.date - a.date);

  dispatch({
    type: SET_TRANSACTIONS,
    payload,
  });
};

export const fetchPendingTransactions = () => async (dispatch, getState) => {
  if (!getState().wallet.initialized) {
    return;
  }

  const payload = await walletClient.getPendingTransactions();
  dispatch({
    type: SET_PENDING_TRANSACTIONS,
    payload,
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
    const handler = throttle(() => dispatch(resetIdle()), 5000, {leading: true});
    document.addEventListener('mousemove', handler);
    document.addEventListener('keypress', handler);
  }
};

// TODO: Make this method smarter
async function parseInputsOutputs(net, tx) {
  const correctOutput = tx.outputs.filter(({path}) => !path || !path.change)[0];
  const covenant = correctOutput.covenant;

  if (covenant && covenant.action !== 'NONE') {
    const covData = await parseCovenant(net, covenant);
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
      value: '0',
    };
  }

  for (const input of tx.inputs) {
    if (input.path) {
      return {
        type: 'SEND',
        meta: {
          to: correctOutput.address,
        },
        value: correctOutput.value,
        fee: tx.fee,
      };
    }
  }

  // Handles odd transactions with null input data, such as coinbases with
  // airdrops included in them. See tx
  // hash 8bde704a5177f9ae3a0a091058119e4bf52a8c1cc218f0a6b9dad4346ec74fbd
  // for an example.
  // In HSD: lib/mining/template.js
  let isCoinbase = true;
  for (const input of tx.inputs) {
    if (input.address) {
      isCoinbase = false;
      break;
    }
  }

  let totalValue = 0;
  let rec = false;
  for (const output of tx.outputs) {
    if (output.path) {
      rec = true;
      totalValue += output.value;
    }
  }

  if (rec) {
    return {
      type: isCoinbase ? 'COINBASE' : 'RECEIVE',
      meta: {
        from: isCoinbase ? '' : tx.inputs[0].address,
      },
      value: totalValue,
      fee: tx.fee,
    };
  }

  return {
    type: 'UNKNOWN',
    meta: {},
    value: '0',
  };
}

async function parseCovenant(net, covenant) {
  switch (covenant.action) {
    case 'OPEN':
      return {type: 'OPEN', meta: {domain: await nameByHash(net, covenant)}};
    case 'BID':
      return {type: 'BID', meta: {domain: await nameByHash(net, covenant)}};
    case 'REVEAL':
      return {type: 'REVEAL', meta: {domain: await nameByHash(net, covenant)}};
    case 'UPDATE':
      return {
        type: 'UPDATE',
        meta: {
          domain: await nameByHash(net, covenant),
          data: covenant.items[2],
        },
      };
    case 'REGISTER':
      return {
        type: 'UPDATE',
        meta: {
          domain: await nameByHash(net, covenant),
          data: covenant.items[2],
        },
      };
    case 'RENEW':
      return {
        type: 'RENEW',
        meta: {
          domain: await nameByHash(net, covenant),
        },
      };
    case 'REDEEM':
      return {
        type: 'REDEEM',
        meta: {
          domain: await nameByHash(net, covenant),
        },
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

const MAX_NAME_CACHE_SIZE = 500;

const nameCache = {
  currNet: null,
  cache: {},
};

async function nameByHash(net, covenant) {
  if (nameCache.currNet !== net) {
    nameCache.currNet = net;
    nameCache.cache = {};
  }
  if (Object.keys(nameCache.cache) > MAX_NAME_CACHE_SIZE) {
    nameCache.cache = {};
  }

  const hash = covenant.items[0];
  if (nameCache.cache[hash]) {
    return nameCache.cache[hash];
  }
  let name = await nodeClient.getNameByHash(hash);

  if (!name && covenant.action === 'OPEN') {
    // Before an OPEN is confirmed, the name->hash mapping will not be present
    // in the full node. Luckily, the name is included as an ASCII string in
    // the covenant itself.
    name = Buffer.from(covenant.items[2], 'hex').toString('ascii');
  }

  if (name) {
    nameCache.cache[hash] = name;
  }

  return name;
}
