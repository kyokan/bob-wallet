import { Context } from 'shakedex/src/context.js';
import { SwapProof } from 'shakedex/src/swapProof.js';
const secp256k1 = require('bcrypto/lib/secp256k1.js');
import { service as nodeService } from '../node/service';
import { service as walletService } from '../wallet/service';
import {
  fillSwap as sdFulfillSwap,
  finalizeSwap as sdFinalizeSwap,
  transferNameLock,
  finalizeNameLock,
  transferNameLockCancel,
  finalizeNameLockCancel,
} from 'shakedex/src/swapService.js';
import { SwapFill } from 'shakedex/src/swapFill.js';
import { createLockScript } from 'shakedex/src/script';
import { Auction, AuctionFactory, linearReductionStrategy } from 'shakedex/src/auction.js';
const jsonSchemaValidate = require('jsonschema').validate;
import { NameLockFinalize } from 'shakedex/src/nameLock.js';
const Address = require('hsd/lib/primitives/address.js');
import stream from 'stream';
import {encrypt, decrypt} from "../../utils/encrypt";
import path from "path";
import {app} from "electron";
import bdb from "bdb";
import {
  auctionSchema, fetchShakedexAuction,
  fulfillmentSchema,
  getFinalizeFromTransferTx,
  nameLockSchema,
  paramSchema
} from "../../utils/shakedex";
import {Client} from "bcurl";

let db;

const client = new Client({
  host: 'api.shakedex.com',
  ssl: true,
});

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

export async function getExchangeAuctions(currentPage = 1) {
  return await client.get(`api/v1/auctions?page=${currentPage}&per_page=20`);
}

