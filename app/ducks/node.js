import { clientStub } from '../background/node/client';
import { getNetwork, setNetwork, getInitializationState } from '../db/system';
import { fetchWallet, fetchTransactions } from './walletActions';
import { getWatching } from './watching';
import * as logger from '../utils/logClient';
import { onNewBlock } from './backgroundMonitor';

import {
  END_NETWORK_CHANGE,
  SET_NODE_INFO,
  SET_FEE_INFO,
  START,
  START_ERROR,
  START_NETWORK_CHANGE,
  STOP,
} from './nodeReducer';
import { VALID_NETWORKS } from '../constants/networks';

const nodeClient = clientStub(() => require('electron').ipcRenderer);

export const start = (network) => async (dispatch, getState) => {
  if (network === getState().node.network) {
    return;
  }

  if (!network) {
    network = await getNetwork();
  }
  await setNetwork(network);

  try {
    await nodeClient.start(network);
    const apiKey = await nodeClient.getAPIKey();
    dispatch({
      type: START,
      payload: {
        network,
        apiKey,
      },
    });
    await dispatch(setNodeInfo());
    await dispatch(fetchWallet());
    if (await getInitializationState(network)) {
      await dispatch(fetchTransactions());
      await dispatch(getWatching(network));
      await dispatch(onNewBlock());
    }
  } catch (error) {
    dispatch({
      type: START_ERROR,
      payload: {
        error: error.message,
      },
    });
  }
};

const setNodeInfo = () => async (dispatch) => {
  try {
    const info = await nodeClient.getInfo();
    const fees = await nodeClient.getFees();
    dispatch({
      type: SET_NODE_INFO,
      payload: {
        info,
      },
    });
    dispatch({
      type: SET_FEE_INFO,
      payload: {
        fees,
      },
    });
  } catch (e) {
    logger.error(`Error received from node.js - setNodeInfo\n\n${e.message}\n${e.stack}\n`);
    dispatch({type: STOP});
  }
};

export const changeNetwork = (network) => async (dispatch) => {
  if (!VALID_NETWORKS[network]) {
    throw new Error('invalid network');
  }

  await nodeClient.stop();
  dispatch({
    type: START_NETWORK_CHANGE,
  });
  await dispatch(start(network));
  dispatch({
    type: END_NETWORK_CHANGE,
  });
};
