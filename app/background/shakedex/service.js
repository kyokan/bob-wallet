import { Context } from 'shakedex/src/context.js';
import { SwapProof } from 'shakedex/src/swapProof.js';
import { service as nodeService } from '../node/service';
import { service as walletService } from '../wallet/service';
import {
  fillSwap as sdFulfillSwap,
  finalizeSwap as sdFinalizeSwap,
  transferNameLock,
  finalizeNameLock,
} from 'shakedex/src/swapService.js';
import { SwapFill } from 'shakedex/src/swapFill.js';
import { Auction, AuctionFactory, linearReductionStrategy } from 'shakedex/src/auction.js';
import { NameLockFinalize } from 'shakedex/src/nameLock.js';
import stream from 'stream';
import {encrypt, decrypt} from "../../utils/encrypt";
import path from "path";
import {app} from "electron";
import bdb from "bdb";

let db;

export async function openDB() {
  if (db) {
    return;
  }

  const loc = path.join(app.getPath('userData'), 'exchange_db');
  let tdb = bdb.create(loc);
  await tdb.open();
  db = tdb;
}

export async function closeDB() {
  ensureDB();
  await db.close();
  db = null;
}

export async function put(key, value) {
  ensureDB();
  return db.put(Buffer.from(key, 'utf-8'), Buffer.from(JSON.stringify(value), 'utf-8'));
}

export async function get(key) {
  ensureDB();
  const data = await db.get(Buffer.from(key, 'utf-8'));
  if (data === null) {
    return null;
  }

  return JSON.parse(data.toString('utf-8'));
}

export async function del(key) {
  ensureDB();
  return db.del(Buffer.from(key, 'utf-8'));
}

export async function iteratePrefix(prefix, cb) {
  const gt = Buffer.from(prefix, 'utf-8');
  const iter = db.iterator({
    gt,
    lt: Buffer.concat([gt, Buffer.from([0xFF])]),
    values: true,
  });
  await iter.each(cb);
}

export async function fulfillSwap(auction, bid) {
  const context = getContext();
  const proof = new SwapProof({
    lockingTxHash: auction.lockingTxHash,
    lockingOutputIdx: auction.lockingOutputIdx,
    name: auction.name,
    publicKey: auction.publicKey,
    paymentAddr: auction.paymentAddr,
    price: bid.price,
    lockTime: Math.floor(bid.lockTime / 1000),
    signature: bid.signature,
  });

  const fulfillment = await sdFulfillSwap(context, proof);
  const fulfillmentJSON = fulfillment.toJSON();
  await put(
    `${fillsPrefix()}/${fulfillmentJSON.name}/${fulfillmentJSON.fulfillmentTxHash}`,
    {
      fulfillment: fulfillmentJSON,
    },
  );
  return fulfillmentJSON;
}

export async function finalizeSwap(fulfillmentJSON) {
  const context = getContext();
  const fulfillment = new SwapFill(fulfillmentJSON);
  const finalize = await sdFinalizeSwap(context, fulfillment);
  const out = {
    fulfillment: fulfillmentJSON,
    finalize: finalize.toJSON(),
  };
  await put(
    `${fillsPrefix()}/${fulfillmentJSON.name}/${fulfillmentJSON.fulfillmentTxHash}`,
    out,
  );
  return out;
}

export async function getFulfillments() {
  const swaps = [];
  await iteratePrefix(
    fillsPrefix(),
    (key, value) => swaps.push(
      JSON.parse(value.toString('utf-8')),
    ),
  );
  return swaps;
}

function fillsPrefix() {
  const walletName = walletService.name;
  return `exchange/fills/${walletName}`;
}

function listingPrefix() {
  const walletName = walletService.name;
  return `exchange/listings/${walletName}`;
}

