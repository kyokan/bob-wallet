import walletClient from '../utils/walletClient';
import {INVALIDATE_WALLET_REQUESTS, LOCK_WALLET, SET_WALLET_NETWORK, START_SYNC_WALLET} from './walletReducer';

export const WALLET_STATS_REQUEST = 'app/walletStats/request';
export const WALLET_STATS_SUCCESS = 'app/walletStats/success';
export const WALLET_STATS_FAILURE = 'app/walletStats/failure';
export const WALLET_STATS_PROGRESS = 'app/walletStats/progress';
export const WALLET_STATS_INVALIDATE_REDEEMABLE =
  'app/walletStats/invalidateRedeemable';

const EMPTY_STATS = {
  lockedBalance: {
    bidding: {HNS: null, num: null},
    revealable: {HNS: null, num: null, block: null},
    finished: {HNS: null, num: null},
  },
  actionableInfo: {
    revealable: {HNS: null, num: null, block: null},
    redeemable: {HNS: null, num: null},
    renewable: {domains: null, block: null},
    transferring: {domains: null, block: null},
    finalizable: {domains: null},
    registerable: {HNS: null, num: null},
  },
};

let nextRequestId = 0;
const pendingRequests = new WeakMap();
let activeTransports = 0;

function completeSummary(stats) {
  const groups = [
    ...['bidding', 'revealable', 'finished'].map(key => stats?.lockedBalance?.[key]),
    ...['revealable', 'redeemable', 'registerable'].map(key => stats?.actionableInfo?.[key]),
  ];
  return groups.every(group => group && ['HNS', 'num'].every(key => Number.isSafeInteger(group[key]) && group[key] >= 0))
    && ['renewable', 'transferring', 'finalizable'].every(key => Array.isArray(stats?.actionableInfo?.[key]?.domains));
}

export function getInitialState() {
  return {
    ...EMPTY_STATS,
    isLoading: true,
    requestId: 0,
    error: null,
    status: 'loading',
    elapsedMs: 0,
  };
}

export default function walletStatsReducer(
  state = getInitialState(),
  {type, payload} = {},
) {
  switch (type) {
    case INVALIDATE_WALLET_REQUESTS:
    case LOCK_WALLET:
    case SET_WALLET_NETWORK:
    case START_SYNC_WALLET:
      return getInitialState();
    case WALLET_STATS_REQUEST:
      return {
        ...getInitialState(),
        isLoading: true,
        requestId: payload.requestId,
        error: null,
      };
    case WALLET_STATS_SUCCESS:
      if (payload.requestId !== state.requestId) return state;
      return {
        ...state,
        ...payload.stats,
        isLoading: false,
        error: null,
        status: 'ready',
        elapsedMs: payload.elapsedMs,
      };
    case WALLET_STATS_FAILURE:
      if (payload.requestId !== state.requestId) return state;
      return {
        ...state,
        isLoading: false,
        error: payload.error,
        errorStage: payload.errorStage,
        status: 'failed',
        elapsedMs: payload.elapsedMs,
      };
    case WALLET_STATS_PROGRESS:
      if (payload.requestId !== state.requestId) return state;
      return {...state, status: payload.elapsedMs >= 5000 ? 'slow' : 'loading', elapsedMs: payload.elapsedMs};
    case WALLET_STATS_INVALIDATE_REDEEMABLE: {
      const redeemable = state.actionableInfo.redeemable;
      return {
        ...state,
        requestId: payload.requestId,
        lockedBalance: {
          ...state.lockedBalance,
          finished: {
            HNS: Math.max(
              0,
              (state.lockedBalance.finished.HNS || 0) - (redeemable.HNS || 0),
            ),
            num: Math.max(
              0,
              (state.lockedBalance.finished.num || 0) - (redeemable.num || 0),
            ),
          },
        },
        actionableInfo: {
          ...state.actionableInfo,
          redeemable: {HNS: 0, num: 0},
        },
      };
    }
    default:
      return state;
  }
}

