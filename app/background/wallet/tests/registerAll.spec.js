import test from 'tape';
import {RegisterAllJournal} from '../registerAll';

const context = {network: 'regtest', walletId: 'disposable'};
const clone = value => value == null ? null : JSON.parse(JSON.stringify(value));
const txid = name => Buffer.from(name).toString('hex').padEnd(64, '0');

function fixture(store = new Map()) {
  return {
    store,
    journal: new RegisterAllJournal({
      get: async key => clone(store.get(key)),
      put: async (key, value) => store.set(key, clone(value)),
    }),
  };
}

function submission(log, fail) {
  return async (name, hooks) => {
    await hooks.onStage('signing');
    if (name === fail) throw new Error('Transient signing-key failure');
    await hooks.beforeBroadcast(txid(name));
    log.push(name);
    return {txid: () => txid(name)};
  };
}

test('empty eligibility never replaces a completed journal and confirmation is recomputed after restart', async t => {
  const {journal, store} = fixture();
  const args = {getNames: async () => ['one'], submit: submission([]), assertCurrent() {}};
  await journal.run(context, args);
  const saved = clone(store.get(journal.key(context)));
  const empty = await journal.run(context, {...args, getNames: async () => []});
  t.equal(empty.noWork, true);
  t.deepEqual(store.get(journal.key(context)), saved, 'receipts not replaced by 0/0 operation');
  const restarted = fixture(store).journal;
  t.equal((await restarted.status(context, async () => true)).confirmedComplete, false, 'submitted is not confirmed');
  t.equal((await restarted.status(context, async () => true, async id => id === txid('one'))).confirmedComplete, true);
  t.equal((await restarted.status(context, async () => true, async () => false)).confirmedComplete, false, 'lost confirmation revives pending state');
  t.deepEqual((await restarted.status(context, async () => true)).txids, [txid('one')]);
  t.end();
});

test('empty and skipped completed journals settle without inventing confirmations', async t => {
  const {journal, store} = fixture();
  await journal.run(context, {getNames: async () => ['one'], submit: submission([]), assertCurrent() {}});
  const saved = clone(store.get(journal.key(context)));
  for (const entries of [[], [{name: 'old', status: 'skipped'}], [...saved.entries, {name: 'old', status: 'skipped'}]]) {
    store.set(journal.key(context), {...saved, entries});
    const result = await fixture(store).journal.status(context, async () => true, async () => true);
    t.equal(result.settledComplete, true, 'no pending transaction blocks future work');
    t.equal(result.confirmedComplete, entries.some(entry => entry.status === 'submitted'));
  }
  store.set(journal.key(context), {...saved, entries: [...saved.entries, {name: 'old', status: 'skipped'}]});
  t.equal((await fixture(store).journal.status(context, async () => true, async () => false)).settledComplete, false, 'pending receipt remains unsettled');
  t.end();
});

test('Register All retains six submitted IDs and the failed name/stage before safely resuming 32', async t => {
  const {journal, store} = fixture();
  const names = Array.from({length: 38}, (_, i) => i === 6 ? 'poh' : `fixture-${i}`);
  const sent = [];
  const args = {getNames: async () => names, submit: submission(sent, 'poh'), assertCurrent() {}};
  const partial = await journal.run(context, args);
  t.equal(partial.status, 'paused');
  t.equal(partial.transactions.length, 6);
  t.equal(partial.failedName, 'poh');
  t.equal(partial.failedStage, 'signing');
  t.equal(partial.notAttempted.length, 31);
  t.equal(partial.retryLocked, false, 'known pre-broadcast failure is resumable');
  t.deepEqual(partial.txids, names.slice(0, 6).map(txid));

  const restarted = fixture(store).journal;
  t.equal((await restarted.status(context, async () => false)).transactions.length, 6, 'partial results survive restart');
  const result = await restarted.run(context, {...args, submit: submission(sent)});
  t.equal(result.status, 'complete');
  t.equal(result.transactions.length, 38);
  t.deepEqual(sent, names, 'transient failure retries the failed name, never the six already sent');
  t.equal(new Set(sent).size, 38);
  t.end();
});

