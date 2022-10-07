import walletClient from '../utils/walletClient';
import nodeClient from '../utils/nodeClient';
import throttle from 'lodash.throttle';
import { getMaxIdleMinutes, setMaxIdleMinutes } from '../db/system';
import {
  GET_PASSPHRASE,
  INCREMENT_IDLE,
  LOCK_WALLET,
  SET_PHRASE_MISMATCH,
  RESET_IDLE,
  SET_MAX_IDLE,
  SET_PENDING_TRANSACTIONS,
  SET_TRANSACTIONS,
  SET_WALLET,
  START_SYNC_WALLET,
  STOP_SYNC_WALLET,
  UNLOCK_WALLET,
  SET_API_KEY,
  SET_FETCHING,
} from './walletReducer';
import { NEW_BLOCK_STATUS } from './nodeReducer';
import {setNames} from "./myDomains";
import {setFilter, setYourBids} from "./bids";

let idleInterval;

export const setWallet = opts => {
  const {
    wid = '',
    watchOnly = false,
    initialized = false,
    type = '',
    receiveAddress = '',
    balance = {},
    apiKey = '',
    changeDepth,
    receiveDepth,
    accountKey = '',
    keys = [],
    keysNames = {},
    m = null,
    n = null,
  } = opts;

  return {
    type: SET_WALLET,
    payload: {
      wid,
      watchOnly,
      initialized,
      type,
      receiveAddress,
      balance,
      apiKey,
      changeDepth,
      receiveDepth,
      accountKey,
      keys,
      keysNames,
      m,
      n,
    },
  };
};

export const completeInitialization = (name, passphrase) => async (dispatch, getState) => {
  const network = getState().wallet.network;
  await walletClient.unlock(name, passphrase);
  await dispatch(fetchWallet());
  dispatch({
    type: UNLOCK_WALLET,
  });
};

export const fetchWalletAPIKey = () => async (dispatch) => {
  const apiKey = await walletClient.getAPIKey();
  dispatch({
    type: SET_API_KEY,
    payload: apiKey,
  });
};

export const fetchWallet = () => async (dispatch, getState) => {
  const network = getState().wallet.network;

  const maxIdle = await getMaxIdleMinutes();
  dispatch({
    type: SET_MAX_IDLE,
    payload: maxIdle ?? 5,
  })

  const accountInfo = await walletClient.getAccountInfo();
  if (!accountInfo) {
    throw new Error('Could not load wallet.');
  }

  dispatch(setWallet(accountInfo));
};

export const setAccountDepth = (changeDepth = 0, receiveDepth = 0) => async () => {
  return walletClient.updateAccountDepth(changeDepth, receiveDepth);
}

export const hasAddress = (address) => async () => {
  return walletClient.hasAddress(address);
};

export const revealSeed = (passphrase) => async () => {
  return walletClient.revealSeed(passphrase);
};

