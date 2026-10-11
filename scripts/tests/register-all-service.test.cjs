const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
process.env.NODE_BACKEND = 'js';
require('@babel/register')({configFile: false, babelrc: false,
  presets: [['@babel/preset-env', {targets: {node: 'current'}}]]});
const {parseSync} = require('@babel/core');
const {RegisterAllJournal} = require('../../app/background/wallet/registerAll');
const {WalletMutationCoordinator, broadcastAndRecord, reserveTransactionInputs} = require('../../app/background/wallet/transactionSafety');
const source = fs.readFileSync(path.join(__dirname, '../../app/background/wallet/service.js'), 'utf8');
const ast = parseSync(source, {configFile: false, babelrc: false, parserOpts: {plugins: ['classProperties']}});
const walletClass = ast.program.body.find(n => n.type === 'ClassDeclaration' && n.id.name === 'WalletService');
const context = {walletId: 'disposable', network: 'regtest', operationId: 'fixture-operation'};
const deferred = () => {let resolve; const promise = new Promise(r => {resolve = r;}); return {resolve, promise};};
const id = name => Buffer.from(name).toString('hex').padEnd(64, '0');

function fixture(store = new Map()) {
  const calls = {sent: [], locks: [], unlocks: [], signed: [], construct: []};
  const wallet = {
    deriveInputs: async () => [{}], lockCoin() {}, unlockCoin() {},
    getTX: async () => null,
  };
  const service = {
    name: context.walletId, networkName: context.network,
    rescanBackendGeneration: 0, walletSelectionGeneration: 0,
    registerAllJournal: new RegisterAllJournal({get: async key => structuredClone(store.get(key)),
      put: async (key, value) => store.set(key, structuredClone(value))}),
    walletMutationCoordinator: new WalletMutationCoordinator(),
    node: {wdb: {get: async () => wallet, addTX: async () => {}}},
    client: {lock: async wid => {calls.locks.push(wid);}, unlock: async wid => {calls.unlocks.push(wid);}},
    nodeService: {getDir: async () => '/unused-disposable-fixture',
      broadcastRawTx: async (hex, {assertCurrent}) => {assertCurrent(); calls.sent.push(hex);}},
    getWalletInfo: async () => ({watchOnly: false}),
    getAccountInfo: async () => ({type: 'pubkeyhash'}),
    refreshWalletInfo: async () => {},
    parseMtx: async (_, mtx) => ({mtx, metadata: {inputs: []}}),
    _createVerifiedRegisterMTX: async (_, name) => {
      calls.construct.push(name);
      return {inputs: [{prevout: {}}], outputs: [], txid: () => id(name),
        toTX() {return this;}, toHex: () => name, check() {},
        sign: async () => {calls.signed.push(name);}};
    },
  };
  const eligibility = {get: async () => ['one', 'two', 'three']};
  const bindings = {getNamesForRegisterAll: wallet => eligibility.get(wallet),
    MTX: class {static fromJSON(value) {return value;}},
    storageHealth: {preflight: async () => {}, reportError() {}},
    reserveTransactionInputs, broadcastAndRecord, Script: {hashType: {ALL: 1}},
    PRIVATE_KEY_ERROR_MESSAGE: 'No private key available.'};
  // Bind real service source with inert I/O; never import the service singleton.
  for (const name of ['_registerAllContext', 'getRegisterAllStatus', 'cancelRegisterAll',
    'sendRegisterAll', '_walletProxy', '_walletProxyUnchecked']) {
    const node = walletClass.body.body.find(n => n.key.name === name);
    service[name] = new Function(...Object.keys(bindings),
      `return function(){return (${source.slice(node.value.start, node.value.end)});};`)(...Object.values(bindings)).call(service);
  }
  return {service, wallet, store, calls, eligibility};
}