test('Register All ambiguous broadcast stays locked across restart and absence, then reconciles positive wallet evidence', async t => {
  const {journal, store} = fixture();
  const sent = [];
  const args = {getNames: async () => ['one', 'two'], assertCurrent() {}, submit: async (name, hooks) => {
    await hooks.beforeBroadcast(txid(name));
    sent.push(name);
    throw new Error('Network response timed out');
  }};
  const result = await journal.run(context, args);
  t.equal(result.retryLocked, true);
  t.equal(result.entries[0].txid, txid('one'));
  t.deepEqual(result.notAttempted, ['two']);
  const restarted = fixture(store).journal;
  t.equal((await restarted.status(context, async () => false)).retryLocked, true, 'absence never proves rejection');
  await restarted.run(context, args);
  t.deepEqual(sent, ['one'], 'blind retry never invokes submit');
  const reconciled = await restarted.status(context, async id => id === txid('one'));
  t.equal(reconciled.retryLocked, false);
  t.equal(reconciled.transactions[0].txid, txid('one'));
  await restarted.run(context, {...args, submit: submission(sent)});
  t.deepEqual(sent, ['one', 'two']);
  t.end();
});

test('Register All writes a broadcast intent before sending and fails closed if that write fails', async t => {
  const {store} = fixture();
  let broadcasts = 0;
  const journal = new RegisterAllJournal({
    get: async key => clone(store.get(key)),
    put: async (key, value) => {
      if (value.entries?.some(e => e.status === 'broadcasting')) throw new Error('disk full');
      store.set(key, clone(value));
    },
  });
  const result = await journal.run(context, {getNames: async () => ['one'], assertCurrent() {}, submit: async (name, hooks) => {
    await hooks.beforeBroadcast(txid(name));
    broadcasts++;
  }});
  t.equal(broadcasts, 0);
  t.equal(result.retryLocked, true, 'uncertain journal state is not retried automatically');
  t.end();
});

test('Register All blocks concurrent runs and a switched wallet stops the next send', async t => {
  const {journal} = fixture();
  let release;
  const wait = new Promise(resolve => {release = resolve;});
  let selected = true;
  const sent = [];
  const args = {getNames: async () => ['one', 'two'], assertCurrent() {
    if (!selected) throw new Error('Wallet changed');
  }, submit: async (name, hooks) => {
    await hooks.beforeBroadcast(txid(name));
    sent.push(name);
    await wait;
    return {txid: () => txid(name)};
  }};
  const first = journal.run(context, args);
  try {await journal.run(context, args); t.fail('duplicate must fail');}
  catch (error) {t.match(error.message, /running/);}
  while (!sent.length) await new Promise(resolve => setTimeout(resolve, 1));
  t.equal((await journal.status(context, async () => false)).running, true);
  selected = false;
  release();
  const stopped = await first;
  t.deepEqual(sent, ['one']);
  t.equal(stopped.failedName, 'two');
  t.equal(stopped.transactions[0].txid, txid('one'));
  t.end();
});

test('Register All skips names no longer eligible and never silently ignores unsigned transactions', async t => {
  const {journal} = fixture();
  const partial = await journal.run(context, {getNames: async () => ['one', 'two'], assertCurrent() {}, submit: async () => null});
  t.equal(partial.status, 'paused');
  t.equal(partial.failedName, 'one');
  t.equal(partial.transactions.length, 0);
  const sent = [];
  const result = await journal.run(context, {getNames: async () => ['two'], assertCurrent() {}, submit: submission(sent)});
  t.deepEqual(sent, ['two']);
  t.equal(result.entries[0].status, 'skipped');
  t.end();
});