export const invalidateRedeemableStats = () => ({
  type: WALLET_STATS_INVALIDATE_REDEEMABLE,
  payload: {requestId: ++nextRequestId},
});

export const fetchWalletStats = (options = {}) => (dispatch, getState) => {
  const wallet = getState().wallet;
  if (wallet.requestWallet || wallet.balanceReady === false || wallet.walletSync) return;
  const wid = wallet.requestWallet || wallet.wid;
  const generation = wallet.requestGeneration || 0;
  const network = wallet.network;
  const height = getState().node?.chain?.height;
  const walletHeight = wallet.walletHeight;
  const isSelected = () => {
    const current = getState().wallet;
    return (current.requestWallet || current.wid) === wid
      && (current.requestGeneration || 0) === generation
      && current.network === network;
  };
  const isCurrent = () => isSelected() && getState().node?.chain?.height === height
    && getState().wallet.walletHeight === walletHeight;
  const previous = pendingRequests.get(dispatch);
  if (previous && previous.wid === wid && previous.generation === generation && previous.network === network) {
    if (previous.requestId === getState().walletStats.requestId && previous.height === height
      && previous.walletHeight === walletHeight) return previous.promise;
    // A mutation invalidated the snapshot. Finish the old read before taking a
    // new one; never reuse pre-mutation counts as the post-mutation summary.
    return previous.promise.catch(() => {}).then(() => isSelected() && dispatch(fetchWalletStats(options)));
  }
  const requestId = ++nextRequestId;
  dispatch({type: WALLET_STATS_REQUEST, payload: {requestId}});
  const startedAt = Date.now();
  const trace = event => console.info('[auction-summary-renderer]', {
    requestId, generation, stage: 'wallet-statistics', event, elapsedMs: Date.now() - startedAt,
  });
  trace('start');
  let deadline;
  const tick = setInterval(() => {
    if (isCurrent()) dispatch({type: WALLET_STATS_PROGRESS, payload: {requestId, elapsedMs: Date.now() - startedAt}});
  }, 1000);
  const promise = (async () => {
   await Promise.resolve();
   try {
    if (activeTransports >= 3) throw new Error('Auction summary reader is busy.');
    activeTransports++;
    const transport = Promise.resolve().then(() => isCurrent() ? walletClient.getStats({requestId, generation}) : undefined);
    transport.then(() => { activeTransports--; }, () => { activeTransports--; });
    const stats = await Promise.race([
      transport,
      new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Auction summary response timed out. Retry is read-only.')), options.timeoutMs || 35000); }),
    ]);
    if (!isCurrent()) { trace('cancelled'); return; }
    if (!completeSummary(stats)) throw new Error('Auction summary values are unavailable.');
    dispatch({
      type: WALLET_STATS_SUCCESS,
      payload: {requestId, stats, elapsedMs: Date.now() - startedAt},
    });
    trace('complete');
    return stats;
  } catch (error) {
    if (!isCurrent()) { trace('cancelled'); return; }
    dispatch({
      type: WALLET_STATS_FAILURE,
      payload: {requestId, error: /timed out/i.test(error.message) ? 'timeout' : /busy/i.test(error.message) ? 'busy' : 'read-failed',
        errorStage: [...new Set((error.message || '').match(/\b(?:load-wallet|getBids|getReveals|getNames|getNameState|getTX|getUnspentCoin)\b/g) || [])].join(', '),
        elapsedMs: Date.now() - startedAt},
    });
    trace('failed');
    throw error;
   } finally {
    clearTimeout(deadline);
    clearInterval(tick);
    if (pendingRequests.get(dispatch)?.requestId === requestId) pendingRequests.delete(dispatch);
   }
  })();
  pendingRequests.set(dispatch, {wid, generation, network, height, walletHeight, requestId, promise});
  return promise;
};
