// Action Types
const SET_NAME = 'app/names/setName';

// Other Constants
const NODE_API = 'http://127.0.0.1:15037';
const WALLET_API = 'http://127.0.0.1:15039';
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

export const sendOpen = name => async dispatch => {
  if (!name) {
    return;
  }

  const resp = await fetch(WALLET_API, {
    method: 'POST',
    body: JSON.stringify({
      method: 'sendopen',
      params: [ name ],
    }),
  });
  const { result, error } = await resp.json();
  return {result, error};
};

export const sendBid = (name, amount, lockup) => async dispatch => {
  if (!name) {
    return;
  }

  const resp = await fetch(WALLET_API, {
    method: 'POST',
    body: JSON.stringify({
      method: 'sendbid',
      params: [ name, amount, lockup ],
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