export async function listAuction(auction) {
  const resp = await fetch(`https://api.shakedex.com/api/v1/auctions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      auction,
    }),
  });
  return resp.json();
}

export async function fulfillSwap(auction, bid, passphrase) {
  const context = getContext(passphrase);
  const proof = new SwapProof({
    lockingTxHash: auction.lockingTxHash,
    lockingOutputIdx: auction.lockingOutputIdx,
    name: auction.name,
    publicKey: auction.publicKey,
    paymentAddr: auction.paymentAddr,
    price: bid.price,
    fee: bid.fee,
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

export async function finalizeSwap(fulfillmentJSON, passphrase) {
  const context = getContext(passphrase);
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
  const context = getContext(password);
  const listings = await getListings();
  const walletKey = await walletService.deriveAddressForShakedex(listings.length);
  const nameLock = await transferNameLock(context, name, walletKey.getPrivateKey());
  const {privateKey, ...nameLockJSON} = nameLock.toJSON();
  const out = {
    nameLock: {
      ...nameLockJSON,
      encryptedPrivateKey: encrypt(privateKey, password),
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

export async function transferCancel(nameLock, password) {
  const context = getContext(password);
  const existing = await get(
    `${listingPrefix()}/${nameLock.name}/${nameLock.transferTxHash}`,
  );
  const {
    tx: finalizeTx,
    coin: finalizeCoin,
  } = await getFinalizeFromTransferTx(
    nameLock.transferTxHash,
    nameLock.name,
    nodeService,
  );

  const cancelNameLock = await transferNameLockCancel(context, {
    ...nameLock,
    finalizeTxHash: finalizeTx.hash,
    finalizeOutputIdx: finalizeCoin.index,
    publicKey: Buffer.from(nameLock.publicKey, 'hex'),
    privateKey: Buffer.from(decrypt(nameLock.encryptedPrivateKey, password), 'hex'),
  });
  const {privateKey, ...cancelLockJSON} = cancelNameLock.toJSON(context);

  const out = {
    ...existing,
    nameLockCancel: {
      ...cancelLockJSON,
      encryptedPrivateKey: encrypt(privateKey, password)
    },
  };

  await put(
    `${listingPrefix()}/${nameLock.name}/${nameLock.transferTxHash}`,
    out,
  );

  return out;
}

export async function finalizeCancel(nameLock, password) {
  const context = getContext(password);
  const existing = await get(
    `${listingPrefix()}/${nameLock.name}/${nameLock.transferTxHash}`,
  );
  const {nameLockCancel} = existing;
  const decrypted = Buffer.from(decrypt(nameLock.encryptedPrivateKey, password), 'hex');
  const finalizeCancelLock = await finalizeNameLockCancel(context, {
    ...nameLockCancel,
    publicKey: secp256k1.publicKeyCreate(decrypted),
    privateKey: decrypted,
  });
  const finalizeCancelLockJSON = finalizeCancelLock.toJSON(context);

  const out = {
    ...existing,
    cancelFinalize: finalizeCancelLockJSON,
  };

  await put(
    `${listingPrefix()}/${nameLock.name}/${nameLock.transferTxHash}`,
    out,
  );

  return out;
}

export async function rescanFillByName(name) {
  const data = await nodeService.getNameInfo(name);
  const owner = data?.info?.owner;
  if (owner) {
    const ownerCoin = await nodeService.getCoin(owner.hash, owner.index);
    const xferAddr = selectTransferAddr({ outputs: [ownerCoin ]});

    if (!xferAddr) return;

    const owned = await walletService.hasAddress(xferAddr);

    if (!owned) return;

    const tx = await nodeService.getTx(owner.hash);

    if (!tx) return;

    const outputs = tx.outputs;
    const lastOutputs = outputs[outputs.length - 1];

    const sAuction = await fetchShakedexAuction(name);

    if (!sAuction || sAuction.lockingTxHash !== owner.hash) return;

    const lockingPublicKey = sAuction.publicKey;

    await restoreOneFill({
      fulfillment: {
        broadcastAt: tx.time * 1000,
        fulfillmentTxHash: tx.hash,
        lockingPublicKey,
        name,
        price: lastOutputs.value,
      },
    });
  }
}

export async function rescanShakedex(password) {
  const {transactions, addresses, keys} = await _rescanShakedex();
  const result = [];

  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    const parsed = await parseTX(transactions, address.toString(walletService.network));

    if (parsed) {
      const walletKey = keys[i];
      const publicKey = await walletKey.getPublicKey();
      const privkey = await walletKey.getPrivateKey();
      const pubkeyHex = Buffer.from(publicKey).toString('hex');
      const privkeyHex = Buffer.from(privkey).toString('hex');

      if (parsed.auction) {
        parsed.auction.publicKey = pubkeyHex;
      }

      parsed.nameLock.lockScriptAddr = {
        hash: {
          data: Array.from(address.hash),
          type: 'Buffer',
        },
        version: address.version,
      };
      parsed.nameLock.encryptedPrivateKey = encrypt(privkeyHex, password);
      parsed.nameLock.publicKey = pubkeyHex;

      try {
        await restoreOneListing(parsed);
      } catch (e) {
        console.error(e);
      }
      result.push(parsed);
    }
  }

  return result;
}

async function parseTX(transactions, address) {
  let transferTxHash;
  let transferTxIndex;
  let cancelTxIndex;
  let lockingOutputIdx;
  let finalizeTx;
  let cancelTx;
  let cancelFinalizeTx;
  let cancelFinalizeTxIdx;
  let name;
  let cancelAddr;

  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];

    for (let j = 0; j < tx.inputs.length; j++) {
      const input = tx.inputs[j];
      if (input.coin?.address === address) {
        if (input.coin?.covenant?.action === 'TRANSFER') {
          if (await isRecipientSelf(tx)) {
            cancelFinalizeTx = tx;
            cancelFinalizeTxIdx = j;
          }
        } else if (input.coin?.covenant?.action === 'FINALIZE') {
          cancelAddr = selectTransferAddr(tx);
          if (await walletService.hasAddress(cancelAddr)) {
            cancelTx = tx;
            cancelTxIndex = j;
          }
        }
      }
    }

    for (let k = 0; k < tx.outputs.length; k++) {
      const output = tx.outputs[k];
      if (output.address === address) {
        if (output.covenant?.action === 'FINALIZE') {
          const { hash, index } = selectTransferPrevout(tx) || {};
          finalizeTx = tx;
          lockingOutputIdx = k;
          transferTxHash = hash;
          transferTxIndex = index;
          name = await nodeService.getNameByHash(output.covenant?.items[0]);
        }
      }
    }
  }

  if (!transferTxHash && !finalizeTx && !cancelTx && !cancelFinalizeTx) {
    return null;
  }

  const listing = {
    nameLock: {
      broadcastAt: finalizeTx.time * 1000,
      name: name,
      transferTxHash: transferTxHash,
    },
  };

  try {
    const resp = await fetch(`https://api.shakedex.com/api/v1/auctions/n/${name}`);
    const json = await resp.json();
    if (json?.auction?.bids && json?.auction?.lockingTxHash === finalizeTx.hash) {
      const first = json.auction.bids[0];
      const last = json.auction.bids[json.auction.bids.length - 1];
      listing.auction = {
        data: json.auction.bids,
        lockingOutputIdx: lockingOutputIdx,
        lockingTxHash: finalizeTx.hash,
        name: name,
      };
      listing.params = {
        durationDays: Math.ceil((last.lockTime-first.lockTime)/(1000*60*60*24)),
        endPrice: last.price,
        startPrice: first.price,

      }
    }
  } catch (e) {

  }

  if (cancelTx) {
    listing.nameLockCancel = {
      broadcastAt: cancelTx.time * 1000,
      cancelAddr: cancelAddr,
      name: name,
      transferOutputIdx: cancelTxIndex,
      transferTxHash: cancelTx.hash,
    }
  }

  if (cancelFinalizeTx) {
    listing.cancelFinalize = {
      broadcastAt: cancelFinalizeTx.time * 1000,
      name: name,
      finalizeOutputIdx: cancelFinalizeTxIdx,
      finalizeTxHash: cancelFinalizeTx.hash,
    }
  }

  return listing;
}