export async function transferLock(name, startPrice, endPrice, durationDays, password) {
  const context = getContext();
  const nameLock = await transferNameLock(context, name);
  const {privateKey, ...nameLockJSON} = nameLock.toJSON();
  const out = {
    nameLock: {
      ...nameLockJSON,
      encryptedPrivateKey: encrypt(privateKey, password)
    },
    params: {
      startPrice,
      endPrice,
      durationDays,
    },
  };
  await put(
    `${listingPrefix()}/${nameLockJSON.name}/${nameLockJSON.transferTxHash}`,
    out,
  );
  return out;
}

export async function finalizeLock(nameLock, password) {
  const context = getContext();
  const finalizeLock = await finalizeNameLock(context, {
    ...nameLock,
    privateKey: decrypt(nameLock.encryptedPrivateKey, password),
  });
  const {privateKey, ...finalizeLockJSON} = finalizeLock.toJSON();
  const existing = await get(
    `${listingPrefix()}/${nameLock.name}/${nameLock.transferTxHash}`,
  );
  const out = {
    ...existing,
    finalizeLock: {
      ...finalizeLockJSON,
      encryptedPrivateKey: encrypt(privateKey, password),
    },
  };
  await put(
    `${listingPrefix()}/${nameLock.name}/${nameLock.transferTxHash}`,
    out,
  );
  return out;
}

export async function getListings() {
  const listings = [];
  await iteratePrefix(
    listingPrefix(),
    (key, value) => listings.push(
      JSON.parse(value.toString('utf-8')),
    ),
  );
  return listings;
}

export async function launchAuction(nameLock, passphrase) {
  const context = getContext();
  const key = `${listingPrefix()}/${nameLock.name}/${nameLock.transferTxHash}`;
  const listing = await get(
    key,
  );

  const {startPrice, endPrice, durationDays} = listing.params;
  let reductionTimeMS;
  switch (durationDays) {
    case 1:
      reductionTimeMS = 60 * 60 * 1000;
      break;
    case 3:
      reductionTimeMS = 3 * 60 * 60 * 1000;
      break;
    case 5:
    case 7:
    case 14:
      reductionTimeMS = 24 * 60 * 60 * 1000;
      break;
  }

  const auctionFactory = new AuctionFactory({
    name: listing.nameLock.name,
    startTime: Date.now(),
    endTime: Date.now() + durationDays * 24 * 60 * 60 * 1000,
    startPrice: startPrice,
    endPrice: endPrice,
    reductionTimeMS,
    reductionStrategy: linearReductionStrategy,
  });
  const auction = await auctionFactory.createAuction(
    context,
    new NameLockFinalize({
      ...listing.finalizeLock,
      privateKey: decrypt(listing.finalizeLock.encryptedPrivateKey, passphrase)
    }),
  );
  const auctionJSON = auction.toJSON(context);
  listing.auction = auctionJSON;
  await put(
    key,
    listing,
  );
  return auctionJSON;
}

async function downloadProofs(auctionJSON) {
  const context = getContext();
  const proofs = [];
  for (const bid of auction.bids) {
    proofs.push(new SwapProof({
      price: bid.price,
      lockTime: bid.lockTime / 1000,
      signature: bid.signature,
    }));
  }
  const auction = new Auction({
    ...auctionJSON,
    data: proofs,
  });
  const data = [];
  const writable = new stream.Writable({
    write: function (chunk, encoding, next) {
      data.push(chunk);
      next();
    },
  });
  await auction.writeToStream(context, writable);
  return {
    data: data.join(''),
  };
}

function getContext() {
  const walletId = walletService.name;
  const {apiKey, networkName} = nodeService;

  return new Context(
    networkName,
    walletId,
    apiKey,
    () => Promise.resolve(null),
  );
}

const sName = 'Shakedex';
const methods = {
  fulfillSwap,
  getFulfillments,
  finalizeSwap,
  transferLock,
  finalizeLock,
  getListings,
  launchAuction,
  downloadProofs,
};

export async function start(server) {
  await openDB();
  server.withService(sName, methods);
}

function ensureDB() {
  if (!db) {
    throw new Error('db not open');
  }
}