export const unlockWallet = (name, passphrase) => async (dispatch, getState) => {
  await walletClient.unlock(name, passphrase);

  if (name !== getState().wallet.wid) {
    dispatch({
      type: SET_TRANSACTIONS,
      payload: new Map(),
    });

    dispatch(setNames({}));
    dispatch(setYourBids({
      order: [],
      map: {},
    }));
    dispatch(setFilter({
      OPENING: [],
      BIDDING: [],
      REVEAL: [],
      CLOSED: [],
      TRANSFER: [],
    }))
  }

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

export const verifyPhrase = (passphrase) => async (dispatch, getState) => {
  const {watchOnly} = getState().wallet;
  if (watchOnly) {
    dispatch({
      type: SET_PHRASE_MISMATCH,
      payload: false,
    })
    return;
  };

  const {phraseMatchesKey} = await walletClient.revealSeed(passphrase);

  dispatch({
    type: SET_PHRASE_MISMATCH,
    payload: !phraseMatchesKey,
  })
}

export const reset = () => async (dispatch, getState) => {
  await walletClient.reset();
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
    const state = getState();
    const nodeHeight = state.node.chain.height;
    const {walletHeight, rescanHeight, walletSync} = state.wallet;

    let progress;
    if (walletSync) {
      progress = walletHeight / rescanHeight * 100;
    } else {
      progress = walletHeight / nodeHeight * 100;
    }

    // If we go 50 seconds without any progress, throw an error
    if (lastProgress === progress) {
      stall++;
    } else {
      lastProgress = progress;
      stall = 0;
    }

    if (stall >= 50) {
      throw new Error('Wallet sync progress has stalled.');
    }

    if (walletSync ? (rescanHeight === null) : (progress === 100)) {
      break;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }
};

export const fetchTransactions = () => async (dispatch, getState) => {
  const state = getState();
  const net = state.wallet.network;
  const currentTXs = state.wallet.transactions;

  if (state.wallet.isFetching) {
    return;
  }

  dispatch({
    type: SET_FETCHING,
    payload: true,
  });


  const txs = await walletClient.getTransactionHistory();

  let payload = new Map();

  for (let i = 0; i < txs.length; i++) {
    const tx = txs[i];
    const {time, block} = tx;
    const existing = currentTXs.get(tx.hash);

    if (existing) {
      const isPending = !block;
      existing.date = isPending ? Date.now() : time * 1000;
      existing.pending = isPending;

      payload.set(existing.id, existing);
      continue;
    }

    if (!(i % 100)) {
      dispatch({
        type: NEW_BLOCK_STATUS,
        payload: `Processing TX: ${i}/${txs.length}`,
      });
    }

    const ios = await parseInputsOutputs(net, tx);
    const isPending = !block;
    const txData = {
      id: tx.hash,
      date: isPending ? Date.now() : time * 1000,
      pending: isPending,
      ...ios,
    };

    payload.set(tx.hash, txData);
  }
  dispatch({type: NEW_BLOCK_STATUS, payload: ''});

  // Sort all TXs by date without losing the hash->tx mapping
  payload = new Map([...payload.entries()].sort((a, b) => b[1].date - a[1].date));

  dispatch({
    type: SET_FETCHING,
    payload: false,
  });

  dispatch({
    type: SET_TRANSACTIONS,
    payload,
  });
};

export const fetchPendingTransactions = () => async (dispatch, getState) => {
  const state = getState();

  if (!state.wallet.initialized) {
    return;
  }

  const pendingTxs = await walletClient.getPendingTransactions();
  const payload = await processPendingTransactions(state.names, pendingTxs);

  // SET_PENDING_TRANSACTIONS takes payload to replace `state.names`
  dispatch({
    type: SET_PENDING_TRANSACTIONS,
    payload: payload || [],
  });
};

const incrementIdle = () => ({
  type: INCREMENT_IDLE,
});

export const resetIdle = () => ({
  type: RESET_IDLE,
});

export const setMaxIdle = (maxIdle) => async (dispatch) => {
  await setMaxIdleMinutes(maxIdle);
  dispatch({
    type: SET_MAX_IDLE,
    payload: maxIdle,
  })
};

export const getPassphrase = (resolve, reject) => async (dispatch, getState) => {
  if (getState().wallet.watchOnly === true) {
    resolve();
    return;
  }

  dispatch({
    type: GET_PASSPHRASE,
    payload: {get: true, resolve, reject},
  })
};

export const closeGetPassphrase = () => ({
  type: GET_PASSPHRASE,
  payload: {get: false},
});

export const waitForPassphrase = () => async (dispatch) => {
  return new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
};

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
  let covDomains = new Set();
  let covData = {};
  let count = 0;
  let totalValue = 0;
  for (let i = 0; i < tx.outputs.length; i++) {
    const output = tx.outputs[i];

    // Find outputs to the wallet's receive branch
    if (output.path && output.path.change)
      continue;

    const covenant = output.covenant;

    // Track normal receive amounts for later
    if (covenant.action === 'NONE') {
      if (output.path) {
        totalValue += output.value;
      }
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
      covValue += !output.path
        ? output.value
        : tx.inputs[i].value - output.value;
    } else {
      // Special case for reserved name claims, we are receiving
      // coins but they are locked. The spendable balance will
      // be incremented by the reward value when we REGISTER.
      // (The name's value is burned at 0 but we get the reward as change)
      if (covenant.action !== 'CLAIM')
        covValue += output.value;
    }

    if (covenant.action == 'FINALIZE') {
      const isSender = output.path == null;

      // Start with no payment for normal Finalizes
      covValue = 0;

      // containsOtherOutputs: Look for outputs that are not change addresses to self
      if (isSender) {
        // If yes, sum all self outputs (payment made by receiver)
        const containsOtherOutputs = tx.outputs.findIndex(x => x.covenant.action == 'NONE' && x.path === null) !== -1;
        if (containsOtherOutputs) covValue = tx.outputs.reduce((sum, op) => op.path ? (sum+op.value) : sum, 0);
      } else {
        // If yes, sum all outputs to others' addresses (payment made to sender)
        const containsOtherOutputs = tx.outputs.findIndex(x => x.covenant.action == 'NONE' && x.path !== null) !== -1;
        if (containsOtherOutputs) covValue = -tx.outputs.reduce((sum, op) => !op.path ? (sum+op.value) : sum, 0);
      }
    }

    // Renewals and Updates have a value, but it doesn't
    // affect the spendable balance of the wallet.
    if (covenant.action === 'RENEW' ||
      covenant.action === 'UPDATE') {
      covValue = 0;
    }

    if (covenant.action === 'TRANSFER' ) {
      if (output.path) {
        covValue = 0;
      } else {
        covValue = getNetValue(tx);
      }
    }

    // May be called redundantly but should be handled by cache
    covData = await parseCovenant(net, covenant);

    if (covData.meta?.domain) {
      covDomains.add(covData.meta.domain);
    }

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
      domains: Array.from(covDomains),
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
  if (!output) {
    return {
      type: 'UNKNOWN',
      meta: {},
      fee: tx.fee,
      value: 0,
    };
  }

  return {
    type: 'SEND',
    meta: {
      to: output.address,
    },
    value: output.value,
    fee: tx.fee,
  };
}

function getNetValue(tx) {
  let totalValue = 0;

  for (let i = 0; i < tx.outputs.length; i++) {
    const output = tx.outputs[i];
    if (output.path) {
      totalValue += output.value;
    }
  }

  for (let j = 0; j < tx.inputs.length; j++) {
    const input = tx.inputs[j];
    if (input.path) {
      totalValue -= input.value;
    }
  }

  return totalValue;
}

async function parseCovenant(net, covenant) {
  switch (covenant.action) {
    case 'CLAIM':
      return {type: 'CLAIM', meta: {domain: await nameByHash(net, covenant)}};
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

// For processPendingTransactions
const ALLOWED_COVENANTS = new Set([
  'OPEN',
  'BID',
  'REVEAL',
  'UPDATE',
  'REGISTER',
  'RENEW',
  'REDEEM',
  'TRANSFER',
  'FINALIZE',
]);

/**
 * Process Pending Transactions
 * Parse covenant values as needed and add `pendingOperation[Meta]` to state.names
 * @param {Object} names state.names
 * @param {TX[]} pendingTxs result of walletClient.getPendingTransactions()
 * @returns {Object} state.names
 */
async function processPendingTransactions(names, pendingTxs) {
  const pendingOperationsByHash = {};
  const pendingOpMetasByHash = {};
  const pendingOutputByHash = {};

  for (const {tx} of pendingTxs) {
    for (const output of tx.outputs) {
      if (ALLOWED_COVENANTS.has(output.covenant.action)) {
        const hash = output.covenant.items[0];

        // Store multiple bids
        if (output.covenant.action === 'BID') {
          pendingOperationsByHash[hash] = output.covenant.action;
          pendingOpMetasByHash[hash] = [...(pendingOpMetasByHash[hash] || []), output.covenant];
          pendingOutputByHash[hash] = [...(pendingOutputByHash[hash] || []), output];
        } else {
          pendingOperationsByHash[hash] = output.covenant.action;
          pendingOpMetasByHash[hash] = output.covenant;
          pendingOutputByHash[hash] = output;
        }

        break;
      }
    }
  }

  const oldNames = Object.keys(names);
  const newNames = {};
  for (const name of oldNames) {
    const data = names[name];
    const hash = data.hash;
    const pendingOp = pendingOperationsByHash[hash];
    const pendingCovenant = pendingOpMetasByHash[hash];
    const pendingOutput = pendingOutputByHash[hash];
    const pendingOperationMeta = {};

    if (pendingOp === 'UPDATE' || pendingOp === 'REGISTER') {
      pendingOperationMeta.data = pendingCovenant.items[2];
    }

    if (pendingOp === 'REVEAL') {
      pendingOperationMeta.output = pendingOutput;
    }

    if (pendingOp === 'BID') {
      const promises = pendingOutput.map(async output => {
        const blind = output.covenant.items[3];
        const bv = await walletClient.getBlind(blind);

        return {
          value: output.value,
          height: -1,
          from: output.address,
          date: null,
          bid: {
            value: bv?.value || null,
            prevout: null,
            own: true,
            namehash: hash,
            name: name,
            lockup: output.value,
            blind: blind,
          },
        }
      });

      pendingOperationMeta.bids = await Promise.all(promises);
    }

    newNames[name] = {
      ...data,
      pendingOperation: pendingOp || null,
      pendingOperationMeta: pendingOperationMeta,
    };
  }

  return {
    ...names,
    ...newNames,
  };
}
