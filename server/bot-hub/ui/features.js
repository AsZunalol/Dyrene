'use strict';
(() => {
  const esc = HubFormat.escape;
  let library = { templates: [], schedules: [], history: [], events: [], presence: null };
  let files = [], editing = null, templateId = null, pageName = 'overview', refreshing = null, guildSignature = '';
  let presenceDirty = false;
  const zones = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const featurePages = {
    schedules: ['Scheduled announcements', 'Write it now. Let your bot handle the timing.'],
    templates: ['Your message library', 'Reusable announcements for your community.'],
    history: ['Sent by your bot', 'Review, edit, and delete your bot’s messages.'],
    events: ['Bring everyone together', 'Post events and keep track of who is coming.'],
    presence: ['Give your bot a voice', 'Choose its status and the messages it rotates through.']
  };
  for (const [key, title] of Object.entries(featurePages)) {
    titles[key] = title;
    const button = document.createElement('button'); button.className = 'nav-item'; button.dataset.page = key;
    const icon = { schedules: 'clock', templates: 'message', history: 'terminal', events: 'server', presence: 'bot' }[key];
    button.innerHTML = `<svg><use href="#i-${icon}"/></svg><span>${{ schedules: 'Schedules', templates: 'Templates', history: 'Message history', events: 'Gang events', presence: 'Bot status' }[key]}</span>`;
    button.title = button.textContent; button.onclick = () => go(key); document.querySelector('nav').append(button);
    const page = document.createElement('section'); page.className = 'page'; page.id = 'page-' + key; page.hidden = true;
    document.querySelector('.app-footer').before(page);
  }
  const picker = prefix => `<div class="destination feature-destination"><label>SERVER<select id="${prefix}-guild"><option value="">Connect your bot first</option></select></label><label>CHANNEL<select id="${prefix}-channel"><option value="">Select a server</option></select></label></div>`;
  $('page-schedules').innerHTML = `<div class="notice"><svg><use href="#i-clock"/></svg><span>The app and bot must be running on an awake PC. Announcements over 15 minutes late are marked missed. Unconfirmed deliveries are held for review.</span></div><div class="feature-heading"><button class="button primary" id="new-schedule">Compose announcement</button><button class="button secondary" data-refresh>Refresh</button><span class="muted">Times shown in ${esc(zones)}</span></div><div id="schedule-list" class="feature-list"></div>`;
  $('page-templates').innerHTML = `<div class="feature-heading"><button class="button primary" id="new-template">Create a template</button><button class="button secondary" data-refresh>Refresh</button></div><div id="template-list" class="feature-grid"></div>`;
  $('page-history').innerHTML = `<div class="panel feature-panel"><div class="panel-heading"><h3>Load earlier messages from a channel</h3></div>${picker('history')}<button class="button secondary" id="import-history">Import bot messages from the latest 100 posts</button><p class="feature-help">New bot messages are saved automatically. Only messages authored by this bot can be edited or deleted.</p></div><div class="feature-heading"><input id="history-search" placeholder="Search message text or channel…" aria-label="Search message history"><button class="button secondary" data-refresh>Refresh</button></div><div id="history-list" class="feature-list"></div>`;
  $('page-events').innerHTML = `<div class="feature-columns"><div class="panel feature-panel"><div class="panel-heading"><h3>Post a gang event</h3></div>${picker('event')}<label class="feature-field">EVENT TITLE<input id="event-title" maxlength="256" placeholder="Gang meeting, convoy, or game night…"></label><label class="feature-field">WHEN <span class="muted">${esc(zones)}</span><input id="event-when" type="datetime-local"></label><label class="feature-field">DETAILS<textarea id="event-description" maxlength="3500" placeholder="Where to meet, what to bring, and anything else to know."></textarea></label><div class="rsvp-demo"><span>✓ Attending</span><span>? Maybe</span><span>— Unavailable</span></div><p class="feature-help">Members choose a button in Discord. One response per member; they can change it. Responses survive bot restarts.</p><button class="button primary" id="post-event">Post event to Discord</button></div><div><div class="feature-heading"><h3>Your events</h3><button class="button secondary" data-refresh>Refresh</button></div><div id="event-list" class="feature-list"></div></div></div>`;
  $('page-presence').innerHTML = `<div class="panel feature-panel presence-panel"><div class="panel-heading"><svg><use href="#i-bot"/></svg><h3>Presence & rotation</h3></div><div class="feature-columns"><label class="feature-field">STATUS<select id="presence-status"><option value="online">Online</option><option value="idle">Idle</option><option value="dnd">Do not disturb</option><option value="invisible">Invisible</option></select></label><label class="feature-field">MESSAGE SOURCE<select id="presence-mode"><option value="custom">My custom messages</option><option value="penguins">Original penguin facts</option></select></label></div><label class="feature-field">ACTIVITY<select id="presence-activity"><option value="playing">Playing</option><option value="watching">Watching</option><option value="listening">Listening to</option><option value="competing">Competing in</option></select></label><label class="feature-field">ROTATING MESSAGES <span class="muted">One per line · up to 20 · 128 characters each</span><textarea id="presence-lines" placeholder="Keeping the gang connected\nPlanning the next convoy\nReady for game night"></textarea></label><label class="feature-field">SECONDS BETWEEN CHANGES<input id="presence-interval" type="number" min="30" max="86400" value="60"></label><div id="presence-preview" class="presence-preview"></div><button class="button primary" id="save-presence">Save bot status</button><p class="feature-help">Applied immediately when online, or on the next connection. Invisible hides the bot’s online presence but keeps it connected.</p></div>`;

  const rich = document.createElement('div'); rich.id = 'rich-tools';
  rich.innerHTML = `<div id="editing-banner" class="notice" hidden><span>Editing a sent message. Existing attachments will be kept.</span><button class="text-button" id="cancel-edit">Cancel edit</button></div><details class="rich-details"><summary>Embed & link buttons <span>Color, images, and richer announcements</span></summary><div class="rich-body"><div class="feature-columns"><label class="feature-field">EMBED TITLE<input id="embed-title" maxlength="256" placeholder="Announcement title"></label><label class="feature-field color-field">COLOR<input id="embed-color" type="color" value="#8b5cf6"></label></div><label class="feature-field">DESCRIPTION<textarea id="embed-description" maxlength="4096" placeholder="Your embed text. Discord formatting works here too."></textarea></label><div class="feature-columns"><label class="feature-field">IMAGE URL<input id="embed-image" type="url" placeholder="https://…"></label><label class="feature-field">THUMBNAIL URL<input id="embed-thumbnail" type="url" placeholder="https://…"></label></div><label class="feature-field">TITLE LINK<input id="embed-url" type="url" placeholder="https://your-gang-website…"></label><label class="feature-field">FOOTER<input id="embed-footer" maxlength="2048" placeholder="Optional footer"></label><div id="link-rows"></div><button class="text-button" id="add-link">+ Add a link button</button></div></details><div class="attachment-bar"><button class="button secondary" id="attach-files">+ Attach files / images</button><span class="muted">Up to 10 files</span></div><div id="attachment-list"></div><div class="template-tools"><select id="composer-template" aria-label="Choose saved template"><option value="">Load a saved template…</option></select><button class="button secondary" id="save-template">Save as template</button></div><details class="rich-details"><summary>Schedule this announcement</summary><div class="rich-body"><label class="feature-field">ANNOUNCEMENT NAME<input id="schedule-name" maxlength="100" placeholder="Gang meeting reminder"></label><label class="feature-field">SEND AT <span class="muted">${esc(zones)}</span><input id="schedule-when" type="datetime-local"></label><button class="button secondary" id="save-schedule">Schedule for selected channel</button><p class="feature-help">Scheduling saves a copy of your message. It will not send now.</p></div></details>`;
  document.querySelector('.checkbox-row').before(rich);
  const richPreview = document.createElement('div'); richPreview.id = 'rich-preview'; $('message-preview').after(richPreview);
  const recovery = document.createElement('div'); recovery.className = 'panel settings-panel';
  recovery.innerHTML = `<div class="panel-heading"><h3>Reliability & alerts</h3></div><label class="setting-row"><div><strong>Automatically recover after a crash</strong><p>Retry after 3, 15, and 30 seconds. Stop after three failures within ten minutes.</p></div><input type="checkbox" class="switch" id="setting-autoRecover"></label><div class="setting-footnote">Clicking Stop or shutting down the bot server always cancels recovery. Invalid tokens and duplicate bot instances require attention instead of repeated restarts.</div>`;
  document.querySelector('.settings-layout > div').prepend(recovery);
  for (const input of recovery.querySelectorAll('input')) input.onchange = async () => {
    input.disabled = true;
    try { settings = await api.settings({ [input.id.slice(8)]: input.checked }); toast('Preference saved.'); }
    catch (error) { toast(cleanError(error), true); }
    finally { input.disabled = false; renderSettings(); }
  };
  const modal = document.createElement('dialog'); modal.className = 'hub-dialog';
  modal.innerHTML = '<h3></h3><p></p><input maxlength="100"><div><button class="button secondary" data-cancel>Cancel</button><button class="button primary" data-confirm>Confirm</button></div>';
  document.body.append(modal);
  function ask(title, description, initial = null) {
    return new Promise(resolve => {
      modal.querySelector('h3').textContent = title; modal.querySelector('p').textContent = description;
      const input = modal.querySelector('input'); input.hidden = initial === null; input.value = initial || '';
      const finish = value => { modal.close(); resolve(value); };
      modal.querySelector('[data-cancel]').onclick = () => finish(null);
      modal.querySelector('[data-confirm]').onclick = () => finish(initial === null ? true : input.value.trim());
      modal.oncancel = event => { event.preventDefault(); finish(null); }; modal.showModal();
      if (initial !== null) input.focus();
    });
  }
  async function run(button, task) {
    if (button.dataset.busy === 'true') return;
    button.dataset.busy = 'true';
    button.disabled = true;
    try { return await task(); } catch (error) { toast(cleanError(error), true); }
    finally { button.dataset.busy = 'false'; button.disabled = false; }
  }
  function pretty(seconds) { return new Date(seconds * 1000).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
  function summary(message) { return message?.content || message?.embed?.title || message?.embed?.description || 'Attachment message'; }
  function empty(id, message) { $(id).innerHTML = `<div class="panel feature-empty">${esc(message)}</div>`; }
  function actionButton(label, task, danger = false) { const button = document.createElement('button'); button.className = 'button ' + (danger ? 'danger-quiet' : 'secondary'); button.textContent = label; button.onclick = () => run(button, task); return button; }
  function card(parent, title, detail, message) {
    const el = document.createElement('article'); el.className = 'panel feature-card';
    el.innerHTML = `<div class="feature-card-head"><h3>${esc(title)}</h3><span>${esc(detail)}</span></div><p class="feature-copy">${esc(message)}</p><div class="feature-actions"></div>`;
    $(parent).append(el); return el;
  }
  function clearRich() {
    for (const key of ['title', 'description', 'image', 'thumbnail', 'url', 'footer']) $('embed-' + key).value = '';
    $('embed-color').value = '#8b5cf6'; $('link-rows').replaceChildren(); files = []; editing = null; templateId = null;
    $('editing-banner').hidden = true; $('attach-files').disabled = false; $('composer-template').value = ''; renderFiles();
  }
  function addLink(link = {}) {
    if ($('link-rows').children.length >= 5) return toast('Use up to five link buttons.', true);
    const row = document.createElement('div'); row.className = 'link-row';
    row.innerHTML = '<input class="link-label" maxlength="80" placeholder="Button label" aria-label="Button label"><input class="link-url" type="url" placeholder="https://…" aria-label="Button link"><button class="icon-button" title="Remove link" aria-label="Remove link">×</button>';
    row.querySelector('.link-label').value = link.label || ''; row.querySelector('.link-url').value = link.url || '';
    row.querySelector('button').onclick = () => { row.remove(); changed(); }; row.oninput = changed; $('link-rows').append(row);
  }
  function payload() {
    const embed = Object.fromEntries(['title', 'description', 'image', 'thumbnail', 'url', 'footer', 'color'].map(key => [key, $('embed-' + key).value]));
    const links = [...$('link-rows').children].map(row => ({ label: row.querySelector('.link-label').value, url: row.querySelector('.link-url').value }));
    return { embed: ['title', 'description', 'image', 'thumbnail', 'footer'].some(key => embed[key]) ? embed : null, links, files };
  }
  function message() { return { ...payload(), content: editor.value, allowEveryone: $('allow-everyone').checked }; }
  function loadMessage(data, edit = null) {
    clearRich(); editor.value = data.content || '';
    for (const key of ['title', 'description', 'image', 'thumbnail', 'url', 'footer', 'color']) if (data.embed?.[key]) $('embed-' + key).value = data.embed[key];
    files = data.files || []; for (const link of data.links || []) addLink(link);
    $('allow-everyone').checked = false; editing = edit; $('editing-banner').hidden = !editing;
    $('rich-tools details').open = !!data.embed || !!data.links?.length;
    $('attach-files').disabled = !!editing; renderFiles(); changed();
    $('send-message').lastElementChild.textContent = editing ? 'Save changes' : 'Send message';
  }
  function renderFiles() {
    $('attachment-list').replaceChildren();
    for (const [index, file] of files.entries()) {
      const row = document.createElement('div'); row.className = 'attachment-chip'; row.innerHTML = `<span>${esc(file.name)} <small>${Math.ceil((file.size || 0) / 1024)} KB</small></span>`;
      if (!editing) { const remove = actionButton('×', async () => { files.splice(index, 1); renderFiles(); changed(); }); row.append(remove); }
      $('attachment-list').append(row);
    }
  }
  function preview() {
    const data = payload(); $('rich-preview').replaceChildren();
    if (data.embed) {
      const embed = data.embed, block = document.createElement('div'); block.className = 'embed-preview'; block.style.borderLeftColor = embed.color;
      block.innerHTML = `<strong>${esc(embed.title)}</strong><div class="markdown">${HubFormat.preview(embed.description, mentionNames)}</div><small>${esc(embed.footer)}</small>`;
      if (embed.image || embed.thumbnail) { const hint = document.createElement('div'); hint.className = 'image-preview-note'; hint.textContent = '▧ Image: ' + (embed.image || embed.thumbnail); block.append(hint); }
      $('rich-preview').append(block);
    }
    for (const link of data.links) { const button = document.createElement('span'); button.className = 'discord-link-preview'; button.textContent = (link.label || 'Link button') + ' ↗'; $('rich-preview').append(button); }
    if (files.length) { const note = document.createElement('p'); note.className = 'feature-help'; note.textContent = files.map(file => '📎 ' + file.name).join(' · '); $('rich-preview').append(note); }
  }
  function renderLibrary() {
    const selectedTemplate = $('composer-template').value;
    $('composer-template').replaceChildren(new Option('Load a saved template…', ''));
    library.templates.forEach(item => $('composer-template').add(new Option(item.name, item.id)));
    $('composer-template').value = selectedTemplate;
    $('template-list').replaceChildren();
    if (!library.templates.length) empty('template-list', 'Save your first template from the message composer.');
    library.templates.forEach(item => {
      const el = card('template-list', item.name, pretty(item.updatedAt), summary(item.message));
      const actions = el.querySelector('.feature-actions');
      actions.append(actionButton('Use template', async () => { loadMessage(item.message); templateId = item.id; go('messages'); }),
        actionButton('Rename', async () => { const name = await ask('Rename template', 'Give this template a clear name.', item.name); if (!name) return; await api.request('template.save', { ...item, name }); await refresh(); }),
        actionButton('Delete', async () => { if (await ask('Delete template?', item.name)) { await api.request('template.delete', { id: item.id }); await refresh(); } }, true));
    });
    $('schedule-list').replaceChildren();
    if (!library.schedules.length) empty('schedule-list', 'No announcements scheduled yet. Compose a message to get started.');
    [...library.schedules].sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || a.due - b.due).forEach(item => {
      const el = card('schedule-list', item.name, `${item.status.toUpperCase()} · ${pretty(item.due)} · #${item.channelName || item.channelId}`, summary(item.message));
      if (item.error) { const note = document.createElement('p'); note.className = 'feature-error'; note.textContent = item.error; el.querySelector('.feature-actions').before(note); }
      const actions = el.querySelector('.feature-actions');
      actions.append(actionButton('Use as draft', async () => { loadMessage(item.message); go('messages'); }));
      if (['pending', 'failed', 'missed', 'cancelled'].includes(item.status)) actions.append(actionButton('Change time', async () => {
        const initial = new Date(Math.max(Date.now() + 600000, item.due * 1000)).toISOString();
        const when = await ask('Reschedule announcement', 'Enter a date/time including timezone, for example 2026-11-24T20:00:00+01:00.', initial);
        if (!when) return; const parsed = new Date(when); if (!Number.isFinite(+parsed)) throw new Error('Enter a valid date and time.');
        await api.request('schedule.save', { ...item, when: parsed.toISOString() }); await refresh();
      }));
      if (['pending', 'failed', 'missed'].includes(item.status)) actions.append(actionButton('Cancel', async () => { await api.request('schedule.cancel', { id: item.id }); await refresh(); }, true));
      if (item.result?.url) actions.append(actionButton('Open message', () => api.openMessage(item.result.url)));
    });
    renderHistory(); renderEvents();
    if (library.presence && !presenceDirty) {
      const config = library.presence;
      for (const key of ['mode', 'status', 'activity', 'interval']) $('presence-' + key).value = config[key];
      $('presence-lines').value = config.lines.join('\n'); presencePreview();
    }
  }
  function renderHistory() {
    const query = $('history-search').value.trim().toLowerCase();
    const items = library.history.filter(item => `${summary(item.message)} ${item.channelName} ${item.guildName}`.toLowerCase().includes(query));
    $('history-list').replaceChildren();
    if (!items.length) empty('history-list', 'No matching messages. Send a message or import a channel’s recent bot posts.');
    items.forEach(item => {
      const el = card('history-list', `${item.deleted ? 'Deleted · ' : ''}#${item.channelName}`, `${pretty(item.createdAt)} · ${item.source}`, summary(item.message));
      const actions = el.querySelector('.feature-actions');
      if (!item.deleted) {
        actions.append(actionButton('Open in Discord', () => api.openMessage(item.url)));
        if (!item.eventId) actions.append(actionButton('Edit message', async () => {
          if (bot.status !== 'running') throw new Error('Start the bot before editing a sent message.');
          go('messages'); loadMessage(item.message, item.id);
          $('guild-select').value = item.guildId; await loadChannels(); $('channel-select').value = item.channelId; updatePreview();
          if (!$('channel-select').value) toast('The original channel is unavailable. Check the bot’s permissions.', true);
        }));
        actions.append(actionButton('Delete message', async () => {
          if (await ask('Delete this Discord message?', 'This removes the bot’s message from Discord.')) { await api.request('history.delete', { id: item.id }); await refresh(); }
        }, true));
      }
      actions.append(actionButton('Copy to draft', async () => { loadMessage(item.message); go('messages'); }));
    });
  }
  function renderEvents() {
    $('event-list').replaceChildren();
    if (!library.events.length) empty('event-list', 'No events yet. Post one to collect signups in Discord.');
    library.events.forEach(event => {
      const el = card('event-list', event.title, `${event.closed ? 'CLOSED' : 'OPEN'} · ${pretty(event.startsAt)}`, event.description);
      const votes = document.createElement('div'); votes.className = 'event-votes';
      for (const [choice, name] of Object.entries({ attending: 'Attending', maybe: 'Maybe', unavailable: 'Unavailable' })) {
        const members = (event.votes || []).filter(vote => vote.choice === choice);
        const column = document.createElement('div'); column.innerHTML = `<strong>${name} <b>${members.length}</b></strong><p>${members.length ? members.map(member => esc(member.name)).join('<br>') : 'No responses yet'}</p>`; votes.append(column);
      }
      el.querySelector('.feature-actions').before(votes);
      const actions = el.querySelector('.feature-actions');
      if (event.url) actions.append(actionButton('Open event', () => api.openMessage(event.url)));
      if (!event.closed && event.messageId) actions.append(actionButton('Close signups', async () => {
        if (await ask('Close signups?', 'Existing responses stay saved. The Discord buttons will be disabled.')) { await api.request('event.close', { id: event.id }); await refresh(); }
      }, true));
      if (event.error) { const warning = document.createElement('p'); warning.className = 'feature-error'; warning.textContent = event.error; el.append(warning); }
    });
  }
  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = api.request('library', {}).then(result => { library = result; renderLibrary(); }).catch(error => toast(cleanError(error), true)).finally(() => { refreshing = null; });
    return refreshing;
  }
  function presencePreview() {
    const mode = $('presence-mode').value;
    $('presence-lines').disabled = mode !== 'custom'; $('presence-activity').disabled = mode !== 'custom';
    const activity = $('presence-activity').selectedOptions[0].textContent;
    $('presence-preview').textContent = mode === 'penguins' ? 'Watching 🐧 Rotating penguin facts' : activity + ' ' + ($('presence-lines').value.split('\n').find(line => line.trim()) || 'your custom status');
  }
  const pickerVersions = {};
  async function fillChannels(prefix) {
    const select = $(prefix + '-channel'), guildId = $(prefix + '-guild').value, previous = select.value;
    const version = (pickerVersions[prefix] || 0) + 1; pickerVersions[prefix] = version;
    select.replaceChildren(new Option(guildId ? 'Loading…' : 'Select a server', '')); select.disabled = true;
    if (!guildId || bot.status !== 'running') return;
    try {
      const items = await api.request('channels', { guildId }); if (pickerVersions[prefix] !== version) return;
      select.replaceChildren(); items.forEach(item => select.add(new Option('# ' + item.name, item.id)));
      if (!items.length) select.add(new Option('No writable channels', ''));
      if (items.some(item => item.id === previous)) select.value = previous;
      select.disabled = !items.length;
    } catch (error) { if (pickerVersions[prefix] === version) { select.replaceChildren(new Option('Could not load channels', '')); toast(cleanError(error), true); } }
  }
  function onState(state) {
    const signature = JSON.stringify([state.status === 'running', state.guilds.map(g => [g.id, g.name])]);
    if (signature !== guildSignature) {
      guildSignature = signature;
      for (const prefix of ['event', 'history']) {
        const select = $(prefix + '-guild'), previous = select.value; select.replaceChildren();
        if (state.status === 'running') state.guilds.forEach(guild => select.add(new Option(guild.name, guild.id)));
        if (!select.options.length) select.add(new Option('Connect your bot first', ''));
        if (state.guilds.some(guild => guild.id === previous)) select.value = previous;
        select.disabled = state.status !== 'running'; void fillChannels(prefix);
      }
    }
    $('post-event').disabled = state.status !== 'running' || $('post-event').dataset.busy === 'true'; $('import-history').disabled = state.status !== 'running' || $('import-history').dataset.busy === 'true';
    if (state.status === 'recovering' && state.retryAt) $('bot-detail').textContent = `Automatic restart in ${Math.max(0, Math.ceil((state.retryAt - Date.now()) / 1000))}s`;
  }
  for (const prefix of ['event', 'history']) $(prefix + '-guild').onchange = () => fillChannels(prefix);
  all('[data-refresh]').forEach(button => { button.onclick = () => run(button, refresh); });
  $('new-schedule').onclick = () => { go('messages'); $('rich-tools details:last-child').open = true; $('schedule-name').focus(); };
  $('new-template').onclick = () => { go('messages'); editor.focus(); };
  $('add-link').onclick = () => { addLink(); changed(); };
  $('attach-files').onclick = () => run($('attach-files'), async () => {
    if (editing) return;
    const selected = await api.pickFiles();
    if (selected.length + files.length > 10) throw new Error('Use up to ten attachments per message.');
    files.push(...selected); renderFiles(); changed();
  });
  for (const input of $('rich-tools').querySelectorAll('input,textarea')) input.addEventListener('input', changed);
  $('cancel-edit').onclick = () => { editing = null; $('editing-banner').hidden = true; $('attach-files').disabled = false; $('send-message').lastElementChild.textContent = 'Send message'; changed(); };
  $('composer-template').onchange = async () => {
    const item = library.templates.find(item => item.id === $('composer-template').value); if (!item) return;
    if (editor.value.trim() && !await ask('Load this template?', 'This replaces the current draft.')) return;
    loadMessage(item.message); templateId = item.id;
  };
  $('save-template').onclick = () => run($('save-template'), async () => {
    const old = library.templates.find(item => item.id === templateId);
    const name = await ask('Save message template', old ? 'Use the same name to update this template, or a new name to save a copy.' : 'Save text, embeds, links, and attachments for reuse.', old?.name || '');
    if (!name) return;
    await api.request('template.save', { name, message: message(), id: name === old?.name ? old.id : undefined }); toast('Template saved.'); await refresh();
  });
  $('save-schedule').onclick = () => run($('save-schedule'), async () => {
    if (editing) throw new Error('Finish or cancel the message edit before scheduling a new post.');
    const value = $('schedule-when').value;
    if (!value) throw new Error('Choose the announcement date and time.');
    await api.request('schedule.save', { name: $('schedule-name').value || 'Announcement', when: new Date(value).toISOString(), timezone: zones,
      guildId: $('guild-select').value, channelId: $('channel-select').value,
      channelName: channels.find(item => item.id === $('channel-select').value)?.name || '', message: message() });
    toast('Announcement scheduled. Keep the bot running at its send time.'); await refresh(); go('schedules');
  });
  $('history-search').oninput = renderHistory;
  $('import-history').onclick = () => run($('import-history'), async () => {
    const result = await api.request('history.import', { guildId: $('history-guild').value, channelId: $('history-channel').value });
    toast(`Imported ${result.count} bot message(s).`); await refresh();
  });
  $('post-event').onclick = () => run($('post-event'), async () => {
    if (!$('event-when').value) throw new Error('Choose an event date and time.');
    const channelName = $('event-channel').selectedOptions[0]?.textContent || '';
    if (!await ask('Post this event?', `${$('event-title').value} → ${channelName}. This creates a message with signup buttons in Discord.`)) return;
    await api.request('event.create', { title: $('event-title').value, description: $('event-description').value, when: new Date($('event-when').value).toISOString(), guildId: $('event-guild').value, channelId: $('event-channel').value });
    toast('Event posted. Members can now sign up in Discord.'); $('event-title').value = ''; $('event-description').value = ''; await refresh();
  });
  for (const input of $('page-presence').querySelectorAll('input,textarea,select')) input.addEventListener('input', () => { presenceDirty = true; presencePreview(); });
  $('save-presence').onclick = () => run($('save-presence'), async () => {
    await api.request('status.save', { mode: $('presence-mode').value, status: $('presence-status').value, activity: $('presence-activity').value,
      lines: $('presence-lines').value.split('\n').map(line => line.trim()).filter(Boolean), interval: Number($('presence-interval').value) });
    presenceDirty = false;
    if (bot.status === 'running') await api.request('status.apply', {});
    toast(bot.status === 'running' ? 'Bot status updated.' : 'Status saved for the next connection.'); await refresh();
  });
  window.hubExtras = {
    payload, preview, draft: () => ({ ...payload(), editing }), editId: () => editing,
    hasContent: () => !!payload().embed || !!files.length,
    reset: () => { clearRich(); void refresh(); },
    busy: value => { for (const input of $('rich-tools').querySelectorAll('input,select,textarea,button')) input.disabled = value; if (!value && editing) $('attach-files').disabled = true; },
    onPage: page => { pageName = page; if (featurePages[page] || page === 'messages') void refresh(); }, onState
  };
  try { const saved = JSON.parse(localStorage.getItem('az-bot-draft') || '{}'); if (saved.rich) { loadMessage({ ...saved.rich, content: editor.value }); if (saved.rich.editing) toast('Your unfinished edit was restored as a new draft.'); } } catch {}
  onState(bot); renderSettings(); updatePreview(); void refresh();
  setInterval(() => { if (['events', 'history', 'schedules'].includes(pageName) && !document.hidden) void refresh(); }, 7000);
})();
