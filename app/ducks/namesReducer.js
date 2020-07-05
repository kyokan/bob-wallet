import { SET_PENDING_TRANSACTIONS } from './walletReducer';
import { hashName } from '../utils/nameChecker';

const ALLOWED_COVENANTS = new Set([
  'OPEN',
  'BID',
  'REVEAL',
  'UPDATE',
  'REGISTER',
  'RENEW',
  'REDEEM',
  'TRANSFER',
  'FINALIZE',
]);

export const SET_NAME = 'app/names/setName';


function reduceSetName(state, action) {
  const {payload} = action;
  const {name} = payload;
  const hash = (name.info && name.info.hash) || hashName(name).toString('hex');

  return {
    ...state,
    [name]: {
      ...state[name] || {},
      ...state[name],
      ...payload,
      hash,
      // pendingOperation: null,
    }
  };
}

function reducePendingTransactions(state, action) {
  const pendingOperationsByHash = {};
  const pendingOpMetasByHash = {};
  const pendingOutputByHash = {};

  for (const tx of action.payload) {
    for (const output of tx.outputs) {
      if (ALLOWED_COVENANTS.has(output.covenant.action)) {
        pendingOperationsByHash[output.covenant.items[0]] = output.covenant.action;
        pendingOpMetasByHash[output.covenant.items[0]] = output.covenant;
        pendingOutputByHash[output.covenant.items[0]] = output;
        break;
      }
    }
  }

  const names = Object.keys(state);
  const newNames = {};
  for (const name of names) {
    const data = state[name];
    const hash = data.hash;
    const pendingOp = pendingOperationsByHash[hash];
    const pendingCovenant = pendingOpMetasByHash[hash];
    const pendingOutput = pendingOutputByHash[hash];
    const pendingOperationMeta = {};

    if (pendingOp === 'UPDATE' || pendingOp === 'REGISTER') {
      pendingOperationMeta.data = pendingCovenant.items[2];
    }

    if (pendingOp === 'REVEAL') {
      pendingOperationMeta.output = pendingOutput;
    }

    newNames[name] = {
      ...data,
      pendingOperation: pendingOp || null,
      pendingOperationMeta: pendingOperationMeta,
    };
  }

  return {
    ...state,
    ...newNames
  };
}

function getInitialState() {
  return {}
}

export default function namesReducer(state = getInitialState(), action) {
  switch (action.type) {
    case SET_NAME:
      return reduceSetName(state, action);
    case SET_PENDING_TRANSACTIONS:
      return reducePendingTransactions(state, action);
    default:
      return state;
  }
};
