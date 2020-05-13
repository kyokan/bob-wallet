import walletClient from '../utils/walletClient';
import nodeClient from '../utils/nodeClient';
import * as logger from '../utils/logClient';
import { store } from '../store/configureStore';
import { SET_PENDING_TRANSACTIONS } from './walletReducer';
import { getInitializationState } from '../db/system';
import isEqual from 'lodash.isequal';
import { SET_NODE_INFO, SET_FEE_INFO, NEW_BLOCK_STATUS } from './nodeReducer';
import { getNameInfo } from './names';
import { getYourBids } from './bids';
import { getWatching } from './watching';
import { fetchTransactions, fetchWallet } from './walletActions';

export function createBackgroundMonitor() {
  let timeout;
  let info;
  let prevNamesWithPendingUpdates = new Set();

  const doPoll = async () => {
    let state = store.getState();
    const isInitialized = await getInitializationState(state.node.network);
    if (!isInitialized) {
      return;
    }

    if (!state.wallet.initialized || !state.node.isRunning) {
      return;
    }

    const infoRes = await nodeClient.getInfo();
    const newInfo = {
      chain: infoRes.chain,
      network: infoRes.network,
    };
    if (!isEqual(info, newInfo)) {
      info = newInfo;
      store.dispatch({
        type: SET_NODE_INFO,
        payload: {
          info: newInfo,
        },
      });
    }

    if (state.node.chain.tip !== infoRes.chain.tip)
      await store.dispatch(onNewBlock());

    const newPendingTxns = await walletClient.getPendingTransactions();
    store.dispatch({
      type: SET_PENDING_TRANSACTIONS,
      payload: newPendingTxns,
    });

    await store.dispatch(fetchWallet());
    await store.dispatch(fetchTransactions());

    // once a pending name operation is no longer pending,
    // refresh that name's state.
    state = store.getState();
    const currentNamesWithPendingUpdates = new Set();
    Object.keys(state.names).filter((k) => {
      const domain = state.names[k];
      return domain.pendingOperation === 'UPDATE' || domain.pendingOperation === 'REGISTER';
    }).forEach((name) => currentNamesWithPendingUpdates.add(name));

    const noLongerPending = difference(prevNamesWithPendingUpdates, currentNamesWithPendingUpdates);
    for (const name of noLongerPending) {
      await store.dispatch(getNameInfo(name));
    }
    prevNamesWithPendingUpdates = currentNamesWithPendingUpdates;
  };

  const poll = async () => {
    try {
      await doPoll();
    } catch (e) {
      console.error('failed to poll', e, e && e.stack);
      logger.error(`[Error received from backgroundMonitor.js - poll\n\n${e.message}\n${e.stack}\n`);
    }

    timeout = setTimeout(poll, 10000);
  };

  return {
    start() {
      poll();
    },

    bump: doPoll,

    stop() {
      clearTimeout(poll);
    },
  };
}

function difference(setA, setB) {
  let d = new Set(setA);
  for (let elem of setB) {
    d.delete(elem);
  }
  return d;
}

export const onNewBlock = () => async (dispatch, getState) => {
  let state = getState();

  dispatch({type: NEW_BLOCK_STATUS, payload: 'Updating fees...'});
  const newFees = await nodeClient.getFees();
  if (!isEqual(state.node.fees, newFees)) {
    dispatch({
      type: SET_FEE_INFO,
      payload: {
        fees: newFees,
      },
    });
  }

  dispatch({type: NEW_BLOCK_STATUS, payload: 'Loading bids...'});
  await dispatch(getYourBids());
  
  state = getState();
  const bids = state.bids.yourBids;
  for (const bid of bids) {
    const name = bid.name;
    dispatch({type: NEW_BLOCK_STATUS, payload: `Loading bids: ${name}`});
    await dispatch(getNameInfo(name));
  }

  const watch = state.watching.names;
  for (const name of watch) {
    dispatch({type: NEW_BLOCK_STATUS, payload: `Loading watchlist: ${name}`});
    await dispatch(getNameInfo(name));
  }

  dispatch({type: NEW_BLOCK_STATUS, payload: ''});
}

export const monitor = createBackgroundMonitor();
