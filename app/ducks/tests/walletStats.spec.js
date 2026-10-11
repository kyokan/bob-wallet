import test from 'tape';
import {applyMiddleware, combineReducers, createStore} from 'redux';
import thunk from 'redux-thunk';
import walletReducer, {INVALIDATE_WALLET_REQUESTS, SET_WALLET, SET_BALANCE} from '../walletReducer';
import BalanceSummary, {balanceSnapshotReady, balanceGuideUrl} from '../../pages/Overview/BalanceSummary';
import React from 'react';
import {mount} from 'enzyme';
import {shell} from '../../renderer/electron';
import {I18nContext} from '../../utils/i18n';
import {balanceReadiness} from '../../utils/balanceReadiness';
import AuctionSummaryStatus, {auctionSummaryTotal} from '../../pages/Overview/AuctionSummaryStatus';
import {renderToStaticMarkup} from 'react-dom/server';

import walletClient from '../../utils/walletClient';
import {sendRedeemAll} from '../names';
import walletStatsReducer, {
  fetchWalletStats,
} from '../walletStats';

const stats = (redeemable, registerable = 0, revealable = 0) => ({
  lockedBalance: {
    bidding: {HNS: 0, num: 0},
    revealable: {HNS: revealable * 10, num: revealable, block: 10},
    finished: {
      HNS: redeemable * 10 + registerable * 20,
      num: redeemable + registerable,
    },
  },
  actionableInfo: {
    revealable: {HNS: revealable * 10, num: revealable, block: 10},
    redeemable: {HNS: redeemable * 10, num: redeemable},
    registerable: {HNS: registerable * 20, num: registerable},
    renewable: {domains: [], block: null},
    transferring: {domains: [], block: null},
    finalizable: {domains: []},
  },
});

test('auction summary status distinguishes loading, slow, failed, waiting and known zero', t => {
  const render = props => renderToStaticMarkup(<I18nContext.Provider value={{t: (key, value) => `${key}${value || ''}`}}>
    <AuctionSummaryStatus {...props} />
  </I18nContext.Provider>);
  t.ok(render({stats: {status: 'loading'}}).includes('auctionSummaryLoading'), 'loading is explicit');
  const slow = render({stats: {status: 'slow', elapsedMs: 12000}});
  t.ok(slow.includes('auctionSummarySlow') && slow.includes('auctionSummaryElapsed12'), 'slow read has elapsed time');
  const failed = render({stats: {status: 'failed', error: 'timeout', errorStage: 'getNames'}});
  t.ok(failed.includes('auctionSummaryRetry') && failed.includes('<button'), 'failure offers read-only retry');
  t.ok(failed.includes('auctionSummaryStagegetNames') && failed.includes('aria-busy="false"'), 'failed stage ends busy state');
  t.ok(render({waiting: true}).includes('auctionSummaryWaiting'), 'sync prerequisite is distinct');
  t.equal(auctionSummaryTotal({status: 'loading', ...stats(0)}), null, 'loading does not display known zero');
  t.equal(auctionSummaryTotal({status: 'ready', ...stats(0)}), 0, 'ready zero is valid');
  t.equal(auctionSummaryTotal({status: 'ready', error: 'timeout', ...stats(0)}), null, 'error does not display known zero');
  t.end();
});

