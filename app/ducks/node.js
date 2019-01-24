import * as nodeClient from '../utils/nodeClient';
import { clientStub, VALID_NETWORKS } from '../background/node';
import { getNetwork, setNetwork } from '../db/system';
import { fetchWallet } from './walletActions';
import * as logger from '../utils/logClient';
import { END_NETWORK_CHANGE, SET_NODE_INFO, START, START_ERROR, START_NETWORK_CHANGE, STOP } from './nodeReducer';

const hsdClient = clientStub(() => require('electron').ipcRenderer);

export const start = (network) => async (dispatch, getState) => {
  if (network === getState().node.network) {
    return;
  }

  if (!network) {
    network = await getNetwork();
  }
  await setNetwork(network);

  try {
    await hsdClient.start(network);
    dispatch({
      type: START,
      payload: {
        network
      }
    });
    await dispatch(setNodeInfo());
    await dispatch(fetchWallet());
  } catch (error) {
    dispatch({
      type: START_ERROR,
      payload: {
        error: error.message
      }
    });
  }
};

const setNodeInfo = () => async (dispatch, getState) => {
  try {
    const client = nodeClient.forNetwork(getState().node.network);
    const info = await client.getInfo();
    const fees = await client.getFees();
    dispatch({
      type: SET_NODE_INFO,
      payload: {
        info,
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

  await hsdClient.stop();
  dispatch({
    type: START_NETWORK_CHANGE
  });
  await dispatch(start(network));
  dispatch({
    type: END_NETWORK_CHANGE
  });
};
