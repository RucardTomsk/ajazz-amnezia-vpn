'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize } = require('../plugin/config');
const { bridge } = require('../plugin/index');

test('portable defaults contain no username, server or install directory', () => {
  assert.deepEqual(normalize(), { statusMode: 'auto', executablePath: '', connectedText: '', disconnectedText: '', timeoutSeconds: 5 });
});

test('spaces, Cyrillic and literal shell characters in local paths are data', () => {
  const executablePath = 'D:\\Мои приложения\\Amnezia $HOME (portable)\\AmneziaVPN.exe';
  assert.equal(normalize({ executablePath }).executablePath, executablePath);
});

test('invalid paths, overlapping labels and wrong timeouts are rejected', () => {
  for (const config of [
    { executablePath: 'amnezia.exe' }, { executablePath: 'https://example.org/app.exe' },
    { executablePath: '\\\\server\\share\\AmneziaVPN.exe' }, { executablePath: 'C:\\app.exe --connect' },
    { executablePath: 'C:\\app.exe\n' }, { connectedText: 'Verbunden' },
    { connectedText: ' ON ', disconnectedText: 'on' },
    { connectedText: 'Connect', disconnectedText: 'Connected' },
    { connectedText: 'Connecting...', disconnectedText: 'Verbinden' },
    { timeoutSeconds: 0 }, { timeoutSeconds: 21 }, { timeoutSeconds: 3.5 }, { statusMode: 'xray' },
  ]) assert.throws(() => normalize(config));
});

test('custom labels and slow-PC timeout normalize without changing unrelated settings', () => {
  assert.deepEqual(normalize({ connectedText: ' Verbunden ', disconnectedText: ' Verbinden ', timeoutSeconds: '15', unknown: 'ignored' }),
    { statusMode: 'auto', executablePath: '', connectedText: 'Verbunden', disconnectedText: 'Verbinden', timeoutSeconds: 15 });
});

test('unknown bridge commands cannot launch a control action', async () => {
  await assert.rejects(bridge('diagnose'));
  await assert.rejects(bridge('set', 'toggle'));
});
