import test from 'tape';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {mount} from 'enzyme';
import {Provider} from 'react-redux';
import {Records} from '../../../components/Records';

const fixture = require('../../../utils/tests/fixtures/activate-proposal-v1-addresses.json');

test('Selling options require explicit selection and only navigate or reveal a draft form', t => {
  const paths = [];
  const subject = makeRecords({sellingOptions: true, domain: {isOwner: true, info: {registered: true}}, history: {push: path => paths.push(path)}});
  const {component} = subject;
  t.equal(component.state.saleProvider, null, 'no provider selected by default');
  component.chooseSale('shakex');
  t.equal(component.state.saleProvider, 'shakex');
  t.equal(component.state.isDirty, false, 'selection does not modify records');
  t.equal(subject.sendCalls(), 0, 'selection does not send a transaction');
  t.equal(subject.loadCalls(), 0, 'selection does not contact a provider');
  component.chooseSale('shakedex');
  t.deepEqual(paths, ['/exchange?createListing=1&name=example']);
  component.props.shakedexListings = [{nameLock: {name: 'example'}, status: 'ACTIVE'}];
  component.chooseSale('shakedex');
  t.equal(paths[1], '/exchange?listing=example', 'existing listing is opened');
  component.props.name = 'xn--ev9h';
  component.chooseSale('shakedex');
  t.equal(paths[2], '/exchange?createListing=1&name=xn--ev9h', 'canonical name stays unchanged');
  component.props.name = 'example';
  component.props.shakedexListings[0].status = 'SOLD';
  component.chooseSale('shakedex');
  t.equal(paths[3], '/exchange?createListing=1&name=example', 'reacquired sold name can be listed again');
  t.end();
});

test('Selling options deny ineligible names and preserve dirty drafts', t => {
  for (const override of [{domain: {isOwner: false}}, {domain: {isOwner: true, info: {registered: false}}}, {transferring: true}, {pendingData: {}}, {canonicalLoading: true}, {canonicalError: 'offline'}]) {
    let navigations = 0;
    const {component} = makeRecords({domain: {isOwner: true, info: {registered: true}}, history: {push: () => navigations++}, ...override});
    component.chooseSale('shakedex');
    component.chooseSale('shakex');
    t.equal(navigations, 0);
    t.equal(component.state.saleProvider, null);
  }
  const {component} = makeRecords({domain: {isOwner: true, info: {registered: true}}});
  component.state.isDirty = true;
  const draft = component.state.updatedResource;
  component.chooseSale('shakex');
  t.equal(component.state.saleProvider, null);
  t.equal(component.state.updatedResource, draft, 'unsaved DNS draft survives');
  t.end();
});

test('Records controls precede selling in DOM order without changing the draft', t => {
  const {component, sendCalls} = makeRecords({sellingOptions: true, domain: {isOwner: true, info: {registered: true}}});
  const before = component.state.updatedResource;
  const panels = component.render().props.children;
  t.equal(panels[0].props.title, component.context.t('records'));
  t.equal(panels[1].props.title, component.context.t('sellNameTitle'));
  t.equal(component.state.updatedResource, before);
  t.equal(sendCalls(), 0);
  t.end();
});

function makeRecords(overrides = {}) {
  let sendCalls = 0;
  let loadCalls = 0;
  const component = new Records({
    name: 'example',
    network: 'main',
    domain: {name: 'example', isOwner: true},
    resource: {records: []},
    pendingData: null,
    deeplinkParams: {},
    transferring: false,
    editable: true,
    canonicalLoading: false,
    canonicalError: '',
    currentHeight: 100,
    showSuccess() {},
    clearDeeplinkParams() {},
    async sendUpdate() {
      sendCalls += 1;
      return null;
    },
    async loadCanonicalNameInfo() {
      loadCalls += 1;
      return {info: {data: '00'}};
    },
    async refreshCanonicalNameInfo() {
      loadCalls += 1;
    },
    async openProposalFile() {
      return {canceled: false, filePaths: ['/authorized/proposal.json']};
    },
    async readProposalFile() {
      return Buffer.from(JSON.stringify(fixture));
    },
    ...overrides,
  });
  component.context = {t: key => key};
  component.setState = update => {
    const value = typeof update === 'function' ? update(component.state, component.props) : update;
    component.state = {...component.state, ...value};
  };
  component.componentDidMount();
  return {component, sendCalls: () => sendCalls, loadCalls: () => loadCalls};
}

const carnageResource = {
  records: [
    {type: 'NS', ns: 'ns1.namebase.io.'},
    {type: 'NS', ns: 'ns2.namebase.io.'},
    {
      type: 'DS',
      keyTag: 27885,
      algorithm: 13,
      digestType: 2,
      digest: '33f86dde585bf7f2da39c08c26cef5bfd7507be1835c34300e601ad4713ee317',
    },
  ],
};