test('real registration preflight reads fresh eligibility without unlocking or constructing', async () => {
  const f = fixture();
  f.eligibility.get = async () => [];
  assert.deepEqual(await f.service.getRegisterAllStatus({...context, preflight: true}), {operation: null, eligibleCount: 0});
  f.eligibility.get = async () => ['new'];
  assert.equal((await f.service.getRegisterAllStatus({...context, preflight: true})).eligibleCount, 1);
  assert.deepEqual(f.calls.unlocks, []);
  assert.deepEqual(f.calls.construct, []);
  assert.deepEqual(f.calls.sent, []);
});

test('real registration preflight rejects late wallet or backend generation results', async () => {
  for (const field of ['walletSelectionGeneration', 'rescanBackendGeneration']) {
    const f = fixture();
    const wait = deferred();
    const started = deferred();
    f.eligibility.get = async () => {started.resolve(); await wait.promise; return ['new'];};
    const pending = f.service.getRegisterAllStatus({...context, preflight: true});
    await started.promise;
    f.service[field]++;
    wait.resolve();
    await assert.rejects(pending, /wallet changed/);
    assert.deepEqual(f.calls.sent, []);
  }
});

test('real registration status only settles exact confirmed receipts and empty attempts preserve them', async () => {
  const f = fixture();
  await f.service.sendRegisterAll('fixture', context);
  const before = structuredClone(f.store);
  f.eligibility.get = async () => [];
  f.wallet.getTX = async () => ({height: -1});
  assert.equal((await f.service.getRegisterAllStatus(context)).settledComplete, false);
  f.wallet.getTX = async hash => hash.toString('hex') === id('wrong') ? {height: 1} : null;
  assert.equal((await f.service.getRegisterAllStatus(context)).settledComplete, false);
  f.wallet.getTX = async hash => ['one', 'two', 'three'].some(name => id(name) === hash.toString('hex')) ? {height: 1} : null;
  assert.equal((await f.service.getRegisterAllStatus(context)).settledComplete, true);
  assert.equal((await f.service.sendRegisterAll('fixture', {...context, operationId: 'empty'})).noWork, true);
  assert.deepEqual(f.store, before);
  assert.equal(f.calls.sent.length, 3);
});

test('real Register All service retains accepted IDs and resumes only unfinished names after restart', async () => {
  const f = fixture();
  const create = f.service._createVerifiedRegisterMTX;
  f.service._createVerifiedRegisterMTX = async (wallet, name) => {
    if (name === 'two') throw new Error('fixture signing unavailable');
    return create(wallet, name);
  };
  const partial = await f.service.sendRegisterAll('fixture-not-a-secret', context);
  assert.equal(partial.failedName, 'two');
  assert.deepEqual(partial.transactions, [{name: 'one', txid: id('one')}]);
  const resumed = fixture(f.store);
  const result = await resumed.service.sendRegisterAll('fixture-not-a-secret', {...context, operationId: 'retry'});
  assert.equal(result.status, 'complete');
  assert.deepEqual(resumed.calls.sent, ['two', 'three']);
});

test('real service ambiguous send stays locked after restart and missing history', async () => {
  const f = fixture();
  f.service.nodeService.broadcastRawTx = async () => {throw new Error('fixture timeout');};
  const result = await f.service.sendRegisterAll('fixture', context);
  assert.equal(result.retryLocked, true);
  const restarted = fixture(f.store);
  assert.equal((await restarted.service.getRegisterAllStatus(context)).retryLocked, true);
  assert.equal((await restarted.service.getRegisterAllStatus({...context, preflight: true})).operation.retryLocked, true);
  await restarted.service.sendRegisterAll('fixture', {...context, operationId: 'retry'});
  assert.deepEqual(restarted.calls.construct, []);
});

test('cancellation while deriving and wallet A-to-B-to-A switch prevent sends', async () => {
  for (const cancel of [true, false]) {
    const f = fixture(); const entered = deferred(); const release = deferred();
    f.wallet.deriveInputs = async () => {entered.resolve(); await release.promise; return [{}];};
    const pending = f.service.sendRegisterAll('fixture', context);
    await entered.promise;
    if (cancel) f.service.cancelRegisterAll(context);
    else f.service.walletSelectionGeneration += 2;
    release.resolve();
    const result = await pending;
    assert.equal(result.status, 'paused');
    assert.deepEqual(f.calls.sent, []);
    assert.deepEqual(f.calls.signed, []);
  }
});

