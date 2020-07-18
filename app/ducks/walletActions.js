import walletClient from '../utils/walletClient';
import nodeClient from '../utils/nodeClient';
import throttle from 'lodash.throttle';
import { getInitializationState, setInitializationState } from '../db/system';
import {
  GET_PASSPHRASE,
  getInitialState,
  INCREMENT_IDLE,
  LOCK_WALLET,
  NONE,
  RESET_IDLE,
  SET_PENDING_TRANSACTIONS,
  SET_TRANSACTIONS,
  SET_WALLET,
  START_SYNC_WALLET,
  STOP_SYNC_WALLET,
  SYNC_WALLET_PROGRESS,
  UNLOCK_WALLET,
} from './walletReducer';
import { NEW_BLOCK_STATUS } from './nodeReducer';

let idleInterval;

export const setWallet = opts => {
  const {
    initialized = false,
    address = '',
    type = NONE,
    balance = {},
  } = opts;

  return {
    type: SET_WALLET,
    payload: {
      initialized,
      address,
      type,
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
      balance: {
        ...getInitialState().balance,
      },
    }));
  }

  const accountInfo = await walletClient.getAccountInfo();
  dispatch(setWallet({
    initialized: isInitialized,
    address: accountInfo && accountInfo.receiveAddress,
    type: NONE,
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
  dispatch({
    type: UNLOCK_WALLET,
  });
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
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
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

  for (; ;) {
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
  const state = getState();
  const net = state.node.network;
  const currentTXs = state.wallet.transactions;
  const txs = await walletClient.getTransactionHistory();
  let payload = new Map();

  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    const existing = currentTXs.get(tx.hash);
    if (existing) {
      const isPending = tx.block === null;
      existing.date = isPending ? Date.now() : Date.parse(tx.date);
      existing.pending = isPending;

      payload.set(existing.id, existing);
      continue;
    }
    dispatch({type: NEW_BLOCK_STATUS, payload: `Processing TX: ${i}/${txs.length}`});
    const ios = await parseInputsOutputs(net, tx);
    const isPending = tx.block === null;
    const txData = {
      id: tx.hash,
      date: isPending ? Date.now() : Date.parse(tx.date),
      pending: isPending,
      ...ios,
    };

    payload.set(tx.hash, txData);
  }
  dispatch({type: NEW_BLOCK_STATUS, payload: ''});

  // Sort all TXs by date without losing the hash->tx mapping
  payload = new Map([...payload.entries()].sort((a, b) => b[1].date - a[1].date));

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

export const getPassphrase = (resolve, reject) => ({
  type: GET_PASSPHRASE,
  payload: {get: true, resolve, reject},
});

export const closeGetPassphrase = () => ({
  type: GET_PASSPHRASE,
  payload: {get: false},
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

async function parseInputsOutputs(net, tx) {
  // Look for covenants. A TX with multiple covenant types is not supported
  let covAction = null;
  let covValue = 0;
  let covData = {};
  let count = 0;
  let totalValue = 0;
  for (let i = 0; i < tx.outputs.length; i++) {
    const output = tx.outputs[i];

    // Find outputs to the wallet's receive branch
    if (!output.path || output.path.change)
      continue;

    const covenant = output.covenant;

    // Track normal receive amounts for later
    if (covenant.action === 'NONE') {
      totalValue += output.value;
      continue;
    }
    // Stay focused on the first non-NONE covenant type, ignore other types
    if (covAction && covenant.action !== covAction)
      continue;

    covAction = covenant.action;

    // Special case for reveals and registers, indicate how much
    // spendable balance is returning to the wallet
    // as change from the mask on the bid, or the difference
    // between the highest and second-highest bid.
    if (covenant.action === 'REVEAL'
      || covenant.action === 'REGISTER') {
      covValue += tx.inputs[i].value - output.value;
    } else {
      covValue += output.value;
    }

    // Renewals and Updates have a value, but it doesn't
    // affect the spendable balance of the wallet.
    if (covenant.action === 'RENEW' ||
      covenant.action === 'UPDATE' ||
      covenant.action === 'TRANSFER' ||
      covenant.action === 'FINALIZE') {
      covValue = 0;
    }

    // May be called redundantly but should be handled by cache
    covData = await parseCovenant(net, covenant);

    // Identify this TX as having multiple actions
    count++;
    covData.meta.multiple = count > 1;
  }

  // This TX was a covenant, return.
  if (covAction) {
    return {
      ...covData,
      fee: tx.fee,
      value: covValue,
    };
  }

  // If there were outputs to the wallet's receive branch
  // but no covenants, this was just a plain receive.
  // Note: assuming input[0] is the "from" is not really helpful data.
  if (totalValue > 0) {
    return {
      type: tx.inputs[0].address === null ? 'COINBASE' : 'RECEIVE',
      meta: {
        from: tx.inputs[0].address,
      },
      value: totalValue,
      fee: tx.fee,
    };
  }

  // This TX must have been a plain send from the wallet.
  // Assume that the first non-wallet output of the TX is the "to".
  const output = tx.outputs.filter(({path}) => !path)[0];
  return {
    type: 'SEND',
    meta: {
      to: output.address,
    },
    value: output.value,
    fee: tx.fee,
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
        type: 'REGISTER',
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
    case 'TRANSFER':
      return {
        type: 'TRANSFER',
        meta: {
          domain: await nameByHash(net, covenant),
        },
      };
    case 'REVOKE':
      return {
        type: 'REVOKE',
        meta: {
          domain: await nameByHash(net, covenant),
        },
      };
    case 'FINALIZE':
      return {
        type: 'FINALIZE',
        meta: {
          domain: await nameByHash(net, covenant),
        },
      };
    default:
      return {type: 'UNKNOWN', meta: {}};
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
