'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { once } = require('node:events');
const { queryDaemon, withBackgroundStatus } = require('../plugin/background');

async function daemon(t, respond) {
  const server = net.createServer(socket => {
    socket.on('error', () => {});
    socket.on('data', data => {
      assert.equal(data.toString(), '{"type":"status"}\n');
      respond(socket);
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  return { connect: () => net.connect(server.address().port, '127.0.0.1'), timeout: 200 };
}

test('hidden window reads status only, handles split frames and strips private fields', async t => {
  const options = await daemon(t, socket => {
    socket.write('{"type":"sta');
    socket.end('tus","connected":true,"date":"valid","serverIpv4Gateway":"private"}\n');
  });
  const result = await withBackgroundStatus({ state: 'unknown', backgroundAvailable: true }, () => queryDaemon(options));
  assert.equal(result.state, 'connected');
  assert.equal(result.invoked, false);
  assert.equal('serverIpv4Gateway' in result, false);
});

test('disconnected and waiting for handshake are distinct', async t => {
  for (const [message, expected] of [[{ connected: false }, 'disconnected'], [{ connected: true, date: '' }, 'busy']]) {
    const options = await daemon(t, socket => socket.end(JSON.stringify({ type: 'status', ...message }) + '\n'));
    assert.equal((await queryDaemon(options)).state, expected);
  }
});

test('visible or unavailable client never queries background service', async () => {
  for (const value of [{ state: 'connected' }, { state: 'busy' }, { state: 'unavailable' }, { state: 'unknown', backgroundAvailable: false }]) {
    assert.equal(await withBackgroundStatus(value, () => { throw new Error('must not query'); }), value);
  }
});

test('malformed or missing service state remains unknown', async t => {
  for (const answer of ['{"type":"status","connected":"false"}\n', 'broken\n', '']) {
    const options = await daemon(t, socket => socket.end(answer));
    const result = await withBackgroundStatus({ state: 'unknown', backgroundAvailable: true }, () => queryDaemon(options));
    assert.equal(result.state, 'unknown');
  }
});

test('auto never treats an inactive WG service as proof XRay or OpenVPN is off', async () => {
  const ui = { state: 'unknown', backgroundAvailable: true, applicationVersion: '4.8.19.0', windowState: 'hidden' };
  const query = async () => ({ state: 'disconnected', invoked: false });
  assert.equal((await withBackgroundStatus(ui, query, 'auto')).state, 'unknown');
  assert.equal((await withBackgroundStatus(ui, query, 'wg')).state, 'disconnected');
  let calls = 0;
  assert.equal((await withBackgroundStatus(ui, async () => { calls++; return query(); }, 'ui')).state, 'unknown');
  assert.equal(calls, 0);
});
