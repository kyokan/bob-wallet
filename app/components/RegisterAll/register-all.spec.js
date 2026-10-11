import test from 'tape';
import sinon from 'sinon';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {sendRegisterAll} from '../../ducks/names';
import walletClient from '../../utils/walletClient';
import {RegisterAll} from './index';

function fixture(overrides = {}) {
  const component = new RegisterAll({walletId: 'disposable', network: 'regtest', requestGeneration: 1,
    eligibilityReady: true, registerable: {num: 2, HNS: 100, verified: false},
    submit: async () => null, getStatus: async () => null, cancel: async () => true, ...overrides});
  component.context = {t: key => key};
  component.setState = patch => {component.state = {...component.state, ...patch};};
  component.mounted = true;
  component.state.loaded = true;
  return component;
}

test('registration empty/confirmed UI has no start button; pending and uncertain journals remain visible', t => {
  const html = component => renderToStaticMarkup(component.render());
  const empty = fixture({registerable: {num: 0}});
  t.equal(html(empty), '', 'known empty has no unnecessary control');
  empty.state.operation = {status: 'complete', settledComplete: true, eligibleCount: 0, entries: []};
  t.equal(html(empty), '', 'legacy 0/0 journal is not outstanding work');
  empty.state.operation.eligibleCount = 1;
  t.equal(empty.canStart(), true, 'fresh names are allowed after empty settled history');
  empty.state.operation.entries = [{name: 'old', status: 'skipped'}];
  t.equal(empty.canStart(), true, 'skipped history cannot permanently block new work');
  const c = fixture();
  c.state.operation = {status: 'complete', entries: [{name: 'fixture', status: 'submitted', stage: 'submitted', txid: 'aa'.repeat(32)}]};
  t.notOk(html(c).includes('<button'), 'stale eligible count cannot restart submitted batch');
  t.ok(html(c).includes('registrationPendingConfirmation'));
  t.notOk(html(c).includes('submitted /'), 'matching stage/status is rendered once');
  c.state.operation.confirmedComplete = true;
  c.state.operation.eligibleCount = 0;
  t.ok(html(c).includes('registrationHistory'));
  t.notOk(html(c).includes('registrationProgress'), 'confirmed result archived out of active panel');
  t.ok(html(c).includes('aa'.repeat(32)), 'receipt remains accessible');
  c.state.operation.confirmedComplete = false;
  c.state.operation.retryLocked = true;
  c.state.operation.status = 'paused';
  c.props = {...c.props, registerable: {num: 0}};
  t.ok(html(c).includes('registrationUncertain'), 'zero eligible never hides uncertainty');
  t.end();
});

test('registration recovery remains visible while synchronization blocks new work', t => {
  const component = fixture({eligibilityReady: false});
  component.state.operation = {status: 'paused', retryLocked: true, entries: [{name: 'one', status: 'unknown', txid: 'aa'.repeat(32)}]};
  t.notOk(component.canStart());
  t.ok(renderToStaticMarkup(component.render()).includes('registrationUncertain'));
  component.state.operation.running = true;
  t.ok(renderToStaticMarkup(component.render()).includes('registrationStop'), 'Stop remains available');
  t.end();
});

test('registration authoritative preflight precedes password and rejects empty, uncertain or switched scope', async t => {
  const originalStatus = walletClient.getRegisterAllStatus;
  const originalSend = walletClient.sendRegisterAll;
  let prompts = 0; let sends = 0;
  const state = {wallet: {wid: 'fixture', network: 'regtest', requestGeneration: 1}};
  const getState = () => state;
  const dispatch = action => typeof action === 'function' ? action(dispatch, getState) : (() => {prompts++; action.payload.resolve('fixture');})();
  walletClient.sendRegisterAll = async () => {sends++; return {noWork: true};};
  try {
    for (const result of [{eligibleCount: 0}, {eligibleCount: 2, operation: {retryLocked: true}}, {}]) {
      walletClient.getRegisterAllStatus = async () => result;
      try {await sendRegisterAll()(dispatch, getState); t.fail('must reject');} catch (error) {t.ok(error.message);}
    }
    t.equal(prompts, 0); t.equal(sends, 0);
    walletClient.getRegisterAllStatus = async () => {state.wallet.requestGeneration++; return {eligibleCount: 1};};
    try {await sendRegisterAll()(dispatch, getState); t.fail('must reject stale preflight');}
    catch (error) {t.match(error.message, /cancelled/);}
    t.equal(prompts, 0);
    walletClient.getRegisterAllStatus = async () => ({eligibleCount: 1});
    const result = await sendRegisterAll()(dispatch, getState);
    t.equal(prompts, 1); t.equal(sends, 1); t.equal(result.noWork, true, 'backend can still report eligibility changed after unlock');
  } finally {walletClient.getRegisterAllStatus = originalStatus; walletClient.sendRegisterAll = originalSend;}
  t.end();
});

