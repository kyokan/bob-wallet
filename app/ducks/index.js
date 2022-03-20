import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';
import names from './namesReducer';
import wallet from './walletReducer';
import node, { START_NETWORK_CHANGE } from './nodeReducer';
import hip2 from './hip2Reducer';
import myDomains from './myDomains';
import notifications from './notifications';
import bids from './bids';
import watching from './watching';
import ledger from './ledger';
import app from './app';
import exchange from './exchange.js';
import claims from './claims.js';

export default function createRootReducer(history) {
  const root = combineReducers({
    router: connectRouter(history),
    names,
    wallet,
    node,
    hip2,
    myDomains,
    notifications,
    bids,
    watching,
    ledger,
    app,
    exchange,
    claims,
  });

  return (state, action) => {
    if (action.type === START_NETWORK_CHANGE) {
      state = undefined;
    }

    return root(state, action);
  }
};
