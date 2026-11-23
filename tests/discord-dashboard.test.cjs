const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, mocks = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', output)(id => id === 'server-only' ? {} : id.startsWith('node:') ? require(id) : mocks[id], module, module.exports);
  return module.exports;
}
const types = load('lib/discord-dashboard-types.ts');
const backend = load('lib/discord-dashboard.ts', { './discord-dashboard-types': types });
const strays = types.DASHBOARD_GUILDS[0].id, testing = types.DASHBOARD_GUILDS[1].id;
const channelId = '111111111111111111', messageId = '222222222222222222', botId = '333333333333333333';
const other = '444444444444444444';
const message = (overrides = {}) => ({ id: messageId, type: 0, channel_id: channelId, author: { id: botId }, content: 'Original', timestamp: '2026-11-23T12:00:00Z', embeds: [], attachments: [], components: [], ...overrides });
const send = (overrides = {}) => ({ action: 'send', guildId: strays, channelId, nonce: 'test-message-123456789', draft: { ...types.emptyDraft(), content: 'Hello' }, ...overrides });
async function withDiscord(respond, run) {
  const original = global.fetch, oldToken = process.env.BOT_HUB_DISCORD_TOKEN;
  process.env.BOT_HUB_DISCORD_TOKEN = 'private-unit-test-token';
  const requests = [];
  global.fetch = async (url, init) => {
    assert.ok(String(url).startsWith('https://discord.com/api/v10/'), 'only Discord is contacted');
    assert.equal(new Headers(init.headers).get('Authorization'), 'Bot private-unit-test-token');
    const endpoint = String(url).slice('https://discord.com/api/v10'.length);
    requests.push({ endpoint, init });
    const response = await respond(endpoint, init);
    return response instanceof Response ? response : Response.json(response);
  };
  try { await run(requests); } finally {
    global.fetch = original;
    if (oldToken === undefined) delete process.env.BOT_HUB_DISCORD_TOKEN; else process.env.BOT_HUB_DISCORD_TOKEN = oldToken;
  }
}

test('both allowed servers work; disabled features and other guilds never reach Discord', async () => {
  await withDiscord(() => assert.fail('Unexpected network request'), async () => {
    assert.equal(backend.allowedGuild(strays), strays);
    assert.equal(backend.allowedGuild(testing), testing);
    assert.throws(() => backend.allowedGuild(other), error => error.status === 403);
    for (const action of ['start', 'stop', 'restart', 'twitch.save', 'schedule.save', 'event.create', 'presence.save', 'library']) {
      await assert.rejects(backend.dashboardAction({ ...send(), action }, [], 'admin'), /desktop app/);
    }
    await assert.rejects(backend.dashboardAction(send({ guildId: other }), [], 'admin'), error => error.status === 403);
  });
});

test('a forged channel is rejected for sends, history, lookups, edits and deletions', async () => {
  await withDiscord(endpoint => { assert.equal(endpoint, `/channels/${channelId}`); return { id: channelId, type: 0, guild_id: other }; }, async requests => {
    for (const action of ['send', 'history', 'message', 'edit', 'delete']) {
      await assert.rejects(backend.dashboardAction({ ...send(), action, messageId }, [], 'admin'), error => error.status === 403);
    }
    assert.equal(requests.length, 5);
  });
});

