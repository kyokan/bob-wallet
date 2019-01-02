// Action Types
const SET_NAME = 'app/names/setName';


// Other Constants
const API = 'http://127.0.0.1:15037';
const LAUNCH_DATE = new Date('October 1, 2018');
export const NAME_STATES = {
  BIDDING: 'BIDDING',
  REVEAL: 'REVEAL',
  CLOSED: 'CLOSED',
  REVOKED: 'REVOKED',
  TRANSFER: 'TRANSFER',
};

const initialState = {};

export const getNameInfo = name => async dispatch => {
  const resp = await fetch(API, {
    method: 'POST',
    body: JSON.stringify({
      method: 'getnameinfo',
      params: [ name ],
    }),
  });
  const { result, error } = await resp.json();

  if (error) {
    const err = new Error(error.message);
    dispatch({
      type: SET_NAME,
      error: err,
      payload: {
        name,
        result: null,
      }
    });
    throw err;
  }

  dispatch({
    type: SET_NAME,
    payload: { name, result },
  });
};

export default function namesReducer(state = initialState, action) {
  const { type, payload } = action;
  switch (type) {
    case SET_NAME:
      return { ...state, [payload.name]: payload.result };
    default:
      return state;
  }
};

// Selectors
export function getDomain(state, name) {
  assert(state, 'state is undefined');
  assert(typeof name === 'string', 'name must be string');
  return state.names[name] || {};
}

export function getIsAvailable(state, name) {
  const domain = getDomain(state, name);
  const { info, start } = domain;

  if (!start && !info) {
    return false;
  }

  if (start.reserved) {
    return false;
  }

  if (!info || info === NAME_STATES.BIDDING) {
    return true;
  }

  return false;
}

export function getIsReserved(state, name) {
  const domain = getDomain(state, name);
  const { start } = domain;

  if (start && start.reserved) {
    return true;
  }

  return false;
}

export function getBiddingOpenDate(state, name) {
  const domain = getDomain(state, name);
  const { start } = domain;

  if (!start) {
    return;
  }

  return addDays(LAUNCH_DATE, start.week * 7)
}

export function getBiddingCloseDate(state, name) {
  const domain = getDomain(state, name);
  const { start } = domain;

  if (!start) {
    return;
  }

  return addDays(LAUNCH_DATE, start.week * 7 + 7)
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function addDays(start = new Date(), days = 0) {
  return new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
}
