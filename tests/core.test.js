'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Controller, ACTION } = require('../plugin/core');

function harness(state = 'connected', enabled = true) {
  const calls = [], messages = [];
  let current = state, clock = 100000;
  const controller = new Controller({
    now: () => clock,
    bridge: async (command, desired) => {
      calls.push([command, desired]);
      return command === 'status' ? { state: current } : { state: 'busy', invoked: true };
    },
    send: message => messages.push(message),
  });
  controller.contexts.set('key1', { enableControl: enabled });
  return { controller, calls, messages, setState: s => { current = s; }, advance: ms => { clock += ms; } };
}

test('default settings and startup never control VPN', async () => {
  const h = harness();
  await h.controller.handle({ event: 'willAppear', context: 'new', action: ACTION, payload: { settings: {} } });
  await h.controller.handle({ event: 'keyUp', context: 'new', action: ACTION });
  assert.ok(h.calls.every(([command]) => command === 'status'));
  assert.equal(h.controller.status.state, 'connected');
});

test('both explicit desired-state commands use a fresh read', async () => {
  for (const [initial, desired] of [['connected', 'disconnected'], ['disconnected', 'connected']]) {
    const h = harness(initial);
    await h.controller.toggle('key1');
    assert.deepEqual(h.calls, [['status', undefined], ['set', desired]]);
    assert.equal(h.controller.status.state, 'busy');
    assert.equal(h.controller.pending.desired, desired);
    h.setState(desired);
    await h.controller.refresh();
    assert.equal(h.controller.status.state, desired);
    assert.equal(h.controller.pending, null);
  }
});

test('unknown, transition, errors and missing app never toggle', async () => {
  for (const state of ['unknown', 'unavailable', 'busy', 'error', 'invalid']) {
    const h = harness(state);
    await h.controller.toggle('key1');
    assert.equal(h.calls.length, 1);
  }
});

test('simultaneous buttons, keyDown and repeated keyUp invoke only once', async () => {
  const h = harness();
  h.controller.contexts.set('key2', { enableControl: true });
  await h.controller.handle({ event: 'keyDown', context: 'key1' });
  assert.equal(h.calls.length, 0);
  await Promise.all([h.controller.toggle('key1'), h.controller.toggle('key2'), h.controller.toggle('key1')]);
  h.advance(5000);
  await h.controller.toggle('key1');
  assert.equal(h.calls.filter(([c]) => c === 'set').length, 1);
});

test('manual Amnezia state changes update every visible button', async () => {
  const h = harness();
  h.controller.contexts.set('key2', {});
  await h.controller.refresh();
  h.setState('disconnected');
  await h.controller.refresh();
  const renders = h.messages.filter(m => m.event === 'render').slice(-2);
  assert.equal(renders.length, 2);
  assert.ok(renders.every(m => m.payload.state === 'disconnected'));
  assert.equal(renders[1].payload.monitoringOnly, true);
});

test('timeout never retries an uncertain command', async () => {
  const h = harness();
  h.controller.bridge = async command => {
    h.calls.push([command]);
    if (command === 'set') throw new Error('timeout');
    return { state: 'connected' };
  };
  await h.controller.toggle('key1');
  h.advance(5000);
  await h.controller.toggle('key1');
  assert.deepEqual(h.calls.map(c => c[0]), ['status', 'set']);
  assert.equal(h.controller.status.state, 'unknown');
});

test('confirmation timeout reports error without another command', async () => {
  const h = harness();
  await h.controller.toggle('key1');
  h.advance(31000);
  await h.controller.refresh();
  assert.equal(h.controller.status.state, 'error');
  assert.equal(h.controller.pending, null);
  assert.equal(h.calls.filter(([c]) => c === 'set').length, 1);
});

test('revoking control during status query prevents invocation', async () => {
  const h = harness();
  let release;
  h.controller.bridge = () => new Promise(resolve => { release = resolve; });
  const work = h.controller.toggle('key1');
  h.controller.contexts.set('key1', { enableControl: false });
  release({ state: 'connected' });
  await work;
  assert.equal(h.controller.pending, null);
});

test('foreign actions, removed contexts and string true cannot toggle', async () => {
  const h = harness();
  await h.controller.handle({ event: 'keyUp', action: 'foreign', context: 'key1' });
  await h.controller.handle({ event: 'willDisappear', context: 'key1' });
  await h.controller.toggle('key1');
  h.controller.contexts.set('string', { enableControl: 'true' });
  await h.controller.toggle('string');
  assert.equal(h.calls.length, 0);
});

test('changing computer configuration while reading state cancels the queued command', async () => {
  const h = harness();
  let release;
  h.controller.bridge = command => {
    h.calls.push([command]);
    return new Promise(resolve => { release = resolve; });
  };
  const work = h.controller.toggle('key1');
  h.controller.invalidateConfiguration();
  release({ state: 'connected' });
  await work;
  assert.deepEqual(h.calls, [['status']]);
});