test('registration preflight timeout cannot later request a password or send', async t => {
  const clock = sinon.useFakeTimers();
  const originalStatus = walletClient.getRegisterAllStatus;
  const originalSend = walletClient.sendRegisterAll;
  let resolve; let prompts = 0; let sends = 0;
  walletClient.getRegisterAllStatus = () => new Promise(r => {resolve = r;});
  walletClient.sendRegisterAll = async () => {sends++;};
  try {
    const state = {wallet: {wid: 'fixture', network: 'regtest', requestGeneration: 1}};
    const outcome = sendRegisterAll()(() => {prompts++;}, () => state).catch(error => error);
    await clock.tickAsync(60001);
    t.equal((await outcome).code, 'registrationPreflightTimeout');
    resolve({eligibleCount: 1});
    await clock.tickAsync(1);
    t.equal(prompts, 0); t.equal(sends, 0);
  } finally {clock.restore(); walletClient.getRegisterAllStatus = originalStatus; walletClient.sendRegisterAll = originalSend;}
  t.end();
});

test('Register All translates the failed stage in its recovery summary', t => {
  const component = fixture();
  const calls = [];
  component.context = {t: (key, ...args) => {calls.push([key, ...args]); return key === 'registrationState_broadcasting' ? 'translated-stage' : key;}};
  component.state.operation = {status: 'paused', failedName: 'fixture-name', failedStage: 'broadcasting', entries: []};
  component.render();
  t.deepEqual(calls.find(call => call[0] === 'registrationStoppedAt'), ['registrationStoppedAt', 'fixture-name', 'translated-stage']);
  t.end();
});

test('Register All component prevents duplicate clicks and ignores late results after unmount', async t => {
  let resolve; let calls = 0; const cancelled = [];
  const component = fixture({submit: () => {calls++; return new Promise(r => {resolve = r;});},
    cancel: async context => {cancelled.push(context); return true;}});
  const pending = component.start();
  await component.start();
  t.equal(calls, 1);
  component.componentWillUnmount();
  const state = component.state;
  resolve({transactions: [{name: 'one', txid: 'aa'.repeat(32)}]});
  await pending;
  t.equal(component.state, state, 'late completion cannot update unmounted UI');
  t.equal(cancelled.length, 1);
  t.equal(cancelled[0].walletId, 'disposable');
  t.ok(cancelled[0].operationId);
  t.end();
});

test('Register All component keeps an uncertain journal retry locked and retries failed cancellation', async t => {
  let calls = 0; let cancels = 0;
  const component = fixture({submit: async () => {calls++;}, cancel: async () => {
    cancels++;
    if (cancels === 1) throw new Error('IPC unavailable');
    return true;
  }});
  component.state.operation = {retryLocked: true};
  await component.start(); t.equal(calls, 0);
  component.operationContext = {walletId: 'disposable', network: 'regtest', operationId: 'fixture'};
  component.stop(); await Promise.resolve(); await Promise.resolve();
  t.ok(component.operationContext, 'failed cancellation keeps retryable context');
  t.equal(component.state.error, 'IPC unavailable');
  component.stop(); await Promise.resolve(); await Promise.resolve();
  t.equal(component.operationContext, null);
  t.equal(cancels, 2);
  t.end();
});

test('Register All component status timeout is bounded and stale wallet responses are ignored', async t => {
  const clock = sinon.useFakeTimers();
  try {
    let resolve;
    const component = fixture({getStatus: () => new Promise(r => {resolve = r;})});
    const pending = component.refresh();
    await clock.tickAsync(10001); await pending;
    t.equal(component.refreshing, false);
    t.equal(component.state.loaded, false);
    t.equal(component.state.error, 'registrationStatusTimeout');
    resolve({walletId: 'old-wallet'}); await Promise.resolve();
    t.equal(component.state.operation, null);
    const next = component.refresh();
    component.generation++;
    resolve({walletId: 'old-wallet'}); await next;
    t.equal(component.state.operation, null);
  } finally {clock.restore();}
  t.end();
});
