(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AmneziaConfig = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const defaults = Object.freeze({ statusMode: 'auto', executablePath: '', connectedText: '', disconnectedText: '', timeoutSeconds: 5 });
  const textKey = value => value.trim().toLowerCase().replace(/…/g, '').replace(/\.+$/, '');
  function normalize(value = {}) {
    const config = { ...defaults };
    for (const key of Object.keys(defaults)) if (value[key] !== undefined) config[key] = value[key];
    if (!['auto', 'wg', 'ui'].includes(config.statusMode)) throw new Error('Выберите способ определения состояния.');
    for (const key of ['executablePath', 'connectedText', 'disconnectedText']) {
      if (typeof config[key] !== 'string') throw new Error('Параметр должен быть текстом.');
      if (/[\r\n\0]/.test(config[key])) throw new Error('В параметрах недопустимы переносы строк.');
      config[key] = config[key].trim();
    }
    if (config.executablePath && (!/^[a-z]:[\\/].+\.exe$/i.test(config.executablePath) || config.executablePath.length > 260))
      throw new Error('Укажите полный локальный путь к .exe без кавычек и аргументов.');
    const on = textKey(config.connectedText), off = textKey(config.disconnectedText);
    if (!!on !== !!off) throw new Error('Укажите обе подписи кнопки или оставьте обе пустыми.');
    if (on && on === off) throw new Error('Подписи включённого и выключенного состояния должны отличаться.');
    if (on.length > 80 || off.length > 80) throw new Error('Подпись должна быть не длиннее 80 символов.');
    if (['connect', 'disconnected', 'подключиться', 'подключить', 'отключено', 'отключен', 'не подключено'].includes(on) ||
        ['connected', 'подключено'].includes(off)) throw new Error('Подписи противоречат стандартным состояниям Amnezia.');
    const transitions = ['connecting', 'disconnecting', 'reconnecting', 'preparing', 'подключение', 'отключение', 'переподключение', 'подготовка', 'error', 'ошибка'];
    if (transitions.includes(on) || transitions.includes(off)) throw new Error('Не используйте подпись переключения или ошибки как состояние подключения.');
    config.timeoutSeconds = Number(config.timeoutSeconds);
    if (!Number.isInteger(config.timeoutSeconds) || config.timeoutSeconds < 3 || config.timeoutSeconds > 20)
      throw new Error('Ожидание ответа: целое число от 3 до 20 секунд.');
    return config;
  }
  return { defaults, normalize };
});
