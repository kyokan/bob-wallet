import * as nodeClient from '../utils/nodeClient';
import * as walletClient from '../utils/walletClient';
import * as namesDb from '../db/names';
import { fetchPendingTransactions, SET_PENDING_TRANSACTIONS } from './wallet';
import { hashName } from '../utils/nameChecker';

export const RECORD_TYPE = {
  A: 'A',
  CNAME: 'CNAME',
  AAAA: 'AAAA',
};

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

const ALLOWED_COVENANTS = new Set([
  'OPEN',
  'BID',
  'REVEAL'
]);

const initialState = {};

export const getNameInfo = name => async (dispatch, getState) => {
  const net = getState().wallet.network;
  const nClient = nodeClient.forNetwork(net);
  const wClient = walletClient.forNetwork(net);

  const result = await nClient.getNameInfo(name);
  const {start, info} = result;
  let bids = [];
  let reveals = [];
  let winner = null;
  if (!info) {
    dispatch({
      type: SET_NAME,
      payload: {
        name,
        start,
        info,
        bids,
        reveals,
        winner,
      }
    });
    return;
  }

  try {
    const auctionInfo = await wClient.getAuctionInfo(name);
    bids = await inflateBids(nClient, auctionInfo.bids);
    reveals = auctionInfo.reveals;
  } catch (e) {
    if (!e.message.match(/auction not found/i)) {
      throw e;
    }
  }

  if (info.state === NAME_STATES.CLOSED) {
    const buyTx = await nClient.getTx(info.owner.hash);
    const buyOutput = buyTx.outputs[info.owner.index];
    winner = {
      address: buyOutput.address,
    };
  }

  dispatch({
    type: SET_NAME,
    payload: {name, start, info, bids, reveals, winner},
  });
};

async function inflateBids(nClient, bids) {
  if (!bids.length) {
    return [];
  }

  const ret = [];
  for (const bid of bids) {
    const tx = await nClient.getTx(bid.prevout.hash);
    const out = tx.outputs[bid.prevout.index];
    ret.push({
      bid,
      from: out.address,
      date: tx.mtime,
      value: out.value
    });
  }

  return ret;
}

export const sendOpen = name => async (dispatch, getState) => {
  const wClient = walletClient.forNetwork(getState().wallet.network);
  await wClient.sendOpen(name);
  await namesDb.storeName(name);
  await dispatch(fetchPendingTransactions());
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

export const sendUpdate = (name, json) => async (dispatch, getState) => {
  if (!json.type || !json.name || !json.value || !json.ttl) {
    return;
  }
  // console.log({ type, name, value, ttl });
  // window.Resource = Resource;
  // Resource.fromJSON({
  //
  // })
  const wClient = walletClient.forNetwork(getState().wallet.network);
  console.log({
    hosts: ['104.198.104.19', '2001:db8:85a3:8d3:1319:8a2e:370:7348'],
    ttl: 86400,
    canonical: 'google.com',
  })
  await wClient.sendUpdate(name, {
    hosts: ['104.198.104.19', '2001:db8:85a3:8d3:1319:8a2e:370:7348'],
    ttl: 86400,
    canonical: 'google.com',
  });
};

function reduceSetName(state, action) {
  const {payload} = action;
  const {name} = payload;
  const hash = (name.info && name.info.hash) || hashName(name).toString('hex');

  return {
    ...state,
    [name]: {
      ...payload,
      hash,
      pendingOperation: null,
    }
  };
}

function reducePendingTransactions(state, action) {
  const pendingOperationsByHash = {};

  for (const tx of action.payload) {
    for (const output of tx.outputs) {
      if (ALLOWED_COVENANTS.has(output.covenant.action)) {
        pendingOperationsByHash[output.covenant.items[0]] = output.covenant.action;
        break;
      }
    }
  }

  const names = Object.keys(state);
  const newNames = {};
  for (const name of names) {
    const data = state[name];
    const hash = data.hash;
    const pendingOp = pendingOperationsByHash[hash];
    newNames[name] = {
      ...data,
      pendingOperation: pendingOp || null
    };
  }

  return {
    ...state,
    ...newNames
  };
}

export default function namesReducer(state = initialState, action) {
  switch (action.type) {
    case SET_NAME:
      return reduceSetName(state, action);
    case SET_PENDING_TRANSACTIONS:
      return reducePendingTransactions(state, action);
    default:
      return state;
  }
};
