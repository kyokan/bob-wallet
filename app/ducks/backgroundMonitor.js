import * as walletClient from '../utils/walletClient';
import * as nodeClient from '../utils/nodeClient';
import { store } from '../store/configureStore';
import { LOCK_WALLET, SET_PENDING_TRANSACTIONS } from './wallet';
import isEqual from 'lodash.isequal';
import { SET_NODE_INFO } from './node';

export function createBackgroundMonitor() {
  let isLocked;
  let pendingTxns = new Set();
  let timeout;
  let info;
  let fees;

  const doPoll = async () => {
    const state = store.getState();
    const wClient = walletClient.forNetwork(state.node.network);
    const nClient = nodeClient.forNetwork(state.node.network);

    if (!state.wallet.initialized || !state.node.isRunning) {
      return;
    }

    const newIsLocked = await wClient.isLocked();
    if (newIsLocked) {
      if (newIsLocked !== isLocked) {
        isLocked = newIsLocked;
        store.dispatch({
          type: LOCK_WALLET
        });
      }

      return;
    }

    const infoRes = await nClient.getInfo();
    const newInfo = {
      chain: infoRes.chain,
      network: infoRes.network
    };

    const newFees = await nClient.getFees();
    if (!isEqual(info, newInfo) || !isEqual(fees, newFees)) {
      info = newInfo;
      fees = newFees;
      store.dispatch({
        type: SET_NODE_INFO,
        payload: {
          info: newInfo,
          fes: newFees
        }
      });
    }

    const newPendingTxns = await wClient.getPendingTransactions();
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
        payload: newPendingTxns
      });
    }
  };

  const poll = async () => {
    try {
      await doPoll();
    } catch (e) {
      console.error('failed to poll', e);
    }

    timeout = setTimeout(poll, 1000);
  };

  return {
    start() {
      poll();
    },

    async bump() {
      await doPoll();
    },

    stop() {
      clearTimeout(poll);
    }
  }
}

export const monitor = createBackgroundMonitor();