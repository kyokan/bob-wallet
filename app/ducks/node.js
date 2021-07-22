import { clientStub } from '../background/node/client';
import { clientStub as connClientStub } from '../background/connections/client';
import { clientStub as settingClientStub } from '../background/setting/client';
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
  SET_EXPLORER,
  UPDATE_HNS_PRICE,
  SET_NO_DNS,
} from './nodeReducer';
import { VALID_NETWORKS } from '../constants/networks';
import {ConnectionTypes} from "../background/connections/service";

const Network = require('hsd/lib/protocol/network');

const nodeClient = clientStub(() => require('electron').ipcRenderer);
const connClient = connClientStub(() => require('electron').ipcRenderer);
const settingClient = settingClientStub(() => require('electron').ipcRenderer);

let hasAppStarted = false;

export const testRPC = (walletNetwork) => async (dispatch, getState) => {
  dispatch({ type: START_RPC_TEST });

  const [status, error] = await nodeClient.testCustomRPCClient(walletNetwork);

  dispatch({ type: END_RPC_TEST });
  return [status, error];
}

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

    // WalletNode might not be loaded yet
    // if we are in Custom RPC mode.
    const walletNetwork = await walletClient.isReady();
    if (!walletNetwork)
      throw new Error('Could not connect to wallet.');

    await dispatch(listWallets());

    const info = await nodeClient.getInfo();
    if (!info)
      throw new Error('Could not connect to node.');

    // For remote RPC connections: check compatability with full node.
    // The STOP action will let the user reconfigure in settings.
    if (walletNetwork !== info.network)
      throw new Error('Wallet/Node network mismatch.');

    dispatch({
      type: SET_NODE_INFO,
      payload: {
        info,
      }
    });
    dispatch(setFees());

  } catch (error) {
    console.log(error);
    dispatch({ type: STOP });
  } finally {
    dispatch({ type: END_NODE_STATUS_CHANGE });
  }
};

export const setCustomRPCStatus = (status = false) => ({
  type: SET_CUSTOM_RPC_STATUS,
  payload: status,
});

const setFees = () => async (dispatch) => {
  const fees = await nodeClient.getFees();
  dispatch({
    type: SET_FEE_INFO,
    payload: {
      fees,
    },
  });
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

export const changeCustomNetwork = (network) => async (dispatch) => {
  if (!VALID_NETWORKS[network]) {
    throw new Error('invalid network');
  }

  const conn = await connClient.getConnection();

  if (conn.networkType !== network) {
    dispatch({
      type: START_NETWORK_CHANGE,
    });

    await connClient.setConnection({
      type: ConnectionTypes.Custom,
      port: conn.port,
      host: conn.host,
      pathname: conn.pathname,
      networkType: network,
      apiKey: conn.apiKey,
    });

    await nodeClient.reset();

    dispatch({
      type: END_NETWORK_CHANGE,
    });
  }
};

export const setExplorer = (explorer) => async (dispatch) => {
  await settingClient.setExplorer(explorer);
  dispatch({
    type: SET_EXPLORER,
    payload: explorer,
  })
};

export const updateHNSPrice = () => async (dispatch) => {
  const value = await nodeClient.getHNSPrice();
  dispatch({
    type: UPDATE_HNS_PRICE,
    payload: {
      value,
      currency: 'USD',
    },
  })
};

export const setNoDns = (noDns) => async (dispatch) => {
  await nodeClient.setNoDns(noDns);
  await dispatch({
    type: SET_NO_DNS,
    payload: noDns,
  })
  await dispatch(stop());
  await dispatch(start());
};
