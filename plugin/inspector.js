'use strict';
let socket, context, action, settings = {}, dirty = false, configurationLoaded = false;
const control = document.getElementById('control');
const notice = document.getElementById('notice');
const fields = Object.keys(AmneziaConfig.defaults);
function updateSettings(value) {
  settings = value || {};
  control.checked = settings.enableControl === true;
  document.getElementById('mode').textContent = control.checked
    ? 'Управление включено: нажатие переключает VPN.' : 'Только индикация: нажатие не меняет подключение.';
}
function help() {
  const messages = {
    auto: 'Когда окно скрыто, авто подтверждает активный AmneziaWG. Чтобы отличать выключенный VPN от другого протокола, выберите свой протокол явно.',
    wg: 'Фоновый статус из трея для AmneziaWG и WireGuard. Выбирайте этот режим только если данный протокол используется в Amnezia.',
    ui: 'Для XRay/OpenVPN оставьте главное окно открытым или свёрнутым на панель задач. Полное скрытие в трей не позволяет прочитать состояние этим способом.',
  };
  document.getElementById('modeHelp').textContent = messages[document.getElementById('statusMode').value];
}
function populate(configuration) {
  const value = AmneziaConfig.normalize(configuration);
  for (const key of fields) document.getElementById(key).value = value[key];
  dirty = false;
  help();
}
function collect() {
  const value = {};
  for (const key of fields) value[key] = document.getElementById(key).value;
  return AmneziaConfig.normalize(value);
}
function send(message) { if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message)); }
function command(payload) { send({ event: 'sendToPlugin', context, action, payload }); }
function showDiagnostics(value) {
  const names = { connected: 'Подключено', disconnected: 'Отключено', busy: 'Переключение', unknown: 'Не определено', unavailable: 'Клиент не найден', error: 'Ошибка' };
  const lines = ['Результат: ' + (names[value.state] || 'Не определено'), value.detail || ''];
  if (value.applicationPath) lines.push('Клиент: ' + value.applicationPath);
  if (value.applicationVersion) lines.push('Версия Amnezia: ' + value.applicationVersion);
  if (value.hostVersion) lines.push('Версия AJAZZ: ' + value.hostVersion);
  if (value.runtime) lines.push('Среда: ' + value.platform + ' / ' + value.architecture + ', Node.js ' + value.runtime, 'Системный мост: отвечает');
  if (value.canInvoke !== undefined) lines.push('Штатная команда кнопки: ' + (value.canInvoke ? 'доступна (не вызывалась)' : 'недоступна'));
  if (value.windowState === 'hidden') lines.push('Окно скрыто в трее; команда кнопки не проверялась.');
  if (value.windowState === 'uninitialized') lines.push('Окно клиента ещё недоступно после запуска; используется фоновая проверка. Команда кнопки не проверялась.');
  const panel = document.getElementById('diagnostics');
  panel.hidden = false;
  panel.textContent = lines.filter(Boolean).join('\n');
}
function connectElgatoStreamDeckSocket(port, uuid, registerEvent, info, actionInfo) {
  context = uuid;
  const parsed = JSON.parse(actionInfo);
  action = parsed.action;
  updateSettings(parsed.payload?.settings || {});
  socket = new WebSocket('ws://127.0.0.1:' + port);
  socket.onopen = () => {
    send({ event: registerEvent, uuid });
    send({ event: 'getGlobalSettings', context });
    command({ command: 'refresh' });
  };
  socket.onmessage = event => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.event === 'didReceiveSettings') updateSettings(message.payload.settings);
    if (message.event === 'didReceiveGlobalSettings') {
      configurationLoaded = true;
      if (!dirty) {
        try { populate(message.payload.settings?.configuration || {}); }
        catch (error) { notice.textContent = error.message; }
      }
    }
    if (message.event !== 'sendToPropertyInspector') return;
    const value = message.payload;
    if (value.kind === 'configurationSaved') {
      populate(value.configuration);
      notice.textContent = 'Сохранено для всех кнопок на этом компьютере. VPN не переключался.';
      return;
    }
    if (value.kind === 'configurationError') { notice.textContent = value.detail; return; }
    if (value.kind === 'diagnostics') { showDiagnostics(value); return; }
    const names = { connected: 'VPN включён', disconnected: 'VPN выключен', busy: 'Переключение…', error: 'Ошибка', unknown: 'Состояние неизвестно', unavailable: 'AmneziaVPN не запущена' };
    document.getElementById('status').textContent = names[value.state] || 'Состояние неизвестно';
    document.getElementById('detail').textContent = value.detail || '';
  };
}
window.connectElgatoStreamDeckSocket = connectElgatoStreamDeckSocket;
window.connectSocket = connectElgatoStreamDeckSocket;
control.onchange = () => {
  updateSettings({ ...settings, enableControl: control.checked });
  send({ event: 'setSettings', context, payload: settings });
};
document.getElementById('refresh').onclick = () => command({ command: 'refresh' });
document.getElementById('diagnose').onclick = () => {
  if (dirty) { notice.textContent = 'Сначала сохраните изменения, затем запустите проверку.'; return; }
  command({ command: 'diagnose' });
};
for (const key of fields) document.getElementById(key).oninput = () => { dirty = true; notice.textContent = 'Есть несохранённые изменения.'; help(); };
document.getElementById('configuration').onsubmit = event => {
  event.preventDefault();
  if (!configurationLoaded) { notice.textContent = 'Ожидается загрузка настроек AJAZZ.'; return; }
  try { command({ command: 'saveConfiguration', configuration: collect() }); }
  catch (error) { notice.textContent = error.message; }
};
document.getElementById('defaults').onclick = () => { populate({}); dirty = true; notice.textContent = 'Стандартные значения подготовлены. Нажмите «Сохранить настройки».'; };
populate({});