function mountRecords(overrides = {}) {
  const subject = makeRecords(overrides);
  const store = {
    dispatch() {},
    getState() {
      return {node: {chain: {height: 100}}};
    },
    subscribe() {
      return () => {};
    },
  };
  return {
    ...subject,
    wrapper: mount(<Records {...subject.component.props} />, {
      wrappingComponent: Provider,
      wrappingComponentProps: {store},
    }),
  };
}

test('Records replaces an initially stale empty draft when canonical records arrive', t => {
  const subject = mountRecords({name: 'carnage', resource: {records: []}});
  t.equal(subject.wrapper.find('.record__value').length, 0, 'stale resource starts empty');

  subject.wrapper.setProps({resource: carnageResource});

  t.deepEqual(
    subject.wrapper.state('updatedResource').records,
    carnageResource.records,
    'the clean draft follows the later canonical resource'
  );
  const html = subject.wrapper.html();
  t.match(html, /ns1\.namebase\.io\./);
  t.match(html, /ns2\.namebase\.io\./);
  t.match(html, /27885 13 2 33f86dde585bf7f2da39c08c26cef5bfd7507be1835c34300e601ad4713ee317/);
  subject.wrapper.unmount();
  t.end();
});

test('Records preserves a dirty local draft across a later canonical refresh', async t => {
  const subject = mountRecords({name: 'carnage', resource: {records: []}});
  const localRecord = {type: 'NS', ns: 'local.example.'};

  await subject.wrapper.instance().onCreate(localRecord);
  subject.wrapper.setProps({resource: carnageResource});

  t.deepEqual(subject.wrapper.state('updatedResource').records, [localRecord]);
  t.equal(subject.wrapper.state('isDirty'), true, 'local edit remains explicitly dirty');
  t.equal(
    subject.wrapper.find('.records-table__refresh-status__button').prop('disabled'),
    true,
    'refresh is disabled while the draft is dirty'
  );
  subject.wrapper.unmount();
  t.end();
});

test('Records refresh uses the name-info path without invoking wallet mutation actions', async t => {
  let refreshedName = null;
  let sendCalls = 0;
  const subject = mountRecords({
    name: 'carnage',
    async refreshCanonicalNameInfo(name) {
      refreshedName = name;
    },
    async sendUpdate() {
      sendCalls += 1;
      return null;
    },
  });

  await subject.wrapper.instance().refreshRecords();

  t.equal(refreshedName, 'carnage', 'refresh calls the canonical name-info callback');
  t.equal(sendCalls, 0, 'refresh does not invoke the UPDATE action');
  t.equal(subject.wrapper.state('isRefreshingRecords'), false);
  subject.wrapper.unmount();
  t.end();
});

test('Records add, edit, and remove operations continue to update the local draft', async t => {
  const subject = makeRecords({resource: {records: []}});
  await subject.component.onCreate({type: 'NS', ns: 'first.example.'});
  await subject.component.makeOnEdit(0)({type: 'NS', ns: 'edited.example.'});
  subject.component.onRemove(0);

  t.deepEqual(subject.component.state.updatedResource.records, []);
  t.equal(subject.component.state.isDirty, true);
  t.end();
});

test('Records deeplink additions remain staged as dirty local edits', t => {
  let cleared = 0;
  const subject = makeRecords({
    resource: {records: []},
    deeplinkParams: {ns: 'deeplink.example.'},
    clearDeeplinkParams() {
      cleared += 1;
    },
  });
  const nextState = Records.getDerivedStateFromProps(
    subject.component.props,
    subject.component.state
  );

  t.deepEqual(nextState.updatedResource.records, [{type: 'NS', ns: 'deeplink.example.'}]);
  t.equal(nextState.isDirty, true);
  t.equal(cleared, 1, 'deeplink parameters are cleared after staging');
  t.end();
});

test('Records hides an unresolved empty draft behind canonical loading and failure states', t => {
  const loading = makeRecords({canonicalLoading: true});
  const loadingHtml = renderToStaticMarkup(loading.component.render());
  t.match(loadingHtml, /Refreshing canonical records from the name tree/);
  t.notOk(/Add Record/.test(loadingHtml));

  const failed = makeRecords({canonicalError: 'name lookup timed out'});
  const failedHtml = renderToStaticMarkup(failed.component.render());
  t.match(failedHtml, /editable draft has not been changed/);
  t.match(failedHtml, /Refresh records/);
  t.notOk(/Add Record/.test(failedHtml));
  t.end();
});

