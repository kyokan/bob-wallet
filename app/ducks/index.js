import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';
import wallet from './wallet';

export default function createRootReducer(history) {
  return combineReducers({
    router: connectRouter(history),
    wallet
  });
}
