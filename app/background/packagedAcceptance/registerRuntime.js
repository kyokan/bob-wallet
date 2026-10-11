const {RegisterAllJournal} = require('../wallet/registerAll');
const crypto = require('crypto');

const STATE_KEY = 'acceptance-register-state-v1';
const JOURNAL_PREFIX = 'acceptance-register-journal:';
const CONTROL_KEY = 'acceptance-fixed-product-state-v1';

function createRegisterRuntime(plan, db) {
  if (!plan.fixtureType.startsWith('register-') || plan.network !== 'regtest') {
    throw new Error('Register All fixture requires a fixed regtest scenario.');
  }
  const walletId = 'acceptance-primary';
  let state;
  let delay;
  let walletService;
  const journal = new RegisterAllJournal({
    get: key => db.get(`${JOURNAL_PREFIX}${key}`),
    put: (key, value) => db.put(`${JOURNAL_PREFIX}${key}`, value),
  });
  const load = async () => {
    if (!state) state = await db.get(STATE_KEY) || {scenario: plan.scenario,
      constructionCalls: 0, inertBoundaryCalls: 0, liveBroadcastCalls: 0,
      signatureCalls: 0, acceptedNames: [], injectedFailure: false, historyLookupCalls: 0};
    if (state.scenario !== plan.scenario) throw new Error('Cannot change a disposable registration scenario.');
    return state;
  };
  const save = () => db.put(STATE_KEY, state);
  const check = (context, requireId = false) => {
    const allowedWallets = plan.fixtureType === 'register-wallet-switch'
      ? [walletId, 'acceptance-secondary'] : [walletId];
    if (context?.network !== 'regtest' || !allowedWallets.includes(context?.walletId)
        || (requireId && !/^[a-zA-Z0-9-]{1,100}$/.test(context.operationId || ''))) {
      throw new Error('Controlled Register All fixture refused non-fixture context.');
    }
  };
  const walletMethods = {
    async getRegisterAllStatus(context) {
      check(context);
      await load();
      if (context.preflight) {
        const {preflight, ...scope} = context;
        const operation = await walletMethods.getRegisterAllStatus(scope);
        return {operation, eligibleCount: plan.registrationNames.filter(name => !state.acceptedNames.includes(name)).length};
      }
      if (walletService) return walletService.getRegisterAllStatus(context);
      if (plan.fixtureType.startsWith('register-reconcile-')) {
        throw new Error('Exact-ID fixture requires the disposable WalletService status endpoint.');
      }
      return journal.status(context, async () => false);
    },
    async cancelRegisterAll(context) {
      check(context, true);
      const cancelled = journal.cancel(context);
      if (delay?.operationId === context.operationId) {
        clearTimeout(delay.timer);
        delay.resolve();
        delay = null;
      }
      return cancelled;
    },
    async sendRegisterAll(passphrase, context) {
      check(context, true);
      if (passphrase !== undefined && passphrase !== null && passphrase !== '') {
        throw new Error('Disposable registration fixture does not accept credentials.');
      }
      await load();
      const selectionGeneration = walletService?.walletSelectionGeneration;
      const node = walletService?.node;
      return journal.run(context, {
        assertCurrent: () => {
          check(context, true);
          if (walletService && (walletService.name !== context.walletId
              || walletService.walletSelectionGeneration !== selectionGeneration
              || walletService.node !== node)) {
            throw new Error('The wallet backend changed. Register All has stopped.');
          }
        },
        getNames: async () => plan.registrationNames.filter(name => !state.acceptedNames.includes(name)),
        submit: async (name, hooks) => {
          if (!plan.registrationNames.includes(name)) throw new Error('Non-fixture registration blocked.');
          state.constructionCalls++;
          await save();
          if (plan.fixtureType === 'register-cancel' || plan.fixtureType === 'register-wallet-switch') {
            await new Promise(resolve => {
              const timer = setTimeout(() => {delay = null; resolve();}, 10000);
              delay = {timer, resolve, operationId: context.operationId};
            });
            hooks.assertCurrent();
          }
          // Stage only: no key derivation, signature, or real WalletService proxy.
          await hooks.onStage('signing');
          if (plan.fixtureType === 'register-partial' && name === plan.registrationNames[6] && !state.injectedFailure) {
            state.injectedFailure = true;
            await save();
            throw new Error('Controlled seventh-registration preparation failure; no transaction sent for this name.');
          }
          const txid = crypto.createHash('sha256').update(`inert-register:${name}`).digest('hex');
          await hooks.beforeBroadcast(txid);
          state.inertBoundaryCalls++;
          if (plan.fixtureType !== 'register-ambiguous') state.acceptedNames.push(name);
          await save();
          if (plan.fixtureType === 'register-ambiguous'
              || (plan.fixtureType.startsWith('register-reconcile-')
                && name === plan.registrationNames[0])) {
            throw new Error('Controlled ambiguous registration result; no real signature or broadcast occurred.');
          }
          return {txid: () => txid};
        },
      });
    },
  };
  return {walletMethods, async attachWalletService(service) {
    await load();
    if (typeof service.getRegisterAllStatus !== 'function'
        || typeof service._registerAllContext !== 'function'
        || !service.node?.wdb?.get) throw new Error('Disposable WalletService status endpoint is missing.');
    const wallet = await service.node.wdb.get(walletId);
    if (!wallet || typeof wallet.getTX !== 'function') throw new Error('Disposable registration wallet is missing.');
    service.registerAllJournal = journal;
    if (plan.fixtureType.startsWith('register-reconcile-')) {
      const expected = crypto.createHash('sha256')
        .update(`inert-register:${plan.registrationNames[0]}`).digest('hex');
      wallet.getTX = async hash => {
        const requested = Buffer.isBuffer(hash) ? hash.toString('hex') : '';
        if (requested !== expected) return null;
        state.historyLookupCalls += 1;
        const control = await db.get(CONTROL_KEY);
        const offered = control?.controlStep === 1
          ? plan.fixtureType === 'register-reconcile-exact' ? expected : 'bd'.repeat(32)
          : null;
        state.historyCandidateTxid = offered;
        await save();
        return offered === requested ? {hash: Buffer.from(requested, 'hex')} : null;
      };
    }
    walletService = service;
  }, async describe() {
    await load();
    return {...state, journal: 'real-RegisterAllJournal', walletServiceProxy: 'MOCKED',
      statusEndpoint: walletService ? 'real-WalletService.getRegisterAllStatus' : 'NOT ATTACHED',
      eligibility: 'MOCKED fixed disposable registration names; production eligibility requires separate service tests',
      transport: 'INERT', packagedStatus: 'NOT TESTED'};
  }};
}

module.exports = {createRegisterRuntime, STATE_KEY, JOURNAL_PREFIX};
