export const START = 'node/START';
export const START_ERROR = 'node/START_ERROR';
export const SET_NODE_INFO = 'node/SET_NODE_INFO';
export const SET_NODE_API = 'node/SET_NODE_API';
export const SET_FEE_INFO = 'node/SET_FEE_INFO';
export const SET_CUSTOM_RPC_STATUS = 'node/SET_CUSTOM_RPC_STATUS';
export const STOP = 'node/STOP';
export const START_NETWORK_CHANGE = 'node/START_NETWORK_CHANGE';
export const END_NETWORK_CHANGE = 'node/END_NETWORK_CHANGE';
export const NEW_BLOCK_STATUS = 'node/NEW_BLOCK_STATUS';
export const START_NODE_STATUS_CHANGE = 'node/START_NODE_STATUS_CHANGE';
export const END_NODE_STATUS_CHANGE = 'node/END_NODE_STATUS_CHANGE';
export const START_RPC_TEST = 'node/START_RPC_TEST';
export const END_RPC_TEST = 'node/END_RPC_TEST';
export const SET_EXPLORER = 'node/SET_EXPLORER';
export const UPDATE_HNS_PRICE = 'node/UPDATE_HNS_PRICE';
export const SET_RS_PORT = 'node/SET_RS_PORT';
export const SET_NS_PORT = 'node/SET_NS_PORT';
export const SET_NO_DNS = 'node/SET_NO_DNS';
export const SET_SPV_MODE = 'node/SET_SPV_MODE';
export const COMPACTING_TREE = 'node/COMPACTING_TREE';

export function getInitialState() {
  return {
    error: '',
    isCustomRPCConnected: false,
    isRunning: false,
    isChangingNodeStatus: false,
    isTestingCustomRPC: false,
    isChangingNetworks: false,
    network: 'main',
    apiKey: null,
    rsPort: 9892,
    nsPort: 9891,
    noDns: false,
    spv: false,
    compactingTree: false,
    fees: {
      slow: 0,
      medium: 0,
      fast: 0
    },
    chain: {
      height: 0,
      tip: '',
    },
    newBlockStatus: '',
    explorer: {
      label: '',
      tx: '',
      name: '',
    },
    hnsPrice: {
      value: 0,
      currency: 'USD'
    }
  };
}

export default function nodeReducer(state = getInitialState(), action = {}) {
  switch (action.type) {
    case START_NODE_STATUS_CHANGE:
      return { ...state, isChangingNodeStatus: true };
    case END_NODE_STATUS_CHANGE:
      return { ...state, isChangingNodeStatus: false };
    case START_RPC_TEST:
      return { ...state, isTestingCustomRPC: true };
    case END_RPC_TEST:
      return { ...state, isTestingCustomRPC: false };
    case START:
      return {
        ...state,
        isRunning: true,
        network: action.payload.network,
        apiKey: action.payload.apiKey,
        noDns: action.payload.noDns,
      };
    case STOP:
      return {
        ...state,
        isRunning: false,
        network: null,
        chain: {
          height: 0,
          tip: '',
        },
      };
    case START_ERROR:
      return {...state, error: action.payload};
    case SET_NODE_INFO:
      return {
        ...state,
        chain: action.payload,
      };
    case SET_CUSTOM_RPC_STATUS:
      return {
        ...state,
        isCustomRPCConnected: action.payload,
      };
    case SET_NODE_API:
      return {
        ...state,
        apiKey: action.payload,
      };
    case SET_FEE_INFO:
      return {
        ...state,
        fees: action.payload,
      };
    case START_NETWORK_CHANGE:
    case END_NETWORK_CHANGE:
      return {
        ...state,
        isChangingNetworks: action.type === START_NETWORK_CHANGE
      };
    case NEW_BLOCK_STATUS:
      return {
        ...state,
        newBlockStatus: action.payload,
      };
    case SET_EXPLORER:
      return {
        ...state,
        explorer: action.payload,
      };
    case UPDATE_HNS_PRICE:
      return {
        ...state,
        hnsPrice: action.payload,
      };
    case SET_NO_DNS:
      return {
        ...state,
        noDns: action.payload,
      };
    case SET_SPV_MODE:
      return {
        ...state,
        spv: action.payload,
      };
    case COMPACTING_TREE:
      return {
        ...state,
        compactingTree: action.payload,
      };
    default:
      return state;
  }
}
