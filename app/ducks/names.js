// Action Types
const SET_NAME = 'app/names/setName';


// Other Constants
const NODE_API = 'http://127.0.0.1:15037';
const WALLET_API = 'http://127.0.0.1:15039';
const LAUNCH_DATE = new Date('April 1, 2018');
export const NAME_STATES = {
  OPENNING: 'OPENING',
  BIDDING: 'BIDDING',
  REVEAL: 'REVEAL',
  CLOSED: 'CLOSED',
  REVOKED: 'REVOKED',
  TRANSFER: 'TRANSFER',
};

const initialState = {};

export const getNameInfo = name => async dispatch => {
  const resp = await fetch(NODE_API, {
    method: 'POST',
    body: JSON.stringify({
      method: 'getnameinfo',
      params: [ name ],
    }),
  });
  const { result, error } = await resp.json();

  if (error || !result) {
    const err = new Error(error.message);
    dispatch({
      type: SET_NAME,
      error: true,
      payload: err,
    });
    throw err;
  }

  const start = result.start;
  let info = result.info;

  const auctionInfo = await fetchAuctionInfo(name);

  if (!auctionInfo.error) {
    info = auctionInfo.result;
  }

  dispatch({
    type: SET_NAME,
    payload: { name, start, info },
  });
};

const fetchAuctionInfo = async name => {
  const resp = await fetch(WALLET_API, {
    method: 'POST',
    body: JSON.stringify({
      method: 'getauctioninfo',
      params: [ name ],
    }),
  });
  const { result, error } = await resp.json();
  return {result, error};
};

export default function namesReducer(state = initialState, action) {
  const { type, payload, error } = action;
  switch (type) {
    case SET_NAME:
      return error
        ? state
        : { ...state, [payload.name]: payload };
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
