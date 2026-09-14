'use strict';

const ACTION = 'com.rucard.amnezia.toggle';
const STATES = new Set(['connected', 'disconnected', 'busy', 'error', 'unknown', 'unavailable']);

class Controller {
  constructor({ bridge, send, now = Date.now }) {
    this.bridge = bridge;
    this.send = send;
    this.now = now;
    this.contexts = new Map();
    this.status = { state: 'unknown', detail: 'Ожидание AmneziaVPN' };
    this.operation = false;
    this.refreshPromise = null;
    this.pending = null;
    this.cooldownUntil = 0;
    this.configurationRevision = 0;
  }

  invalidateConfiguration() {
    this.configurationRevision++;
    this.pending = null;
    this.status = { state: 'unknown', detail: 'Проверка новых настроек' };
    this.publishAll();
  }

  publish(context) {
    const settings = this.contexts.get(context);
    if (!settings) return;
    this.send({ event: 'render', context, payload: {
      ...this.status, monitoringOnly: settings.enableControl !== true,
    } });
    this.send({ event: 'sendToPropertyInspector', action: ACTION, context,
      payload: { ...this.status, monitoringOnly: settings.enableControl !== true } });
  }

  publishAll() { for (const context of this.contexts.keys()) this.publish(context); }

  async refresh() {
    if (this.operation) return this.status;
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = (async () => {
      const revision = this.configurationRevision;
      try {
        const result = await this.bridge('status');
        if (revision !== this.configurationRevision) return this.status;
        this.status = STATES.has(result.state) ? result : { state: 'unknown', detail: 'Неизвестный ответ Amnezia' };
      } catch {
        this.status = { state: 'unknown', detail: 'Не удалось прочитать состояние AmneziaVPN' };
      }
      if (this.pending) {
        if (this.status.state === this.pending.desired) this.pending = null;
        else if (this.now() >= this.pending.deadline) {
          this.pending = null;
          this.status = { state: 'error', detail: 'AmneziaVPN не подтвердила переключение за 30 секунд' };
          this.cooldownUntil = this.now() + 3000;
        } else if (['connected', 'disconnected', 'busy'].includes(this.status.state)) {
          this.status = { state: 'busy', detail: 'Ожидание переключения AmneziaVPN' };
        }
      }
      this.publishAll();
      return this.status;
    })();
    try { return await this.refreshPromise; } finally { this.refreshPromise = null; }
  }

  async toggle(context) {
    if (!this.contexts.has(context)) return;
    if (this.contexts.get(context).enableControl !== true) {
      this.send({ event: 'showAlert', context });
      this.publish(context);
      return;
    }
    if (this.operation || this.pending || this.now() < this.cooldownUntil) return;
    // Reserve before awaiting: two keys/double presses cannot overlap.
    this.operation = true;
    const revision = this.configurationRevision;
    try {
      if (this.refreshPromise) await this.refreshPromise;
      const fresh = await this.bridge('status');
      if (revision !== this.configurationRevision) return;
      if (!['connected', 'disconnected'].includes(fresh.state)) {
        this.status = STATES.has(fresh.state) ? fresh : { state: 'unknown', detail: 'Неизвестное состояние' };
        this.send({ event: 'showAlert', context });
        return;
      }
      // A settings change or page removal while the probe ran revokes control.
      if (this.contexts.get(context)?.enableControl !== true) return;
      const desired = fresh.state === 'connected' ? 'disconnected' : 'connected';
      this.status = { state: 'busy', detail: 'Переключение AmneziaVPN' };
      this.publishAll();
      const result = await this.bridge('set', desired);
      if (revision !== this.configurationRevision) return;
      this.status = STATES.has(result.state) ? result : { state: 'unknown', detail: 'Неизвестный ответ' };
      if (result.invoked) this.pending = { desired, deadline: this.now() + 30000 };
      else if (result.state !== desired) this.send({ event: 'showAlert', context });
    } catch {
      this.status = { state: 'unknown', detail: 'Результат команды неизвестен. Проверьте AmneziaVPN' };
      // An invocation may have succeeded before its bridge timed out. Never retry.
      this.cooldownUntil = this.now() + 30000;
      this.send({ event: 'showAlert', context });
    } finally {
      this.operation = false;
      this.cooldownUntil = Math.max(this.cooldownUntil, this.now() + 1500);
      this.publishAll();
    }
  }

  async handle(message) {
    const { event, context, payload = {} } = message;
    if (message.action && message.action !== ACTION) return;
    if (event === 'willAppear' || event === 'didReceiveSettings') {
      this.contexts.set(context, payload.settings || {});
      this.publish(context);
      await this.refresh();
    } else if (event === 'willDisappear' || event === 'deleteAction') {
      this.contexts.delete(context);
    } else if (event === 'keyUp') {
      await this.toggle(context);
    } else if (event === 'sendToPlugin' && payload.command === 'refresh') {
      await this.refresh();
    } else if (event === 'propertyInspectorDidAppear') {
      this.publish(context);
    }
  }
}

module.exports = { Controller, ACTION };
