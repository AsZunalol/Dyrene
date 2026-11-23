'use strict';
const $ = id => document.getElementById(id);
const all = selector => [...document.querySelectorAll(selector)];
const api = window.hub;
let bot = { status: 'stopped', guilds: [], logs: [] }, settings = {};
let logs = [], channels = [], roles = [], mentionNames = {}, memberResults = [];
let busyControl = false, sending = false, channelLoading = false, mentionTab = 'members';
let channelVersion = 0, memberVersion = 0, memberTimer, toastTimer, draftTimer;
let lastGuildSignature = '', lastOnline = false, selection = [0, 0];
const titles = {
  messages: ['Make yourself heard', 'Write, preview, and send a message as your bot.'],
  activity: ['Behind the scenes', 'A live look at your bot’s connection and activity.'],
  settings: ['Make it yours', 'A few preferences. A smoother everyday.']
};
function toast(message, error = false) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').classList.toggle('error', error); $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, error ? 9000 : 3500);
}
function cleanError(error) { return String(error?.message || error).replace(/^Error invoking remote method '[^']+': Error: /, ''); }
function go(page) {
  all('.page').forEach(element => { element.hidden = element.id !== 'page-' + page; });
  all('[data-page]').forEach(element => { element.classList.toggle('active', element.dataset.page === page); element.setAttribute('aria-current', element.dataset.page === page ? 'page' : 'false'); });
  document.querySelector(`[data-page="${page}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  $('page-title').replaceChildren(document.createTextNode(titles[page][0]));
  const dot = document.createElement('span'); dot.className = 'accent'; dot.textContent = '.'; $('page-title').append(dot);
  $('page-subtitle').textContent = titles[page][1]; $('main').scrollTop = 0;
  window.hubExtras?.onPage(page);
}
all('[data-page]').forEach(button => button.addEventListener('click', () => go(button.dataset.page)));
all('[data-go]').forEach(button => button.addEventListener('click', () => go(button.dataset.go)));
$('collapse').addEventListener('click', () => {
  const collapsed = $('sidebar').classList.toggle('collapsed');
  $('collapse').setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
});
$('date').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date());
function setAvatar(id, avatar) {
  const element = $(id);
  if (element.dataset.avatar === (avatar || '')) return;
  element.dataset.avatar = avatar || '';
  if (avatar && /^https:\/\/(cdn\.discordapp\.com|media\.discordapp\.net)\//.test(avatar)) {
    const img = document.createElement('img'); img.src = avatar; img.alt = ''; element.replaceChildren(img);
  } else element.innerHTML = '<svg><use href="#i-bot"/></svg>';
}
function renderControls() {
  const active = ['starting', 'running', 'connecting', 'stopping', 'recovering'].includes(bot.status);
  all('[data-control]').forEach(button => {
    const action = button.dataset.control;
    button.disabled = busyControl || (action === 'start' ? active : !active || bot.status === 'stopping');
  });
  $('send-message').disabled = sending || channelLoading || bot.status !== 'running' || !$('channel-select').value || !($('message-content').value.trim() || window.hubExtras?.hasContent()) || $('message-content').value.length > 2000;
  $('guild-select').disabled = sending || bot.status !== 'running' || !bot.guilds.length;
  $('channel-select').disabled = sending || bot.status !== 'running' || channelLoading || !channels.length;
  $('refresh-channels').disabled = sending || channelLoading || bot.status !== 'running' || !$('guild-select').value;
}
function renderState(state) {
  bot = state;
  const online = state.status === 'running';
  const active = ['starting', 'connecting', 'stopping', 'recovering'].includes(state.status);
  const label = { running: 'Online', stopped: 'Offline', starting: 'Starting', connecting: 'Connecting', stopping: 'Stopping', recovering: 'Recovering', error: 'Needs attention' }[state.status] || state.status;
  all('[data-status-dot]').forEach(dot => { dot.classList.toggle('online', online); dot.classList.toggle('busy', active); dot.classList.toggle('error', state.status === 'error'); });
  $('global-status').lastElementChild.textContent = label; $('global-status').classList.toggle('online', online);
  $('sidebar-status').textContent = online ? 'Bot online' : label === 'Offline' ? 'Bot offline' : label;
  $('bot-name').textContent = state.user?.name || 'Your Discord bot';
  $('preview-name').textContent = state.user?.name || 'Your bot';
  $('bot-detail').textContent = online ? 'Connected to Discord' : active ? `${label}…` : 'Ready when you are.';
  $('connection-error').hidden = !state.error; $('connection-error').textContent = state.error || '';
  $('composer-offline').hidden = online;
  setAvatar('preview-avatar', state.user?.avatar);
  const signature = JSON.stringify(state.guilds.map(guild => [guild.id, guild.name]));
  if (signature !== lastGuildSignature || online !== lastOnline) {
    const selected = $('guild-select').value;
    $('guild-select').replaceChildren();
    if (online && state.guilds.length) {
      state.guilds.forEach(guild => $('guild-select').add(new Option(guild.name, guild.id)));
      if (state.guilds.some(g => g.id === selected)) $('guild-select').value = selected;
      void loadChannels();
    } else {
      $('guild-select').add(new Option(online ? 'No servers found' : 'Connect your bot first', ''));
      ++channelVersion; ++memberVersion; channels = []; roles = []; memberResults = []; channelLoading = false;
      $('channel-select').replaceChildren(new Option('Select a server', '')); updatePreview();
      if (!$('mention-panel').hidden) renderMentions();
    }
    lastGuildSignature = signature; lastOnline = online;
  }
  renderControls();
  window.hubExtras?.onState(state);
}
all('[data-control]').forEach(button => button.addEventListener('click', async () => {
  if (busyControl) return;
  busyControl = true; renderControls();
  try { renderState(await api.control(button.dataset.control)); }
  catch (error) { toast(cleanError(error), true); }
  finally { busyControl = false; renderControls(); }
}));
async function loadChannels() {
  const guildId = $('guild-select').value;
  if (!guildId || bot.status !== 'running') return;
  const version = ++channelVersion; ++memberVersion;
  const previous = $('channel-select').value;
  channelLoading = true; channels = []; roles = []; memberResults = [];
  $('channel-select').replaceChildren(new Option('Loading channels…', '')); renderControls();
  try {
    const [channelData, roleData] = await Promise.allSettled([api.request('channels', { guildId }), api.request('roles', { guildId })]);
    if (version !== channelVersion) return;
    if (channelData.status === 'rejected') throw channelData.reason;
    channels = channelData.value;
    roles = roleData.status === 'fulfilled' ? roleData.value : [];
    if (roleData.status === 'rejected') toast('Could not load roles: ' + cleanError(roleData.reason), true);
    roles.forEach(role => { mentionNames[role.id] = role.name; });
    $('channel-select').replaceChildren();
    const groups = new Map();
    channels.forEach(channel => {
      if (!groups.has(channel.category)) { const group = document.createElement('optgroup'); group.label = channel.category; groups.set(channel.category, group); $('channel-select').append(group); }
      groups.get(channel.category).append(new Option('# ' + channel.name, channel.id));
    });
    if (!channels.length) $('channel-select').add(new Option('No writable channels', ''));
    if (channels.some(channel => channel.id === previous)) $('channel-select').value = previous;
    if (!$('mention-panel').hidden) searchMentions();
  } catch (error) {
    if (version !== channelVersion) return;
    $('channel-select').replaceChildren(new Option('Could not load channels', '')); toast(cleanError(error), true);
  } finally {
    if (version === channelVersion) { channelLoading = false; renderControls(); updatePreview(); }
  }
}
$('guild-select').addEventListener('change', () => { $('mention-search').value = ''; void loadChannels(); });
$('channel-select').addEventListener('change', updatePreview);
$('refresh-channels').addEventListener('click', () => void loadChannels());

const editor = $('message-content');
try { const saved = JSON.parse(localStorage.getItem('az-bot-draft') || '{}'); editor.value = typeof saved.content === 'string' ? saved.content : ''; mentionNames = saved.names && typeof saved.names === 'object' ? saved.names : {}; } catch {}
function saveDraft() {
  clearTimeout(draftTimer);
  try { localStorage.setItem('az-bot-draft', JSON.stringify({ content: editor.value, names: mentionNames, rich: window.hubExtras?.draft() })); $('draft-status').textContent = 'DRAFT SAVED LOCALLY'; }
  catch { $('draft-status').textContent = 'DRAFT COULD NOT BE SAVED'; }
}
function updatePreview() {
  const content = editor.value;
  $('character-count').textContent = `${content.length.toLocaleString()} / 2,000`;
  $('character-count').classList.toggle('over-limit', content.length > 2000);
  $('message-preview').classList.toggle('preview-placeholder', !content);
  if (content) $('message-preview').innerHTML = HubFormat.preview(content, mentionNames);
  else $('message-preview').innerHTML = 'Your message will appear here.<br>Make it a good one.';
  const channel = channels.find(item => item.id === $('channel-select').value);
  $('preview-channel').textContent = channel?.name || 'your-channel';
  renderControls();
  window.hubExtras?.preview();
}
function changed() { updatePreview(); clearTimeout(draftTimer); $('draft-status').textContent = 'SAVING DRAFT…'; draftTimer = setTimeout(saveDraft, 250); }
editor.addEventListener('input', changed);
['select', 'keyup', 'click', 'blur'].forEach(event => editor.addEventListener(event, () => { selection = [editor.selectionStart, editor.selectionEnd]; }));
function format(kind) {
  if (sending) return;
  const result = HubFormat.formatSelection(editor.value, editor.selectionStart, editor.selectionEnd, kind);
  editor.value = result.text; editor.focus(); editor.setSelectionRange(result.start, result.end); selection = [result.start, result.end]; changed();
}
all('[data-format]').forEach(button => { button.addEventListener('mousedown', event => event.preventDefault()); button.addEventListener('click', () => format(button.dataset.format)); });
editor.addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey)) return;
  if (event.key === 'Enter') { event.preventDefault(); void sendMessage(); }
  const kind = { b: 'bold', i: 'italic', u: 'underline' }[event.key.toLowerCase()];
  if (kind) { event.preventDefault(); format(kind); }
});
function insert(text) {
  if (sending) return;
  const start = Math.min(selection[0], editor.value.length), end = Math.min(selection[1], editor.value.length);
  editor.setRangeText(text, start, end, 'end'); selection = [editor.selectionStart, editor.selectionEnd]; editor.focus(); changed();
}
$('clear-draft').addEventListener('click', () => { if (sending) return; editor.value = ''; selection = [0, 0]; $('allow-everyone').checked = false; $('send-result').hidden = true; window.hubExtras?.reset(); changed(); editor.focus(); });
$('open-mentions').addEventListener('click', () => { $('mention-panel').hidden = !$('mention-panel').hidden; if (!$('mention-panel').hidden) { searchMentions(); $('mention-search').focus(); } });
$('close-mentions').onclick = () => { $('mention-panel').hidden = true; };
all('[data-mention-tab]').forEach(button => button.addEventListener('click', () => {
  mentionTab = button.dataset.mentionTab; ++memberVersion;
  all('[data-mention-tab]').forEach(item => item.classList.toggle('active', item === button));
  $('mention-search').placeholder = mentionTab === 'roles' ? 'Find a role…' : 'Search a name or paste a user ID…';
  $('mention-search').value = ''; memberResults = []; searchMentions();
}));
function mentionNotice(text) { const paragraph = document.createElement('p'); paragraph.className = 'muted'; paragraph.textContent = text; $('mention-results').replaceChildren(paragraph); }
function renderMentions() {
  if (bot.status !== 'running' || !$('guild-select').value) return mentionNotice('Connect your bot and choose a server first.');
  const query = $('mention-search').value.trim().toLowerCase();
  const items = mentionTab === 'roles' ? roles.filter(role => role.name.toLowerCase().includes(query)) : memberResults;
  if (!items.length) return mentionNotice(mentionTab === 'members' && !query ? 'Type a name to find members, or paste a Discord user ID.' : 'No matches found. Try another name.');
  $('mention-results').replaceChildren();
  items.forEach(item => {
    const button = document.createElement('button'); button.className = 'mention-result'; button.type = 'button';
    const name = document.createElement('span'); name.textContent = '@' + item.name;
    const detail = document.createElement('small'); detail.textContent = mentionTab === 'roles' ? (item.mentionable ? 'Role' : 'Role · may not notify') : item.username;
    button.append(name, detail);
    const isRole = mentionTab === 'roles';
    button.addEventListener('click', () => { mentionNames[item.id] = item.name; insert(`<@${isRole ? '&' : ''}${item.id}> `); $('mention-panel').hidden = true; });
    $('mention-results').append(button);
  });
}
async function searchMentions() {
  clearTimeout(memberTimer);
  const version = ++memberVersion;
  if (mentionTab === 'roles' || bot.status !== 'running' || !$('guild-select').value || !$('mention-search').value.trim()) return renderMentions();
  mentionNotice('Searching members…');
  try {
    const results = await api.request('members', { guildId: $('guild-select').value, query: $('mention-search').value.trim() });
    if (version !== memberVersion) return;
    memberResults = results; results.forEach(member => { mentionNames[member.id] = member.name; }); renderMentions();
  } catch (error) { if (version === memberVersion) mentionNotice(cleanError(error) + ' You can also try a Discord user ID.'); }
}
$('mention-search').addEventListener('input', () => { ++memberVersion; memberResults = []; clearTimeout(memberTimer); memberTimer = setTimeout(searchMentions, 350); });
$('emoji-toggle').onclick = () => { $('emoji-picker').hidden = !$('emoji-picker').hidden; };
['👋', '🎉', '🐧', '❤️', '🔥', '✅', '📢', '🎮', '🚀', '✨', '👍', '😂', '💚', '📌', '👀', '💬'].forEach(emoji => {
  const button = document.createElement('button'); button.textContent = emoji; button.title = emoji;
  button.onclick = () => { insert(emoji); $('emoji-picker').hidden = true; }; $('emoji-picker').append(button);
});
async function sendMessage() {
  if ($('send-message').disabled || sending) return;
  const payload = { ...window.hubExtras?.payload(), guildId: $('guild-select').value, channelId: $('channel-select').value, content: editor.value, allowEveryone: $('allow-everyone').checked };
  const editId = window.hubExtras?.editId();
  sending = true; editor.disabled = true; $('allow-everyone').disabled = true; $('clear-draft').disabled = true;
  window.hubExtras?.busy(true);
  $('send-message').lastElementChild.textContent = 'Sending…'; $('send-result').hidden = true; renderControls();
  try {
    const result = await api.request(editId ? 'history.edit' : 'send', editId ? { id: editId, message: payload } : payload);
    $('send-result').classList.remove('error'); $('send-result').replaceChildren(document.createTextNode(`${editId ? 'Updated in' : 'Sent to'} #${result.channel}.`));
    const link = document.createElement('button'); link.className = 'text-button'; link.textContent = 'Open in Discord ↗'; link.onclick = () => api.openMessage(result.url).catch(error => toast(cleanError(error), true)); $('send-result').append(link);
    editor.value = ''; selection = [0, 0]; $('allow-everyone').checked = false; window.hubExtras?.reset(); saveDraft(); updatePreview();
  } catch (error) { $('send-result').classList.add('error'); $('send-result').textContent = cleanError(error) + ' Your draft has been kept.'; }
  finally { sending = false; editor.disabled = false; $('allow-everyone').disabled = false; $('clear-draft').disabled = false; window.hubExtras?.busy(false); $('send-message').lastElementChild.textContent = window.hubExtras?.editId() ? 'Save changes' : 'Send message'; $('send-result').hidden = false; renderControls(); }
}
$('send-message').onclick = sendMessage;
function time(value) { return new Date(value).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function renderLogs() {
  const list = $('log-list'); const wasAtBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 40;
  list.replaceChildren();
  const filtered = logs.filter(log => $('log-filter').value === 'all' || log.level === 'error');
  if (!filtered.length) { const empty = document.createElement('div'); empty.className = 'empty-small'; empty.textContent = logs.length ? 'No errors in this session.' : 'Start your bot to see its activity here.'; list.append(empty); }
  filtered.forEach(log => {
    const row = document.createElement('div'); row.className = 'log-row ' + log.level;
    const timestamp = document.createElement('time'); timestamp.textContent = time(log.time);
    const level = document.createElement('span'); level.className = 'log-level'; level.textContent = log.level.toUpperCase();
    const message = document.createElement('span'); message.className = 'log-message'; message.textContent = log.message;
    row.append(timestamp, level, message); list.append(row);
  });
  if (wasAtBottom) list.scrollTop = list.scrollHeight;
  $('log-count').textContent = `${filtered.length} entries`;

}
$('log-filter').onchange = renderLogs;
function renderSettings() {
  Object.entries(settings).forEach(([key, value]) => { if ($('setting-' + key)) $('setting-' + key).checked = value; });
}
all('.switch').forEach(input => input.addEventListener('change', async () => {
  input.disabled = true;
  try { settings = await api.settings({ [input.id.replace('setting-', '')]: input.checked }); toast('Preference saved.'); }
  catch (error) { toast(cleanError(error), true); }
  finally { input.disabled = false; renderSettings(); }
}));
api.onState(renderState);
api.onLog(log => { logs.push(log); if (logs.length > 500) logs.shift(); renderLogs(); });

window.addEventListener('beforeunload', saveDraft);
api.snapshot().then(snapshot => {
  settings = snapshot.settings; logs = snapshot.bot.logs || []; renderSettings(); renderState(snapshot.bot); renderLogs();
  $('token-status').textContent = snapshot.tokenConfigured ? 'Configured' : 'Not configured';
  $('token-status').classList.toggle('online', snapshot.tokenConfigured); updatePreview();
}).catch(error => toast(cleanError(error), true));
