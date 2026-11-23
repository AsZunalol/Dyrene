const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { createHubService } = require('../server/bot-hub/service.cjs');

function load(file, mocks) {
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => id === 'server-only' ? {} : mocks[id], module, module.exports);
  return module.exports;
}

test('admin access ignores editable metadata and requires a current Discord admin role', async () => {
  const originalFetch = global.fetch;
  const originalNow = Date.now;
  let now = originalNow();
  Date.now = () => now;
  const old = { ...process.env };
  Object.assign(process.env, { DISCORD_GUILD_ID: 'guild', DISCORD_ADMIN_ROLE_ID: 'admin', DISCORD_BOT_TOKEN: 'test' });
  let user = null;
  let roles = [];
  let fail = false;
  global.fetch = async () => { if (fail) throw Error('offline'); return Response.json({ roles }); };
  const { botAdminAccess } = load('lib/bot-admin.ts', {
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) },
  });
  try {
    assert.equal((await botAdminAccess()).status, 401);
    user = { id: 'account', user_metadata: { is_admin: true, provider_id: '123456789012345678' } };
    assert.equal((await botAdminAccess()).status, 403);
    user.identities = [{ provider: 'discord', identity_data: { sub: '123456789012345678' } }];
    assert.equal((await botAdminAccess()).status, 403);
    roles = ['admin'];
    now += 6000;
    assert.deepEqual(await botAdminAccess(), { status: 200, userId: 'account' });
    roles = [];
    now += 6000;
    assert.equal((await botAdminAccess()).status, 403, 'revocation takes effect after the five-second verification window');
    fail = true;
    now += 6000;
    assert.equal((await botAdminAccess()).status, 503, 'Discord errors fail closed');
  } finally { global.fetch = originalFetch; Date.now = originalNow; delete global.botRoleChecks; process.env = old; }
});

test('website routes reject guests, ordinary members and cross-site mutations before reaching Discord', async () => {
  let status = 401, calls = 0;
  const auth = { botAdminAccess: async () => ({ status }), botAccessError: code => new Response(null, { status: code }) };
  class DashboardError extends Error {}
  const direct = { DashboardError, dashboardAction: async () => { calls++; return { ok: true }; } };
  const routes = load('app/api/admin/bot/route.ts', { '@/lib/bot-admin': auth, '@/lib/discord-dashboard': direct, '@/lib/discord-dashboard-types': {} });
  const upload = load('app/api/admin/bot/upload/route.ts', { '@/lib/bot-admin': auth });
  const request = origin => new Request('http://localhost/api/admin/bot', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal((await routes.GET()).status, 401);
  status = 403;
  assert.equal((await routes.POST(request('http://localhost'))).status, 403);
  assert.equal((await upload.POST(request('http://localhost'))).status, 403);
  status = 200;
  assert.equal((await routes.POST(request('https://attacker.invalid'))).status, 403);
  assert.equal(calls, 0);
  assert.equal((await routes.POST(request('http://localhost'))).status, 200);
  assert.equal(calls, 1);
  assert.equal((await upload.POST(request('http://localhost'))).status, 410);
  const retiredUI = load('app/api/admin/bot/ui/[asset]/route.ts', { '@/lib/bot-admin': auth });
  assert.equal((await retiredUI.GET()).status, 410);
});

test('worker authenticates, restricts actions, stores safe uploads and redacts secrets', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dyrene-bot-test-'));
  const secret = 'unit-test-secret-'.repeat(4);
  let localCalls = 0, liveCalls = 0;
  const oldSecret = process.env.TWITCH_CLIENT_SECRET;
  process.env.TWITCH_CLIENT_SECRET = 'fake-twitch-secret-for-test';
  const controller = {
    snapshot: () => ({ status: 'stopped', guilds: [{ id: '1452753397362069507', name: 'The Strays' }, { id: 'other', name: 'Other server' }], logs: [{ message: process.env.TWITCH_CLIENT_SECRET }] }),
    setRecovery() {}, request: async () => { liveCalls++; return true; }, start: () => ({ status: 'starting' }),
  };
  const features = { local: async () => { localCalls++; return { templates: [] }; } };
  const { server } = createHubService({ secret, controller, features, dataDir: directory });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' };
  const action = body => fetch(base + '/action', { method: 'POST', headers, body: JSON.stringify(body) });
  try {
    assert.equal((await fetch(base + '/snapshot')).status, 401);
    assert.equal((await fetch(base + '/snapshot', { headers: { ...headers, Origin: 'http://localhost' } })).status, 403);
    const snapshot = await (await fetch(base + '/snapshot', { headers })).text();
    assert.ok(!snapshot.includes(process.env.TWITCH_CLIENT_SECRET));
    assert.deepEqual(JSON.parse(snapshot).bot.guilds.map(guild => guild.name), ['The Strays']);
    for (const name of ['channels', 'members', 'roles', 'send', 'schedule.save', 'twitch.save', 'event.create']) {
      assert.equal((await action({ kind: 'request', action: name, payload: { guildId: '1239636392326467735' } })).status, 403);
    }
    assert.equal(liveCalls, 0); assert.equal(localCalls, 0);
    for (const name of ['twitch.credentials', 'shutdown', '__proto__', 'importFiles']) {
      assert.equal((await action({ kind: 'request', action: name })).status, 400);
    }
    assert.equal((await action({ kind: 'request', action: 'library' })).status, 200);
    assert.equal(localCalls, 1); assert.equal(liveCalls, 0);
    assert.equal((await action({ kind: 'settings', payload: { startWithWindows: true } })).status, 400);
    assert.equal((await action({ kind: 'settings', payload: { autoRecover: false } })).status, 200);
    for (const name of ['../.env', '.env.local', 'bad\\name.txt']) {
      assert.equal((await fetch(base + '/upload', { method: 'POST', headers: { ...headers, 'X-File-Name': encodeURIComponent(name) }, body: 'data' })).status, 400);
    }
    const upload = await fetch(base + '/upload', { method: 'POST', headers: { ...headers, 'X-File-Name': 'notice.txt' }, body: 'Hello' });
    const attachment = await upload.json();
    assert.equal(upload.status, 200);
    assert.match(attachment.id, /^[a-f0-9]{32}$/);
    assert.equal(fs.readFileSync(path.join(directory, 'attachments', attachment.id), 'utf8'), 'Hello');
    assert.equal((await action({ kind: 'request', action: 'send', payload: { content: 'a'.repeat(65536) } })).status, 413);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
    if (oldSecret === undefined) delete process.env.TWITCH_CLIENT_SECRET; else process.env.TWITCH_CLIENT_SECRET = oldSecret;
  }
});

