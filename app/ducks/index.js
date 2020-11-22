import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';
import names from './namesReducer';
import wallet from './walletReducer';
import node, { START_NETWORK_CHANGE } from './nodeReducer';
import myDomains from './myDomains';
import notifications from './notifications';
import bids from './bids';
import watching from './watching';
import ledger from './ledger';
import app from './app';

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
    ledger,
    app,
  });

  return (state, action) => {
    if (action.type === START_NETWORK_CHANGE) {
      state = undefined;
    }

    return root(state, action);
  }
};
