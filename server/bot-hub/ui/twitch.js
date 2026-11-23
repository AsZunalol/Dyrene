'use strict';
(() => {
  const esc = HubFormat.escape;
  let data = { streamers: [], health: {} }, editing = null, active = false, refreshing = null, signature = '', channelVersion = 0;
  let manualBusy = false, manualPreview = null, sendingManual = false;
  titles.twitch = ['Twitch live alerts', 'Custom Discord announcements for your favorite Twitch streamers.'];
  const nav = document.createElement('button'); nav.className = 'nav-item'; nav.dataset.page = 'twitch'; nav.title = 'Twitch alerts';
  nav.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 3h17v12l-5 5h-5l-4 3v-3H4zM9 7v6m6-6v6"/></svg><span>Twitch alerts</span>';
  nav.onclick = () => go('twitch'); document.querySelector('nav').append(nav);
  const page = document.createElement('section'); page.className = 'page'; page.id = 'page-twitch'; page.hidden = true;
  page.innerHTML = `
    <div class="notice"><svg><use href="#i-clock"/></svg><span>Checks every minute while your bot is online and the bot server is running. Automatic alerts post once per stream and channel. Manual sends always show a preview first.</span></div>
    <div class="feature-heading"><span id="twitch-health" class="muted">Loading Twitch alerts…</span><button class="button secondary" id="twitch-refresh">Refresh</button></div>
    <div class="twitch-layout"><div class="panel feature-panel">
      <div class="panel-heading"><h3 id="twitch-form-title">Add a streamer</h3></div>
      <label class="feature-field">TWITCH CHANNEL<input id="twitch-login" maxlength="100" placeholder="Username or https://twitch.tv/streamer" spellcheck="false"></label>
      <div class="destination feature-destination"><label>DISCORD SERVER<select id="twitch-guild"></select></label><label>POST IN CHANNEL<select id="twitch-channel"></select></label></div>
      <label class="feature-field">GO-LIVE MESSAGE<textarea id="twitch-message" maxlength="1500" rows="6"></textarea></label>
      <div class="twitch-tokens"><span>Insert:</span><button data-twitch-token="{streamer}">Streamer</button><button data-twitch-token="{title}">Stream title</button><button data-twitch-token="{game}">Game</button><button data-twitch-token="{url}">Watch link</button><button data-twitch-token="**text**">Bold</button></div>
      <label class="feature-field">MENTION A ROLE<select id="twitch-role"><option value="">Choose a role to insert…</option></select></label>
      <label class="twitch-option"><input type="checkbox" id="twitch-everyone"> Allow @everyone and @here notifications</label>
      <label class="twitch-option"><input type="checkbox" id="twitch-current"> Announce if already live on the first check</label>
      <label class="twitch-option"><input type="checkbox" id="twitch-rich" checked> Include a purple embed with stream title, game, and thumbnail</label>
      <label class="twitch-option"><input type="checkbox" id="twitch-enabled" checked> Enable automatic alerts</label>
      <div class="twitch-preview"><span class="eyebrow">MESSAGE PREVIEW · EXAMPLE STREAM</span><div id="twitch-preview" class="markdown"></div><div id="twitch-embed-example" class="twitch-embed"><strong>Tonight’s adventures with the gang</strong><p>Streaming Grand Theft Auto V</p><div class="twitch-thumbnail-placeholder">Live stream thumbnail appears here</div><small>Live on Twitch</small></div><span class="discord-link-preview">Watch on Twitch ↗</span></div>
      <div class="feature-actions"><button class="button primary" id="twitch-save">Add streamer</button><button class="button secondary" id="twitch-cancel" hidden>Cancel edit</button></div>
      <p class="feature-help">Leave “already live” off to wait for their next stream. Discord formatting and member mentions such as &lt;@member-ID&gt; work in the message.</p>
    </div><div><div class="feature-heading"><h3>Your streamers</h3><span id="twitch-count" class="pill">0</span></div><div id="twitch-list" class="feature-list"></div><div class="panel twitch-activity-panel"><div class="feature-heading"><h3>Alert activity</h3><select id="twitch-activity-filter" aria-label="Filter Twitch activity"><option value="all">All activity</option><option value="sent">Sent messages</option><option value="error">Errors</option><option value="skipped">Skipped alerts</option><option value="check">Checks</option></select></div><p class="feature-help">Latest 200 entries. Checks, skips, and delivery results stay here after restarting.</p><div id="twitch-activity" aria-live="polite"></div></div></div></div>`;
  document.querySelector('.app-footer').before(page);
  const dialog = document.createElement('dialog'); dialog.id = 'twitch-send-dialog'; dialog.className = 'hub-dialog twitch-send-dialog';
  dialog.innerHTML = '<h3>Send live alert now</h3><p id="twitch-send-destination"></p><p id="twitch-send-warning" class="notice" hidden></p><div id="twitch-send-preview"></div><p id="twitch-send-note" class="feature-help"></p><p id="twitch-send-error" class="feature-error" role="alert" hidden></p><div class="feature-actions"><button class="button secondary" id="twitch-send-cancel">Cancel</button><button class="button primary" id="twitch-send-confirm">Send to Discord</button></div>';
  document.body.append(dialog);
  const defaults = '**{streamer} is live!**\n{title}\nPlaying {game}\n{url}';
  const busy = async (button, task) => {
    if (button.disabled) return;
    button.disabled = true;
    try { await task(); } catch (error) { toast(cleanError(error), true); }
    finally { button.disabled = false; }
  };
  function preview() {
    const login = $('twitch-login').value.trim().split('/').filter(Boolean).pop() || 'YourStreamer';
    const values = { streamer: login, title: 'Tonight’s adventures with the gang', game: 'Grand Theft Auto V', url: 'https://www.twitch.tv/' + login };
    const content = $('twitch-message').value.replace(/\{(streamer|title|game|url)\}/g, (_, key) => values[key]);
    $('twitch-preview').innerHTML = HubFormat.preview(content, {});
    $('twitch-embed-example').hidden = !$('twitch-rich').checked;
  }
  function insert(value) {
    const input = $('twitch-message'); input.setRangeText(value, input.selectionStart, input.selectionEnd, 'end'); input.focus(); preview();
  }
  function reset() {
    editing = null; $('twitch-login').value = ''; $('twitch-message').value = defaults;
    $('twitch-everyone').checked = false; $('twitch-current').checked = false; $('twitch-enabled').checked = true; $('twitch-rich').checked = true;
    $('twitch-form-title').textContent = 'Add a streamer'; $('twitch-save').textContent = 'Add streamer'; $('twitch-cancel').hidden = true; preview();
  }
  async function fillChannels(wanted) {
    const version = ++channelVersion, guildId = $('twitch-guild').value;
    $('twitch-channel').replaceChildren(new Option('Loading channels…', '')); $('twitch-channel').disabled = true;
    $('twitch-role').replaceChildren(new Option('Choose a role to insert…', ''));
    if (!guildId || bot.status !== 'running') { $('twitch-channel').replaceChildren(new Option('Start your bot to choose a channel', '')); return; }
    try {
      const [channelsResult, rolesResult] = await Promise.allSettled([api.request('channels', { guildId }), api.request('roles', { guildId })]);
      if (version !== channelVersion) return;
      if (channelsResult.status === 'rejected') throw channelsResult.reason;
      $('twitch-channel').replaceChildren(...channelsResult.value.map(item => new Option('#' + item.name, item.id)));
      if (!channelsResult.value.length) $('twitch-channel').add(new Option('No writable channels', ''));
      if (wanted) $('twitch-channel').value = wanted;
      if (rolesResult.status === 'fulfilled') rolesResult.value.forEach(role => $('twitch-role').add(new Option('@' + role.name, role.id)));
      $('twitch-channel').disabled = false;
    } catch (error) { if (version === channelVersion) { $('twitch-channel').replaceChildren(new Option('Could not load channels', '')); toast(cleanError(error), true); } }
  }
  function onState(state) {
    const next = JSON.stringify([state.status === 'running', state.guilds]);
    if (signature === next) return; signature = next;
    const selected = $('twitch-guild').value;
    $('twitch-guild').replaceChildren(...(state.status === 'running' ? state.guilds : []).map(guild => new Option(guild.name, guild.id)));
    if (!$('twitch-guild').options.length) $('twitch-guild').add(new Option('Connect your bot first', ''));
    if ([...$('twitch-guild').options].some(option => option.value === selected)) $('twitch-guild').value = selected;
    $('twitch-guild').disabled = state.status !== 'running'; void fillChannels(); render();
  }
  function renderHealth() {
    const health = data.health || {};
    const checked = health.checkedAt ? ' Last check: ' + new Date(health.checkedAt * 1000).toLocaleTimeString() + '.' : '';
    const due = health.checkedAt ? Math.max(0, Math.ceil((health.nextCheckAt || health.checkedAt + 60) - Date.now() / 1000)) : 0;
    const next = bot.status === 'running' && data.configured && data.streamers.some(item => item.enabled) ? (due ? ` Next check in about ${due}s.` : ' Next check due shortly.') : '';
    $('twitch-health').textContent = (bot.status !== 'running' ? 'Bot offline — live checks are paused. ' : '') + (health.error || health.message || 'Add a streamer to begin.') + checked + next;
    $('twitch-health').className = health.error ? 'feature-error' : 'muted';
  }
  function button(label, task, danger = false) {
    const element = document.createElement('button'); element.className = 'button ' + (danger ? 'danger-quiet' : 'secondary'); element.textContent = label;
    element.onclick = () => busy(element, task); return element;
  }
  function render() {
    renderHealth(); renderActivity(); $('twitch-count').textContent = data.streamers.length;
    $('twitch-list').replaceChildren();
    if (!data.streamers.length) $('twitch-list').innerHTML = '<div class="panel feature-empty">No streamers yet. Add someone to bring their next stream to your Discord.</div>';
    for (const item of data.streamers) {
      const state = item.state || {};
      const fresh = state.checkedAt && Date.now() / 1000 - state.checkedAt < 150 && bot.status === 'running' && !data.health?.error;
      const status = !item.enabled ? 'PAUSED' : !fresh ? 'WAITING FOR CHECK' : state.live ? 'LIVE' : 'OFFLINE / NOT DISCOVERABLE';
      const card = document.createElement('article'); card.className = 'panel feature-card';
      const explanation = state.error || state.delivery || (state.initialized ? 'Checked. Waiting for the next live update.' : 'Waiting for the first check.');
      card.innerHTML = `<div class="feature-card-head"><h3>${esc(item.login)}</h3><span class="${status === 'LIVE' ? 'twitch-live' : ''}">${status}</span></div><p class="feature-help">Posts in #${esc(item.channelName || item.channelId)} · ${item.richEmbed !== false ? 'Purple embed' : 'Text announcement'}</p><p class="feature-copy">${esc(item.message)}</p><p class="${state.error ? 'feature-error' : 'feature-help'}">${esc(explanation)}</p><div class="feature-actions"></div>`;
      card.querySelector('.feature-actions').append(
        button('Edit', async () => {
          editing = item.id; $('twitch-login').value = item.login; $('twitch-message').value = item.message;
          $('twitch-everyone').checked = item.allowEveryone; $('twitch-current').checked = item.announceCurrent; $('twitch-enabled').checked = item.enabled; $('twitch-rich').checked = item.richEmbed !== false;
          $('twitch-guild').value = item.guildId; await fillChannels(item.channelId);
          $('twitch-form-title').textContent = 'Edit ' + item.login; $('twitch-save').textContent = 'Save changes'; $('twitch-cancel').hidden = false;
          preview(); $('twitch-login').focus();
        }),
        button(item.enabled ? 'Pause' : 'Enable', async () => { await api.request('twitch.save', { ...item, enabled: !item.enabled }); await refresh(); }),
        button('Remove', async () => {
          // Inline confirmation keeps the affected streamer and destination visible.
          const actions = card.querySelector('.feature-actions'); actions.replaceChildren(document.createTextNode('Remove this alert? '),
            button('Keep', refresh), button('Remove alert', async () => { await api.request('twitch.delete', { id: item.id }); if (editing === item.id) reset(); await refresh(); }, true));
        }, true));
      const sendNow = button('Send live alert now', () => openManual(item));
      sendNow.disabled = bot.status !== 'running' || !data.configured || manualBusy;
      sendNow.title = bot.status !== 'running' ? 'Connect the bot using the controls above.' : !data.configured ? 'Twitch is unavailable. Check the connection status.' : 'Preview the current live stream before posting.';
      card.querySelector('.feature-actions').prepend(sendNow);
      if (state.messageUrl) card.querySelector('.feature-actions').append(button('View message', () => api.openMessage(state.messageUrl)));
      $('twitch-list').append(card);
    }
  }
  function renderActivity() {
    const filter = $('twitch-activity-filter').value;
    const items = (data.activity || []).filter(item => filter === 'all' || item.kind === filter);
    $('twitch-activity').replaceChildren();
    if (!items.length) { $('twitch-activity').textContent = 'No matching activity yet. New checks and alerts will appear here.'; return; }
    for (const item of items) {
      const row = document.createElement('article'); row.className = 'twitch-log-row';
      row.innerHTML = `<div><span class="twitch-log-kind ${item.kind === 'error' ? 'feature-error' : ''}">${esc(item.kind.toUpperCase())}</span><time>${esc(new Date(item.at * 1000).toLocaleString())}</time></div><strong>${esc([item.login, item.channelName && '#' + item.channelName].filter(Boolean).join(' → '))}</strong><p>${esc(item.message)}</p>`;
      if (item.url) row.append(button('View message', () => api.openMessage(item.url)));
      $('twitch-activity').append(row);
    }
  }
  function renderManual(message) {
    const container = $('twitch-send-preview'); container.replaceChildren();
    const content = document.createElement('div'); content.className = 'markdown'; content.innerHTML = HubFormat.preview(message.content, {}); container.append(content);
    if (message.embed) {
      const embed = document.createElement('div'); embed.className = 'twitch-embed';
      embed.innerHTML = `<strong>${esc(message.embed.title)}</strong><div class="markdown">${HubFormat.preview(message.embed.description || '', {})}</div><small>${esc(message.embed.footer || '')}</small>`;
      if (/^https:\/\/static-cdn\.jtvnw\.net\//.test(message.embed.image || '')) {
        const img = document.createElement('img'); img.src = message.embed.image; img.alt = 'Current Twitch stream thumbnail'; img.referrerPolicy = 'no-referrer';
        img.onerror = () => { const note = document.createElement('p'); note.textContent = 'Thumbnail unavailable in preview.'; img.replaceWith(note); };
        embed.querySelector('small').before(img);
      }
      container.append(embed);
    }
    const watch = document.createElement('span'); watch.className = 'discord-link-preview'; watch.textContent = 'Watch on Twitch ↗'; container.append(watch);
  }
  async function openManual(item) {
    if (manualBusy) return;
    if (bot.status !== 'running') throw new Error('Start the bot before sending an alert.');
    manualBusy = true;
    try {
      manualPreview = await api.request('twitch.preview', { id: item.id });
      $('twitch-send-destination').textContent = `${manualPreview.login} → ${bot.guilds.find(g => g.id === manualPreview.guildId)?.name || manualPreview.guildId} / #${manualPreview.channelName}`;
      $('twitch-send-warning').textContent = manualPreview.warning || ''; $('twitch-send-warning').hidden = !manualPreview.warning;
      $('twitch-send-error').hidden = true;
      $('twitch-send-note').textContent = 'Review this message before posting. Preview expires in 2 minutes.' + (manualPreview.message.allowEveryone ? ' @everyone / @here notifications are enabled.' : ' @everyone / @here notifications are disabled.');
      $('twitch-send-confirm').disabled = false; $('twitch-send-cancel').disabled = false; $('twitch-send-cancel').textContent = 'Cancel'; $('twitch-send-confirm').textContent = 'Send to #' + manualPreview.channelName;
      renderManual(manualPreview.message); dialog.showModal();
    } catch (error) { manualBusy = false; throw error; }
  }
  function closeManual() { if (sendingManual) return; dialog.close(); manualPreview = null; manualBusy = false; void refresh(); }
  dialog.oncancel = event => { event.preventDefault(); closeManual(); };
  $('twitch-send-cancel').onclick = closeManual;
  $('twitch-send-confirm').onclick = async () => {
    if (!manualPreview || sendingManual || $('twitch-send-confirm').disabled) return;
    sendingManual = true; $('twitch-send-confirm').disabled = true; $('twitch-send-cancel').disabled = true; $('twitch-send-confirm').textContent = 'Sending…';
    try {
      await api.request('twitch.send', { token: manualPreview.token });
      toast('Twitch announcement sent.'); sendingManual = false; closeManual();
    } catch (error) {
      $('twitch-send-error').textContent = cleanError(error); $('twitch-send-error').hidden = false;
      $('twitch-send-note').textContent = 'Open a new preview before trying again. If delivery is unconfirmed, check Discord first.';
      $('twitch-send-confirm').textContent = 'Preview used'; $('twitch-send-cancel').textContent = 'Close';
    } finally { sendingManual = false; $('twitch-send-cancel').disabled = false; void refresh(); }
  };
  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => { try { data = await api.request('twitch.list', {}); render(); } catch (error) { toast(cleanError(error), true); } finally { refreshing = null; } })();
    return refreshing;
  }
  $('twitch-save').onclick = () => busy($('twitch-save'), async () => {
    const previous = data.streamers.find(item => item.id === editing);
    if (bot.status === 'running' && (!$('twitch-channel').value || $('twitch-channel').disabled)) throw new Error('Choose a writable Discord channel before saving.');
    const channelId = $('twitch-channel').value || previous?.channelId;
    await api.request('twitch.save', { id: editing || undefined, login: $('twitch-login').value,
      guildId: $('twitch-guild').value || previous?.guildId, channelId,
      channelName: $('twitch-channel').value ? $('twitch-channel').selectedOptions[0].textContent.replace(/^#/, '') : previous?.channelName || '',
      message: $('twitch-message').value, enabled: $('twitch-enabled').checked,
      allowEveryone: $('twitch-everyone').checked, announceCurrent: $('twitch-current').checked, richEmbed: $('twitch-rich').checked });
    reset(); await refresh(); toast('Streamer saved. Live checks run automatically every minute.');
  });
  $('twitch-refresh').onclick = () => busy($('twitch-refresh'), refresh);
  $('twitch-cancel').onclick = reset;
  $('twitch-guild').onchange = () => fillChannels();
  $('twitch-role').onchange = () => { if ($('twitch-role').value) insert('<@&' + $('twitch-role').value + '> '); $('twitch-role').value = ''; };
  $('twitch-login').oninput = preview; $('twitch-message').oninput = preview;
  $('twitch-rich').onchange = preview; $('twitch-activity-filter').onchange = renderActivity;
  page.querySelectorAll('[data-twitch-token]').forEach(element => { element.onclick = () => insert(element.dataset.twitchToken); });
  const oldPage = window.hubExtras.onPage, oldState = window.hubExtras.onState;
  window.hubExtras.onPage = name => { oldPage(name); active = name === 'twitch'; if (active) void refresh(); };
  window.hubExtras.onState = state => { oldState(state); onState(state); };
  setInterval(() => { if (active && !document.hidden) void refresh(); }, 10000);
  setInterval(() => { if (active && !document.hidden) renderHealth(); }, 1000);
  reset(); onState(bot);
  void refresh();
  go('twitch');
})();
