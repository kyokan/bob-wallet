import * as nodeClient from '../utils/nodeClient';
import { clientStub } from '../background/node';
const hsdClient = clientStub(() => require('electron').ipcRenderer);

let interval;

export const START = 'node/START';
export const SET_NODE_INFO = 'node/SET_NODE_INFO';
export const STOP = 'node/STOP';

export function start(network) {
  return async (dispatch) => {
    await hsdClient.start(network);

    if (interval) {
      clearInterval(interval);
    }

    dispatch(setNodeInfo());
    interval = setInterval(() => dispatch(setNodeInfo()), 5000);

    dispatch({
      type: START,
      payload: {
        network
      }
    });
  };
}

const setNodeInfo = () => async (dispatch, getState) => {
  try {
    const client = nodeClient.forNetwork(getState().wallet.network);
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
    dispatch({ type: STOP });
  }
};

export function getInitialState() {
  return {
    isRunning: false,
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
      return { ...state, isRunning: true, network: action.payload.network };
    case STOP:
      return { ...state, isRunning: false, network: null };
    case SET_NODE_INFO:
      return {
        ...state,
        chain: action.payload.info.chain,
        fees: action.payload.fees,
      };
    default:
      return state;
  }
}