test('snapshot filters inaccessible channels and honors role/member overwrite order', async () => {
  const all = String(1024 | 2048 | 65536);
  await withDiscord(endpoint => {
    if (endpoint === '/users/@me') return { id: botId, username: 'The Strays' };
    if (endpoint === `/guilds/${testing}`) return { id: testing, name: 'Testing' };
    if (endpoint.endsWith('/roles')) return [{ id: testing, name: '@everyone', permissions: all }, { id: other, name: 'Bot', permissions: '0' }];
    if (endpoint.includes('/members/')) return { roles: [other] };
    if (endpoint.endsWith('/channels')) return [
      { id: 'category', type: 4, name: 'General' },
      { id: channelId, type: 0, name: 'open', parent_id: 'category' },
      { id: 'hidden', type: 0, name: 'hidden', permission_overwrites: [{ id: testing, type: 0, deny: '1024', allow: '0' }] },
      { id: 'readonly', type: 0, name: 'read', permission_overwrites: [{ id: other, type: 0, deny: '2048', allow: '0' }] },
      { id: 'member', type: 0, name: 'member', permission_overwrites: [{ id: other, type: 0, deny: '2048', allow: '0' }, { id: botId, type: 1, deny: '0', allow: '2048' }] },
    ];
    assert.fail(endpoint);
  }, async () => {
    const snapshot = await backend.dashboardSnapshot(testing);
    assert.equal(snapshot.guild.id, testing);
    assert.equal(snapshot.channels.length, 3);
    assert.equal(snapshot.channels[0].category, 'General');
    assert.equal(snapshot.channels.find(row => row.id === 'readonly').canSend, false);
    assert.equal(snapshot.channels.find(row => row.id === 'member').canSend, true);
    assert.ok(!JSON.stringify(snapshot).includes('private-unit-test-token'));
  });
});

test('send uses Discord directly, safe mentions and a stable user-scoped duplicate-prevention nonce', async () => {
  await withDiscord((endpoint, init) => {
    if (endpoint === `/channels/${channelId}`) return { id: channelId, type: 0, guild_id: testing };
    assert.equal(endpoint, `/channels/${channelId}/messages`); assert.equal(init.method, 'POST');
    const body = JSON.parse(init.body);
    assert.equal(body.content, 'Hello'); assert.equal(body.enforce_nonce, true);
    assert.deepEqual(body.allowed_mentions.parse, ['users', 'roles']);
    assert.equal(body.token, undefined);
    return message();
  }, async requests => {
    const input = send({ guildId: testing });
    const result = await backend.dashboardAction(input, [], 'admin');
    await backend.dashboardAction(input, [], 'admin');
    await backend.dashboardAction(input, [], 'other-admin');
    const payloads = requests.filter(row => row.init.method === 'POST').map(row => JSON.parse(row.init.body));
    assert.equal(payloads[0].nonce, payloads[1].nonce);
    assert.notEqual(payloads[0].nonce, payloads[2].nonce);
    assert.ok(result.message.url.includes(testing));
  });
});

test('uploads go with the message in one multipart request without desktop file IDs', async () => {
  await withDiscord((endpoint, init) => {
    if (endpoint === `/channels/${channelId}`) return { id: channelId, type: 0, guild_id: strays };
    assert.ok(init.body instanceof FormData);
    assert.equal(init.body.get('files[0]').name, 'test.txt');
    const body = JSON.parse(init.body.get('payload_json'));
    assert.deepEqual(body.attachments, [{ id: 0, filename: 'test.txt' }]);
    return message({ attachments: [{ id: 'file', filename: 'test.txt', url: 'https://cdn.discordapp.com/test.txt' }] });
  }, async () => {
    const result = await backend.dashboardAction(send(), [new File(['hello'], 'test.txt')], 'admin');
    assert.equal(result.message.attachments[0].name, 'test.txt');
  });
});

test('message validation rejects oversized content, unsafe links and oversized attachments', () => {
  const draft = types.emptyDraft(); draft.content = 'Hello';
  assert.throws(() => backend.buildMessage({ ...draft, content: 'x'.repeat(2001) }, []), /2,000/);
  assert.throws(() => backend.buildMessage({ ...draft, links: [{ label: 'Unsafe', url: 'javascript:alert(1)' }] }, []), /http/);
  assert.throws(() => backend.buildMessage(draft, [new File([new Uint8Array(4_000_001)], 'large.bin')]), error => error.status === 413);
  assert.throws(() => backend.buildMessage({ ...draft, embed: { title: 'x'.repeat(256), description: 'x'.repeat(4096), footer: 'x'.repeat(2048) } }, []), /6,000/);
  assert.throws(() => backend.buildMessage(types.emptyDraft(), []), /Write a message/);
  assert.deepEqual(backend.buildMessage({ ...draft, allowEveryone: true }, []).allowed_mentions.parse, ['users', 'roles', 'everyone']);
});

