export const START = 'node/START';
export const START_ERROR = 'node/START_ERROR';
export const SET_NODE_INFO = 'node/SET_NODE_INFO';
export const STOP = 'node/STOP';
export const START_NETWORK_CHANGE = 'node/START_NETWORK_CHANGE';
export const END_NETWORK_CHANGE = 'node/END_NETWORK_CHANGE';

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
