process.env.NODE_BACKEND = 'js';
process.env.BABEL_DISABLE_CACHE = '1';
require('@babel/register')({configFile: false, babelrc: false,
  presets: [['@babel/preset-env', {targets: {node: 'current'}}]]});
const assert = require('node:assert/strict');
const test = require('node:test');
const net = require('node:net');
const dgram = require('node:dgram');
const deny = () => {throw new Error('Source replay test forbids every socket.');};
net.Socket.prototype.connect = net.connect = net.createConnection = net.Server.prototype.listen = deny;
dgram.createSocket = deny;
const {installProductRuntime, getProductRuntime} = require('../../app/background/packagedAcceptance/productRuntime');
const {BLOCK_ALLOCATION, BLOCK_WALLET_INDEXES} = require('../../app/background/packagedAcceptance/embeddedRestore');

test('embedded restore funds generated wallets with fixed unequal regtest history', () => {
  assert.deepEqual(BLOCK_ALLOCATION, [8, 5, 4, 2, 1]);
  assert.equal(BLOCK_WALLET_INDEXES.length, 20);
  assert.deepEqual(BLOCK_ALLOCATION.map((_, index) =>
    BLOCK_WALLET_INDEXES.filter(value => value === index).length), BLOCK_ALLOCATION);
});

for (const scenario of ['restore-full', 'restore-spv']) {
  test(`retained in-memory fixture invokes actual reviewed ${scenario} replay`, {timeout: 180000}, async () => {
    const values = new Map();
    let exposed;
    installProductRuntime({scenario}, {
      get: async key => values.get(key), put: async (key, value) => values.set(key, value),
    }, {withService(name, methods) {
      assert.equal(name, 'Acceptance'); exposed = Object.keys(methods);
    }});
    const evidence = await getProductRuntime().initializeRestore();
    assert.deepEqual(exposed, ['describe', 'advance']);
    await assert.rejects(getProductRuntime().advance(), {code: 'ERR_PACKAGED_ACCEPTANCE_POLICY'});
    assert.equal(evidence.status, 'SOURCE REVIEWED REPLAY PASSED');
    assert.equal(evidence.reviewedAdapter, 'installLocalRescan');
    assert.equal(evidence.sequentialRestores, 5);
    assert.equal(evidence.pendingJournalEntries, 0);
    assert.equal(evidence.failureObserved, true);
    assert.equal(evidence.walletHeight, 20);
    assert.equal(evidence.chainHeight, 20);
    assert.equal(evidence.sockets, 0);
    assert.equal(evidence.signingCalls, 0);
    assert.equal(evidence.liveBroadcastCalls, 0);
    assert(evidence.balances.every(wallet => wallet.confirmed > 0));
    assert.equal(evidence.packagedBackendStatus, 'NOT TESTED');
    if (scenario === 'restore-spv') {
      assert.equal(evidence.overlapRejections, 5);
      assert(evidence.checkpoints.some(point => point.label === 'partial-replay-walletdb-reopened'
        && point.target === 20 && point.walletHeight === 5 && point.pendingJournalEntries === 1 && !point.ready));
    } else {
      assert.equal(evidence.overlapCompletions, 5);
    }
    assert.deepEqual((await getProductRuntime().describe()).restoreEvidence, evidence);
  });
}

test('restore fixture rejects any non-allowlisted scenario before creating a database', async () => {
  const {runControlledRestore} = require('../../app/background/packagedAcceptance/restoreReplay');
  await assert.rejects(runControlledRestore('main'), /fixed restore scenario/);
});