test('Records import stages review without invoking the wallet update action', async t => {
  const subject = makeRecords();
  await subject.component.onImportProposal();
  t.equal(subject.loadCalls(), 1, 'canonical state is independently loaded');
  t.equal(subject.sendCalls(), 0, 'import does not invoke sendUpdate');
  t.ok(subject.component.state.importReview, 'a separate review is staged');
  t.deepEqual(subject.component.state.updatedResource, subject.component.state.importReview.afterResource);
  const reviewHtml = renderToStaticMarkup(subject.component.renderImportReview());
  t.match(reviewHtml, /Canonical before/);
  t.match(reviewHtml, /Complete result/);
  t.match(reviewHtml, /203\.0\.113\.8/);
  t.match(reviewHtml, /Import did not unlock, sign, broadcast, or update/);
  t.end();
});

test('Records submit rechecks canonical state before invoking the wallet action', async t => {
  const subject = makeRecords();
  const review = require('../../../utils/activateProposal').parseActivateProposal(JSON.stringify(fixture), {
    expectedName: 'example',
    expectedNetwork: 'main',
    currentResourceHex: '00',
  });
  subject.component.state = {
    ...subject.component.state,
    updatedResource: review.afterResource,
    importReview: review,
  };
  await subject.component.sendUpdate();
  t.equal(subject.loadCalls(), 1, 'canonical state is fetched again');
  t.equal(subject.sendCalls(), 1, 'submit invokes the existing wallet action only after the check');
  t.end();
});


test('ShakeX listing stages review without sending', async t => {
  let current = '00';
  const {component, sendCalls} = makeRecords({
    async loadCanonicalNameInfo() { return {info: {data: current}}; },
  });
  await component.onStageSale({price: '5000', contact: 'X @alice'});
  t.equal(sendCalls(), 0, 'staging never sends a transaction');
  t.equal(component.state.importReview.kind, 'shakex', 'uses sale review');
  t.equal(component.state.updatedResource.records.length, 2, 'stages price and contact');
  t.ok(component.state.isDirty, 'requires explicit submit');
  t.end();
});

test('ShakeX listing rejects dirty drafts and pending transfers', async t => {
  const dirty = makeRecords();
  dirty.component.state.isDirty = true;
  await dirty.component.onStageSale({contact: 'X @alice'});
  t.equal(dirty.loadCalls(), 0, 'does not overwrite a dirty draft');
  const transferring = makeRecords({transferring: true});
  await transferring.component.onStageSale({contact: 'X @alice'});
  t.equal(transferring.loadCalls(), 0, 'does not stage during a transfer');
  const valid = makeRecords();
  await valid.component.onStageSale({contact: 'X @alice'});
  await valid.component.sendUpdate();
  t.equal(valid.sendCalls(), 1, 'explicit submit uses existing wallet action');
  t.end();
});


for (const mode of [
  {label: 'watch-only', watchOnly: true, type: 'pubkeyhash'},
  {label: 'hardware-backed watch-only', watchOnly: true, type: 'pubkeyhash', hardware: true},
  {label: 'multisig', watchOnly: false, type: 'multisig', m: 2, n: 3},
]) {
  test(`ShakeX ${mode.label} fixture stages only for owner and delegates explicit submit`, async t => {
    const subject = makeRecords({...mode});
    await subject.component.onStageSale({price: '5000', contact: 'X @alice'});
    t.equal(subject.sendCalls(), 0, 'staging does not sign or submit');
    t.equal(subject.component.state.importReview.kind, 'shakex');
    await subject.component.sendUpdate();
    t.equal(subject.sendCalls(), 1, 'explicit submit delegates to the existing host action');
    const denied = makeRecords({...mode, domain: {isOwner: false}});
    await denied.component.onStageSale({contact: 'X @alice'});
    t.equal(denied.loadCalls(), 0, 'non-owner cannot stage');
    t.equal(denied.sendCalls(), 0);
    t.end();
  });
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}

function changeContext(component, changes) {
  component.props = {...component.props, ...changes};
  component.state = {...component.state, ...Records.getDerivedStateFromProps(component.props, component.state)};
}

for (const fails of [false, true]) {
  test(`ShakeX staging ignores ${fails ? 'failed' : 'successful'} lookup after unmount`, async t => {
    const lookup = deferred();
    const subject = mountRecords({loadCanonicalNameInfo: () => lookup.promise});
    const component = subject.wrapper.instance();
    const pending = component.onStageSale({contact: 'X @alice'});
    subject.wrapper.unmount();
    let updates = 0;
    component.setState = () => updates++;
    if (fails) lookup.reject(new Error('old lookup failed')); else lookup.resolve({info: {data: '00'}});
    await pending;
    t.equal(updates, 0, 'no stale success/error/finally updates');
    t.end();
  });
}

