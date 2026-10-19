import test from 'tape';
import EventEmitter from 'events';
import walletReducer, {SET_WALLET, SET_RESCAN_STATE} from '../../../ducks/walletReducer';
import {Lock} from 'bmutex';
import {installLocalRescan} from '../localRescan';

function deferred() {let resolve; const promise = new Promise(r => {resolve = r;}); return {promise, resolve};}
const tick = () => new Promise(r => setImmediate(r));
function fixture({store = new Map(), spv = false, poolConnected} = {}) {
  const calls = [];
  const chain = Object.assign(new EventEmitter(), {locker: new Lock(), db: {scan: async height => calls.push(height)}});
  chain._reset = async height => calls.push(height);
  const node = {chain, spv};
  if (typeof poolConnected === 'boolean') node.pool = {connected: poolConnected};
  const client = {
    node, filter: {}, emitAsync: async () => {},
    async rescan(height) {
      const unlock = await chain.locker.lock();
      try {return await (spv ? chain._reset(height) : chain.db.scan(height));}
      finally {unlock();}
    },
  };
  const wdb = Object.assign(new EventEmitter(), {
    height: 0,
    client, txLock: new Lock(), state: {startHeight: 0},
    db: {
      get: async key => store.get(key.toString('hex')) || null,
      put: async (key, value) => store.set(key.toString('hex'), Buffer.from(value)),
    },
    async rescan(height) {
      const unlock = await this.txLock.lock();
      let result;
      try {result = await client.rescan(height);}
      finally {unlock();}
      return result;
    },
    async close() {},
    async syncNode() {
      const unlock = await this.txLock.lock();
      try {return;}
      finally {unlock();}
    },
  });
  const originalUnlocker = wdb.txLock.unlocker;
  installLocalRescan(wdb, node);
  return {wdb, chain, node, store, calls, originalUnlocker};
}
function record(store) {return JSON.parse([...store.values()][0].toString());}

test('local rescans preserve native serialization and every requested height', async t => {
  const f = fixture();
  f.wdb.height = 10;
  const entered = deferred(); const gate = deferred();
  f.chain.db.scan = async height => {f.calls.push(height); if (height === 10) {entered.resolve(); await gate.promise;}};
  const first = f.wdb.rescan(10); await entered.promise;
  const more = [0, 4, 2, 1].map(h => f.wdb.rescan(h));
  await tick();
  t.deepEqual(f.calls, [10], 'later requests wait on real backend mutex');
  t.deepEqual(record(f.store).requests.map(r => r.height), [10, 0, 4, 2, 1], 'all requirements durable before waiting');
  gate.resolve(); await Promise.all([first, ...more]);
  t.deepEqual(f.calls, [10, 0, 4, 2, 1]);
  t.deepEqual(record(f.store).requests, []);
  t.notOk(f.chain.locker.busy); t.notOk(f.wdb.txLock.busy);
  t.end();
});

test('crash reconstruction recovers earliest queued coverage without wallet identifiers', async t => {
  const f = fixture(); const gate = deferred(); const entered = deferred();
  f.wdb.height = 10;
  f.chain.db.scan = async () => {entered.resolve(); await gate.promise;};
  const first = f.wdb.rescan(10); await entered.promise;
  const second = f.wdb.rescan(2); await tick();
  const saved = new Map([...f.store].map(([k,v]) => [k, Buffer.from(v)]));
  const restarted = fixture({store: saved});
  restarted.wdb.height = 10;
  await restarted.wdb.syncNode();
  t.deepEqual(restarted.calls, [2], 'restart recovers earliest unfulfilled scan');
  t.deepEqual(record(saved).requests, []);
  t.deepEqual(Object.keys(record(saved)).sort(), ['next', 'requests']);
  gate.resolve(); await Promise.all([first, second]);
  t.end();
});

