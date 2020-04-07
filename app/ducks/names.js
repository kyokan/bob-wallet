import nodeClient from '../utils/nodeClient';
import walletClient from '../utils/walletClient';
import * as namesDb from '../db/names';
import {
  startWalletSync,
  stopWalletSync,
  waitForWalletSync,
  fetchPendingTransactions,
  SET_PENDING_TRANSACTIONS
} from './walletActions';
import { SET_NAME } from './namesReducer';

export const RECORD_TYPE = {
  DS: 'DS',
  NS: 'NS',
  GLUE4: 'GLUE4',
  GLUE6: 'GLUE6',
  SYNTH4: 'SYNTH4',
  SYNTH6: 'SYNTH6',
  TXT: 'TXT',
};

export const DROPDOWN_TYPES = [
  {label: RECORD_TYPE.DS},
  {label: RECORD_TYPE.NS},
  {label: RECORD_TYPE.GLUE4},
  {label: RECORD_TYPE.GLUE6},
  {label: RECORD_TYPE.SYNTH4},
  {label: RECORD_TYPE.SYNTH6},
  {label: RECORD_TYPE.TXT},
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

export const getNameInfo = name => async (dispatch) => {
  const result = await nodeClient.getNameInfo(name);
  const {start, info} = result;
  let bids = [];
  let reveals = [];
  let winner = null;
  let isOwner = false;
  let walletHasName = false;
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
        walletHasName,
      },
    });
    return;
  }

  try {
    const auctionInfo = await walletClient.getAuctionInfo(name);
    walletHasName = true;
    bids = await inflateBids(nodeClient, walletClient, auctionInfo.bids, info.height);
    reveals = await inflateReveals(nodeClient, walletClient, auctionInfo.reveals, info.height);
  } catch (e) {
    if (!e.message.match(/auction not found/i)) {
      throw e;
    }
  }

  if (info.state === NAME_STATES.CLOSED) {
    const buyTx = await nodeClient.getTx(info.owner.hash);
    const buyOutput = buyTx.outputs[info.owner.index];
    isOwner = !!await walletClient.getCoin(info.owner.hash, info.owner.index);

    winner = {
      address: buyOutput.address,
    };
  }

  dispatch({
    type: SET_NAME,
    payload: {name, start, info, bids, reveals, winner, isOwner, walletHasName},
  });
};

async function inflateBids(nClient, walletClient, bids) {
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

async function inflateReveals(nClient, walletClient, bids) {
  if (!bids.length) {
    return [];
  }

  const ret = [];
  for (const bid of bids) {
    const tx = await nClient.getTx(bid.prevout.hash);
    const out = tx.outputs[bid.prevout.index];
    const coin = await walletClient.getCoin(bid.prevout.hash, bid.prevout.index);

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

export const sendOpen = name => async (dispatch) => {
  await walletClient.sendOpen(name);
  await namesDb.storeName(name);
  await dispatch(fetchPendingTransactions());
};

export const sendBid = (name, amount, lockup, height) => async (dispatch) => {
  if (!name) {
    return;
  }

  if (height) {
    try {
      await dispatch(startWalletSync());
      await walletClient.importName(name, height);
      await dispatch(waitForWalletSync());
    } catch (e) {
      throw e;
    } finally {
      await dispatch(stopWalletSync());
    }
  }

  await walletClient.sendBid(name, amount, lockup);
  await namesDb.storeName(name);
};

export const sendReveal = (name) => async () => {
  if (!name) {
    return;
  }

  await namesDb.storeName(name);
  await walletClient.sendReveal(name);
};

export const sendRedeem = (name) => async () => {
  if (!name) {
    return;
  }

  await namesDb.storeName(name);
  await walletClient.sendRedeem(name);
};

export const sendRenewal = (name) => async () => {
  if (!name) {
    return;
  }

  await namesDb.storeName(name);
  await walletClient.sendRenewal(name);
};

export const sendUpdate = (name, json) => async (dispatch) => {
  await namesDb.storeName(name);
  await walletClient.sendUpdate(name, json);
  await dispatch(fetchPendingTransactions());
};
