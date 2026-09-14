'use strict';
// Packaging checks only: never load the bridge or access a running VPN.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const json = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, ''));
const version = json('package.json').version;
assert.match(version, /^\d+\.\d+\.\d+$/);
assert.equal(json('plugin/package.json').version, version);
assert.equal(json('plugin/manifest.json').Version, version);
assert.equal(json('plugin/package-lock.json').version, version);
assert.equal(json('plugin/package-lock.json').packages['node_modules/ws'].version, json('plugin/package.json').dependencies.ws);
if (process.env.GITHUB_REF_TYPE === 'tag') assert.equal(process.env.GITHUB_REF_NAME, 'v' + version);
const base = 'dist/com.rucard.amnezia.sdPlugin/';
for (const file of ['manifest.json', 'index.js', 'config.js', 'inspector.html', 'bin/AmneziaBridge.exe',
  'images/connected.png', 'images/disconnected.png', 'node_modules/ws/index.js', 'node_modules/ws/LICENSE',
  'LICENSE', 'README.md', 'THIRD_PARTY_NOTICES.md', 'docs/README.en.md']) {
  assert.ok(fs.statSync(path.join(root, base, file)).size > 0, file);
}
assert.ok(fs.existsSync(path.join(root, 'dist/Install-AmneziaPlugin.ps1')));
assert.ok(fs.existsSync(path.join(root, 'docs/releases/v' + version + '.md')));
assert.equal(json(base + 'manifest.json').Version, version);
const archive = fs.readFileSync(path.join(root, 'dist/AmneziaVPN-AJAZZ.zip'));
const hash = crypto.createHash('sha256').update(archive).digest('hex');
assert.equal(fs.readFileSync(path.join(root, 'dist/SHA256SUMS.txt'), 'utf8').trim(), hash + '  AmneziaVPN-AJAZZ.zip');
function inspect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    assert.ok(!/^(?:\.git|\.env|\.research|artifacts)$|\.(?:log|pem|pfx|p12)$/i.test(entry.name), 'Private/build artifact: ' + entry.name);
    if (entry.isDirectory()) inspect(path.join(directory, entry.name));
  }
}
inspect(path.join(root, base));
console.log('PASS: version ' + version + ', package contents, dependency lock and ZIP SHA-256; no VPN access');