test('failure retains recovery record, releases both mutexes, and retries only on reconnect', async t => {
  const f = fixture();
  f.wdb.height = 3;
  f.chain.db.scan = async () => {throw new Error('fixture scan failure');};
  try {await f.wdb.rescan(3); t.fail('must reject');} catch (e) {t.equal(e.message, 'fixture scan failure');}
  t.deepEqual(record(f.store).requests.map(r => r.height), [3]);
  t.notOk(f.chain.locker.busy); t.notOk(f.wdb.txLock.busy);
  f.chain.db.scan = async height => f.calls.push(height);
  await tick(); t.deepEqual(f.calls, [], 'no automatic retry loop');
  await f.wdb.syncNode(); t.deepEqual(f.calls, [3]);
  t.deepEqual(record(f.store).requests, []);
  t.end();
});

test('SPV rewind stays pending through partial replay and restart until preserved target', async t => {
  const requestId = 'c'.repeat(32);
  const f = fixture({spv: true});
  f.chain.height = 20; f.wdb.height = 20;
  f.chain._reset = async height => {
    f.calls.push(height);
    f.chain.height = height;
    f.wdb.height = height;
  };
  await f.wdb.syncNode();
  let admission = require('../recoveryAdmission').createRecoveryAdmission(() => f.wdb.bobRescanState);
  f.wdb.on('bob rescan', state => {
    f.wdb.bobRescanState = state;
  });
  const scan = f.wdb.rescan(0, {requestId});
  try {await f.wdb.rescan(0); t.fail('a concurrent second restore must be rejected immediately');}
  catch (error) {t.match(error.message, /not ready/);}
  await scan;
  t.deepEqual(f.calls, [0], 'SPV performs one rewind');
  t.equal(f.wdb.bobRescanState.journalReady, true, 'request target and identity are hydrated before replay remains pending');
  t.equal(record(f.store).requests[0].target, 20, 'replay target is durable');
  t.equal(record(f.store).requests[0].rewound, true, 'journal records that rewind completed');
  t.equal(f.wdb.bobRescanState.status, 'scanning');
  t.equal(f.wdb.bobRescanState.ready, false);
  t.ok(f.wdb.bobRescanState.activeRequestIds.includes(requestId));
  t.throws(() => admission.beginImport(), {code: 'WALLET_RECOVERY_BUSY'}, 'imports stay closed during replay');
  try {await f.wdb.rescan(0); t.fail('second restore must be rejected while replaying');}
  catch (error) {t.match(error.message, /not ready/);}

  // Recreate the adapter over the same durable journal while replay is at 5.
  const saved = new Map([...f.store].map(([k, v]) => [k, Buffer.from(v)]));
  const restarted = fixture({store: saved, spv: true});
  admission = require('../recoveryAdmission').createRecoveryAdmission(() => restarted.wdb.bobRescanState);
  restarted.chain.height = 5; restarted.wdb.height = 5;
  t.equal(restarted.wdb.bobRescanState.journalReady, false, 'a new adapter starts closed until its journal is read');
  await restarted.wdb.syncNode();
  t.deepEqual(restarted.calls, [], 'restart resumes replay without resetting the partial tip');
  t.equal(restarted.wdb.bobRescanState.target, 20, 'partial tip does not replace original target');
  t.equal(restarted.wdb.bobRescanState.journalReady, true, 'restart publishes the hydrated target before replay');
  t.equal(restarted.wdb.bobRescanState.ready, false);
  restarted.chain.height = 19; restarted.wdb.height = 19;
  restarted.wdb.emit('block connect', {height: 19});
  t.equal(record(saved).requests.length, 1, 'request remains pending below target');
  t.notOk(restarted.wdb.bobRescanState.completedRequestIds.includes(requestId));
  restarted.chain.height = 20; restarted.wdb.height = 20;
  restarted.wdb.emit('block connect', {height: 20});
  await tick();
  t.deepEqual(record(saved).requests, [], 'durable request is acknowledged at target');
  t.equal(restarted.wdb.bobRescanState.status, 'complete');
  t.equal(restarted.wdb.bobRescanState.ready, true);
  t.ok(restarted.wdb.bobRescanState.completedRequestIds.includes(requestId));
  t.notOk(admission.isBusy(), 'another import is admitted after target replay completes');
  t.end();
});