test('balance guide is localized, accessible while loading, and opens only the fixed external URL', t => {
  for (const [locale, prefix] of [['en-US', ''], ['zh-CN', '/zh'], ['ru-RU', '/ru'], ['th-TH', '/th'],
    ['fr-FR', ''], ['custom', ''], ['../../wallet-secret', ''], [undefined, '']]) {
    t.equal(balanceGuideUrl(locale), `https://bobwallet.org${prefix}/docs/wallet-balances/`);
  }
  const original = shell.openExternal;
  const opened = [];
  shell.openExternal = url => opened.push(url);
  let wrapper;
  try {
    wrapper = mount(<I18nContext.Provider value={{t: key => key}}>
      <BalanceSummary locale="zh-CN" walletName="private-wallet" balanceReady={false} />
    </I18nContext.Provider>);
    const link = wrapper.find('a.overview__balance-guide');
    t.equal(link.length, 1, 'one visible native keyboard-accessible link');
    t.equal(wrapper.find('details').prop('open'), undefined, 'details remain collapsed by default');
    t.equal(link.parents('details').length, 0, 'help is visible without expanding details');
    t.equal(link.text(), 'balanceGuideLink', 'localized label');
    let prevented = false;
    link.simulate('click', {preventDefault: () => {prevented = true;}});
    t.ok(prevented, 'does not navigate the wallet renderer');
    t.deepEqual(opened, ['https://bobwallet.org/zh/docs/wallet-balances/'], 'opens once without wallet data');
    wrapper.setProps({value: {t: key => key}, children: <BalanceSummary locale="th-TH" balanceReady={false} />});
    t.equal(wrapper.find('a').prop('href'), balanceGuideUrl('th-TH'), 'updates with selected locale');
  } finally {
    wrapper?.unmount();
    shell.openExternal = original;
  }
  t.end();
});

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return {promise, resolve};
}

function createStatsStore() {
  return createStore(
    combineReducers({
      walletStats: walletStatsReducer,
      wallet: (state = {watchOnly: true}) => state,
    }),
    applyMiddleware(thunk),
  );
}

test('height advance queues a fresh summary instead of reusing an older block snapshot', async t => {
  const original = walletClient.getStats;
  const blocked = deferred();
  let calls = 0;
  walletClient.getStats = () => ++calls === 1 ? blocked.promise : Promise.resolve(stats(2));
  const store = createStore(combineReducers({
    walletStats: walletStatsReducer,
    wallet: (state = {wid: 'fixture-height', walletHeight: 1}) => state,
    node: (state = {chain: {height: 1}}, action) => action.type === 'fixture-height' ? {chain: {height: 2}} : state,
  }), applyMiddleware(thunk));
  const first = store.dispatch(fetchWalletStats());
  await new Promise(resolve => setTimeout(resolve, 0));
  store.dispatch({type: 'fixture-height'});
  const next = store.dispatch(fetchWalletStats());
  t.equal(calls, 1, 'new block waits for old read to finish');
  blocked.resolve(stats(9));
  await first;
  await next;
  t.equal(calls, 2, 'exactly one new snapshot requested');
  t.equal(store.getState().walletStats.actionableInfo.redeemable.num, 2, 'new block counts replace stale response');
  walletClient.getStats = original;
  t.end();
});

test('summary timeout stops loading, deduplicates navigation and permits read-only retry', async t => {
  const original = walletClient.getStats;
  const blocked = deferred();
  let calls = 0;
  walletClient.getStats = () => { calls++; return blocked.promise; };
  const store = createStatsStore();
  const first = store.dispatch(fetchWalletStats({timeoutMs: 20}));
  t.equal(first, store.dispatch(fetchWalletStats({timeoutMs: 20})), 'two views share one request');
  try { await first; t.fail('must timeout'); } catch (_) {}
  t.equal(calls, 1, 'one transport request');
  t.equal(store.getState().walletStats.status, 'failed', 'spinner stops on failure');
  t.equal(auctionSummaryTotal(store.getState().walletStats), null, 'failed is not known zero');
  blocked.resolve(stats(9));
  await new Promise(resolve => setTimeout(resolve, 0));
  t.equal(store.getState().walletStats.status, 'failed', 'late completion does not overwrite failure');
  walletClient.getStats = () => Promise.resolve(stats(0));
  await store.dispatch(fetchWalletStats());
  t.equal(auctionSummaryTotal(store.getState().walletStats), 0, 'retry establishes genuine zero');
  const same = {...stats(2, 3, 4), isLoading: false, status: 'ready'};
  t.equal(auctionSummaryTotal(same), same.lockedBalance.bidding.HNS + same.lockedBalance.revealable.HNS + same.lockedBalance.finished.HNS, 'Overview uses identical Transactions auction scope');
  walletClient.getStats = original;
  t.end();
});

