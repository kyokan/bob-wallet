import { Context } from 'shakedex/src/context.js';
import { SwapProof } from 'shakedex/src/swapProof.js';
import { service as nodeService } from '../node/service';
import { service as walletService } from '../wallet/service';
import { fulfillSwap as sdFulfillSwap, finalizeSwap as sdFinalizeSwap } from 'shakedex/src/swapService.js';
import { put, iteratePrefix } from '../db/service.js';
import { SwapFulfillment } from 'shakedex/src/swapFulfillment.js';

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
    `exchange/swaps/${fulfillmentJSON.name}/${fulfillmentJSON.fulfillmentTxHash}`,
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
    `exchange/swaps/fulfillments/${fulfillmentJSON.name}/${fulfillmentJSON.fulfillmentTxHash}`,
    out,
  );
  return out;
}

export async function getFulfillments() {
  const swaps = [];
  await iteratePrefix(
    'exchange/swaps/fulfillments',
    (key, value) => swaps.push(
      JSON.parse(value.toString('utf-8')),
    ),
  );
  return swaps;
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
};

export async function start(server) {
  server.withService(sName, methods);
}