test('ShakeX old staging error cannot clear a new wallet draft operation', async t => {
  const oldLookup = deferred(), newLookup = deferred();
  let calls = 0;
  const {component} = makeRecords({walletId: 'a', loadCanonicalNameInfo: () => (++calls === 1 ? oldLookup.promise : newLookup.promise)});
  const oldStage = component.onStageSale({contact: 'old'});
  component.state = {...component.state, isUpdating: true, isRefreshingRecords: true, errorMessage: 'old error'};
  changeContext(component, {walletId: 'b', walletGeneration: 2});
  t.equal(component.state.isImporting, false);
  t.equal(component.state.isUpdating, false);
  t.equal(component.state.isRefreshingRecords, false);
  t.equal(component.state.errorMessage, '');
  const newStage = component.onStageSale({contact: 'new'});
  oldLookup.reject(new Error('old lookup failed'));
  await oldStage;
  t.equal(component.state.isImporting, true, 'old finally does not clear newer busy state');
  t.equal(component.state.errorMessage, '', 'old error is suppressed');
  newLookup.resolve({info: {data: '00'}});
  await newStage;
  t.equal(component.state.importReview.afterResource.records[0].txt[0], 'v=FORSALE1;ftxt=new');
  t.equal(component.state.isImporting, false);
  t.end();
});

for (const boundary of ['canonical', 'unlock']) {
  for (const transition of ['unmount', 'wallet-switch', 'switch-back']) {
    test(`ShakeX submit blocks ${boundary} continuation after ${transition}`, async t => {
      const gate = deferred(), entered = deferred();
      let broadcasts = 0, calls = 0;
      const {component} = makeRecords({walletId: 'a', walletGeneration: 1,
        async sendUpdate(name, resource, review, assertActive) {
          calls++;
          entered.resolve();
          await gate.promise;
          await review();
          assertActive();
          broadcasts++;
          return null;
        },
      });
      await component.onStageSale({contact: 'alice'});
      if (boundary === 'canonical') component.props.loadCanonicalNameInfo = () => {entered.resolve(); return gate.promise;};
      const pending = component.sendUpdate();
      await entered.promise;
      if (transition === 'unmount') component.componentWillUnmount();
      else {
        changeContext(component, {walletId: 'b', walletGeneration: 2});
        if (transition === 'switch-back') changeContext(component, {walletId: 'a', walletGeneration: 1});
      }
      let updates = 0;
      component.setState = () => updates++;
      gate.resolve({info: {data: '00'}});
      await pending;
      t.equal(broadcasts, 0, 'no wallet broadcast');
      t.equal(calls, boundary === 'canonical' ? 0 : 1, 'host entered only after canonical preflight');
      t.equal(updates, 0, 'stale completion/error does not touch current UI');
      t.end();
    });
  }
}

for (const transition of ['unmount', 'wallet-switch']) {
  test(`ShakeX already-sent completion is ignored after ${transition}`, async t => {
    const result = deferred(), sent = deferred();
    let broadcasts = 0, success = 0;
    const {component} = makeRecords({walletId: 'a',
      showSuccess: () => success++,
      async sendUpdate(name, resource, review, assertActive) {
        await review();
        assertActive();
        broadcasts++;
        sent.resolve();
        return result.promise;
      },
    });
    await component.onStageSale({contact: 'alice'});
    const pending = component.sendUpdate();
    await sent.promise;
    if (transition === 'unmount') component.componentWillUnmount();
    else changeContext(component, {walletId: 'b', walletGeneration: 2});
    let updates = 0;
    component.setState = () => updates++;
    result.resolve({hash: 'already sent'});
    await pending;
    t.equal(broadcasts, 1, 'already-sent transaction is not aborted or retried');
    t.equal(updates, 0, 'new UI state is untouched');
    t.equal(success, 0, 'no success toast in a stale context');
    t.end();
  });
}

test('activation import ignores a file dialog result after context changes', async t => {
  const dialog = deferred();
  let reads = 0;
  const {component} = makeRecords({walletId: 'a', openProposalFile: () => dialog.promise,
    readProposalFile: async () => {reads++; return Buffer.from(JSON.stringify(fixture));},
  });
  const pending = component.onImportProposal();
  changeContext(component, {walletId: 'b'});
  dialog.resolve({filePaths: ['/authorized/proposal.json']});
  await pending;
  t.equal(reads, 0);
  t.equal(component.state.importReview, null);
  t.equal(component.state.isImporting, false);
  t.end();
});
