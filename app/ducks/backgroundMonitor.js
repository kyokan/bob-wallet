import walletClient from '../utils/walletClient';
import nodeClient from '../utils/nodeClient';
import * as logger from '../utils/logClient';
import { store } from '../store/configureStore';
import { LOCK_WALLET, SET_PENDING_TRANSACTIONS } from './walletReducer';
import { getInitializationState } from '../db/system';
import isEqual from 'lodash.isequal';
import { SET_NODE_INFO } from './nodeReducer';
import { getNameInfo } from './names';

export function createBackgroundMonitor() {
  let isLocked;
  let timeout;
  let info;
  let fees;
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

    const newIsLocked = await walletClient.isLocked();
    if (newIsLocked) {
      if (newIsLocked !== isLocked) {
        isLocked = newIsLocked;
        store.dispatch({
          type: LOCK_WALLET,
        });
      }

      return;
    }

    const infoRes = await nodeClient.getInfo();
    const newInfo = {
      chain: infoRes.chain,
      network: infoRes.network,
    };

    const newFees = await nodeClient.getFees();
    if (!isEqual(info, newInfo) || !isEqual(fees, newFees)) {
      info = newInfo;
      fees = newFees;
      store.dispatch({
        type: SET_NODE_INFO,
        payload: {
          info: newInfo,
          fees: newFees,
        },
      });
    }

    const newPendingTxns = await walletClient.getPendingTransactions();
    store.dispatch({
      type: SET_PENDING_TRANSACTIONS,
      payload: newPendingTxns,
    });

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

export const monitor = createBackgroundMonitor();
