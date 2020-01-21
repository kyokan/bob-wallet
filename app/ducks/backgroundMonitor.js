import walletClient from '../utils/walletClient';
import nodeClient from '../utils/nodeClient';
import * as logger from '../utils/logClient';
import { store } from '../store/configureStore';
import { LOCK_WALLET, SET_PENDING_TRANSACTIONS } from './walletReducer';
import { getInitializationState } from '../db/system';
import isEqual from 'lodash.isequal';
import { SET_NODE_INFO } from './nodeReducer';

export function createBackgroundMonitor() {
  let isLocked;
  let pendingTxns = new Set();
  let timeout;
  let info;
  let fees;

  const doPoll = async () => {
    const state = store.getState();
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
    let hasNewPending = false;
    for (const tx of newPendingTxns) {
      if (!pendingTxns.has(tx.hash)) {
        pendingTxns.add(tx.hash);
        hasNewPending = true;
      }
    }

    if (hasNewPending) {
      store.dispatch({
        type: SET_PENDING_TRANSACTIONS,
        payload: newPendingTxns,
      });
    }
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

export const monitor = createBackgroundMonitor();
