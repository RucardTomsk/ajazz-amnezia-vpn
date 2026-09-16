'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { once } = require('node:events');
const { withBackgroundStatus } = require('../plugin/background');

test('a running client without a window can report WG status before its first display',
  { skip: process.platform !== 'win32', timeout: 20000 }, async t => {
    const executablePath = path.resolve(__dirname, '../artifacts/BridgeTests.exe');
    const client = spawn(executablePath, ['--headless-client'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    t.after(async () => {
      if (client.exitCode === null && client.signalCode === null) {
        const exited = once(client, 'exit');
        client.kill();
        await exited;
      }
    });
    const [ready] = await once(client.stdout, 'data');
    assert.match(ready.toString(), /ready/);
    // The real compiled bridge performs process/window discovery. No real VPN is used.
    const { stdout } = await promisify(execFile)(path.resolve(__dirname, '../plugin/bin/AmneziaBridge.exe'),
      ['status', '--config', Buffer.from(JSON.stringify({ executablePath })).toString('base64')],
      { windowsHide: true, timeout: 10000, encoding: 'utf8' });
    const ui = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
    assert.equal(ui.state, 'unknown');
    assert.equal(ui.invoked, false);
    assert.equal(ui.backgroundAvailable, true);
    assert.equal(ui.windowState, 'uninitialized');
    assert.equal(ui.applicationPath.toLowerCase(), executablePath.toLowerCase());

    for (const state of ['connected', 'disconnected', 'busy']) {
      let queries = 0;
      const result = await withBackgroundStatus(ui, async () => {
        queries++;
        return { state, invoked: false, source: 'amneziawg-service' };
      }, 'wg');
      assert.equal(result.state, state);
      assert.equal(result.invoked, false);
      assert.equal(queries, 1);
    }
    const inactive = async () => ({ state: 'disconnected', invoked: false });
    assert.equal((await withBackgroundStatus(ui, inactive, 'auto')).state, 'unknown');
    let queries = 0;
    const windowOnly = await withBackgroundStatus(ui, async () => { queries++; return inactive(); }, 'ui');
    assert.equal(windowOnly.state, 'unknown');
    assert.equal(queries, 0);
    // Service startup may lag behind the GUI process; the next poll must recover.
    const unavailable = await withBackgroundStatus(ui, async () => { throw new Error('service starting'); }, 'wg');
    assert.equal(unavailable.state, 'unknown');
    const recovered = await withBackgroundStatus(ui, async () => ({ state: 'connected', invoked: false }), 'wg');
    assert.equal(recovered.state, 'connected');
  });
