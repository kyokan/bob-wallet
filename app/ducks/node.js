import { clientStub } from '../background/node';

const client = clientStub(() => require('electron').ipcRenderer);

export const START = 'node/START';
export const STOP = 'node/STOP';

export function start(network) {
  return async dispatch => {
    await client.start(network);
    dispatch({
      type: START,
      payload: {
        network
      }
    });
  };
}

export function getInitialState() {
  return {
    isRunning: false,
    network: null
  };
}

export function nodeReducer(state = getInitialState(), action = {}) {
  switch (action.type) {
    case START:
      return { ...state, isRunning: true, network: action.payload.network };
    case STOP:
      return { ...state, isRunning: false, network: null };
    default:
      return state;
  }
}
