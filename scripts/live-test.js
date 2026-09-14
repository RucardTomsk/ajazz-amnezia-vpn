'use strict';
// Explicit opt-in ONLY. Runs against the real VPN and restores the connection.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Controller, ACTION } = require('../plugin/core');
const { bridge: configuredBridge } = require('../plugin/index');
// This integration test verifies the WG service; explicitly select that protocol.
const bridge = (command, desired) => configuredBridge(command, desired, { statusMode: 'wg' });
const { queryDaemon } = require('../plugin/background');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const args = process.argv.slice(2);
if (!args.includes('--allow-vpn-toggle')) {
  console.error('Real VPN changes require --allow-vpn-toggle. This test ends with VPN connected.');
  process.exit(2);
}
const label = args.find(a => /^--mode=/.test(a))?.split('=')[1] || 'unspecified';
const holdOff = Number(args.find(a => /^--hold-off-ms=/.test(a))?.split('=')[1] || 3000);
if (!Number.isInteger(holdOff) || holdOff < 2000 || holdOff > 15000) throw new Error('Invalid hold duration');
const events = [];
const calls = [];
function log(type, value) {
  const event = { time: new Date().toISOString(), type, ...value };
  events.push(event);
  console.log(JSON.stringify(event));
}
const controller = new Controller({
  bridge: async (command, desired) => {
    const result = await bridge(command, desired);
    if (command === 'set') { calls.push({ desired, result }); log('command', { desired, ...result }); }
    return result;
  },
  send: message => {
    if (message.event === 'render') log('render', { state: message.payload.state });
    if (message.event === 'showAlert') log('alert', {});
  },
});
async function awaitState(expected, timeout = 30000) {
  const deadline = Date.now() + timeout;
  do {
    const status = await controller.refresh();
    const daemon = await queryDaemon();
    if (status.state === expected && daemon.state === expected) {
      log('verified', { state: expected, client: status.state, service: daemon.state });
      return;
    }
    await delay(500);
  } while (Date.now() < deadline);
  throw new Error('Timed out waiting for ' + expected);
}
async function main() {
  log('start', { mode: label });
  let changed = false;
  try {
    const initial = await bridge('status');
    assert.equal(initial.state, 'connected', 'Start with VPN connected');
    assert.equal(initial.windowState, label, 'Window must match the requested scenario');
    log('window', { state: initial.windowState });
    await controller.handle({ event: 'willAppear', action: ACTION, context: 'live-test', payload: { settings: {} } });
    await controller.handle({ event: 'keyUp', action: ACTION, context: 'live-test' });
    assert.equal(calls.length, 0, 'Read-only mode must never send control commands');
    controller.contexts.set('live-test', { enableControl: true });
    changed = true;
    const press = () => controller.handle({ event: 'keyUp', action: ACTION, context: 'live-test' });
    await Promise.all([press(), press(), press()]);
    assert.equal(calls.length, 1, 'Repeated presses must emit exactly one disconnect');
    assert.equal(calls[0].desired, 'disconnected');
    assert.equal(calls[0].result.invoked, true, 'Disconnect must actually invoke Amnezia');
    await awaitState('disconnected');
    // Keep the disconnected state briefly so the installed AJAZZ plugin can repaint.
    await delay(holdOff);
    await press();
    assert.equal(calls.length, 2, 'Second command must reconnect');
    assert.equal(calls[1].desired, 'connected');
    assert.equal(calls[1].result.invoked, true, 'Connect must actually invoke Amnezia');
    await awaitState('connected');
    await delay(2000);
    log('pass', { mode: label, commands: calls.length });
  } finally {
    if (changed) {
      // Idempotent restoration even if assertions fail; no blind toggle or retries.
      const current = await bridge('status');
      if (current.state === 'disconnected') log('restore', await bridge('set', 'connected'));
      const deadline = Date.now() + 30000;
      let final;
      do { final = await bridge('status'); if (final.state === 'connected') break; await delay(500); }
      while (Date.now() < deadline);
      log('final', { state: final.state, windowState: final.windowState });
      if (final.state !== 'connected') throw new Error('VPN could not be restored: ' + final.state);
    }
    const directory = path.join(__dirname, '..', 'artifacts');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'live-test-' + label.replace(/[^a-z-]/g, '') + '.json'), JSON.stringify(events, null, 2));
  }
}
main().catch(error => { log('fail', { error: error.message }); process.exitCode = 1; });