test('desktop bridge uses the running bot controller and native settings for preview and send', async () => {
  const secret = 'desktop-test-'.repeat(4);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dyrene-desktop-test-'));
  let settings = { autoRecover: true, autoStartBot: true };
  const received = [];
  const controller = {
    snapshot: () => ({ status: 'running', user: { id: '123', name: 'Existing bot' }, guilds: [], logs: [] }),
    setRecovery() {},
    request: async (action, payload) => {
      received.push({ action, payload });
      return action === 'twitch.preview' ? { token: 'preview-token', message: { content: 'Live now' } } : { url: 'https://discord.com/channels/1/2/3' };
    },
  };
  const features = { local: async () => ({ clientId: 'desktop-private-client', configured: true, streamers: [] }) };
  const { server } = createHubService({ secret, controller, features, dataDir: directory,
    desktopSettings: { get: () => settings, set: patch => (settings = { ...settings, ...patch }) },
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const headers = { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' };
  const action = body => fetch(url + '/action', { method: 'POST', headers, body: JSON.stringify(body) });
  try {
    const snapshot = await (await fetch(url + '/snapshot', { headers })).json();
    assert.equal(snapshot.backendMode, 'desktop');
    assert.equal(snapshot.bot.status, 'running');
    const preview = await (await action({ kind: 'request', action: 'twitch.preview', payload: { id: 'streamer' } })).json();
    assert.equal(preview.token, 'preview-token');
    await action({ kind: 'request', action: 'twitch.send', payload: { token: preview.token } });
    assert.deepEqual(received, [
      { action: 'twitch.preview', payload: { id: 'streamer', _websiteGuildId: '1452753397362069507' } },
      { action: 'twitch.send', payload: { token: 'preview-token', _websiteGuildId: '1452753397362069507' } },
    ]);
    const twitch = await (await action({ kind: 'request', action: 'twitch.list' })).json();
    assert.equal(twitch.clientId, undefined);
    await action({ kind: 'settings', payload: { autoRecover: false } });
    assert.equal(settings.autoRecover, false);
    settings.autoStartBot = false;
    const changed = await (await fetch(url + '/snapshot', { headers })).json();
    assert.equal(changed.settings.autoStartBot, false, 'desktop changes are reflected on the website');
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
