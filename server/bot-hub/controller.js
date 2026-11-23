'use strict';
const { EventEmitter } = require('node:events');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

class BotController extends EventEmitter {
  constructor(root, options = {}) {
    super();
    this.root = root;
    this.spawn = options.spawn || spawn;
    this.process = null;
    this.pending = new Map();
    this.logs = [];
    this.autoRecover = options.autoRecover ?? false;
    this.retryDelays = options.retryDelays || [3000, 15000, 30000];
    this.recoveryAttempts = [];
    this.recoveryTimer = null;
    this.intentionalStop = false;
    this.dataDir = options.dataDir || path.join(root, '.hub-data');
    this.state = { status: 'stopped', user: null, guilds: [], startedAt: null, latency: null, error: null };
  }
  snapshot() { return { ...this.state, logs: this.logs }; }
  update(patch) { Object.assign(this.state, patch); this.emit('state', this.snapshot()); }
  log(message, level = 'info') {
    // Tokens never belong in the renderer or log files.
    const safe = String(message).replace(/[A-Za-z\d_-]{20,}\.[A-Za-z\d_-]{5,}\.[A-Za-z\d_-]{20,}/g, '[redacted]');
    this.logs.push({ time: Date.now(), message: safe.slice(0, 4000), level });
    if (this.logs.length > 500) this.logs.shift();
    this.emit('log', this.logs.at(-1));
  }
  start(automatic = false) {
    if (this.process) return this.snapshot();
    clearTimeout(this.recoveryTimer); this.recoveryTimer = null;
    if (!automatic) this.recoveryAttempts = [];
    this.intentionalStop = false;
    const python = process.env.BOT_HUB_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
    this.update({ status: 'starting', error: null, retryAt: null, user: null, guilds: [], latency: null, startedAt: null });
    this.log('Starting bot…');
    const child = this.spawn(python, ['-u', path.join(this.root, 'bot.py'), '--hub'], {
      cwd: this.root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, AZ_HUB_DATA_DIR: this.dataDir, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' }
    });
    this.process = child;
    let exited = false;
    const finish = (code, error) => {
      if (exited) return;
      exited = true;
      this.process = null;
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error('The bot stopped.')); }
      this.pending.clear();
      const failed = !this.intentionalStop && (error || code !== 0 || this.autoRecover);
      const message = error?.message || this.state.error || (failed ? `Bot exited with code ${code}. Check the activity log.` : null);
      this.update({ status: failed ? 'error' : 'stopped', error: failed ? message : null, startedAt: null, latency: null, guilds: [], user: null });
      this.log(failed ? message : 'Bot stopped.', failed ? 'error' : 'info');
      this.emit('exit');
      if (failed) this.recover(message);
    };
    child.once('error', error => finish(null, error));
    child.once('close', code => finish(code));
    child.stdin.on('error', error => this.log(`Control connection: ${error.message}`, 'error'));
    readline.createInterface({ input: child.stdout }).on('line', line => this.onLine(line));
    readline.createInterface({ input: child.stderr }).on('line', line => this.log(line, /error|exception|traceback/i.test(line) ? 'error' : 'info'));
    return this.snapshot();
  }
  setRecovery(enabled) {
    this.autoRecover = enabled;
    if (!enabled && this.recoveryTimer) {
      clearTimeout(this.recoveryTimer); this.recoveryTimer = null;
      this.update({ status: 'error', retryAt: null });
    }
  }
  recover(message) {
    if (!this.autoRecover || this.intentionalStop) return;
    const permanent = /token|already running|runtime is missing/i.test(message || '');
    this.recoveryAttempts = this.recoveryAttempts.filter(at => Date.now() - at < 600000);
    if (permanent || this.recoveryAttempts.length >= this.retryDelays.length) {
      this.log('Automatic recovery paused. Fix the error and click Start bot.', 'error');
      this.emit('notification', { title: 'Bot needs attention', body: permanent ? message : 'The bot failed repeatedly. Automatic recovery stopped after 3 retries.' });
      return;
    }
    const delay = this.retryDelays[this.recoveryAttempts.length];
    this.recoveryAttempts.push(Date.now());
    this.update({ status: 'recovering', retryAt: Date.now() + delay });
    this.log(`Bot crashed. Recovery attempt ${this.recoveryAttempts.length}/${this.retryDelays.length} in ${delay / 1000}s.`, 'error');
    this.emit('notification', { title: 'Bot recovery', body: `The bot stopped unexpectedly. Restarting in ${delay / 1000} seconds.` });
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null;
      if (this.intentionalStop || !this.autoRecover) return;
      try { this.start(true); } catch (error) { this.update({ status: 'error', error: error.message }); this.recover(error.message); }
    }, delay);
  }
  onLine(line) {
    if (!line.startsWith('@AZHUB@')) return this.log(line);
    let data;
    try { data = JSON.parse(line.slice(7)); } catch { return this.log('Invalid bot control response.', 'error'); }
    if (data.type === 'state') {
      if (this.state.status === 'stopping') return;
      this.update({ ...data.state, startedAt: data.state.status === 'running' ? (this.state.startedAt || Date.now()) : this.state.startedAt });
    } else if (data.type === 'response') {
      const request = this.pending.get(data.id);
      if (!request) return;
      clearTimeout(request.timer);
      this.pending.delete(data.id);
      data.error ? request.reject(new Error(data.error)) : request.resolve(data.result);
    } else if (data.type === 'error') {
      this.update({ error: data.message }); this.log(data.message, 'error');
    }
  }
  request(action, payload = {}, timeout = 30000) {
    if (!this.process || (this.state.status !== 'running' && action !== 'shutdown')) return Promise.reject(new Error('Start the bot and wait for it to connect first.'));
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(['send', 'event.create', 'twitch.send', 'history.edit', 'history.delete', 'event.close'].includes(action) ? 'Discord has not confirmed delivery. Check the channel before sending again.' : 'Discord took too long to respond. Please try again.')); }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.process.stdin.write(JSON.stringify({ id, action, payload }) + '\n', error => {
        if (error && this.pending.delete(id)) { clearTimeout(timer); reject(error); }
      });
    });
  }
  async stop() {
    this.intentionalStop = true;
    clearTimeout(this.recoveryTimer); this.recoveryTimer = null;
    if (!this.process) { this.update({ status: 'stopped', retryAt: null }); return this.snapshot(); }
    if (this.stopping) return this.stopping;
    this.stopping = new Promise(resolve => {
      const child = this.process;
      this.update({ status: 'stopping' });
      this.log('Stopping bot…');
      const timer = setTimeout(() => { this.log('Closing unresponsive bot process.'); child.kill(); }, 6000);
      this.once('exit', () => { clearTimeout(timer); resolve(this.snapshot()); });
      this.request('shutdown', {}, 6500).catch(() => {});
    });
    try { return await this.stopping; } finally { this.stopping = null; }
  }
  async restart() { await this.stop(); return this.start(); }
}
module.exports = { BotController };