test('wallet stats clear on selection and reject late A-B-A completions', async t => {
  const original = walletClient.getStats;
  const store = createStore(combineReducers({walletStats: walletStatsReducer, wallet: walletReducer}), applyMiddleware(thunk));
  const select = wid => {
    store.dispatch({type: INVALIDATE_WALLET_REQUESTS, payload: wid});
    store.dispatch({type: SET_WALLET, payload: {wid, balance: {}}});
  };
  select('fixture-a');
  walletClient.getStats = () => Promise.resolve(stats(3));
  await store.dispatch(fetchWalletStats());
  const pending = deferred();
  walletClient.getStats = () => pending.promise;
  const old = store.dispatch(fetchWalletStats());
  select('fixture-b');
  t.equal(store.getState().walletStats.lockedBalance.finished.HNS, null, 'old auction amounts disappear immediately');
  store.dispatch({type: INVALIDATE_WALLET_REQUESTS, payload: 'fixture-c'});
  let calls = 0;
  walletClient.getStats = () => {calls++; return Promise.resolve(stats(9));};
  await store.dispatch(fetchWalletStats());
  t.equal(calls, 0, 'no stats request during backend selection transition');
  select('fixture-a');
  pending.resolve(stats(99));
  await old;
  t.equal(store.getState().walletStats.lockedBalance.finished.HNS, null, 'same wallet name does not revive old generation');
  walletClient.getStats = () => Promise.resolve(stats(2));
  await store.dispatch(fetchWalletStats());
  t.equal(store.getState().walletStats.actionableInfo.redeemable.num, 2, 'new generation is accepted');
  walletClient.getStats = original;
  t.end();
});

test('balance disclosure distinguishes unknown from zero and rejects cross-wallet updates', t => {
  const props = {balanceReady: true, walletSync: false, progress: 1,
    spendableBalance: 70, lockedUnconfirmed: 30, unconfirmedBalance: 100, confirmedBalance: 90};
  t.ok(balanceSnapshotReady(props), 'pending snapshot reconciles independently of confirmed total');
  t.notOk(balanceSnapshotReady({...props, balanceReady: false}), 'transition is unknown');
  t.notOk(balanceSnapshotReady({...props, walletSync: true}), 'rescan is updating');
  t.equal(balanceReadiness({...props, walletSync: true}), 'wallet-rescanning', 'rescan reason is inspectable');
  t.equal(balanceReadiness({...props, balanceReady: false}), 'wallet-snapshot-pending', 'missing snapshot is inspectable');
  t.notOk(balanceSnapshotReady({...props, chain: {progress: 0.99996, synced: false}}),
    'rounded sync progress alone cannot disclose a balance');
  t.ok(balanceSnapshotReady({...props, chain: {progress: 0.99996, synced: true}}),
    'authoritative synchronized state can disclose a complete wallet snapshot');
  t.equal(balanceReadiness({...props, chain: {progress: 0.99996, synced: true,
    height: 19, bestPeerHeight: 20}}), 'chain-behind-peer', 'lagging peer height wins');
  t.notOk(balanceSnapshotReady({...props, lockedUnconfirmed: undefined}), 'missing lock is not zero');
  t.equal(balanceReadiness({...props, spendableBalance: 71}), 'wallet-amounts-disagree',
    'mismatched arithmetic remains hidden');
  t.ok(balanceSnapshotReady({...props, spendableBalance: 0, lockedUnconfirmed: 0, unconfirmedBalance: 0, confirmedBalance: 0}), 'known zero is valid');
  const state = {...walletReducer(undefined, {}), wid: 'fixture-b', network: 'regtest', balanceReady: true};
  t.equal(walletReducer(state, {type: SET_BALANCE, payload: {walletId: 'fixture-a', network: 'regtest'}}), state, 'another wallet balance rejected');
  t.notOk(walletReducer(state, {type: INVALIDATE_WALLET_REQUESTS, payload: 'fixture-a'}).balanceReady, 'selection hides prior snapshot');
  const current = {...state, balanceContext: '2:3'};
  t.equal(walletReducer(current, {type: SET_BALANCE, payload: {walletId: 'fixture-b', network: 'regtest', balanceContext: '2:1'}}), current, 'queued old same-wallet IPC generation rejected');
  const payload = {walletId: 'fixture-b', network: 'regtest', balanceContext: '2:3',
    confirmed: 100, unconfirmed: 90, lockedConfirmed: 20, lockedUnconfirmed: 30};
  t.equal(walletReducer(current, {type: SET_BALANCE, payload}).balance.spendable, 60, 'current-context update accepted with unchanged accounting');
  const restarted = walletReducer(current, {type: SET_WALLET, payload: {
    wid: 'fixture-b', balanceContext: '4:1', balance: payload}});
  t.equal(restarted.balanceContext, '4:1', 'new account snapshot restores backend context');
  t.equal(walletReducer(restarted, {type: SET_BALANCE,
    payload: {...payload, balanceContext: '4:1', unconfirmed: 80}}).balance.spendable, 50, 'new backend balance updates resume');
  t.end();
});

