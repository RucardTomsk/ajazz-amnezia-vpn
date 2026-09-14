'use strict';
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const WebSocket = require('ws');
const { Controller } = require('./core');
const { withBackgroundStatus } = require('./background');
const { normalize } = require('./config');

function bridge(command, desired, configuration = {}) {
  if (command !== 'status' && (command !== 'set' || !['connected', 'disconnected'].includes(desired)))
    return Promise.reject(new Error('Invalid bridge command'));
  const config = normalize(configuration);
  const args = command === 'status' ? ['status'] : ['set', desired, '--allow-control'];
  args.push('--config', Buffer.from(JSON.stringify(config), 'utf8').toString('base64'));
  const result = new Promise((resolve, reject) => {
    execFile(path.join(__dirname, 'bin', 'AmneziaBridge.exe'), args,
      { windowsHide: true, timeout: config.timeoutSeconds * 1000, maxBuffer: 16384, encoding: 'utf8' }, (error, stdout) => {
        if (error) return reject(error);
        try { resolve(JSON.parse(stdout.replace(/^\uFEFF/, '').trim())); } catch (e) { reject(e); }
      });
  });
  return command === 'status' ? result.then(value => withBackgroundStatus(value, undefined, config.statusMode)) : result;
}

function start(args, dependencies = {}) {
  const options = {};
  for (let i = 0; i < args.length - 1; i += 2) options[args[i]] = args[i + 1];
  const port = Number(options['-port']);
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !options['-pluginUUID'] ||
      options['-registerEvent'] !== 'registerPlugin') throw new Error('Missing Stream Dock launch arguments');
  const images = {};
  for (const state of ['connected', 'disconnected', 'busy', 'error', 'unknown', 'unavailable']) {
    images[state] = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, 'images', state + '.png')).toString('base64');
  }
  const titles = { connected: 'ВКЛ', disconnected: 'ВЫКЛ', busy: 'ЖДИТЕ', error: 'ОШИБКА', unknown: '?', unavailable: 'НЕТ APP' };
  let socket;
  let stopped = false;
  let reconnect;
  let config = normalize(), globalSettings = {}, settingsReady = false, configurationError = '';
  const lastRender = new Map();
  const rawSend = message => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  const configuredBridge = (command, desired) => {
    if (!settingsReady || configurationError) return Promise.resolve({ state: 'unknown', invoked: false,
      detail: configurationError || 'Загрузка настроек плагина' });
    return (dependencies.bridge || bridge)(command, desired, config);
  };
  const controller = new Controller({ bridge: configuredBridge, send(message) {
    if (message.event !== 'render') return rawSend(message);
    const { state, monitoringOnly } = message.payload;
    const signature = state + ':' + monitoringOnly;
    if (lastRender.get(message.context) === signature) return;
    if (socket?.readyState !== WebSocket.OPEN) return;
    lastRender.set(message.context, signature);
    rawSend({ event: 'setImage', context: message.context, payload: { image: images[state], target: 0 } });
    rawSend({ event: 'setTitle', context: message.context, payload: {
      title: titles[state] + (monitoringOnly ? ' · R' : ''), target: 0 } });
  } });
  const reply = (context, payload) => rawSend({ event: 'sendToPropertyInspector', action: 'com.rucard.amnezia.toggle', context, payload });
  function applyConfiguration(settings) {
    globalSettings = settings;
    settingsReady = true;
    try {
      const next = normalize(settings.configuration || {});
      if (JSON.stringify(next) !== JSON.stringify(config) || configurationError) controller.invalidateConfiguration();
      config = next;
      configurationError = '';
    } catch (error) { configurationError = error.message; controller.invalidateConfiguration(); }
    controller.refresh().catch(() => {});
  }
  async function inspectMessage(message) {
    const payload = message.payload || {};
    if (payload.command === 'saveConfiguration') {
      try {
        if (!settingsReady) throw new Error('Настройки ещё загружаются. Повторите сохранение.');
        if (controller.operation || controller.pending) throw new Error('Дождитесь завершения переключения VPN.');
        const next = normalize(payload.configuration);
        const settings = { ...globalSettings, configuration: next };
        rawSend({ event: 'setGlobalSettings', context: options['-pluginUUID'], payload: settings });
        applyConfiguration(settings);
        reply(message.context, { kind: 'configurationSaved', configuration: next });
      } catch (error) { reply(message.context, { kind: 'configurationError', detail: error.message }); }
      return;
    }
    if (payload.command === 'diagnose') {
      try {
        const status = await configuredBridge('status');
        let host = {};
        try { host = JSON.parse(options['-info'] || '{}').application || {}; } catch { }
        reply(message.context, { kind: 'diagnostics', ...status, runtime: process.version,
          platform: process.platform, architecture: process.arch, hostVersion: host.version || '', configuration: config });
      } catch { reply(message.context, { kind: 'diagnostics', state: 'unknown',
        detail: 'Мост не ответил. Проверьте .NET Framework, права приложений и время ожидания в настройках.' }); }
      return;
    }
    return controller.handle(message);
  }
  function connect() {
    socket = new WebSocket('ws://127.0.0.1:' + port);
    socket.on('open', () => {
      lastRender.clear();
      rawSend({ event: options['-registerEvent'], uuid: options['-pluginUUID'] });
      rawSend({ event: 'getGlobalSettings', context: options['-pluginUUID'] });
      controller.publishAll();
    });
    socket.on('message', data => {
      let message;
      try { message = JSON.parse(data.toString()); } catch { return; }
      if (message.event === 'exitApp') return stop();
      if (message.event === 'didReceiveGlobalSettings') return applyConfiguration(message.payload?.settings || {});
      if (message.event === 'willAppear' || message.event === 'willDisappear') lastRender.delete(message.context);
      if (message.event === 'sendToPlugin' && message.action === 'com.rucard.amnezia.toggle') {
        inspectMessage(message).catch(() => {});
        return;
      }
      controller.handle(message).catch(() => {});
    });
    socket.on('error', () => {});
    socket.on('close', () => {
      // Invalidate settings so a stale context cannot issue commands after reconnect.
      controller.contexts.clear();
      settingsReady = false;
      lastRender.clear();
      if (!stopped) reconnect = setTimeout(connect, 2000);
    });
  }
  const timer = setInterval(() => {
    if (controller.contexts.size) controller.refresh().catch(() => {});
  }, 2000);
  function stop() {
    stopped = true;
    controller.contexts.clear();
    clearInterval(timer);
    clearTimeout(reconnect);
    socket?.terminate();
  }
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  connect();
  return { controller, stop };
}

if (require.main === module) {
  try { start(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exitCode = 1; }
}
module.exports = { start, bridge };