test('SPV startup journals a legacy profile catch-up target before rewind and restart', async t => {
  const f = fixture({spv: true});
  f.chain.height = 20; f.wdb.height = 5;
  f.chain._reset = async height => {
    f.calls.push(height);
    f.chain.height = height;
    f.wdb.height = height;
  };
  await f.wdb.syncNode();
  t.equal(f.wdb.bobRescanState.journalReady, true, 'legacy no-journal catch-up is persisted before readiness');
  const pending = record(f.store).requests[0];
  t.equal(pending.height, 5, 'legacy catch-up starts at the stored wallet tip');
  t.equal(pending.target, 20, 'the known chain target is saved before native sync rewinds it');
  t.equal(pending.rewound, true, 'native SPV sync rewind is recorded durably');
  t.equal(f.wdb.bobRescanState.status, 'scanning');
  t.equal(f.wdb.bobRescanState.ready, false, 'ordinary catch-up keeps admission closed');
  t.throws(() => require('../recoveryAdmission').createRecoveryAdmission(() => f.wdb.bobRescanState).beginImport(),
    {code: 'WALLET_RECOVERY_BUSY'});

  const saved = new Map([...f.store].map(([k, v]) => [k, Buffer.from(v)]));
  const restarted = fixture({store: saved, spv: true});
  restarted.chain.height = 10; restarted.wdb.height = 10;
  t.equal(restarted.wdb.bobRescanState.journalReady, false, 'legacy catch-up restart begins unhydrated');
  await restarted.wdb.syncNode();
  t.deepEqual(restarted.calls, [], 'partial-replay restart does not rewind the chain again');
  t.equal(restarted.wdb.bobRescanState.target, 20);
  t.equal(restarted.wdb.bobRescanState.journalReady, true, 'legacy target survives restart journal hydration');
  t.equal(restarted.wdb.bobRescanState.ready, false);
  restarted.chain.height = 20; restarted.wdb.height = 20;
  restarted.wdb.emit('block connect', {height: 20});
  await tick();
  t.deepEqual(record(saved).requests, [], 'legacy catch-up is acknowledged only at its original tip');
  t.equal(restarted.wdb.bobRescanState.status, 'complete');
  t.equal(restarted.wdb.bobRescanState.ready, true);
  t.end();
});

test('bad heights and journal write failures do not start a scan', async t => {
  const f = fixture();
  for (const height of [-1, 1.5, NaN, 0x100000000]) {
    try {await f.wdb.rescan(height); t.fail('must reject');} catch (e) {t.match(e.message, /height/);}
  }
  f.wdb.db.put = async () => {throw new Error('fixture disk full');};
  try {await f.wdb.rescan(0); t.fail('must reject');} catch(e) {t.equal(e.message, 'fixture disk full');}
  t.deepEqual(f.calls, []); t.notOk(f.chain.locker.busy);
  t.end();
});

test('deferred startup recovery keeps the backend unready until post-connect sync succeeds', async t => {
  const f = fixture({poolConnected: false});
  t.equal(f.wdb.bobRescanState.status, 'waiting');
  t.equal(f.wdb.bobRescanState.journalReady, false, 'pool-disconnected profile has not inspected its journal');
  t.equal(f.wdb.bobRescanState.ready, false, 'pool-disconnected startup is explicitly unready');
  try {
    await f.wdb.rescan(3);
    t.fail('must reject before local sync readiness');
  } catch (error) {
    t.match(error.message, /not ready/);
  }

  f.node.pool.connected = true;
  await f.wdb.resumeLocalSync();
  t.equal(f.wdb.bobRescanState.status, 'idle');
  t.equal(f.wdb.bobRescanState.journalReady, true, 'fresh no-journal profile is ready after inspection');
  t.equal(f.wdb.bobRescanState.ready, true, 'backend becomes ready only after sync and journal inspection');
  f.wdb.height = 3;
  await f.wdb.rescan(3);
  t.deepEqual(f.calls, [3]);
  t.end();
});

