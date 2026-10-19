import {AsyncLocalStorage} from 'async_hooks';
import {Lock} from 'bmutex';

// Outside hsd 6.1.1's single-byte ASCII layout. Contains heights/request
// numbers only, never wallet identifiers or keys. Older Bob ignores this key.
const JOURNAL_KEY = Buffer.from('ff626f622d72657363616e2d7631', 'hex');

// hsd v6.1.1 delivers embedded block connects while Chain holds its mutex.
// WalletDB.rescan/syncNode take txLock first, then call Chain.scan/reset: the
// opposite order deadlocks when a block arrives during rollback. Install before
// opening the plugin so startup/reconnect and all wallet HTTP/RPC callers share
// the same order. Custom RPC has no local Chain and retains its own client.
export function installLocalRescan(wdb, node) {
  const {chain} = node;
  const client = wdb.client;
  if (client.node !== node) throw new Error('Expected an embedded wallet client.');
  const ownership = new AsyncLocalStorage();
  const journalLock = new Lock();
  let closing = false;
  let active = false;
  let replaying = false;
  let failed = false;
  let journalReady = false;
  let target = null;
  let generation = 0;
  let ready = !(node.pool && node.pool.connected === false);
  let startupSyncDeferred = !ready;
  const unjournaled = new Set();
  const unacknowledged = new Map();
  const activeRequestIds = new Set();
  const completedRequestIds = new Set();
  let completingReplay = false;
  function rememberCompletedRequest(id) {
    if (!id) return;
    completedRequestIds.delete(id);
    completedRequestIds.add(id);
    if (completedRequestIds.size > 128) {
      completedRequestIds.delete(completedRequestIds.values().next().value);
    }
  }
  function publish(status) {
    const state = {
      status,
      managed: true,
      journalReady,
      height: wdb.height,
      target,
      generation,
      ready,
      activeRequestIds: [...activeRequestIds],
      completedRequestIds: [...completedRequestIds],
    };
    const previous = wdb.bobRescanState;
    wdb.bobRescanState = state;
    if (previous
        && previous.status === state.status
        && previous.height === state.height
        && previous.target === state.target
        && previous.generation === state.generation
        && previous.journalReady === state.journalReady
        && previous.ready === state.ready
        && previous.activeRequestIds?.join(',') === state.activeRequestIds.join(',')
        && previous.completedRequestIds?.join(',') === state.completedRequestIds.join(',')) return;
    wdb.emit('bob rescan', state);
  }
  function advance() {
    if (failed) return;
    if (generation === 0 && unjournaled.size === 0 && unacknowledged.size === 0) return;
    if (ready && unjournaled.size === 0 && unacknowledged.size === 0 && !active && !replaying && generation > 0) {
      publish('complete');
    } else {
      publish(active || replaying ? 'scanning' : 'waiting');
    }
  }
  wdb.bobRescanState = {
    status: ready ? 'idle' : 'waiting',
    managed: true,
    journalReady: false,
    height: wdb.height,
    target: null,
    generation: 0,
    ready,
    activeRequestIds: [],
    completedRequestIds: [],
  };
  async function completeReachedReplay() {
    if (!node.spv || !replaying || failed || completingReplay) return;
    const reached = [...unacknowledged.entries()]
      .filter(([, request]) => request.target == null
        ? chain.synced && wdb.height >= chain.height
        : wdb.height >= request.target && chain.height >= request.target);
    if (!reached.length) {
      advance();
      return;
    }

    completingReplay = true;
    try {
      const ids = reached.map(([id]) => id);
      await acknowledge(ids);
      for (const [id, request] of reached) {
        unacknowledged.delete(id);
        if (request.requestId) {
          activeRequestIds.delete(request.requestId);
          rememberCompletedRequest(request.requestId);
        }
      }
      if (unacknowledged.size === 0 && unjournaled.size === 0) {
        replaying = false;
        ready = true;
        failed = false;
      }
      advance();
    } catch (error) {
      failed = true;
      ready = false;
      publish('failed');
      if (wdb.listenerCount('error') > 0) wdb.emit('error', error);
      else console.error('Wallet recovery replay acknowledgement failed:', error);
    } finally {
      completingReplay = false;
    }
  }
  wdb.on('block connect', () => {
    advance();
    void completeReachedReplay();
  });
  chain.on('full', () => { void completeReachedReplay(); });
  async function journal(update) {
    const release = await journalLock.lock();
    try {
      const raw = await wdb.db.get(JOURNAL_KEY);
      const value = raw ? JSON.parse(raw.toString('utf8')) : {next: 0, requests: []};
      if (!Number.isSafeInteger(value.next) || value.next < 0 || !Array.isArray(value.requests)
          || value.requests.some(r => !Number.isSafeInteger(r.id)
            || (r.height >>> 0) !== r.height
            || (r.target != null && (!Number.isSafeInteger(r.target) || r.target < 0))
            || (r.requestId != null && !/^[a-f0-9]{32}$/.test(r.requestId)))) {
        throw new Error('Invalid pending wallet recovery record.');
      }
      const result = update(value);
      await wdb.db.put(JOURNAL_KEY, Buffer.from(JSON.stringify(value)));
      return result;
    } finally {release();}
  }
  const acknowledge = ids => journal(value => {
    value.requests = value.requests.filter(r => !ids.includes(r.id));
  });
  const markRewound = ids => journal(value => {
    for (const request of value.requests) {
      if (ids.includes(request.id)) request.rewound = true;
    }
  });
  const originalRescan = wdb.rescan;
  const originalClientRescan = client.rescan;

  client.rescan = async function(start) {
    const owner = ownership.getStore();
    if (!owner?.active) return originalClientRescan.call(this, start);
    // Already own the chain mutex. Use hsd 6.1.1's unlocked implementations;
    // otherwise its public scan/reset would acquire the same mutex twice.
    let result;
    if (node.spv) {
      result = await chain._reset(start, false);
    } else {
      result = await chain.db.scan(start, this.filter, (entry, txs) =>
        this.emitAsync('block rescan', entry, txs));
    }

    // SPV reset is only a durable rewind. Keep the journal until replay reaches
    // the preserved target. Full-node scans are acknowledged after native
    // WalletDB.rescan() releases txLock.
    if (owner.requestIds?.length) {
      if (node.spv) {
        await markRewound(owner.requestIds);
        for (const id of owner.requestIds) {
          const request = unacknowledged.get(id);
          if (request) request.rewound = true;
        }
        owner.rewindAccepted = true;
      } else {
        owner.scanComplete = true;
      }
    }
    return result;
  };

  async function withChainLock(owner, operation) {
    const unlock = await chain.locker.lock();
    let released = false;
    owner.active = true;
    owner.releaseChainLock = () => {
      if (released) return;
      released = true;
      owner.active = false;
      unlock();
      active = false;
      advance();
    };
    try {
      return await ownership.run(owner, operation);
    } finally {
      // Descendant callbacks must not bypass the mutex after ownership ends.
      owner.releaseChainLock();
    }
  }

  wdb.rescan = async function(height, options = {}) {
    if (closing) throw new Error('Wallet is stopping; recovery was not started.');
    if (!ready) throw new Error('Wallet backend is not ready for recovery.');
    if (height == null) height = this.state.startHeight;
    if ((height >>> 0) !== height) throw new Error('WDB: Must pass in a height.');
    const requestId = options.requestId || null;
    if (requestId !== null && !/^[a-f0-9]{32}$/.test(requestId)) {
      throw new Error('WDB: Invalid recovery request identifier.');
    }
    // hsd WalletDB.rollback throws "WDB: Cannot rollback to the future" when
    // the start height is above the wallet tip. Import's year estimate can
    // land there while the chain is still downloading. Ordinary sync already
    // indexes this wallet from the current tip forward, which covers a start
    // block that does not exist yet. Persisting that height makes the next
    // launch reject it before peer sync starts.
    if (height > this.height) return undefined;
    const requestTarget = Math.max(target || 0, chain.height || 0, wdb.height || 0);
    const ticket = {};
    if (unjournaled.size === 0 && unacknowledged.size === 0) {
      generation++;
      target = requestTarget;
      failed = false;
    } else {
      target = Math.max(target || 0, requestTarget);
    }
    unjournaled.add(ticket);
    if (requestId) activeRequestIds.add(requestId);
    // SPV reset starts a replay phase in which another rescan would rewind the
    // partial tip. Close admission synchronously so a concurrent second call
    // cannot queue behind the first reset before `ready` is lowered later.
    if (node.spv) ready = false;
    // Persist before waiting for either backend mutex. A crash or failed scan
    // must not silently discard a later wallet's earlier recovery requirement.
    publish(active ? 'scanning' : 'waiting');
    let id = null;
    try {
      id = await journal(value => {
        const id = ++value.next;
        value.requests.push({
          id,
          height,
          target: requestTarget,
          rewound: false,
          ...(requestId ? {requestId} : {}),
        });
        return id;
      });
      unjournaled.delete(ticket);
      const request = {id, height, target: requestTarget, rewound: false, requestId};
      unacknowledged.set(id, request);
      const owner = {requestIds: [id], requestId};
      const result = await withChainLock(owner, async () => {
        if (closing) throw new Error('Wallet is stopping; recovery remains pending for restart.');
        active = true;
        publish('scanning');
        try {
          const result = await originalRescan.call(this, height);
          if (node.spv && owner.rewindAccepted) {
            replaying = true;
            ready = false;
            publish('scanning');
          } else if (owner.scanComplete) {
            await acknowledge([id]);
            unacknowledged.delete(id);
            if (requestId) {
              activeRequestIds.delete(requestId);
              rememberCompletedRequest(requestId);
            }
          }
          return result;
        } finally {active = false;}
      });
      if (node.spv && owner.rewindAccepted) await completeReachedReplay();
      return result;
    } catch (error) {
      failed = true;
      if (requestId && id == null) activeRequestIds.delete(requestId);
      publish('failed');
      throw error;
    } finally {
      if (id == null) unjournaled.delete(ticket);
      advance();
    }
  };

  const originalSync = wdb.syncNode;
  wdb.syncNode = async function() {
    if (closing) return;
    if (node.pool && typeof node.pool.connected === 'boolean' && !node.pool.connected) {
      startupSyncDeferred = true;
      ready = false;
      journalReady = false;
      publish('waiting');
      return;
    }
    ready = false;
    journalReady = false;
    publish('waiting');
    try {
      // A profile created by an older Bob version has no recovery journal.
      // Capture its known chain tip before hsd.syncNode() rewinds an SPV chain
      // to the partial WalletDB tip, so ordinary catch-up remains admission-
      // closed until the original tip has been replayed.
      const preSyncWalletHeight = wdb.height;
      const preSyncChainHeight = chain.height;
      let requests = await journal(value => value.requests.slice());
      let catchupRequest = null;
      if (node.spv && requests.length === 0 && preSyncChainHeight > preSyncWalletHeight) {
        catchupRequest = await journal(value => {
          const request = {
            id: ++value.next,
            height: preSyncWalletHeight,
            target: preSyncChainHeight,
            rewound: false,
          };
          value.requests.push(request);
          return request;
        });
        requests = [catchupRequest];
      }
      const result = await withChainLock({requestIds: []}, async () => {
        if (closing) return;
        const owner = ownership.getStore();
        if (catchupRequest) owner.requestIds = [catchupRequest.id];
        await originalSync.call(this);
        if (catchupRequest && owner.rewindAccepted) catchupRequest.rewound = true;
        for (const request of requests) {
          const restored = {
            ...request,
            target: Number.isSafeInteger(request.target) ? request.target : null,
            rewound: request.rewound === true,
            requestId: request.requestId || null,
          };
          unacknowledged.set(request.id, restored);
          if (restored.requestId) activeRequestIds.add(restored.requestId);
        }
        if (!requests.length) {
          failed = false;
          replaying = false;
          ready = true;
          journalReady = true;
          target = null;
          publish('idle');
          return;
        }
        const height = requests.reduce((min, r) => Math.min(min, r.height), 0xffffffff);
        const requestTargets = requests.map(r => r.target).filter(Number.isSafeInteger);
        target = requestTargets.length ? Math.max(...requestTargets) : null;
        if (generation === 0) generation = 1;
        failed = false;
        if (node.spv && requests.every(request => request.rewound === true)) {
          replaying = true;
          ready = false;
          journalReady = true;
          publish('scanning');
          return;
        }
        // A journal written by v2.3.17/v2.3.18 can store an import start
        // height the wallet has not reached. originalRescan() would throw
        // and abort startup before startSync(). Drop that recovery and let
        // chain sync continue. A lower saved height still resumes below.
        if (height > wdb.height) {
          const ids = requests.map(request => request.id);
          await acknowledge(ids);
          for (const id of ids) {
            const request = unacknowledged.get(id);
            if (request?.requestId) activeRequestIds.delete(request.requestId);
            unacknowledged.delete(id);
          }
          failed = false;
          replaying = false;
          active = false;
          ready = true;
          journalReady = true;
          target = null;
          generation = 0;
          publish('idle');
          return;
        }
        active = true;
        owner.requestIds = requests.map(r => r.id);
        journalReady = true;
        publish('scanning');
        await originalRescan.call(this, height);
        if (node.spv && owner.rewindAccepted) {
          replaying = true;
          ready = false;
        } else if (owner.scanComplete) {
          await acknowledge(owner.requestIds);
          for (const id of owner.requestIds) unacknowledged.delete(id);
          ready = true;
        }
      });
      if (node.spv) await completeReachedReplay();
      return result;
    } catch (error) {
      failed = true;
      ready = false;
      publish('failed');
      throw error;
    } finally {advance();}
  };
  wdb.resumeLocalSync = async function() {
    if (!startupSyncDeferred || closing) return;
    startupSyncDeferred = false;
    return wdb.syncNode();
  };
  const originalClose = wdb.close;
  wdb.close = async function() {
    closing = true;
    return withChainLock({requestIds: []}, async () => {
      const releaseWallet = await wdb.txLock.lock();
      try {
        const release = await journalLock.lock();
        try {return await originalClose.call(this);}
        finally {release();}
      } finally {releaseWallet();}
    });
  };
}
