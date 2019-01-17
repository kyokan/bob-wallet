import * as nodeClient from '../utils/nodeClient';
import { clientStub, VALID_NETWORKS } from '../background/node';
import { getNetwork, setNetwork } from '../db/system';
import { fetchWallet } from './wallet';

const hsdClient = clientStub(() => require('electron').ipcRenderer);

export const START = 'node/START';
export const START_ERROR = 'node/START_ERROR';
export const SET_NODE_INFO = 'node/SET_NODE_INFO';
export const STOP = 'node/STOP';
export const START_NETWORK_CHANGE = 'node/START_NETWORK_CHANGE';
export const END_NETWORK_CHANGE = 'node/END_NETWORK_CHANGE';

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
  } catch (error) {
    console.error(error);
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

export function getInitialState() {
  return {
    error: '',
    isRunning: false,
    isChangingNetworks: false,
    network: null,
    fees: {
      slow: 0,
      medium: 0,
      fast: 0
    },
    chain: {
      height: 0,
      tip: '',
    }
  };
}

export default function nodeReducer(state = getInitialState(), action = {}) {
  switch (action.type) {
    case START:
      return {...state, isRunning: true, network: action.payload.network};
    case STOP:
      return {...state, isRunning: false, network: null};
    case START_ERROR:
      return {...state, error: action.payload.error};
    case SET_NODE_INFO:
      return {
        ...state,
        chain: action.payload.info.chain,
        fees: action.payload.fees,
      };
    case START_NETWORK_CHANGE:
    case END_NETWORK_CHANGE:
      return {
        ...state,
        isChangingNetworks: action.type === START_NETWORK_CHANGE
      };
    default:
      return state;
  }
}
