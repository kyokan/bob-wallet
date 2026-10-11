import test from 'tape';

import {fromReveals, getStats} from '../stats';
import {states} from 'hsd/lib/covenants/namestate';

test('128 registration estimates finish locally without external price enrichment', async t => {
  const wallet = {wdb: {height: 100}, network: {type: 'main', names: {renewalWindow: 1000}},
    getBids: async () => [], getReveals: async () => [],
    getNames: async () => Array.from({length: 128}, (_, i) => ({
      name: Buffer.from(`fixture-${i}`), owner: {hash: i, index: 0}, highest: 100, value: 40,
      toStats: () => ({}), isExpired: () => false, state: () => states.CLOSED,
    })),
    getUnspentCoin: async () => ({covenant: {isReveal: () => true, isClaim: () => false}}),
  };
  const result = await getStats(wallet, {timeoutMs: 1000});
  t.equal(result.actionableInfo.registerable.num, 128, 'counts complete without per-name network waits');
  t.equal(result.actionableInfo.registerable.HNS, 128 * 60, 'existing local estimate math preserved');
  t.equal(result.actionableInfo.registerable.verified, false, 'local estimate explicitly unverified');
  t.end();
});

test('hung reads are bounded and retries cannot accumulate database work', async t => {
  let release;
  let reads = 0;
  const blocked = new Promise(resolve => { release = resolve; });
  const wallet = {wdb: {height: 100}, network: {}, getBids: async () => [], getReveals: async () => [],
    getNames: () => { reads++; return blocked; }};
  const first = getStats(wallet, {timeoutMs: 20});
  t.equal(first, getStats(wallet, {timeoutMs: 20}), 'concurrent requests share work');
  try { await first; t.fail('must time out'); } catch (error) { t.match(error.message, /getNames/, 'identifies unresolved await without names'); }
  for (let i = 0; i < 4; i++) {
    try { await getStats(wallet, {timeoutMs: 20}); t.fail('still blocked'); } catch (error) { t.match(error.message, /timed out/); }
  }
  t.ok(reads <= 3, 'unabortable database reads retain bounded concurrency');
  release([]);
  await new Promise(resolve => setTimeout(resolve, 0));
  const result = await getStats(wallet, {timeoutMs: 1000});
  t.equal(result.actionableInfo.registerable.num, 0, 'retry yields known zero after reads settle');
  t.end();
});

test('redeemable stats include only eligible unspent own reveals', async t => {
  const owner = {equals: () => false};
  const reveals = [
    {own: true, prevout: {hash: 'unspent', index: 0, equals: owner.equals}},
    {own: true, prevout: {hash: 'pending-spent', index: 0, equals: owner.equals}},
    {own: false, prevout: {hash: 'other-wallet', index: 0, equals: owner.equals}},
  ];
  const wallet = {
    wdb: {height: 100},
    network: {},
    getReveals: async () => reveals,
    getNameState: async () => ({
      owner,
      height: 50,
      isExpired: () => false,
      state: () => 6,
    }),
    getUnspentCoin: async hash => hash === 'unspent'
      ? {height: 50, value: 42}
      : null,
  };

  t.deepEqual(await fromReveals(wallet), {
    redeemable: {HNS: 42, num: 1},
  });
  t.end();
});
