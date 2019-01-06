import * as nodeClient from '../utils/nodeClient';
import * as walletClient from '../utils/walletClient';
import * as namesDb from '../db/names';
import { showError } from './notifications';

// Action Types
const SET_NAME = 'app/names/setName';

// Other Constants
const WALLET_API = 'http://127.0.0.1:15039';
export const NAME_STATES = {
  OPENING: 'OPENING',
  BIDDING: 'BIDDING',
  REVEAL: 'REVEAL',
  CLOSED: 'CLOSED',
  REVOKED: 'REVOKED',
  TRANSFER: 'TRANSFER',
};

const initialState = {};

export const getNameInfo = name => async (dispatch, getState) => {
  const net = getState().wallet.network;
  const nClient = nodeClient.forNetwork(net);
  const wClient = walletClient.forNetwork(net);

  let result;
  try {
    result = await nClient.getNameInfo(name);
  } catch (err) {
    dispatch({
      type: SET_NAME,
      error: true,
      payload: err,
    });
    throw err;
  }

  const start = result.start;
  let info = result.info;
  try {
    info = await wClient.getAuctionInfo(name);
  } catch (e) {
    if (!e.message.match(/auction not found/i)) {
      throw e;
    }
  }

  dispatch({
    type: SET_NAME,
    payload: { name, start, info },
  });
};

export const sendOpen = name => async (dispatch, getState) => {
  const wClient = walletClient.forNetwork(getState().wallet.network);
  await wClient.sendOpen(name);
  await namesDb.storeName(name);
};

export const sendBid = (name, amount, lockup) => async (dispatch, getState) => {
  if (!name) {
    return;
  }

  const wClient = walletClient.forNetwork(getState().wallet.network);
  await wClient.sendBid(name, amount, lockup);
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