test('stale wallet statistics cannot restore redeemed action cards', async t => {
  const originalGetStats = walletClient.getStats;
  const originalSendRedeemAll = walletClient.sendRedeemAll;
  const oldResponse = deferred();
  let call = 0;
  walletClient.getStats = () => {
    call++;
    if (call === 1) return Promise.resolve(stats(30, 2, 3));
    if (call === 2) return oldResponse.promise;
    return Promise.resolve(stats(0, 2, 3));
  };
  walletClient.sendRedeemAll = () => Promise.resolve({txid: 'redeem-tx'});

  const store = createStatsStore();
  await store.dispatch(fetchWalletStats());
  t.equal(
    store.getState().walletStats.actionableInfo.redeemable.num,
    30,
    'wallet initially reports redeemable bids',
  );

  const staleRequest = store.dispatch(fetchWalletStats());
  const redemption = store.dispatch(sendRedeemAll());
  oldResponse.resolve(stats(30, 2, 3));
  await redemption;
  await staleRequest;

  const current = store.getState().walletStats;
  t.equal(current.actionableInfo.redeemable.num, 0, 'redeem card stays hidden');
  t.equal(current.actionableInfo.registerable.num, 2, 'register card is preserved');
  t.equal(current.actionableInfo.revealable.num, 3, 'reveal card is preserved');

  walletClient.getStats = originalGetStats;
  walletClient.sendRedeemAll = originalSendRedeemAll;
  t.end();
});

test('empty bulk redeem refreshes stats and returns a friendly message', async t => {
  const originalGetStats = walletClient.getStats;
  const originalSendRedeemAll = walletClient.sendRedeemAll;
  walletClient.getStats = () => Promise.resolve(stats(0, 1, 1));
  walletClient.sendRedeemAll = () => Promise.reject(
    new Error('RPC internal error.\nNothing to do.\nat Wallet.makeBatch'),
  );

  const store = createStatsStore();
  try {
    await store.dispatch(sendRedeemAll());
    t.fail('empty redeem should reject with the friendly state message');
  } catch (error) {
    t.equal(error.message, 'No bids remain to redeem.');
  }

  const current = store.getState().walletStats;
  t.equal(current.actionableInfo.redeemable.num, 0, 'stale card is removed');
  t.equal(current.actionableInfo.registerable.num, 1, 'register card remains');
  t.equal(current.actionableInfo.revealable.num, 1, 'reveal card remains');

  walletClient.getStats = originalGetStats;
  walletClient.sendRedeemAll = originalSendRedeemAll;
  t.end();
});
