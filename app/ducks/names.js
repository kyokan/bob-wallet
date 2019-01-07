import * as nodeClient from '../utils/nodeClient';
import * as walletClient from '../utils/walletClient';
import * as namesDb from '../db/names';

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

  const result = await nClient.getNameInfo(name);
  const { start, info } = result;
  let bids = [];
  if (!info) {
    dispatch({
      type: SET_NAME,
      payload: {
        name,
        start,
        info,
        bids
      }
    });
    return;
  }

  try {
    const auctionInfo = await wClient.getAuctionInfo(name);
    bids = auctionInfo.bids;
  } catch (e) {
    if (!e.message.match(/auction not found/i)) {
      throw e;
    }
  }

  dispatch({
    type: SET_NAME,
    payload: { name, start, info, bids },
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

export const sendReveal = (name) => async (dispatch, getState) => {
  if (!name) {
    return;
  }

  const wClient = walletClient.forNetwork(getState().wallet.network);
  await wClient.sendReveal(name);
};

export default function namesReducer(state = initialState, action) {
  const { type, payload } = action;
  switch (type) {
    case SET_NAME:
      return { ...state, [payload.name]: payload };
    default:
      return state;
  }
};
