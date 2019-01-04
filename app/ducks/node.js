import { clientStub } from '../background/node';

const client = clientStub(() => require('electron').ipcRenderer);

const NODE_API = 'http://127.0.0.1:15037';
let interval;

export const START = 'node/START';
export const SET_NODE_INFO = 'node/SET_NODE_INFO';
export const STOP = 'node/STOP';

export function start(network) {
  return async dispatch => {
    await client.start(network);

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

const setNodeInfo = () => async dispatch => {
  const resp = await fetch(NODE_API);
  const json = await resp.json();

  dispatch({
    type: SET_NODE_INFO,
    payload: json,
  });
};

export function getInitialState() {
  return {
    isRunning: false,
    network: null
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
        chain: action.payload.chain,
      };
    default:
      return state;
  }
}