test('cancellation before delayed IPC submission prevents construction', async () => {
  const f = fixture(); f.service.cancelRegisterAll(context);
  await assert.rejects(f.service.sendRegisterAll('fixture', context), /stopped/);
  assert.deepEqual(f.calls.construct, []);
});

test('proven pre-send guard cancellation clears intent and safely resumes, unlike a transport timeout', async () => {
  const f = fixture(); const entered = deferred(); const release = deferred();
  f.service.nodeService.broadcastRawTx = async (hex, {assertCurrent}) => {
    entered.resolve(); await release.promise;
    assertCurrent(); f.calls.sent.push(hex);
  };
  const pending = f.service.sendRegisterAll('fixture', context);
  await entered.promise;
  f.service.cancelRegisterAll(context); release.resolve();
  const result = await pending;
  assert.equal(result.entries[0].status, 'failed');
  assert.equal(result.entries[0].txid, null);
  assert.equal(result.retryLocked, false);
  assert.deepEqual(f.calls.sent, []);
  const restarted = fixture(f.store);
  const retried = await restarted.service.sendRegisterAll('fixture', {...context, operationId: 'retry'});
  assert.equal(retried.transactions.length, 3);
  assert.deepEqual(restarted.calls.sent, ['one', 'two', 'three']);
});

test('awaited relock serializes following unlock and cleanup cannot mask accepted or unknown result', async () => {
  const f = fixture(); const entered = deferred(); const release = deferred(); let first = true;
  f.service.client.lock = async () => {if (first) {first = false; entered.resolve(); await release.promise;}};
  const pending = f.service.sendRegisterAll('fixture', context);
  await entered.promise;
  assert.equal(f.calls.unlocks.length, 1);
  release.resolve();
  assert.equal((await pending).transactions.length, 3);
  for (const uncertain of [false, true]) {
    const g = fixture();
    g.service.client.lock = async () => {throw new Error('fixture relock failure');};
    if (uncertain) g.service.nodeService.broadcastRawTx = async () => {throw new Error('original timeout');};
    const result = await g.service.sendRegisterAll('fixture', context);
    if (uncertain) {
      assert.equal(result.retryLocked, true);
      assert.doesNotMatch(result.entries[0].error, /relock/);
    } else assert.equal(result.transactions.length, 3);
  }
});

test('node broadcast validates context after delayed preflight before any send', async () => {
  const nodeSource = fs.readFileSync(path.join(__dirname, '../../app/background/node/service.js'), 'utf8');
  const nodeAst = parseSync(nodeSource, {configFile: false, babelrc: false});
  const cls = nodeAst.program.body.map(n => n.declaration || n).find(n => n.type === 'ClassDeclaration');
  const method = cls.body.body.find(n => n.key?.name === 'broadcastRawTx');
  const entered = deferred(); const release = deferred(); let sends = 0; let current = true;
  const storageHealth = {preflight: async () => {entered.resolve(); await release.promise;}, reportError() {}};
  const TX = {decode: () => ({txid: () => id('one')})};
  const fn = new Function('storageHealth', 'TX', 'TRANSACTION_TIMEOUT_MS',
    `return ${nodeSource.slice(method.start, method.end).replace('async broadcastRawTx', 'async function')}`)(storageHealth, TX, 120000);
  const service = {getDir: async () => '/unused', getBroadcastClient: () => ({broadcast: async () => {sends++;}})};
  const pending = fn.call(service, '00', {assertCurrent: () => {if (!current) throw new Error('cancelled');}});
  await entered.promise; current = false; release.resolve();
  await assert.rejects(pending, /cancelled/);
  assert.equal(sends, 0);
});
