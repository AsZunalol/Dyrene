'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { BotController } = require('./controller');
const { FeatureService, LOCAL_ACTIONS, LIVE_ACTIONS } = require('./features');
const guildScope = require('./guild_scope.json');

function sanitize(value) {
  let output = JSON.stringify(value);
  for (const name of ['TWITCH_CLIENT_SECRET', 'BOT_HUB_SECRET', 'DISCORD_TOKEN', 'BOT_HUB_DISCORD_TOKEN', 'DISCORD_BOT_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (process.env[name]) output = output.split(process.env[name]).join('[redacted]');
  }
  return output;
}
async function readBody(request, maximum) {
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximum) { const error = new Error('Request too large.'); error.status = 413; throw error; }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function createHubService({ secret, controller, features, dataDir, desktopSettings }) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('Set a strong BOT_HUB_SECRET in the server environment.');
  const settingsFile = path.join(dataDir, 'settings.json');
  let settings = { autoRecover: true, autoStartBot: false };
  try {
    const saved = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    for (const key of Object.keys(settings)) if (typeof saved[key] === 'boolean') settings[key] = saved[key];
  } catch { /* Defaults for a new install. */ }
  if (desktopSettings) settings = desktopSettings.get();
  controller.setRecovery(settings.autoRecover);
  const scopedSnapshot = value => ({ ...value, guilds: (value.guilds || []).filter(guild => guild.id === guildScope.guildId) });
  const expected = Buffer.from(`Bearer ${secret}`);
  const server = http.createServer(async (request, response) => {
    const reply = (status, value) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(sanitize(value));
    };
    const supplied = Buffer.from(request.headers.authorization || '');
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return reply(401, { error: 'Unauthorized.' });
    // This is a server-to-server API. Browser requests must use the authenticated Next.js routes.
    if (request.headers.origin) return reply(403, { error: 'Use the website to manage the bot.' });
    try {
      if (request.method === 'GET' && request.url === '/snapshot') return reply(200, {
        bot: scopedSnapshot(controller.snapshot()),
        settings: desktopSettings ? desktopSettings.get() : settings,
        tokenConfigured: Boolean(process.env.DISCORD_TOKEN || process.env.BOT_HUB_DISCORD_TOKEN),
        backendMode: desktopSettings ? 'desktop' : 'standalone',
      });
      if (request.method === 'POST' && request.url === '/upload') {
        const name = decodeURIComponent(String(request.headers['x-file-name'] || 'attachment'));
        if (!name || name.length > 200 || /[\\/\x00-\x1f]/.test(name) || /^\.env(?:\.|$)/i.test(name)) throw new Error('Choose a valid attachment filename.');
        const bytes = await readBody(request, 25 * 1024 * 1024);
        if (!bytes.length) throw new Error('Empty files cannot be attached.');
        const id = crypto.randomBytes(16).toString('hex');
        fs.mkdirSync(path.join(dataDir, 'attachments'), { recursive: true });
        fs.writeFileSync(path.join(dataDir, 'attachments', id), bytes, { flag: 'wx', mode: 0o600 });
        return reply(200, { id, name, size: bytes.length });
      }
      if (request.method !== 'POST' || request.url !== '/action') return reply(404, { error: 'Not found.' });
      const body = JSON.parse((await readBody(request, 65536)).toString('utf8'));
      if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error('Invalid request.');
      const { kind, action, payload = {} } = body;
      if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error('Invalid request.');
      if (kind === 'control') {
        if (!['start', 'stop', 'restart'].includes(action)) throw new Error('Unknown control.');
        return reply(200, scopedSnapshot(await controller[action]()));
      }
      if (kind === 'settings') {
        if (Object.keys(payload).some(key => !Object.hasOwn(settings, key) || typeof payload[key] !== 'boolean')) throw new Error('Unknown setting.');
        settings = { ...settings, ...payload };
        if (desktopSettings) {
          settings = desktopSettings.set(payload);
          controller.setRecovery(settings.autoRecover);
          return reply(200, settings);
        }
        fs.mkdirSync(dataDir, { recursive: true });
        fs.writeFileSync(settingsFile + '.tmp', JSON.stringify(settings), { mode: 0o600 });
        fs.renameSync(settingsFile + '.tmp', settingsFile);
        controller.setRecovery(settings.autoRecover);
        return reply(200, settings);
      }
      if (kind !== 'request' || action === 'twitch.credentials' ||
          (!['channels', 'members', 'roles'].includes(action) && !LOCAL_ACTIONS.has(action) && !LIVE_ACTIONS.has(action))) throw new Error('Unknown bot action.');
      if ('guildId' in payload && String(payload.guildId) !== guildScope.guildId) {
        return reply(403, { error: 'The website can only manage The Strays Discord server.' });
      }
      // The server supplies this scope, overriding any browser value. Python
      // enforces it inside the operation, including saved IDs and preview tokens.
      // Native desktop IPC never receives this marker and remains unrestricted.
      const scopedPayload = { ...payload, _websiteGuildId: guildScope.guildId };
      const result = LOCAL_ACTIONS.has(action) ? await features.local(action, scopedPayload)
        : await controller.request(action, scopedPayload, ['send', 'event.create', 'history.import', 'twitch.preview', 'twitch.send'].includes(action) ? 90000 : 30000);
      if (['twitch.list', 'twitch.check'].includes(action) && result && typeof result === 'object') delete result.clientId;
      return reply(200, result);
    } catch (error) { reply(error.status || 400, { error: error instanceof SyntaxError ? 'Invalid JSON.' : error.message || 'The action failed.' }); }
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 10000;
  return { server, settings };
}

if (require.main === module) {
  const root = path.resolve(__dirname, '../..');
  require('dotenv').config({ path: [path.join(root, '.env.local'), path.join(root, '.env')], quiet: true });
  process.env.DISCORD_TOKEN = process.env.BOT_HUB_DISCORD_TOKEN || process.env.DISCORD_TOKEN || process.env.DISCORD_BOT_TOKEN || '';
  const dataDir = path.resolve(process.env.BOT_HUB_DATA_DIR || path.join(root, '.bot-hub-data'));
  const controller = new BotController(__dirname, { dataDir });
  const features = new FeatureService(__dirname, dataDir);
  const { server, settings } = createHubService({ secret: process.env.BOT_HUB_SECRET, controller, features, dataDir });
  const port = Number(process.env.BOT_HUB_PORT || 4319);
  server.listen(port, process.env.BOT_HUB_HOST || '127.0.0.1', () => {
    console.log(`Bot backend ready on port ${port}. Manage it from the website's Discord bot tab.`);
    if (settings.autoStartBot) {
      try { controller.start(); } catch (error) { controller.update({ status: 'error', error: error.message }); }
    }
  });
  let closing = false;
  const shutdown = async () => {
    if (closing) return; closing = true;
    server.close();
    await controller.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  server.on('error', async error => {
    if (error.code === 'EADDRINUSE') {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/snapshot`, {
          headers: { Authorization: `Bearer ${process.env.BOT_HUB_SECRET}` }, signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          console.log('Using the already-running bot backend. The desktop app and website share the same bot.');
          // Keep concurrently alive without claiming or stopping the desktop process.
          setInterval(() => {}, 60000);
          return;
        }
      } catch { /* Report the port conflict instead of attaching to an untrusted service. */ }
    }
    console.error(`Bot backend could not listen (${error.code}).`); process.exitCode = 1;
  });
}
module.exports = { createHubService };