function selectTransferPrevout(tx) {
  for (let j = 0; j < tx.inputs.length; j++) {
    const input = tx.inputs[j];
    if (input.coin?.covenant.action === 'TRANSFER') {
      return input.prevout;
    }
  }
}

function selectTransferAddr(tx) {
  const network = walletService.network;
  for (let j = 0; j < tx.outputs.length; j++) {
    const output = tx.outputs[j];
    if (output.covenant?.action === 'TRANSFER') {
      const addr = new Address(
        {
          hash: Buffer.from(output.covenant?.items[3], 'hex'),
          version: Number(output.covenant?.items[2]),
        },
        network,
      );

      return addr.toString(network);
    }
  }
}

async function isRecipientSelf(tx) {
  for (let j = 0; j < tx.outputs.length; j++) {
    const output = tx.outputs[j];
    if (output.covenant?.action === 'FINALIZE' || output.covenant?.action === 'TRANSFER') {
      return await walletService.hasAddress(output.address);
    }
  }

  return false;
}

async function _rescanShakedex(index = 0, txs = [], addrs = [], wkeys = []) {
  const {addresses: newAddrs, walletKeys} = await generateAddresses(index, index + 10);
  const newTXs = await nodeService.getTXByAddresses(newAddrs.map(addr => addr.toString(walletService.network)));
  const transactions = txs.concat(newTXs);
  const addresses = addrs.concat(newAddrs);
  const keys = wkeys.concat(walletKeys);

  if (!newTXs.length) {
    return {transactions, addresses, keys};
  }

  return await _rescanShakedex(index + 10, transactions, addresses, keys);
}

async function generateAddresses(start = 0, end = 10) {
  const addresses = [];
  const walletKeys = [];

  for (let i = start; i < end; i++) {
    const walletKey = await walletService.deriveAddressForShakedex(i);
    const lockScript = createLockScript(walletKey.getPublicKey());
    const lockScriptAddr = new Address().fromScript(lockScript);
    walletKeys.push(walletKey);
    addresses.push(lockScriptAddr);
  }

  return {addresses, walletKeys};
}

