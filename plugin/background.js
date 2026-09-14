'use strict';
const net = require('node:net');

// Amnezia's local AmneziaWG/WireGuard service accepts newline-delimited JSON.
// This module deliberately exposes no activate/deactivate command.
function queryDaemon({ connect = () => net.connect('\\\\.\\pipe\\amneziavpn'), timeout = 1200 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = connect();
    let buffer = '', finished = false;
    const timer = setTimeout(() => finish(new Error('Amnezia status timeout')), timeout);
    function finish(error, value) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      socket.destroy();
      if (error) reject(error); else resolve(value);
    }
    socket.on('connect', () => socket.write('{"type":"status"}\n'));
    socket.on('error', error => finish(error));
    socket.on('close', () => finish(new Error('Amnezia closed status channel')));
    socket.on('data', data => {
      buffer += data.toString('utf8');
      if (buffer.length > 32768) return finish(new Error('Amnezia status too large'));
      let newline;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        let message;
        try { message = JSON.parse(line); } catch { return finish(new Error('Invalid Amnezia status')); }
        if (message.type !== 'status') continue;
        if (typeof message.connected !== 'boolean') return finish(new Error('Missing Amnezia connection state'));
        // Only return connection state; never expose gateway, keys or counters.
        return finish(null, {
          state: message.connected ? (message.date === '' ? 'busy' : 'connected') : 'disconnected',
          detail: 'Фоновое состояние AmneziaWG', invoked: false, source: 'amneziawg-service',
        });
      }
    });
  });
}

async function withBackgroundStatus(uiStatus, query = queryDaemon, mode = 'auto') {
  if (uiStatus.state !== 'unknown' || uiStatus.backgroundAvailable !== true) return uiStatus;
  if (mode === 'ui') return { ...uiStatus, detail: 'Откройте окно AmneziaVPN или сверните его на панель задач. Для выбранного режима статус из трея недоступен.' };
  try {
    const result = await query();
    // A disconnected WG service says nothing about an active XRay/OpenVPN tunnel.
    if (mode !== 'wg' && result.state === 'disconnected') return { ...uiStatus,
      detail: 'Выберите AmneziaWG / WireGuard в настройках плагина, если используете этот протокол. Иначе откройте AmneziaVPN.' };
    return { ...uiStatus, ...result, windowState: uiStatus.windowState };
  }
  catch { return { ...uiStatus, detail: 'Фоновое состояние недоступно. Откройте AmneziaVPN.' }; }
}

module.exports = { queryDaemon, withBackgroundStatus };