test('history returns this bot only; edits preserve rich content and block other authors and interactive posts', async () => {
  let existing = message({ embeds: [{ title: 'Keep me' }], attachments: [{ id: 'file', filename: 'test.txt', url: 'https://cdn.discordapp.com/test.txt' }] });
  await withDiscord((endpoint, init) => {
    if (endpoint === `/channels/${channelId}`) return { id: channelId, type: 0, guild_id: strays };
    if (endpoint === '/users/@me') return { id: botId };
    if (endpoint.includes('?limit=50')) return [existing, message({ id: other, author: { id: other } })];
    if (init.method === 'PATCH') {
      assert.deepEqual(JSON.parse(init.body), { content: 'Updated', allowed_mentions: { parse: [], replied_user: false } });
      return { ...existing, content: 'Updated' };
    }
    return existing;
  }, async requests => {
    const history = await backend.dashboardAction({ ...send(), action: 'history' }, [], 'admin');
    assert.equal(history.messages.length, 1);
    const edited = await backend.dashboardAction({ ...send(), action: 'edit', messageId, content: 'Updated' }, [], 'admin');
    assert.equal(edited.message.embeds[0].title, 'Keep me');
    existing = message({ components: [{ type: 1, components: [{ type: 2, style: 1, custom_id: 'event:signup' }] }] });
    for (const action of ['edit', 'delete']) await assert.rejects(backend.dashboardAction({ ...send(), action, messageId }, [], 'admin'), /desktop app/);
    existing = message({ author: { id: other } });
    for (const action of ['message', 'edit', 'delete']) await assert.rejects(backend.dashboardAction({ ...send(), action, messageId }, [], 'admin'), /Only this bot/);
    assert.equal(requests.filter(row => row.init.method === 'PATCH').length, 1);
    assert.equal(requests.filter(row => row.init.method === 'DELETE').length, 0);
  });
});

test('Discord rate limits and network failures never retry a send automatically or expose upstream secrets', async () => {
  await withDiscord(endpoint => endpoint === `/channels/${channelId}` ? { type: 0, guild_id: strays } : Response.json({ token: 'secret' }, { status: 429 }), async requests => {
    await assert.rejects(backend.dashboardAction(send(), [], 'admin'), error => error.status === 429 && !error.message.includes('secret'));
    assert.equal(requests.filter(row => row.init.method === 'POST').length, 1);
  });
  await withDiscord(endpoint => { if (endpoint === `/channels/${channelId}`) return { type: 0, guild_id: strays }; throw Error('private network error'); }, async requests => {
    await assert.rejects(backend.dashboardAction(send(), [], 'admin'), /Check the channel before retrying/);
    assert.equal(requests.length, 2);
  });
});

test('route bounds JSON/multipart bodies and only forwards authenticated requests', async () => {
  let calls = 0;
  const route = load('app/api/admin/bot/route.ts', {
    '@/lib/bot-admin': { botAdminAccess: async () => ({ status: 200, userId: 'trusted-admin' }), botAccessError: status => new Response(null, { status }) },
    '@/lib/discord-dashboard-types': types,
    '@/lib/discord-dashboard': { DashboardError: backend.DashboardError, dashboardSnapshot: async () => ({}), dashboardAction: async (input, files, user) => { calls++; assert.equal(user, 'trusted-admin'); return { files: files.length, action: input.action }; } },
  });
  const make = (body, contentType = 'application/json') => new Request('https://site.test/api/admin/bot', { method: 'POST', headers: { Origin: 'https://site.test', ...(contentType ? { 'Content-Type': contentType } : {}) }, body });
  assert.equal((await route.POST(make('{'))).status, 400);
  assert.equal((await route.POST(make('x'.repeat(65537)))).status, 413);
  assert.equal(calls, 0);
  const form = new FormData(); form.set('payload', JSON.stringify(send())); form.set('files', new File(['abc'], 'file.txt'));
  const response = await route.POST(make(form, null));
  assert.equal(response.status, 200); assert.equal((await response.json()).files, 1);
  assert.match(response.headers.get('Cache-Control'), /no-store/);
  assert.equal(calls, 1);
});
