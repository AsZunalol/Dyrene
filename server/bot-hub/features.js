const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const LOCAL_ACTIONS = new Set(['library', 'template.save', 'template.delete', 'schedule.save', 'schedule.cancel', 'status.save']);
for (const action of ['twitch.list', 'twitch.save', 'twitch.delete']) LOCAL_ACTIONS.add(action);
const LIVE_ACTIONS = new Set(['send', 'history.edit', 'history.delete', 'history.import', 'event.create', 'event.close', 'status.apply']);
for (const action of ['twitch.check', 'twitch.preview', 'twitch.send']) LIVE_ACTIONS.add(action);
class FeatureService {
  constructor(root, dataDir) { this.root = root; this.dataDir = dataDir; }
  local(action, payload) {
    if (!LOCAL_ACTIONS.has(action)) return Promise.reject(new Error('Unknown local action.'));
    return new Promise((resolve, reject) => {
      const child = spawn(process.env.BOT_HUB_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), ['-u', path.join(this.root, 'hub_features.py')], {
        cwd: this.root, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, AZ_HUB_DATA_DIR: this.dataDir, PYTHONIOENCODING: 'utf-8' }
      });
      let output = '', done = false;
      const finish = (error, result) => { if (done) return; done = true; clearTimeout(timer); error ? reject(error) : resolve(result); };
      const timer = setTimeout(() => { child.kill(); finish(new Error('Local storage took too long to respond.')); }, 20000);
      child.once('error', finish);
      child.stdout.on('data', chunk => { output += chunk; });
      child.stderr.on('data', () => {});
      child.stdin.on('error', finish);
      child.once('close', () => {
        try { const data = JSON.parse(output); finish(data.error ? new Error(data.error) : null, data.result); }
        catch { finish(new Error('Could not read local app data.')); }
      });
      child.stdin.end(JSON.stringify({ action, payload }) + '\n');
    });
  }
  importFiles(paths) {
    if (paths.length > 10) throw new Error('Choose at most ten attachments.');
    const folder = path.join(this.dataDir, 'attachments'); fs.mkdirSync(folder, { recursive: true });
    // Stage copies so schedules and templates survive moving the original files.
    const files = paths.map(source => {
      const stat = fs.statSync(source);
      if (!stat.isFile() || stat.size > 25 * 1024 * 1024) throw new Error('Choose files up to 25 MB each. Discord may apply a lower server limit.');
      if (/^\.env(?:\.|$)/i.test(path.basename(source))) throw new Error('Bot configuration files cannot be attached.');
      return { source, name: path.basename(source), size: stat.size, id: crypto.randomBytes(16).toString('hex') };
    });
    return files.map(({ source, ...file }) => { fs.copyFileSync(source, path.join(folder, file.id)); return file; });
  }
}
module.exports = { FeatureService, LOCAL_ACTIONS, LIVE_ACTIONS };
