// The journal is written before the network boundary. Absence from wallet
// history is never evidence that an uncertain broadcast is safe to repeat.
export class RegisterAllJournal {
  constructor({get, put}) {
    this.get = get;
    this.put = put;
    this.active = null;
    this.snapshots = new Map();
    this.checking = false;
    this.cancelled = new Set();
  }

  cancel(context) {
    if (!context.operationId) return false;
    this.cancelled.add(`${this.key(context)}:${context.operationId}`);
    return true;
  }

  key({network, walletId}) {
    return `register-all:${JSON.stringify([network, walletId])}`;
  }

  view(state, running = false) {
    if (!state) return null;
    const copy = JSON.parse(JSON.stringify(state));
    copy.running = running;
    copy.retryLocked = running || copy.entries.some(e => ['broadcasting', 'unknown'].includes(e.status));
    copy.transactions = copy.entries.filter(e => e.status === 'submitted').map(({name, txid}) => ({name, txid}));
    copy.names = copy.transactions.map(e => e.name);
    copy.txids = copy.transactions.map(e => e.txid);
    copy.txid = copy.txids.join(', ');
    copy.notAttempted = copy.entries.filter(e => e.status === 'queued').map(e => e.name);
    return copy;
  }

  async save(key, state) {
    // Keep the conservative in-memory state even if the durable write fails.
    this.snapshots.set(key, state);
    await this.put(key, state);
  }

  async load(key) {
    const state = this.snapshots.get(key) || await this.get(key);
    if (state && state.version !== 1) throw new Error('Unsupported Register All recovery record. Retry is blocked.');
    if (state && this.active?.key !== key) {
      for (const entry of state.entries) {
        if (entry.status === 'broadcasting') entry.status = 'unknown';
        if (entry.status === 'preparing') {
          entry.status = 'failed';
          entry.error = 'Preparation was interrupted before broadcast.';
        }
      }
      if (state.status === 'running') state.status = 'paused';
    }
    return state;
  }

  async status(context, findTransaction, isConfirmed = async () => false) {
    const key = this.key(context);
    if (this.active?.key === key) return this.view(this.active.state, true);
    if (this.checking) throw new Error('Register All status is being checked.');
    this.checking = true;
    try {
    const state = await this.load(key);
    if (!state) return null;
    let changed = false;
    for (const entry of state.entries) {
      if (['unknown', 'broadcasting'].includes(entry.status) && entry.txid) {
        if (await findTransaction(entry.txid)) {
          entry.status = 'submitted';
          entry.error = null;
          changed = true;
        }
      }
    }
    if (changed) {
      state.status = state.entries.every(e => ['submitted', 'skipped'].includes(e.status)) ? 'complete' : 'paused';
      await this.save(key, state);
    }
    const view = this.view(state);
    // Confirmation is fresh display evidence, never a durable flag that could
    // hide pending work after a reorg. Receipts and uncertainty stay in the journal.
    view.settledComplete = state.status === 'complete';
    for (const entry of state.entries) {
      if (entry.status === 'skipped' && !entry.txid) continue;
      if (entry.status !== 'submitted' || !entry.txid || !await isConfirmed(entry.txid)) {
        view.settledComplete = false;
        break;
      }
    }
    view.confirmedComplete = view.settledComplete && state.entries.some(entry => entry.status === 'submitted');
    return view;
    } finally {
      this.checking = false;
    }
  }

  async run(context, {getNames, submit, assertCurrent}) {
    if (this.active || this.checking) throw new Error('Register All is running or checking transaction status. Check its progress before submitting again.');
    const key = this.key(context);
    const checkContext = assertCurrent;
    assertCurrent = () => {
      if (this.cancelled.has(`${key}:${context.operationId}`)) {
        throw new Error('Register All was stopped. No further registrations will be sent.');
      }
      checkContext();
    };
    const active = {key, state: null};
    this.active = active;
    try {
      // Normalize interrupted records before declaring the new run active.
      const previous = this.snapshots.get(key) || await this.get(key);
      if (previous && previous.version !== 1) throw new Error('Unsupported Register All recovery record. Retry is blocked.');
      if (previous) {
        for (const entry of previous.entries) {
          if (entry.status === 'broadcasting') entry.status = 'unknown';
          if (entry.status === 'preparing') entry.status = 'failed';
        }
        if (previous.entries.some(e => e.status === 'unknown')) {
          previous.status = 'paused';
          return this.view(previous);
        }
      }
      assertCurrent();
      const eligible = new Set(await getNames());
      assertCurrent();
      if (!eligible.size) return {...this.view(previous), noWork: true};
      let state = previous;
      if (!state || state.status === 'complete') {
        if (state) await this.put(`${key}:history:${state.id}`, state);
        state = {version: 1, id: `${Date.now()}`, ...context, status: 'running', entries: [...eligible].map(name => ({name, status: 'queued', stage: 'queued', txid: null}))};
      }
      state.status = 'running';
      state.operationId = context.operationId;
      active.state = state;
      await this.save(key, state);

      for (const entry of state.entries) {
        if (['submitted', 'skipped'].includes(entry.status)) continue;
        try {
          assertCurrent();
          if (!eligible.has(entry.name)) {
            entry.status = 'skipped';
            entry.error = 'No longer eligible in the current wallet, including pending registrations.';
            await this.save(key, state);
            continue;
          }
          entry.status = 'preparing';
          entry.stage = 'preparing';
          entry.error = null;
          await this.save(key, state);
          const tx = await submit(entry.name, {
            assertCurrent,
            onStage: async stage => {
              entry.stage = stage;
              await this.save(key, state);
              assertCurrent();
            },
            beforeBroadcast: async txid => {
              assertCurrent();
              if (!/^[a-f0-9]{64}$/.test(txid)) throw new Error('Missing registration transaction ID. Broadcast blocked.');
              entry.txid = txid;
              entry.stage = 'broadcasting';
              entry.status = 'broadcasting';
              await this.save(key, state);
              try { assertCurrent(); }
              catch (error) { error.broadcastNotAttempted = true; throw error; }
            },
          });
          if (!tx || tx.txid() !== entry.txid) throw new Error('Registration did not return a verified transaction ID.');
          entry.status = 'submitted';
          entry.stage = 'submitted';
          await this.save(key, state);
        } catch (error) {
          if (error.broadcastNotAttempted === true) entry.txid = null;
          entry.status = entry.txid ? 'unknown' : 'failed';
          entry.error = error.message || String(error);
          state.status = 'paused';
          state.failedName = entry.name;
          state.failedStage = entry.stage;
          await this.save(key, state);
          return this.view(state);
        }
      }
      state.status = 'complete';
      state.failedName = null;
      state.failedStage = null;
      await this.save(key, state);
      return this.view(state);
    } finally {
      this.active = null;
    }
  }
}
