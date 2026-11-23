'use strict';
(() => {
  const stateCallbacks = [], logCallbacks = [];
  let lastLog = null, polling = false, stopped = false;
  async function call(url, options = {}) {
    const response = await fetch(url, { ...options, credentials: 'same-origin', cache: 'no-store' });
    if ([401, 403].includes(response.status)) {
      stopped = true;
      window.top.location.href = response.status === 401 ? '/login' : '/denied';
      throw new Error('Your administrator session ended.');
    }
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
    return result;
  }
  const action = (kind, action, payload = {}) => call('/api/admin/bot', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind, action, payload }),
  });
  const key = log => JSON.stringify(log);
  async function snapshot() {
    const data = await call('/api/admin/bot');
    lastLog = data.bot.logs?.length ? key(data.bot.logs.at(-1)) : null;
    return data;
  }
  async function poll() {
    if (polling || stopped || document.hidden) return;
    polling = true;
    try {
      const data = await call('/api/admin/bot');
      const entries = data.bot.logs || [];
      const index = lastLog ? entries.findLastIndex(log => key(log) === lastLog) : -1;
      for (const log of entries.slice(index + 1)) logCallbacks.forEach(callback => callback(log));
      if (entries.length) lastLog = key(entries.at(-1));
      stateCallbacks.forEach(callback => callback(data.bot));
    } catch (error) {
      stateCallbacks.forEach(callback => callback({ status: 'error', guilds: [], latency: null, error: error.message }));
    } finally { polling = false; }
  }
  window.hub = {
    snapshot, control: value => action('control', value), request: (name, payload) => action('request', name, payload),
    settings: patch => action('settings', '', patch),
    onState: callback => stateCallbacks.push(callback), onLog: callback => logCallbacks.push(callback),
    openMessage: async url => {
      if (!/^https:\/\/discord\.com\/channels\/\d+\/\d+\/\d+$/.test(url)) throw new Error('Invalid Discord link.');
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    pickFiles: () => new Promise((resolve, reject) => {
      const picker = document.createElement('input'); picker.type = 'file'; picker.multiple = true;
      picker.oncancel = () => resolve([]);
      picker.onchange = async () => {
        try {
          const files = Array.from(picker.files || []);
          if (files.length > 10) throw new Error('Choose at most ten attachments.');
          if (files.some(file => file.size > 25 * 1024 * 1024)) throw new Error('Files must be at most 25 MB each.');
          const uploaded = [];
          for (const file of files) uploaded.push(await call('/api/admin/bot/upload', {
            method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) }, body: file,
          }));
          resolve(uploaded);
        } catch (error) { reject(error); }
      };
      picker.click();
    }),
  };
  setInterval(poll, 3000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void poll(); });
})();
