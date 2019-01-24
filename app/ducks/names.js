import * as nodeClient from '../utils/nodeClient';
import * as walletClient from '../utils/walletClient';
import * as namesDb from '../db/names';
import { fetchPendingTransactions, SET_PENDING_TRANSACTIONS } from './walletActions';
import { SET_NAME } from './namesReducer';

export const RECORD_TYPE = {
  A: 'A',
  CNAME: 'CNAME',
  AAAA: 'AAAA',
  MX: 'MX',
  TXT: 'TXT',
  DS: 'DS',
  OPENPGPKEY: 'OPENPGPKEY',
  NS: 'NS',
  SRV: 'SRV',
};

export const DROPDOWN_TYPES = [
  {label: RECORD_TYPE.A},
  {label: RECORD_TYPE.AAAA},
  {label: RECORD_TYPE.CNAME},
  {label: RECORD_TYPE.DS},
  {label: RECORD_TYPE.MX},
  {label: RECORD_TYPE.NS},
  {label: RECORD_TYPE.TXT},
  {label: RECORD_TYPE.OPENPGPKEY},
  {label: RECORD_TYPE.SRV},
];

// Other Constants
export const NAME_STATES = {
  OPENING: 'OPENING',
  BIDDING: 'BIDDING',
  REVEAL: 'REVEAL',
  CLOSED: 'CLOSED',
  REVOKED: 'REVOKED',
  TRANSFER: 'TRANSFER',
};

export const getNameInfo = name => async (dispatch, getState) => {
  const net = getState().node.network;
  const nClient = nodeClient.forNetwork(net);
  const wClient = walletClient.forNetwork(net);

  const result = await nClient.getNameInfo(name);
  const {start, info} = result;
  let bids = [];
  let reveals = [];
  let winner = null;
  let isOwner = false;
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
        isOwner,
      }
    });
    return;
  }

  try {
    const auctionInfo = await wClient.getAuctionInfo(name);
    bids = await inflateBids(nClient, wClient, auctionInfo.bids, info.height);
    reveals = await inflateReveals(nClient, wClient, auctionInfo.reveals, info.height);
  } catch (e) {
    if (!e.message.match(/auction not found/i)) {
      throw e;
    }
  }

  if (info.state === NAME_STATES.CLOSED) {
    const buyTx = await nClient.getTx(info.owner.hash);
    const buyOutput = buyTx.outputs[info.owner.index];
    isOwner = !!await wClient.getCoin(info.owner.hash, info.owner.index);

    winner = {
      address: buyOutput.address,
    };
  }

  dispatch({
    type: SET_NAME,
    payload: {name, start, info, bids, reveals, winner, isOwner},
  });
};

async function inflateBids(nClient, wClient, bids) {
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
      value: out.value,
      height: tx.height,
    });
  }

  return ret;
}

async function inflateReveals(nClient, wClient, bids) {
  if (!bids.length) {
    return [];
  }

  const ret = [];
  for (const bid of bids) {
    const tx = await nClient.getTx(bid.prevout.hash);
    const out = tx.outputs[bid.prevout.index];
    const coin = await wClient.getCoin(bid.prevout.hash, bid.prevout.index);

    ret.push({
      bid,
      from: out.address,
      date: tx.mtime,
      value: out.value,
      height: tx.height,
      redeemable: !!coin,
    });
  }

  return ret;
}

export const sendOpen = name => async (dispatch, getState) => {
  const wClient = walletClient.forNetwork(getState().node.network);
  await wClient.sendOpen(name);
  await namesDb.storeName(name);
  await dispatch(fetchPendingTransactions());
};

export const sendBid = (name, amount, lockup) => async (dispatch, getState) => {
  if (!name) {
    return;
  }

  const wClient = walletClient.forNetwork(getState().node.network);
  await wClient.sendBid(name, amount, lockup);
  await namesDb.storeName(name);
};

export const sendReveal = (name) => async (dispatch, getState) => {
  if (!name) {
    return;
  }

  const wClient = walletClient.forNetwork(getState().node.network);
  await namesDb.storeName(name);
  await wClient.sendReveal(name);
};

export const sendRedeem = (name) => async (dispatch, getState) => {
  if (!name) {
    return;
  }

  const wClient = walletClient.forNetwork(getState().node.network);
  await namesDb.storeName(name);
  await wClient.sendRedeem(name);
};

export const sendRenewal = (name) => async (dispatch, getState) => {
  if (!name) {
    return;
  }

  const wClient = walletClient.forNetwork(getState().node.network);
  await namesDb.storeName(name);
  await wClient.sendRenewal(name);
};

export const sendUpdate = (name, json) => async (dispatch, getState) => {
  const wClient = walletClient.forNetwork(getState().node.network);
  await namesDb.storeName(name);
  await wClient.sendUpdate(name, json);
  await dispatch(fetchPendingTransactions());
};
