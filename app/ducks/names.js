import { Address } from 'hsd/lib/primitives';
import {v4 as uuidv4} from 'uuid';
import nodeClient from '../utils/nodeClient';
import walletClient from '../utils/walletClient';
import {basketScope, assertBasketScope, assertBasketEligibility, basketScopeError} from '../utils/basketScope';
import * as namesDb from '../db/names';
import {
  fetchPendingTransactions,
  getPassphrase,
  startWalletSync,
  stopWalletSync,
  waitForWalletSync,
  isCurrentWalletRequest,
} from './walletActions';
import { SET_NAME } from './namesReducer';
import {NAME_STATES} from "../constants/names";
import {startRequestTrace} from '../utils/requestTrace';
import {
  fetchWalletStats,
  invalidateRedeemableStats,
} from './walletStats';

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

export const fetchName = (name, force) => async (dispatch, getState) => {
  const {names} = getState();
  const existing = names[name];

  if (!force && existing && existing.info) {
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

const activeNameInfoRequests = new Map();
const activeNameHistoryRequests = new Map();

function staleWalletRequestError() {
  const error = new Error('The active wallet changed while this request was running.');
  error.code = 'STALE_WALLET_REQUEST';
  return error;
}

export const getNameInfo = (name, options = {}) => (dispatch, getState) => {
  const wallet = getState().wallet;
  const generation = wallet.requestGeneration || 0;
  const wid = wallet.wid;
  const key = `${generation}:${name}`;

  const isCurrent = () => (
    !options.signal?.aborted
    && isCurrentWalletRequest(getState, generation, wid)
  );
  const activeRequest = activeNameInfoRequests.get(key);
  if (activeRequest && activeRequest.isCurrent()) {
    return activeRequest.request;
  }
  if (activeRequest) activeNameInfoRequests.delete(key);
  const trace = startRequestTrace({
    operation: 'name-info',
    caller: 'names.getNameInfo',
    walletGeneration: generation,
  });
  const request = loadNameInfo(name, dispatch, isCurrent, key, generation)
    .then(result => {
      trace.complete();
      return result;
    }, error => {
      if (error.code === 'STALE_WALLET_REQUEST') trace.cancel();
      else trace.fail();
      throw error;
    })
    .finally(() => {
      if (activeNameInfoRequests.get(key)?.request === request) {
        activeNameInfoRequests.delete(key);
      }
    });
  activeNameInfoRequests.set(key, {request, isCurrent});
  return request;
};

async function loadNameInfo(name, dispatch, isCurrent, requestKey, generation) {
  const result = await nodeClient.getNameInfo(name);
  if (!isCurrent()) throw staleWalletRequestError();
  if (!result || typeof result !== 'object' || !Object.prototype.hasOwnProperty.call(result, 'info')) {
    throw new Error('The SPV helper returned a malformed name response.');
  }
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
    if (!isCurrent()) throw staleWalletRequestError();
    walletHasName = true;
    const hasHistory = auctionInfo.bids.length > 0 || auctionInfo.reveals.length > 0;
    const activeHistory = activeNameHistoryRequests.get(requestKey);
    if (activeHistory && !activeHistory.isCurrent()) {
      activeNameHistoryRequests.delete(requestKey);
    }
    if (hasHistory && !activeNameHistoryRequests.has(requestKey)) {
      const historyTrace = startRequestTrace({
        operation: 'name-bid-history',
        caller: 'names.getNameInfo',
        walletGeneration: generation,
      });
      const historyRequest = loadNameHistory(
        name,
        auctionInfo,
        info.height,
        dispatch,
        isCurrent,
      ).then(() => {
        historyTrace.complete();
      }, error => {
        if (error.code === 'STALE_WALLET_REQUEST') {
          historyTrace.cancel();
          return;
        }
        historyTrace.fail();
        if (isCurrent()) {
          dispatch({
            type: SET_NAME,
            payload: {name, bidHistoryLoading: false, bidHistoryError: error.message},
          });
        }
      }).finally(() => {
        if (activeNameHistoryRequests.get(requestKey)?.request === historyRequest) {
          activeNameHistoryRequests.delete(requestKey);
        }
      });
      activeNameHistoryRequests.set(requestKey, {request: historyRequest, isCurrent});
    }
  } catch (e) {
    if (!e.message.match(/auction not found/i)) {
      throw e;
    }
  }

  if (info.state === NAME_STATES.CLOSED) {
    const res = await walletClient.getTX(info.owner.hash);
    if (!isCurrent()) throw staleWalletRequestError();
    if (res) {
      const {tx: buyTx} = res;
      const buyOutput = buyTx.outputs[info.owner.index];
      const coin = await walletClient.getCoin(info.owner.hash, info.owner.index);
      if (!isCurrent()) throw staleWalletRequestError();
      isOwner = !!coin;

      if (coin) {
        lastTx = {
          height: coin.height,
          covenant: coin.covenant,
        }

        if (coin.covenant.action === 'TRANSFER') {
          const {network} = await nodeClient.getInfo();
          if (!isCurrent()) throw staleWalletRequestError();
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

  if (!isCurrent()) throw staleWalletRequestError();
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
      bidHistoryLoading: activeNameHistoryRequests.has(requestKey),
      bidHistoryError: '',
    },
  });
}

async function loadNameHistory(name, auctionInfo, nameHeight, dispatch, isCurrent) {
  const bids = await inflateBids(auctionInfo.bids, nameHeight, isCurrent);
  const reveals = await inflateReveals(auctionInfo.reveals, nameHeight, isCurrent);
  if (!isCurrent()) throw staleWalletRequestError();
  dispatch({
    type: SET_NAME,
    payload: {name, bids, reveals, bidHistoryLoading: false, bidHistoryError: ''},
  });
}

async function inflateBids(bids, nameHeight, isCurrent = () => true) {
  if (!bids.length) {
    return [];
  }

  const ret = [];
  for (const bid of bids) {
    if (!isCurrent()) throw staleWalletRequestError();
    // Must use node client to get non-own bids
    const res = await nodeClient.getTx(bid.prevout.hash);
    if (!isCurrent()) throw staleWalletRequestError();

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

async function inflateReveals(reveals, nameHeight, isCurrent = () => true) {
  if (!reveals.length) {
    return [];
  }

  const ret = [];
  for (const reveal of reveals) {
    if (!isCurrent()) throw staleWalletRequestError();
    // Must use node client to get non-own reveals
    const res = await nodeClient.getTx(reveal.prevout.hash);
    if (!isCurrent()) throw staleWalletRequestError();

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

async function assertAuctionTracked(name) {
  try {
    await walletClient.getAuctionInfo(name);
  } catch (e) {
    if (e.message.match(/auction not found/i)) {
      throw new Error(
        `This wallet does not have auction history for ${name}/ yet (common in SPV). ` +
        `Bob will try to import it automatically for basket bids. ` +
        `If this keeps happening, open ${name}/ and use Rescan Auction, wait until sync finishes, then retry.`
      );
    }
    throw e;
  }
}

async function ensureAuctionTracked(name, importHeight = null) {
  try {
    await walletClient.getAuctionInfo(name);
    return { imported: false };
  } catch (e) {
    if (!e.message.match(/auction not found/i)) {
      throw e;
    }
  }

  let height = importHeight;
  if (height == null) {
    const result = await nodeClient.getNameInfo(name);
    if (result?.info?.height == null) {
      throw new Error(
        `Cannot bid on ${name}/: no on-chain auction height found. The name may not be in bidding yet.`
      );
    }
    height = result.info.height - 1;
  }

  await walletClient.importName(name, height);
  return { imported: true, height };
}

export const sendOpen = name => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  const res = await walletClient.sendOpen(name);
  await namesDb.storeName(name);
  await dispatch(fetchPendingTransactions());
  return res;
};

/**
 * Open multiple name auctions in one batch transaction (Open Basket).
 * @param {string[]} names
 */
export const sendOpenMany = (names) => async (dispatch, getState) => {
  if (!names || !names.length) {
    return null;
  }

  const { wallet } = getState();
  if (wallet.watchOnly) {
    throw new Error('Open Basket is not available for watch-only wallets.');
  }
  if (wallet.type === 'ledger' || wallet.type === 'multisig') {
    throw new Error('Open Basket is currently limited to standard hot wallets.');
  }

  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  const unique = [...new Set(
    names.map((n) => String(n || '').trim().toLowerCase()).filter(Boolean)
  )];

  const res = await walletClient.sendOpenMany(unique);
  if (!res) {
    throw new Error('Open basket transaction was not fully signed or broadcast.');
  }

  for (const name of unique) {
    await namesDb.storeName(name);
  }
  await dispatch(fetchPendingTransactions());
  return res;
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
      await walletClient.importName(name, height, {transactionAttempted: true});
      await dispatch(waitForWalletSync());
    } catch (e) {
      throw e;
    } finally {
      await dispatch(stopWalletSync());
    }
  }

  await assertAuctionTracked(name);

  let res = await walletClient.sendBid(name, amount, lockup);
  if (!res) {
    throw new Error('Bid transaction was not fully signed or broadcast.');
  }
  await namesDb.storeName(name);
  return res;
};

export const BID_SUBMISSION_PHASES = Object.freeze({
  CHECKING: 'checking',
  RESCANNING: 'rescanning',
  BUILDING: 'building',
  REVIEWING: 'reviewing',
  SIGNING: 'signing',
  BROADCASTING: 'broadcasting',
  VERIFYING: 'verifying',
  SUBMITTED: 'submitted',
  FAILED: 'failed',
});

const PREPARATION_TIMEOUT_MS = 12 * 60 * 1000;
const BROADCAST_TIMEOUT_MS = 120 * 1000;
const RECONCILE_TIMEOUT_MS = 15 * 1000;
const basketSubmissionLocks = new Map();
const basketWalletLocks = new Map();

function basketSubmissionKey(walletId, entries) {
  const values = entries.map(entry => [entry.name, entry.bid, entry.lockup]);
  return `${walletId || 'unknown'}:${JSON.stringify(values)}`;
}

function createSubmissionError(message, details = {}) {
  const error = new Error(message);
  Object.assign(error, details);
  return error;
}

function throwIfCancelled(signal) {
  if (!signal?.aborted) return;
  throw createSubmissionError('Stopped waiting for basket preparation.', {
    code: 'BASKET_SUBMISSION_CANCELLED',
    stage: BID_SUBMISSION_PHASES.CHECKING,
    retryAllowed: false,
  });
}

export function waitForControlledPromise(promise, {signal, timeoutMs, timeoutError}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
      fn(value);
    };
    const onAbort = () => finish(
      reject,
      createSubmissionError('Stopped waiting for basket preparation.', {
        code: 'BASKET_SUBMISSION_CANCELLED',
        stage: BID_SUBMISSION_PHASES.CHECKING,
        retryAllowed: false,
      }),
    );

    if (signal) signal.addEventListener('abort', onAbort, {once: true});
    if (signal?.aborted) {
      onAbort();
      return;
    }
    if (timeoutMs) {
      timer = setTimeout(() => finish(reject, timeoutError), timeoutMs);
    }
    Promise.resolve(promise).then(
      value => finish(resolve, value),
      error => finish(reject, error),
    );
  });
}