test('startup journal failure remains closed and fails packaged fixture readiness', async t => {
  const f = fixture({poolConnected: false});
  f.node.pool.connected = true;
  f.wdb.db.get = async () => {throw new Error('fixture journal read failed');};
  try {
    await f.wdb.resumeLocalSync();
    t.fail('sync must reject when the durable journal cannot be inspected');
  } catch (error) {
    t.equal(error.message, 'fixture journal read failed');
  }
  t.equal(f.wdb.bobRescanState.status, 'failed');
  t.equal(f.wdb.bobRescanState.journalReady, false, 'fixture admission never opens on failed journal inspection');
  t.equal(f.wdb.bobRescanState.ready, false);
  t.end();
});


test('shutdown preserves accepted waiting recovery and rejects new requests', async t => {
  const f = fixture(); const gate = deferred(); const entered = deferred();
  f.wdb.height = 10;
  f.chain.db.scan = async height => {f.calls.push(height); entered.resolve(); await gate.promise;};
  const first = f.wdb.rescan(10); await entered.promise;
  const pending = f.wdb.rescan(0).catch(e => e); await tick();
  const closing = f.wdb.close();
  try {await f.wdb.rescan(2); t.fail('must reject');} catch(e) {t.match(e.message, /not started/);}
  gate.resolve(); await first;
  t.match((await pending).message, /pending for restart/); await closing;
  t.deepEqual(record(f.store).requests.map(r => r.height), [0]);
  const restarted = fixture({store: f.store}); await restarted.wdb.syncNode();
  t.equal(restarted.wdb.bobRescanState.journalReady, true, 'closed adapter rehydrates the durable request on restart');
  t.deepEqual(restarted.calls, [0]);
  t.deepEqual(record(f.store).requests, []);
  t.end();
});

test('completion follows durable acknowledgement and native WalletDB lock release', async t => {
  const f = fixture(); f.chain.height = 100; f.wdb.height = 100;
  const gate = deferred(); const entered = deferred();
  f.chain.db.scan = async () => {
    f.wdb.height = 48; f.wdb.emit('block connect', {height: 48});
    entered.resolve(); await gate.promise;
    f.wdb.height = 100; f.wdb.emit('block connect', {height: 100});
  };
  const first = f.wdb.rescan(0); await entered.promise;
  const second = f.wdb.rescan(0); await tick();
  t.equal(f.wdb.bobRescanState.target, 100, 'second restore cannot replace target with partial height 48');
  f.wdb.height = 100; f.wdb.emit('block connect', {height: 100});
  t.equal(f.wdb.bobRescanState.status, 'scanning', 'pending restore prevents premature completion');
  gate.resolve(); await Promise.all([first, second]);
  t.equal(f.wdb.bobRescanState.status, 'complete');

  f.chain.db.scan = async height => {
    f.calls.push(height);
    f.wdb.height = 100; f.wdb.emit('block connect', {height: 100});
  };
  const firstRequest = 'a'.repeat(32);
  const third = f.wdb.rescan(0, {requestId: firstRequest});
  await third;
  t.equal(f.wdb.bobRescanState.status, 'complete', 'scan success and durable journal acknowledgement mark completion');
  t.ok(f.wdb.bobRescanState.completedRequestIds.includes(firstRequest), 'completion identifies its own request');
  t.notOk(f.wdb.txLock.busy, 'native WalletDB rescan released its lock before the chain operation settled');
  t.notOk(f.chain.locker.busy, 'the chain lock is released when the owned backend operation settles');
  t.equal(f.wdb.txLock.unlocker, f.originalUnlocker, 'adapter leaves the native lock callback untouched');
  const secondRequest = 'b'.repeat(32);
  const queued = f.wdb.rescan(0, {requestId: secondRequest});
  await queued;
  t.deepEqual(f.calls, [0, 0], 'a later operation uses the native lock queue');
  t.ok(f.wdb.bobRescanState.completedRequestIds.includes(secondRequest), 'each completed request remains correlated');
  t.end();
});

