import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';
import names from './names';
import wallet from './wallet';
import node, { START_NETWORK_CHANGE } from './node';
import myDomains from './myDomains';
import notifications from './notifications';
import bids from './bids';
import watching from './watching';

export default function createRootReducer(history) {
  const root = combineReducers({
    router: connectRouter(history),
    names,
    wallet,
    node,
    myDomains,
    notifications,
    bids,
    watching,
  });

  return (state, action) => {
    if (action.type === START_NETWORK_CHANGE) {
      state = undefined;
    }

    return root(state, action);
  }
};
