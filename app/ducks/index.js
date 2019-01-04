import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';
import names from './names';
import node from './node';


// (async () => {
//   const resp = await fetch('http://127.0.0.1:15037');
//   const json = await resp.json();
//   console.log(json);
// })();

export default function createRootReducer(history) {
  return combineReducers({
    router: connectRouter(history),
    names,
    node,
  });
}