function transactionIds(transactions) {
  return new Set((transactions || []).map(tx => tx?.txid).filter(Boolean));
}

async function findNewBasketTransactions(entries, baseline, findTransactions) {
  const current = await waitForControlledPromise(
    findTransactions(entries.map(entry => entry.name)),
    {
      timeoutMs: RECONCILE_TIMEOUT_MS,
      timeoutError: createSubmissionError(
        'Could not verify basket transaction history before the safety timeout.',
        {code: 'BASKET_RECONCILE_TIMEOUT'},
      ),
    },
  );
  return (current || []).filter(tx => tx?.txid && !baseline.has(tx.txid));
}

function submissionFailureStage(error, fallback) {
  if (error?.code === 'BASKET_BUILD_FAILED') return BID_SUBMISSION_PHASES.BUILDING;
  if (error?.code === 'BASKET_SIGN_FAILED') return BID_SUBMISSION_PHASES.SIGNING;
  if (error?.code === 'BASKET_RECONCILE_TIMEOUT') return BID_SUBMISSION_PHASES.VERIFYING;
  return error?.stage || fallback;
}

/**
 * Executes one basket submission with injected side effects so recovery and
 * duplicate-safety behavior can be tested without broadcasting HNS.
 */
export async function submitBidManyLifecycle(entries, deps, options = {}) {
  // Freeze the authorized rows before any asynchronous work or eligibility lookup.
  entries = basketScope(entries).rows.map(row => ({
    ...row, height: entries.find(entry => entry.name === row.name)?.height,
  }));
  const signal = options.signal;
  const onPhase = options.onPhase || (() => {});
  const onTiming = options.onTiming || ((phase, durationMs, details) => {
    console.info('[Auction Basket timing]', {phase, durationMs, ...details});
  });
  const preparationTimeoutMs = options.preparationTimeoutMs || PREPARATION_TIMEOUT_MS;
  const broadcastTimeoutMs = options.broadcastTimeoutMs || BROADCAST_TIMEOUT_MS;
  let stage = BID_SUBMISSION_PHASES.CHECKING;
  let broadcastStarted = false;
  let baseline = null;
  let signed = null;
  const attemptId = options.attemptId || `basket-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const preparationStartedAt = Date.now();

  const setPhase = (phase, details = {}) => {
    stage = phase;
    onPhase(phase, details);
  };
  const prepare = promise => waitForControlledPromise(promise, {
    signal,
    timeoutMs: Math.max(1, preparationTimeoutMs - (Date.now() - preparationStartedAt)),
    timeoutError: createSubmissionError(
      'Basket preparation timed out. No transaction was sent.',
      {code: 'BASKET_PREPARATION_TIMEOUT', stage},
    ),
  });
  const assertCurrent = () => {
    throwIfCancelled(signal);
    options.assertCurrent?.();
  };
  const validateEligibility = async () => {
    for (const entry of entries) {
      assertBasketEligibility(entry.name, await prepare(deps.getNameInfo(entry.name)));
    }
    assertCurrent();
  };

  try {
    setPhase(BID_SUBMISSION_PHASES.CHECKING);
    baseline = transactionIds(await prepare(
      deps.findTransactions(entries.map(entry => entry.name)),
    ));
    assertCurrent();

    const auctionValidationStartedAt = Date.now();
    const missing = [];
    for (const entry of entries) {
      try {
        await prepare(deps.getAuctionInfo(entry.name));
      } catch (error) {
        if (!/auction not found/i.test(error?.message || '')) throw error;
        missing.push(entry);
      }
    }

    if (missing.length) {
      const toImport = [];
      for (const entry of missing) {
        let height = entry.height;
        if (height == null) {
          const result = await prepare(deps.getNameInfo(entry.name));
          if (result?.info?.height == null) {
            throw new Error(`Cannot import ${entry.name}/ for bidding: no auction height from the node.`);
          }
          height = result.info.height - 1;
        }
        toImport.push({name: entry.name, height});
      }

      setPhase(BID_SUBMISSION_PHASES.RESCANNING, {missing: missing.length});
      const recoveryRequestId = uuidv4().replace(/-/g, '');
      const importPromise = Promise.resolve().then(() => (
        deps.importNames(toImport, {
          transactionAttempted: false,
          recoveryRequestId,
        })
      ));
      // Successful import RPC completion is not a completion signal. Observe
      // Redux rescan progress instead, while still surfacing an early RPC error.
      const importFailure = importPromise.then(() => new Promise(() => {}));
      await prepare(Promise.race([
        deps.waitForSync({signal, timeoutMs: preparationTimeoutMs, recoveryRequestId}),
        importFailure,
      ]));
      throwIfCancelled(signal);
    }

    const stillMissing = [];
    for (const entry of entries) {
      try {
        await prepare(deps.getAuctionInfo(entry.name));
      } catch (error) {
        if (/auction not found/i.test(error?.message || '')) stillMissing.push(entry.name);
        else throw error;
      }
    }
    if (stillMissing.length) {
      throw new Error(`Wallet still missing auction data for: ${stillMissing.map(name => `${name}/`).join(', ')}.`);
    }
    onTiming('auction-validation', Date.now() - auctionValidationStartedAt, {
      count: entries.length,
      imported: missing.length,
    });

    await validateEligibility();
    const payload = entries.map(entry => ({
      name: entry.name,
      bid: entry.bid,
      lockup: entry.lockup,
    }));

    setPhase(BID_SUBMISSION_PHASES.BUILDING, {attemptId});
    let prepared;
    try {
      prepared = await prepare(deps.prepare(payload, attemptId));
    } catch (error) {
      if (signal?.aborted) await deps.cancel?.(attemptId);
      throw error;
    }
    assertCurrent();
    const quotedScope = basketScope(entries, prepared?.scope?.fee);
    assertBasketScope(prepared?.scope, quotedScope);
    if (!Number.isSafeInteger(prepared.scope.fee) || typeof options.confirmScope !== 'function') {
      throw basketScopeError('An explicit review of the exact transaction fee is required.');
    }
    setPhase(BID_SUBMISSION_PHASES.REVIEWING, {attemptId});
    const approvedScope = await prepare(options.confirmScope(JSON.parse(JSON.stringify(quotedScope))));
    assertCurrent();
    assertBasketScope(approvedScope, quotedScope);
    await validateEligibility();
    // Never hold the password over a rescan or over an open review screen.
    await prepare(deps.requestPassphrase());
    assertCurrent();
    await validateEligibility();
    setPhase(BID_SUBMISSION_PHASES.SIGNING, {attemptId});
    signed = await prepare(deps.signPrepared(attemptId, quotedScope));
    assertCurrent();
    assertBasketScope(signed?.scope, quotedScope);
    const preparedTxid = signed?.txid || '';
    if (!/^[a-f0-9]{64}$/.test(preparedTxid)) {
      throw basketScopeError('The signed transaction ID could not be verified.');
    }
    assertCurrent();

    let result;
    setPhase(BID_SUBMISSION_PHASES.BROADCASTING, {attemptId, txid: preparedTxid});
    broadcastStarted = true;
    try {
      result = await waitForControlledPromise(deps.broadcastPrepared(attemptId), {
        timeoutMs: broadcastTimeoutMs,
        timeoutError: createSubmissionError(
          'Broadcast did not return before the safety timeout. Its outcome is uncertain, so retry is disabled.',
          {code: 'BASKET_BROADCAST_AMBIGUOUS', stage: BID_SUBMISSION_PHASES.BROADCASTING},
        ),
      });
    } catch (error) {
      if (error.code === 'BASKET_PREBROADCAST_FAILED') {
        broadcastStarted = false;
        throw error;
      }
      const acceptedMatch = /Transaction ([0-9a-f]{64}) was accepted by the network/i
        .exec(error?.message || '');
      if (acceptedMatch && acceptedMatch[1] === preparedTxid) {
        // Network acceptance with a local history-write error is still a
        // successful broadcast. Keep the txid and do not offer retry.
        result = {txid: acceptedMatch[1]};
      } else {
        let matches;
        try {
          matches = await findNewBasketTransactions(entries, baseline, deps.findTransactions);
        } catch (reconcileError) {
          throw createSubmissionError(
            `${error.message || 'Basket broadcast failed.'} Wallet history reconciliation also failed, so retry is disabled.`,
            {
              code: 'BASKET_BROADCAST_AMBIGUOUS',
              stage: BID_SUBMISSION_PHASES.BROADCASTING,
              retryAllowed: false,
              broadcastUncertain: true,
            },
          );
        }
        const exact = matches.find(match => match.txid === preparedTxid);
        if (exact) {
          result = exact;
        } else {
          throw createSubmissionError(error.message || 'Basket broadcast failed.', {
            code: error.code || 'BASKET_BROADCAST_FAILED',
            stage: BID_SUBMISSION_PHASES.BROADCASTING,
            retryAllowed: false,
            broadcastUncertain: true,
          });
        }
      }
    }

    setPhase(BID_SUBMISSION_PHASES.VERIFYING, {attemptId, txid: preparedTxid});
    let txid = result?.txid || result?.hash || result?.id;
    if (!txid) {
      const matches = await findNewBasketTransactions(entries, baseline, deps.findTransactions);
      if (matches.some(match => match.txid === preparedTxid)) txid = preparedTxid;
    }
    if (!txid || txid !== preparedTxid) {
      throw createSubmissionError(
        'Broadcast returned without a transaction ID. Retry is disabled until wallet history confirms the outcome.',
        {
          code: 'BASKET_BROADCAST_AMBIGUOUS',
          stage: BID_SUBMISSION_PHASES.BROADCASTING,
          retryAllowed: false,
          broadcastUncertain: true,
        },
      );
    }

    try {
      await waitForControlledPromise((async () => {
        for (const entry of entries) {
          try {
            await deps.storeName(entry.name);
          } catch (error) {
            console.error(`Could not store submitted basket name ${entry.name}:`, error);
          }
        }
        await deps.refreshPending();
      })(), {
        timeoutMs: RECONCILE_TIMEOUT_MS,
        timeoutError: new Error('Post-submission display refresh timed out; the transaction was already submitted.'),
      });
    } catch (error) {
      console.error('Could not refresh pending transactions after basket submission:', error);
    }
    setPhase(BID_SUBMISSION_PHASES.SUBMITTED, {txid, timings: result?.timings || prepared?.timings || {}});
    return {txid, scope: signed.scope, timings: result?.timings || prepared?.timings || {}};
  } catch (error) {
    let retryAllowed = !!error.retryAllowed;
    let broadcastUncertain = broadcastStarted || !!error.broadcastUncertain;
    if (!broadcastStarted) {
      let cancellation;
      try {
        cancellation = await waitForControlledPromise(deps.cancel?.(attemptId), {
          timeoutMs: RECONCILE_TIMEOUT_MS,
          timeoutError: new Error('Cancellation could not be confirmed.'),
        });
      } catch (_) { /* Keep the attempt locked if the backend cannot confirm cancellation. */ }
      retryAllowed = cancellation?.broadcastAttempted === false;
      broadcastUncertain = !retryAllowed;
    }
    if (error?.code === 'BASKET_SUBMISSION_CANCELLED' && !broadcastUncertain) throw error;

    const wrapped = createSubmissionError(error.message || 'Basket submission failed.', {
      code: broadcastUncertain ? 'BASKET_BROADCAST_AMBIGUOUS' : error.code || 'BASKET_SUBMISSION_FAILED',
      stage: submissionFailureStage(error, stage),
      retryAllowed,
      broadcastUncertain,
      txid: signed?.txid || '',
    });
    setPhase(BID_SUBMISSION_PHASES.FAILED, {
      error: wrapped.message,
      failedStage: wrapped.stage,
      retryAllowed,
      broadcastUncertain,
    });
    throw wrapped;
  }
}

/**
 * Place multiple bids in one batch transaction (Auction Basket).
 * @param {Array<{name: string, bid: number|string, lockup: number|string, height?: number}>} entries
 *   bid/lockup in base units.
 */
export const sendBidMany = (entries, options = {}) => async (dispatch, getState) => {
  if (!entries || !entries.length) {
    return null;
  }

  const { wallet } = getState();
  const walletKey = `${wallet.network}:${wallet.wid}`;
  const assertCurrent = () => {
    if (!isCurrentWalletRequest(getState, wallet.requestGeneration || 0, wallet.wid)
        || getState().wallet.network !== wallet.network) {
      throw basketScopeError('The selected wallet or network changed.');
    }
    options.assertCurrent?.();
  };
  const rescanGenerationBefore = Number.isSafeInteger(wallet.rescanGeneration)
    ? wallet.rescanGeneration
    : 0;
  const rescanBackendGenerationBefore = Number.isSafeInteger(wallet.rescanBackendGeneration)
    ? wallet.rescanBackendGeneration
    : null;
  if (wallet.watchOnly) {
    throw new Error('Auction Basket bidding is not available for watch-only wallets.');
  }
  if (wallet.type === 'ledger' || wallet.type === 'multisig') {
    throw new Error('Auction Basket bidding is currently limited to standard hot wallets.');
  }

  const submissionKey = basketSubmissionKey(wallet.wid, entries);
  const existing = basketSubmissionLocks.get(submissionKey) || basketWalletLocks.get(walletKey);
  if (existing) {
    throw createSubmissionError(
      existing.txid
        ? `This basket already produced transaction ${existing.txid}. Duplicate submission is blocked.`
        : 'The previous broadcast outcome for this basket is still uncertain. Duplicate submission is blocked.',
      {
        code: 'BASKET_DUPLICATE_BLOCKED',
        stage: BID_SUBMISSION_PHASES.BROADCASTING,
        retryAllowed: false,
        broadcastUncertain: !existing.txid,
      },
    );
  }

  basketWalletLocks.set(walletKey, {status: 'preparing'});
  try {
    const result = await submitBidManyLifecycle(entries, {
      requestPassphrase: () => new Promise((resolve, reject) => {
        assertCurrent();
        dispatch(getPassphrase(resolve, reject));
      }),
      getAuctionInfo: name => walletClient.getAuctionInfo(name),
      getNameInfo: name => nodeClient.getNameInfo(name),
      importNames: (names, importOptions) => walletClient.importNames(names, importOptions),
      waitForSync: waitOptions => dispatch(waitForWalletSync(600, {
        ...waitOptions,
        requireRescanStart: true,
        rescanGenerationBefore,
        rescanBackendGenerationBefore,
      })),
      findTransactions: names => walletClient.findBasketBidTransactions(names),
      prepare: (payload, attemptId) => {
        basketSubmissionLocks.set(submissionKey, {status: 'preparing', attemptId});
        assertCurrent();
        return walletClient.prepareBidMany(payload, attemptId, {walletId: wallet.wid, network: wallet.network});
      },
      signPrepared: (attemptId, scope) => {
        assertCurrent();
        return walletClient.signPreparedBidMany(attemptId, scope);
      },
      cancel: attemptId => walletClient.cancelBidManyAttempt(attemptId),
      broadcastPrepared: attemptId => {
        assertCurrent();
        basketSubmissionLocks.set(submissionKey, {status: 'broadcasting', attemptId});
        return walletClient.broadcastPreparedBidMany(attemptId);
      },
      storeName: name => {
        if (isCurrentWalletRequest(getState, wallet.requestGeneration || 0, wallet.wid)
            && getState().wallet.network === wallet.network) return namesDb.storeName(name);
      },
      refreshPending: () => {
        if (isCurrentWalletRequest(getState, wallet.requestGeneration || 0, wallet.wid)
            && getState().wallet.network === wallet.network) return dispatch(fetchPendingTransactions());
      },
    }, {...options, assertCurrent});
    basketSubmissionLocks.set(submissionKey, {status: 'submitted', txid: result.txid});
    basketWalletLocks.delete(walletKey);
    return result;
  } catch (error) {
    if (error.broadcastUncertain) {
      basketSubmissionLocks.set(submissionKey, {status: 'uncertain'});
      basketWalletLocks.set(walletKey, {status: 'uncertain'});
    } else {
      basketSubmissionLocks.delete(submissionKey);
      basketWalletLocks.delete(walletKey);
    }
    throw error;
  }
};

export const sendReveal = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  await namesDb.storeName(name);
  return await walletClient.sendReveal(name);
};

export const sendRegister = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  return await walletClient.sendRegister(name);
};

export const sendRedeem = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  await namesDb.storeName(name);
  return await walletClient.sendRedeem(name);
};

export const sendRedeemAll = () => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  // Hide the action immediately and invalidate any stats request that began
  // before the wallet marked the reveal outputs spent.
  dispatch(invalidateRedeemableStats());

  try {
    const result = await walletClient.sendRedeemAll();
    try {
      await dispatch(fetchWalletStats());
    } catch (statsError) {
      console.error('Could not refresh wallet stats after redeem:', statsError);
    }
    return result;
  } catch (error) {
    try {
      await dispatch(fetchWalletStats());
    } catch (statsError) {
      console.error('Could not refresh wallet stats after empty redeem:', statsError);
    }
    if (/nothing to do/i.test(error.message || '')) {
      throw new Error('No bids remain to redeem.');
    }
    throw error;
  }
};

export const sendRevealAll = () => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  return await walletClient.sendRevealAll();
};

export const sendRevealMany = (names) => async (dispatch) => {
  if (!names || !names.length) {
    return null;
  }

  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  for (const name of names) {
    if (name) {
      await namesDb.storeName(name);
    }
  }

  return await walletClient.sendRevealMany(names);
};

export const sendRegisterAll = (isMounted = () => true, operationId) => async (dispatch, getState) => {
  const {wid, network, requestGeneration} = getState().wallet;
  const assertCurrent = () => {
    if (!isMounted() || !isCurrentWalletRequest(getState, requestGeneration || 0, wid)
        || getState().wallet.network !== network) {
      throw new Error('Register All was cancelled before submission because the active view or wallet changed.');
    }
  };
  assertCurrent();
  let timer;
  let preflight;
  try {
    preflight = await Promise.race([
      walletClient.getRegisterAllStatus({walletId: wid, network, preflight: true}),
      new Promise((_, reject) => {timer = setTimeout(() => {
        const error = new Error('Registration eligibility check timed out. No transaction was sent.');
        error.code = 'registrationPreflightTimeout';
        reject(error);
      }, 60000);}),
    ]);
  } finally { clearTimeout(timer); }
  assertCurrent();
  if (!Number.isSafeInteger(preflight?.eligibleCount) || preflight.eligibleCount < 0
      || preflight.operation?.retryLocked) {
    throw new Error('Registration eligibility or transaction status is unavailable. Retry is blocked.');
  }
  if (!preflight.eligibleCount) {
    const error = new Error('No names are currently eligible for registration.');
    error.code = 'registrationNoWork';
    throw error;
  }
  const passphrase = await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  assertCurrent();
  return await walletClient.sendRegisterAll(passphrase, {walletId: wid, network, operationId});
};

export const sendRenewal = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  await namesDb.storeName(name);
  return await walletClient.sendRenewal(name);
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
  return await walletClient.transferMany(names, recipient);
};

export const finalizeAll = () => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  return await walletClient.finalizeAll();
};

export const finalizeMany = (names) => async (dispatch) => {
  if (!names || !names.length) {
    return;
  }

  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  return await walletClient.finalizeMany(names);
};

export const renewAll = () => async (dispatch) => {
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });

  return await walletClient.renewAll();
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
  return await walletClient.sendTransfer(name, recipient);
};

export const cancelTransfer = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  return await walletClient.cancelTransfer(name);
};

export const finalizeTransfer = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  return await walletClient.finalizeTransfer(name);
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
  return await walletClient.claimPaidTransfer(hex);
};

export const revokeName = (name) => async (dispatch) => {
  if (!name) {
    return;
  }
  await new Promise((resolve, reject) => {
    dispatch(getPassphrase(resolve, reject));
  });
  return await walletClient.revokeName(name);
};

// Keep the asynchronous ordering testable without replacing immutable module
// exports. assertCurrent is synchronous and runs directly before send().
export async function submitNameUpdate(name, json, {
  unlock, assertCurrent, beforeSend, storeName, send, refreshPending,
}) {
  await unlock();
  assertCurrent();
  if (beforeSend) await beforeSend();
  assertCurrent();
  await storeName(name);
  assertCurrent();
  const res = await send(name, json);
  await refreshPending();
  return res;
}

export const sendUpdate = (name, json, beforeSend, assertReviewContext) => async (dispatch, getState) => {
  const {wid, requestGeneration = 0} = getState().wallet;
  const assertCurrent = () => {
    if (!isCurrentWalletRequest(getState, requestGeneration, wid)) throw staleWalletRequestError();
    if (assertReviewContext) assertReviewContext();
  };
  return submitNameUpdate(name, json, {
    unlock: () => new Promise((resolve, reject) => dispatch(getPassphrase(resolve, reject))),
    assertCurrent,
    beforeSend,
    storeName: namesDb.storeName,
    send: (name, resource) => walletClient.sendUpdate(name, resource),
    refreshPending: () => dispatch(fetchPendingTransactions()),
  });
};
