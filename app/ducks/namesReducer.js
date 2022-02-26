import { SET_PENDING_TRANSACTIONS } from './walletReducer';
import { hashName } from 'hsd/lib/covenants/rules';

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

  for (const {tx} of action.payload) {
    for (const output of tx.outputs) {
      if (ALLOWED_COVENANTS.has(output.covenant.action)) {
        const hash = output.covenant.items[0];

        // Store multiple bids
        if (output.covenant.action === 'BID') {
          pendingOperationsByHash[hash] = output.covenant.action;
          pendingOpMetasByHash[hash] = [...(pendingOpMetasByHash[hash] || []), output.covenant];
          pendingOutputByHash[hash] = [...(pendingOutputByHash[hash] || []), output];
        } else {
          pendingOperationsByHash[hash] = output.covenant.action;
          pendingOpMetasByHash[hash] = output.covenant;
          pendingOutputByHash[hash] = output;
        }
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

    if (pendingOp === 'BID') {
      pendingOperationMeta.bids = pendingOutput.map(output => ({
        value: output.value,
        height: -1,
        from: output.address,
        date: null,
        bid: {
          value: null, // true bid
          prevout: null,
          own: true,
          namehash: hash,
          name: name,
          lockup: output.value,
          blind: output.covenant.items[3],
        },
      }));
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
