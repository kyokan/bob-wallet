import * as namesDb from '../db/names';
import { getWatchlist, saveToWatchlist } from '../db/watching';

const SET_WATCHLIST = 'app/watching/setWatchlist';

const initialState = {
  names: [],
};

export const getWatching = (network) => async dispatch => {
  const data = await getWatchlist(network);

  dispatch({
    type: SET_WATCHLIST,
    payload: Array.isArray(data) ? data : [],
  });
};

export const addName = (name, network) => async dispatch => {
  const data = await getWatchlist(network);
  const result = validateWatchlist(data);
  result.push(name);
  namesDb.storeName(name);
  saveToWatchlist(network, result);

  dispatch({
    type: SET_WATCHLIST,
    payload: result,
  });
};

export const removeName = (name, network) => async dispatch => {
  const data = await getWatchlist(network);
  let result = validateWatchlist(data);
  result = result.filter(n => n !== name);
  saveToWatchlist(network, result);
  
  dispatch({
    type: SET_WATCHLIST,
    payload: result,
  })
};

export default function watchingReducer(state = initialState, action) {
  const { type, payload } = action;
  switch (type) {
    case SET_WATCHLIST:
      return {
        ...state,
        names: payload,
      };
    default:
      return state;
  }
}

function validateWatchlist(data) {
  if (!data) {
    return [];
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return uniq(data).filter(d => typeof d === 'string');
}

const uniq = a => [...new Set(a)];