export async function restoreOneListing(listing) {
  const {valid: auctionValid} = jsonSchemaValidate(listing.auction, auctionSchema);
  const {valid: nameLockValid} = jsonSchemaValidate(listing.nameLock || {}, nameLockSchema);
  const {valid: paramsValid} = jsonSchemaValidate(listing.params, paramSchema);

  if (!auctionValid || !nameLockValid || !paramsValid) {
    throw new Error('Invalid listing schema');
  }
  const {nameLock} = listing;
  const existing = await get(
    `${listingPrefix()}/${nameLock.name}/${nameLock.transferTxHash}`,
  );
  if (existing) {
    throw new Error(`Auction for ${nameLock.name} already exist.`);
  }

  await put(
    `${listingPrefix()}/${nameLock.name}/${nameLock.transferTxHash}`,
    listing,
  );
}

export async function restoreOneFill(fill) {
  const {valid} = jsonSchemaValidate(fill.fulfillment, fulfillmentSchema);

  if (!valid) {
    throw new Error('Invalid backup file schema');
  }
  const {fulfillment} = fill;
  const existing = await get(
    `${fillsPrefix()}/${fulfillment.name}/${fulfillment.fulfillmentTxHash}`,
  );

  if (existing) {
    throw new Error(`Auction for ${fulfillment.name} already exist.`);
  }

  await put(
    `${fillsPrefix()}/${fulfillment.name}/${fulfillment.fulfillmentTxHash}`,
    fill,
  );
}

export async function finalizeLock(nameLock, password) {
  const context = getContext(password);
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

export async function launchAuction(nameLock, passphrase, paramsOverride, persist=true) {
  const context = getContext();
  const key = `${listingPrefix()}/${nameLock.name}/${nameLock.transferTxHash}`;
  const listing = await get(key);

  const {startPrice, endPrice, durationDays, feeRate, feeAddr} = paramsOverride || listing.params;

  if (paramsOverride) {
    listing.params = paramsOverride;
  }

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

  const {
    tx: finalizeTx,
    coin: finalizeCoin,
  } = await getFinalizeFromTransferTx(
    listing.nameLock.transferTxHash,
    listing.nameLock.name,
    nodeService,
  );

  if (!finalizeCoin) throw new Error('cannot find finalize coin');

  const auctionFactory = new AuctionFactory({
    name: listing.nameLock.name,
    startTime: Date.now(),
    endTime: Date.now() + durationDays * 24 * 60 * 60 * 1000,
    startPrice: startPrice,
    endPrice: endPrice,
    reductionTimeMS,
    reductionStrategy: linearReductionStrategy,
    feeRate: feeRate || 0,
    feeAddr,
  });

  const auction = await auctionFactory.createAuction(
    context,
    new NameLockFinalize({
      ...listing.nameLock,
      finalizeTxHash: finalizeTx.hash,
      finalizeOutputIdx: finalizeCoin.index,
      privateKey: decrypt(listing.nameLock.encryptedPrivateKey, passphrase)
    }),
  );
  const auctionJSON = auction.toJSON(context);
  if (persist) {
    listing.auction = auctionJSON;
    await put(
      key,
      listing,
    );
  }
  return auctionJSON;
}

export async function getFeeInfo() {
  const resp = await fetch(`https://api.shakedex.com/api/v1/fee_info`);
  if (resp.status === 404) {
    return {
      rate: 0,
      address: null
    };
  }
  return resp.json();
}

async function downloadProofs(auctionJSON) {
  const context = getContext();
  const proofs = [];
  for (const bid of auctionJSON.bids) {
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

function getContext(passphrase = null) {
  const {
    name: walletId,
    walletApiKey,
  } = walletService;
  const {
    apiKey: nodeApiKey,
    networkName,
    client,
  } = nodeService;

  return new Context(
    networkName,
    walletId,
    walletApiKey,
    () => Promise.resolve(passphrase),
    client.host,
    nodeApiKey,
  );
}

const sName = 'Shakedex';
const methods = {
  fulfillSwap,
  getFulfillments,
  finalizeSwap,
  transferLock,
  finalizeLock,
  finalizeCancel,
  transferCancel,
  getListings,
  launchAuction,
  downloadProofs,
  rescanShakedex,
  rescanFillByName,
  restoreOneListing,
  restoreOneFill,
  getExchangeAuctions,
  listAuction,
  getFeeInfo,
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