test('scan failure or acknowledgement failure after the target never publishes completion', async t => {
  for (const failure of ['scan-after-target', 'ack-write']) {
    const f = fixture();
    f.chain.height = 100;
    let puts = 0;
    const put = f.wdb.db.put;
    if (failure === 'ack-write') {
      f.wdb.db.put = async (...args) => {
        puts++;
        if (puts === 2) throw new Error('fixture acknowledgement failure');
        return put(...args);
      };
    }
    f.chain.db.scan = async () => {
      f.wdb.height = 100;
      f.wdb.emit('block connect', {height: 100});
      if (failure === 'scan-after-target') throw new Error('fixture scan failed after target');
    };
    try {await f.wdb.rescan(0); t.fail('must reject');}
    catch (error) {t.match(error.message, /fixture (scan failed|acknowledgement failure)/);}
    t.equal(f.wdb.bobRescanState.status, 'failed', `${failure} remains visibly failed`);
    t.equal(record(f.store).requests.length, 1, `${failure} keeps recovery pending on restart`);
  }
  t.end();
});


test('wallet switching and renderer unmount leave shared recovery running', async t => {
  const f = fixture(); f.chain.height = 100;
  const entered = deferred(); const gate = deferred();
  f.chain.db.scan = async () => {entered.resolve(); await gate.promise; f.wdb.height = 100;};
  let state = walletReducer(undefined, {});
  const listener = payload => {state = walletReducer(state, {type: SET_RESCAN_STATE, payload});};
  f.wdb.on('bob rescan', listener);
  const scan = f.wdb.rescan(0); await entered.promise;
  const before = {height: state.rescanHeight, status: state.rescanStatus};
  for (const wid of ['a', 'b', 'a']) {
    state = walletReducer(state, {type: SET_WALLET, payload: {wid, balance: {}}});
    t.deepEqual({height: state.rescanHeight, status: state.rescanStatus}, before);
  }
  f.wdb.removeListener('bob rescan', listener);
  t.ok(f.chain.locker.busy, 'unmount does not abort or rewind the backend');
  gate.resolve(); await scan;
  t.equal(f.wdb.bobRescanState.status, 'complete');
  listener(f.wdb.bobRescanState);
  t.notOk(state.walletSync, 'reopened renderer receives latest backend state');
  t.end();
});

test('a start height above the wallet tip does not roll back or fail recovery', async t => {
  for (const spv of [false, true]) {
    const f = fixture({spv});
    f.chain.height = 144087;
    f.wdb.height = 144087;
    await f.wdb.rescan(304416);
    t.deepEqual(f.calls, [], `${spv ? 'SPV' : 'full node'} does not reset for a future height`);
    t.equal([...f.store.keys()].length, 0, 'a future height is not saved for the next launch');
    t.notEqual(f.wdb.bobRescanState.status, 'failed');
    t.equal(f.wdb.bobRescanState.ready, true);
    await f.wdb.rescan(94032);
    t.deepEqual(f.calls, [94032], 'a start height the wallet has reached still scans');
  }
  t.end();
});

test('restart discards a saved future recovery height and continues', async t => {
  const journalKey = Buffer.from('ff626f622d72657363616e2d7631', 'hex').toString('hex');
  for (const spv of [false, true]) {
    const store = new Map([[journalKey, Buffer.from(JSON.stringify({
      next: 1,
      requests: [{id: 1, height: 304416, target: 144087, rewound: false}],
    }))]]);
    const f = fixture({store, spv});
    f.chain.height = 144087;
    f.wdb.height = 144087;
    await f.wdb.syncNode();
    t.deepEqual(f.calls, [], `${spv ? 'SPV' : 'full node'} startup does not roll back into the future`);
    t.deepEqual(record(store).requests, [], 'the unusable recovery record is removed');
    t.equal(f.wdb.bobRescanState.status, 'idle');
    t.equal(f.wdb.bobRescanState.ready, true);
    t.equal(f.wdb.bobRescanState.journalReady, true);
    t.notOk(f.chain.locker.busy);
    t.notOk(f.wdb.txLock.busy);
  }
  t.end();
});
