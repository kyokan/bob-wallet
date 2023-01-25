import { Address } from 'hsd/lib/primitives';
import nodeClient from '../utils/nodeClient';
import walletClient from '../utils/walletClient';
import * as namesDb from '../db/names';
import {
  fetchPendingTransactions,
  getPassphrase,
  startWalletSync,
  stopWalletSync,
  waitForWalletSync,
} from './walletActions';
import { SET_NAME } from './namesReducer';
import {NAME_STATES} from "../constants/names";

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

export const fetchName = name => async (dispatch, getState) => {
  const {names} = getState();
  const existing = names[name];

  if (existing && existing.info) {
    return;
  }

  const result = await nodeClient.getNameInfo(name);
  const {start, info} = result;

  let bids = [];
  let reveals = [];
  let winner = null;
  let isOwner = false;
  let walletHasName = false;
  let nameState = info && info.state;

  if (nameState === NAME_STATES.CLOSED) {
    isOwner = !!await walletClient.getCoin(info.owner.hash, info.owner.index);
  }

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
};

export const getNameInfo = name => async (dispatch) => {
  const result = await nodeClient.getNameInfo(name);
  const {start, info} = result;

  let bids = [];
  let reveals = [];
  let winner = null;
  let lastTx = null;
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
        lastTx,
        isOwner,
        walletHasName,
      },
    });
    return;
  }

  try {
    const auctionInfo = await walletClient.getAuctionInfo(name);
    walletHasName = true;
    bids = await inflateBids(auctionInfo.bids, info.height);
    reveals = await inflateReveals(auctionInfo.reveals, info.height);
  } catch (e) {
    if (!e.message.match(/auction not found/i)) {
      throw e;
    }
  }

  if (info.state === NAME_STATES.CLOSED) {
    const res = await walletClient.getTX(info.owner.hash);
    if (res) {
      const {tx: buyTx} = res;
      const buyOutput = buyTx.outputs[info.owner.index];
      const coin = await walletClient.getCoin(info.owner.hash, info.owner.index);
      isOwner = !!coin;

      if (coin) {
        lastTx = {
          height: coin.height,
          covenant: coin.covenant,
        }

        if (coin.covenant.action === 'TRANSFER') {
          const {network} = await nodeClient.getInfo();
          info.transferTo = Address.fromHash(
            Buffer.from(coin.covenant.items[3], 'hex'),
            Number(coin.covenant.items[2])
          ).toString(network);
        }
      }

      winner = {
        address: buyOutput.address,
      };
    }
  }

  dispatch({
    type: SET_NAME,
    payload: {name, start, info, bids, reveals, winner, lastTx, isOwner, walletHasName},
  });
};

async function inflateBids(bids, nameHeight) {
  if (!bids.length) {
    return [];
  }

  const ret = [];
  for (const bid of bids) {
    // Must use node client to get non-own bids
    const res = await nodeClient.getTx(bid.prevout.hash);

    if (!res) continue;

    // Ignore bids from previous auctions
    if (res.height < nameHeight) continue;

    const tx = res;
    const out = tx.outputs[bid.prevout.index];

    ret.push({
      bid,
      from: out.address,
      date: tx.mtime * 1000,
      value: out.value,
      height: tx.height,
    });
  }

  return ret;
}

async function inflateReveals(reveals, nameHeight) {
  if (!reveals.length) {
    return [];
  }

  const ret = [];
  for (const reveal of reveals) {
    // Must use node client to get non-own reveals
    const res = await nodeClient.getTx(reveal.prevout.hash);

    if (!res) continue;

    // Ignore reveals from previous auctions
    if (res.height < nameHeight) continue;

    const tx = res;
    const out = tx.outputs[reveal.prevout.index];
    const coin = await walletClient.getCoin(reveal.prevout.hash, reveal.prevout.index);

    ret.push({
      bid: reveal, // yes, it really is reveal
      from: out.address,
      date: tx.mtime * 1000,
      value: out.value,
      height: tx.height,
      redeemable: !!coin,
    });
  }

  return ret;
}

export const sendOpen = name => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  await walletClient.sendOpen(name);
  await namesDb.storeName(name);
  await dispatch(fetchPendingTransactions());
};

export const sendBid = (name, amount, lockup, height) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

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

export const sendReveal = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  await namesDb.storeName(name);
  await walletClient.sendReveal(name);
};

export const sendRegister = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  await walletClient.sendRegister(name);
};

export const sendRedeem = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  await namesDb.storeName(name);
  await walletClient.sendRedeem(name);
};

export const sendRedeemAll = () => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  await walletClient.sendRedeemAll();
};

export const sendRevealAll = () => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  await walletClient.sendRevealAll();
};

export const sendRegisterAll = () => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  await walletClient.sendRegisterAll();
};

export const sendRenewal = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  await namesDb.storeName(name);
  await walletClient.sendRenewal(name);
};

export const transferMany = (names, recipient) => async (dispatch) => {
  if (!names || !names.length) {
    return;
  }
  if (!recipient) {
    return;
  }

  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  await walletClient.transferMany(names, recipient);
};

export const finalizeAll = () => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  await walletClient.finalizeAll();
};

export const finalizeMany = (names) => async (dispatch) => {
  if (!names || !names.length) {
    return;
  }

  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  await walletClient.finalizeMany(names);
};

export const renewAll = () => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  await walletClient.renewAll();
};

export const renewMany = (names) => async (dispatch) => {
  if (!names || !names.length) {
    return;
  }

  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  await walletClient.renewMany(names);
};

export const sendTransfer = (name, recipient) => async (dispatch) => {
  if (!name) {
    return;
  }
  if (!recipient) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  await walletClient.sendTransfer(name, recipient);
};

export const cancelTransfer = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  await walletClient.cancelTransfer(name);
};

export const finalizeTransfer = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  await walletClient.finalizeTransfer(name);
};

export const finalizeWithPayment = (name, fundingAddr, recipient, price) => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  return walletClient.finalizeWithPayment(name, fundingAddr, recipient, price);
};

export const claimPaidTransfer = (hex) => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  await walletClient.claimPaidTransfer(hex);
};

export const revokeName = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  await walletClient.revokeName(name);
};

export const sendUpdate = (name, json) => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  await namesDb.storeName(name);
  await walletClient.sendUpdate(name, json);
  await dispatch(fetchPendingTransactions());
};
