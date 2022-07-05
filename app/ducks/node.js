import { clientStub } from '../background/node/client';
import { clientStub as connClientStub } from '../background/connections/client';
import { clientStub as settingClientStub } from '../background/setting/client';
import { clientStub as walletClientStub } from '../background/wallet/client';
import { ConnectionTypes } from '../background/connections/service';
import { getNetwork, setNetwork } from '../db/system';
import { getWatching } from "./watching";
import { throttle } from '../utils/throttle';

import {
  END_NETWORK_CHANGE,
  SET_NODE_INFO,
  SET_FEE_INFO,
  SET_CUSTOM_RPC_STATUS,
  START_NETWORK_CHANGE,
  START_ERROR,
  STOP,
  START_NODE_STATUS_CHANGE,
  START_RPC_TEST,
  END_NODE_STATUS_CHANGE,
  END_RPC_TEST,
  SET_EXPLORER,
  UPDATE_HNS_PRICE,
  SET_NO_DNS, SET_SPV_MODE,
} from './nodeReducer';
import { VALID_NETWORKS } from '../constants/networks';

const nodeClient = clientStub(() => require('electron').ipcRenderer);
const connClient = connClientStub(() => require('electron').ipcRenderer);
const settingClient = settingClientStub(() => require('electron').ipcRenderer);
const walletClient = walletClientStub(() => require('electron').ipcRenderer);

export const testRPC = (walletNetwork) => async (dispatch) => {
  dispatch({ type: START_RPC_TEST });

  const [status, error] = await nodeClient.testCustomRPCClient(walletNetwork);

  dispatch({ type: END_RPC_TEST });
  return [status, error];
}

export const stop = () => async (dispatch) => {
  await nodeClient.stop();
  dispatch({ type: STOP });
};

export const startApp = (network) => async (dispatch) => {
  return dispatch(start(network));
};

export const start = (network) => async (dispatch) => {
  dispatch({ type: START_NODE_STATUS_CHANGE });

  if (!network) {
    network = await getNetwork();
  }

  await setNetwork(network);

  try {
    await nodeClient.start(network);

    // WalletNode might not be loaded yet
    // if we are in Custom RPC mode.
    const walletNetwork = await walletClient.isReady();
    if (!walletNetwork)
      throw new Error('Could not connect to wallet.');

    const info = await nodeClient.getInfo();
    if (!info)
      throw new Error('Could not connect to node.');

    // For remote RPC connections: check compatability with full node.
    // The STOP action will let the user reconfigure in settings.
    if (walletNetwork !== info.network)
      throw new Error('Wallet/Node network mismatch.');

    dispatch({
      type: SET_NODE_INFO,
      payload: info.chain,
    });
    dispatch(setFees());

    const spv = await nodeClient.getSpvMode();
    dispatch({
      type: SET_SPV_MODE,
      payload: spv,
    });

    dispatch(getWatching(network));

  } catch (error) {
    console.error('node start error', error);
    dispatch({ type: STOP });
    if (error.code === 'ECONNREFUSED') {
      const conn = await connClient.getConnection();
      if (conn.type === ConnectionTypes.Custom) {
        dispatch({ type: START_ERROR, payload: 'RPC:ECONNREFUSED' });
        return;
      }
    }
    dispatch({ type: START_ERROR, payload: error.message });
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
    payload: fees,
  });
};

export const changeNetwork = (network) => async (dispatch) => {
  if (!VALID_NETWORKS[network]) {
    throw new Error('invalid network');
  }

  await dispatch({type: START_NETWORK_CHANGE});
  await dispatch(stop());
  await dispatch(start(network));
  await dispatch({type: END_NETWORK_CHANGE});
};

export const setExplorer = (explorer) => async (dispatch) => {
  await settingClient.setExplorer(explorer);
  dispatch({
    type: SET_EXPLORER,
    payload: explorer,
  })
};

const _updateHNSPrice = throttle(async (dispatch) => {
  const value = await nodeClient.getHNSPrice();
  dispatch({
    type: UPDATE_HNS_PRICE,
    payload: {
      value,
      currency: 'USD',
    },
  })
}, 120*1000); // 120 seconds

export const updateHNSPrice = () => async (dispatch) => {
  _updateHNSPrice(dispatch);
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
