import { Context } from 'shakedex/src/context.js';
import { SwapProof, writeProofStream } from 'shakedex/src/swapProof.js';
import { service as nodeService } from '../node/service';
import { service as walletService } from '../wallet/service';
import {
  fulfillSwap as sdFulfillSwap,
  finalizeSwap as sdFinalizeSwap,
  transferNameLock,
  finalizeNameLock,
} from 'shakedex/src/swapService.js';
import { put, iteratePrefix, get } from '../db/service.js';
import { SwapFulfillment } from 'shakedex/src/swapFulfillment.js';
import { Auction, linearReductionStrategy } from 'shakedex/src/auction.js';
import { NameLockFinalize } from 'shakedex/src/nameLock.js';
import stream from 'stream';

export async function fulfillSwap(auction, bid) {
  const context = getContext();
  const proof = new SwapProof({
    lockingTxHash: auction.lockingTxHash,
    lockingOutputIdx: auction.lockingOutputIdx,
    name: auction.name,
    publicKey: auction.publicKey,
    paymentAddr: auction.paymentAddr,
    price: bid.price,
    lockTime: bid.lockTime / 1000,
    signature: bid.signature,
  });

  const fulfillment = await sdFulfillSwap(context, proof);
  const fulfillmentJSON = fulfillment.toJSON();
  await put(
    `exchange/fills/${fulfillmentJSON.name}/${fulfillmentJSON.fulfillmentTxHash}`,
    {
      fulfillment: fulfillmentJSON,
    },
  );
  return fulfillmentJSON;
}

export async function finalizeSwap(fulfillmentJSON) {
  const context = getContext();
  const fulfillment = new SwapFulfillment(fulfillmentJSON);
  const finalize = await sdFinalizeSwap(context, fulfillment);
  const out = {
    fulfillment: fulfillmentJSON,
    finalize: finalize.toJSON(),
  };
  await put(
    `exchange/fills/${fulfillmentJSON.name}/${fulfillmentJSON.fulfillmentTxHash}`,
    out,
  );
  return out;
}

export async function getFulfillments() {
  const swaps = [];
  await iteratePrefix(
    'exchange/fills',
    (key, value) => swaps.push(
      JSON.parse(value.toString('utf-8')),
    ),
  );
  return swaps;
}

export async function transferLock(name, startPrice, endPrice, durationDays) {
  const context = getContext();
  const nameLock = await transferNameLock(context, name);
  const nameLockJSON = nameLock.toJSON();
  const out = {
    nameLock: nameLockJSON,
    params: {
      startPrice,
      endPrice,
      durationDays,
    },
  };
  await put(
    `exchange/listings/${nameLockJSON.name}/${nameLockJSON.transferTxHash}`,
    out,
  );
  return out;
}

export async function finalizeLock(nameLock) {
  const context = getContext();
  const finalizeLock = await finalizeNameLock(context, nameLock);
  const finalizeLockJSON = finalizeLock.toJSON();
  const existing = await get(
    `exchange/listings/${nameLock.name}/${nameLock.transferTxHash}`,
  );
  const out = {
    ...existing,
    finalizeLock: finalizeLockJSON,
  };
  await put(
    `exchange/listings/${nameLock.name}/${nameLock.transferTxHash}`,
    out,
  );
  return out;
}

export async function getListings() {
  const listings = [];
  await iteratePrefix(
    'exchange/listing',
    (key, value) => listings.push(
      JSON.parse(value.toString('utf-8')),
    ),
  );
  return listings;
}

export async function launchAuction(nameLock) {
  const context = getContext();
  const key = `exchange/listings/${nameLock.name}/${nameLock.transferTxHash}`;
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

  const auction = new Auction({
    name: listing.nameLock.name,
    startTime: Date.now(),
    endTime: Date.now() + durationDays * 24 * 60 * 60 * 1000,
    startPrice: startPrice,
    endPrice: endPrice,
    reductionTimeMS,
    reductionStrategy: linearReductionStrategy,
  });
  const proposals = await auction.generateProposals(
    context,
    new NameLockFinalize(listing.finalizeLock),
  );
  listing.proposals = proposals;
  await put(
    key,
    listing,
  );
  return proposals.map(p => p.toJSON(context));
}

async function downloadProofs(auction) {
  const context = getContext();
  const proofs = [];
  for (const bid of auction.bids) {
    proofs.push(new SwapProof({
      lockingTxHash: auction.lockingTxHash,
      lockingOutputIdx: auction.lockingOutputIdx,
      name: auction.name,
      publicKey: auction.publicKey,
      paymentAddr: auction.paymentAddr,
      price: bid.price,
      lockTime: bid.lockTime / 1000,
      signature: bid.signature,
    }));
  }
  const data = [];
  const writable = new stream.Writable({
    write: function (chunk, encoding, next) {
      data.push(chunk);
      next();
    },
  });
  await writeProofStream(writable, proofs, context);
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
  server.withService(sName, methods);
}
