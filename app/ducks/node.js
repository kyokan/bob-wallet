import { clientStub } from '../background/node/client';
import { clientStub as connClientStub } from '../background/connections/client';
import { getNetwork, setNetwork, getInitializationState } from '../db/system';
import { fetchWallet, fetchTransactions, listWallets } from './walletActions';
import { getWatching } from './watching';
import * as logger from '../utils/logClient';

import {
  END_NETWORK_CHANGE,
  SET_NODE_INFO,
  SET_FEE_INFO,
  SET_CUSTOM_RPC_STATUS,
  START,
  START_ERROR,
  START_NETWORK_CHANGE,
  STOP,
  START_NODE_STATUS_CHANGE,
  START_RPC_TEST,
  END_NODE_STATUS_CHANGE,
  END_RPC_TEST,
} from './nodeReducer';
import { VALID_NETWORKS } from '../constants/networks';
import {ConnectionTypes} from "../background/connections/service";

const Network = require('hsd/lib/protocol/network');

const nodeClient = clientStub(() => require('electron').ipcRenderer);
const connClient = connClientStub(() => require('electron').ipcRenderer);

let hasAppStarted = false;

export const stop = () => async (dispatch, getState) => {
  dispatch({ type: START_RPC_TEST });
  const {networkType} = await connClient.getConnection();
  const network = Network.get(networkType || 'main');

  try {
    await nodeClient.stop();
    await connClient.setConnectionType(ConnectionTypes.Custom);
    await nodeClient.start(networkType || 'main');

    dispatch({ type: STOP });

    await dispatch(fetchWallet());

    if (!hasAppStarted) {
      if (await getInitializationState(network)) {
        setTimeout(async () => {
          await dispatch(fetchTransactions());
          await dispatch(getWatching(network));
        }, 0);
      }
    }

    if (!await nodeClient.getInfo()) {
      throw new Error('cannot get node info');
    }

    await dispatch(setNodeInfo());
    dispatch(setCustomRPCStatus(true));
  } catch (e) {
    logger.error(e);
    dispatch(setCustomRPCStatus(false));
  } finally {
    hasAppStarted = true;
    dispatch({ type: END_RPC_TEST });
  }
};

export const startApp = (network) => async (dispatch) => {
  const {type} = await connClient.getConnection();
  switch (type) {
    case ConnectionTypes.P2P:
      return dispatch(start(network));
    case ConnectionTypes.Custom:
      return dispatch(stop(network));
  }
};

export const start = (network) => async (dispatch, getState) => {
  dispatch({ type: START_NODE_STATUS_CHANGE });

  if (hasAppStarted) {
    try {
      await nodeClient.stop();
    } finally {
      //
    }
  }

  if (!network) {
    network = await getNetwork();
  }

  await setNetwork(network);

  try {
    await connClient.setConnectionType(ConnectionTypes.P2P);
    await nodeClient.start(network);
    hasAppStarted = true;
    const apiKey = await nodeClient.getAPIKey();
    dispatch({
      type: START,
      payload: {
        network,
        apiKey,
      },
    });
    await dispatch(setNodeInfo());
    await dispatch(listWallets());
    await dispatch(fetchWallet());

    if (await getInitializationState(network)) {
      setTimeout(async () => {
        await dispatch(fetchTransactions());
        await dispatch(getWatching(network));
      }, 0);
    }

  } catch (error) {
    dispatch({
      type: START_ERROR,
      payload: {
        error: error.message,
      },
    });
  } finally {
    dispatch({ type: END_NODE_STATUS_CHANGE });
  }
};

export const setCustomRPCStatus = (status = false) => ({
  type: SET_CUSTOM_RPC_STATUS,
  payload: status,
});

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
