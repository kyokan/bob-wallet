import { SET_PENDING_TRANSACTIONS } from './walletReducer';
import { hashName } from 'hsd/lib/covenants/rules';

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

function getInitialState() {
  return {}
}

export default function namesReducer(state = getInitialState(), action) {
  switch (action.type) {
    case SET_NAME:
      return reduceSetName(state, action);
    case SET_PENDING_TRANSACTIONS:
      return action.payload;
    default:
      return state;
  }
};
