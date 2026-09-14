'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { WebSocketServer } = require('../plugin/node_modules/ws');
const { start } = require('../plugin/index');
const { ACTION } = require('../plugin/core');

test('host registration, images, read-only key and exit over a real WebSocket', { timeout: 8000 }, async t => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const calls = [];
  const configurations = [];
  const connected = once(server, 'connection');
  const app = start(['-port', String(server.address().port), '-pluginUUID', 'test-uuid', '-registerEvent', 'registerPlugin', '-info', '{}'], {
    bridge: async (command, desired, configuration) => { calls.push(command); configurations.push(configuration); return { state: 'connected', invoked: false }; },
  });
  t.after(() => { app.stop(); for (const client of server.clients) client.terminate(); server.close(); });
  const [socket] = await connected;
  const messages = [];
  let onMessage;
  socket.on('message', data => { const message = JSON.parse(data); messages.push(message); onMessage?.(message); });
  function waitFor(predicate) {
    const existing = messages.find(predicate);
    if (existing) return Promise.resolve(existing);
    return new Promise(resolve => { onMessage = message => { if (predicate(message)) { onMessage = null; resolve(message); } }; });
  }
  assert.deepEqual(await waitFor(m => m.event === 'registerPlugin'), { event: 'registerPlugin', uuid: 'test-uuid' });
  await waitFor(m => m.event === 'getGlobalSettings');
  socket.send(JSON.stringify({ event: 'didReceiveGlobalSettings', payload: { settings: {} } }));
  socket.send(JSON.stringify({ event: 'willAppear', action: ACTION, context: 'key', payload: { settings: {} } }));
  await waitFor(m => m.event === 'setTitle' && m.payload.title === 'ВКЛ · R');
  assert.ok(messages.some(m => m.event === 'setImage' && m.payload.image.startsWith('data:image/png;base64,iVBOR')));
  socket.send(JSON.stringify({ event: 'keyUp', action: ACTION, context: 'key' }));
  await waitFor(m => m.event === 'showAlert');
  assert.ok(calls.length >= 1 && calls.every(command => command === 'status'));
  socket.send(JSON.stringify({ event: 'sendToPlugin', action: ACTION, context: 'key',
    payload: { command: 'saveConfiguration', configuration: { statusMode: 'wg', timeoutSeconds: 12 } } }));
  const saved = await waitFor(m => m.event === 'setGlobalSettings');
  assert.equal(saved.context, 'test-uuid');
  assert.equal(saved.payload.configuration.statusMode, 'wg');
  await waitFor(m => m.payload?.kind === 'configurationSaved');
  socket.send(JSON.stringify({ event: 'sendToPlugin', action: ACTION, context: 'key', payload: { command: 'diagnose' } }));
  const diagnosis = await waitFor(m => m.payload?.kind === 'diagnostics');
  assert.equal(diagnosis.payload.state, 'connected');
  assert.equal(diagnosis.payload.configuration.timeoutSeconds, 12);
  assert.equal(configurations.at(-1).statusMode, 'wg');
  assert.ok(calls.every(command => command === 'status'), 'Saving and diagnostics never control VPN');
  socket.send(JSON.stringify({ event: 'sendToPlugin', action: ACTION, context: 'key',
    payload: { command: 'saveConfiguration', configuration: { executablePath: 'relative.exe' } } }));
  await waitFor(m => m.payload?.kind === 'configurationError');
  assert.equal(messages.filter(m => m.event === 'setGlobalSettings').length, 1);
  const closed = once(socket, 'close');
  socket.send(JSON.stringify({ event: 'exitApp' }));
  await closed;
});
