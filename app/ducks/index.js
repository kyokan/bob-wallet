import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';

export default function createRootReducer(history) {
  return combineReducers({
    router: connectRouter(history)
  });
}
