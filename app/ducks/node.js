import * as nodeClient from '../utils/nodeClient';
import { clientStub } from '../background/node';
const hsdClient = clientStub(() => require('electron').ipcRenderer);

let interval;

export const START = 'node/START';
export const START_ERROR = 'node/START_ERROR';
export const SET_NODE_INFO = 'node/SET_NODE_INFO';
export const STOP = 'node/STOP';

export function start(network) {
  return async (dispatch) => {
    try {
      await hsdClient.start(network);
      dispatch(setNodeInfo());
      interval = setInterval(() => dispatch(setNodeInfo()), 5000);
      if (interval) {
        clearInterval(interval);
      }
      dispatch({
        type: START,
        payload: {
          network
        }
      });
    } catch (error){
      dispatch( {
        type: START_ERROR, 
        payload: {
          error
        } 
      });
    }
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
    error: '',
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
    case START_ERROR: 
      return {...state, error: payload.error };
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
