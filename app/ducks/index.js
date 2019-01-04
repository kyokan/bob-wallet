import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';
import names from './names';
import auctions from './auctions';
import wallet from './wallet';
import node from './node';

export default function createRootReducer(history) {
  return combineReducers({
    router: connectRouter(history),
    names,
    auctions,
    wallet,
    node,
  });
}
