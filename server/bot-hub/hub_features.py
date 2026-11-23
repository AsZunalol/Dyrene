"""Persistent desktop features. Local actions never connect to Discord."""
import asyncio
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse

import discord
sys.path.insert(0, str(Path(__file__).resolve().parent))
import hub_twitch
import hub_scope

LOCAL_ACTIONS = {'library', 'template.save', 'template.delete', 'schedule.save', 'schedule.cancel', 'status.save'}
LOCAL_ACTIONS |= hub_twitch.LOCAL_ACTIONS
LIVE_ACTIONS = {'send', 'history.edit', 'history.delete', 'history.import', 'event.create', 'event.close', 'status.apply'}
CHOICES = {'attending': 'Attending', 'maybe': 'Maybe', 'unavailable': 'Unavailable'}


def text(value, maximum, label, required=False):
    if not isinstance(value, str) or len(value.encode('utf-16-le')) // 2 > maximum:
        raise ValueError(f'{label} must be text, up to {maximum:,} characters.')
    if required and not value.strip():
        raise ValueError(f'{label} is required.')
    return value


def url(value):
    text(value, 2048, 'URL')
    parsed = urlparse(value)
    if parsed.scheme not in ('https', 'http') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Use a full https:// or http:// link without embedded credentials.')
    return value


def timestamp(value):
    try:
        result = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        if result.tzinfo is None:
            raise ValueError()
        return result.timestamp()
    except (ValueError, TypeError, OverflowError):
        raise ValueError('Choose a valid date and time with a timezone.')


def normalize_message(payload):
    content = text(payload.get('content', ''), 2000, 'Message')
    raw_embed = payload.get('embed') or {}
    if not isinstance(raw_embed, dict):
        raise ValueError('Invalid embed.')
    embed = {key: text(raw_embed.get(key, ''), limit, label) for key, limit, label in
             [('title', 256, 'Embed title'), ('description', 4096, 'Embed description'), ('footer', 2048, 'Embed footer')]}
    for key in ('image', 'thumbnail', 'url'):
        embed[key] = url(raw_embed[key]) if raw_embed.get(key) else ''
    color = raw_embed.get('color', '#8b5cf6')
    if not isinstance(color, str) or not re.fullmatch(r'#[0-9a-fA-F]{6}', color):
        raise ValueError('Choose a valid embed color.')
    embed['color'] = color
    if sum(len(embed[key].encode('utf-16-le')) // 2 for key in ('title', 'description', 'footer')) > 6000:
        raise ValueError('The complete embed must be under 6,000 characters.')
    if not any(embed[key] for key in ('title', 'description', 'image', 'thumbnail', 'footer')):
        embed = None
    links = payload.get('links') or []
    if not isinstance(links, list) or len(links) > 5:
        raise ValueError('Use at most five link buttons.')
    links = [{'label': text(item.get('label', ''), 80, 'Button label', True), 'url': url(item.get('url', ''))} for item in links]
    files = payload.get('files') or []
    if not isinstance(files, list) or len(files) > 10:
        raise ValueError('Attach at most ten files.')
    clean_files = []
    for item in files:
        file_id = item.get('id', '')
        if not isinstance(file_id, str) or not re.fullmatch(r'[a-f0-9]{32}', file_id):
            raise ValueError('Choose the attachment again using Attach files.')
        name = text(item.get('name', 'attachment'), 180, 'Attachment name', True)
        if '/' in name or '\\' in name:
            raise ValueError('Invalid attachment name.')
        clean_files.append({'id': file_id, 'name': name, 'size': item.get('size', 0)})
    if not content.strip() and not embed and not files:
        raise ValueError('Add message text, an embed, or an attachment.')
    return {'content': content, 'embed': embed, 'links': links, 'files': clean_files,
            'allowEveryone': payload.get('allowEveryone') is True}


def build_embed(data):
    if not data:
        return None
    result = discord.Embed(title=data.get('title') or None, description=data.get('description') or None,
                           color=int(data.get('color', '#8b5cf6')[1:], 16), url=data.get('url') or None)
    if data.get('footer'):
        result.set_footer(text=data['footer'])
    if data.get('image'):
        result.set_image(url=data['image'])
    if data.get('thumbnail'):
        result.set_thumbnail(url=data['thumbnail'])
    return result


def allowed_mentions(payload):
    content = payload.get('content', '')
    users = set(re.findall(r'<@!?(\d{1,20})>', content))
    roles = set(re.findall(r'<@&(\d{1,20})>', content))
    if len(users) > 100 or len(roles) > 100:
        raise ValueError('A message can mention at most 100 members and 100 roles.')
    return discord.AllowedMentions(everyone=payload.get('allowEveryone') is True,
                                  users=[discord.Object(id=int(i)) for i in users],
                                  roles=[discord.Object(id=int(i)) for i in roles], replied_user=False)


class Store:
    def __init__(self, directory=None):
        self.directory = Path(directory or os.getenv('AZ_HUB_DATA_DIR') or Path(__file__).parent / '.hub-data')
        self.directory.mkdir(parents=True, exist_ok=True)
        (self.directory / 'attachments').mkdir(exist_ok=True)
        self.db = sqlite3.connect(self.directory / 'hub.sqlite3', timeout=15)
        self.db.execute('PRAGMA journal_mode=WAL')
        self.db.execute('CREATE TABLE IF NOT EXISTS records (kind TEXT, id TEXT, data TEXT NOT NULL, PRIMARY KEY(kind,id))')
        self.db.execute('CREATE TABLE IF NOT EXISTS votes (event_id TEXT, user_id TEXT, name TEXT, choice TEXT, PRIMARY KEY(event_id,user_id))')
        self.db.commit()

    def get(self, kind, key):
        row = self.db.execute('SELECT data FROM records WHERE kind=? AND id=?', (kind, str(key))).fetchone()
        return json.loads(row[0]) if row else None

    def list(self, kind):
        return [json.loads(row[0]) for row in self.db.execute('SELECT data FROM records WHERE kind=? ORDER BY rowid DESC', (kind,))]

    def save(self, kind, data):
        with self.db:
            self.db.execute('INSERT INTO records VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data',
                            (kind, str(data['id']), json.dumps(data)))
        return data

    def delete(self, kind, key):
        with self.db:
            self.db.execute('DELETE FROM records WHERE kind=? AND id=?', (kind, str(key)))

    def change_schedule(self, key, expected, **changes):
        with self.db:
            self.db.execute('BEGIN IMMEDIATE')
            item = self.get('schedules', key)
            if item is None or item['status'] not in expected:
                raise ValueError('This announcement changed or is already being sent. Refresh the list.')
            item.update(changes)
            self.db.execute('UPDATE records SET data=? WHERE kind=? AND id=?', (json.dumps(item), 'schedules', key))
        return item

    def votes(self, key):
        return [dict(zip(('id', 'name', 'choice'), row)) for row in self.db.execute('SELECT user_id,name,choice FROM votes WHERE event_id=? ORDER BY name', (key,))]

    def vote(self, key, user_id, name, choice):
        if choice not in CHOICES:
            raise ValueError('Invalid RSVP.')
        with self.db:
            self.db.execute('INSERT INTO votes VALUES(?,?,?,?) ON CONFLICT(event_id,user_id) DO UPDATE SET name=excluded.name,choice=excluded.choice',
                            (key, str(user_id), name, choice))

    def local(self, action, payload):
        with hub_scope.website_request(payload) as clean:
            return self._local(action, clean)

    def _local(self, action, payload):
        if 'guildId' in payload:
            hub_scope.require_guild(payload['guildId'])
        if action in hub_twitch.LOCAL_ACTIONS:
            return hub_twitch.local(self, action, payload)
        if action == 'library':
            return {'templates': self.list('templates'), 'schedules': [item for item in self.list('schedules') if hub_scope.allowed(item.get('guildId'))],
                    'history': [item for item in self.list('history') if hub_scope.allowed(item.get('guildId'))][:500],
                    'events': [dict(item, votes=self.votes(item['id'])) for item in self.list('events') if hub_scope.allowed(item.get('guildId'))],
                    'presence': self.get('preferences', 'presence') or {'id': 'presence', 'mode': 'penguins', 'status': 'online', 'activity': 'watching', 'lines': [], 'interval': 60}}
        if action == 'template.save':
            return self.save('templates', {'id': payload.get('id') or uuid.uuid4().hex,
                'name': text(payload.get('name', ''), 100, 'Template name', True),
                'message': normalize_message(payload.get('message', {})), 'updatedAt': time.time()})
        if action == 'template.delete':
            self.delete('templates', payload.get('id')); return True
        if action == 'schedule.save':
            hub_scope.require_guild(payload.get('guildId'))
            if payload.get('id'):
                hub_scope.require_record(self.get('schedules', payload['id']))
            due = timestamp(payload.get('when'))
            if due <= time.time():
                raise ValueError('Choose a future announcement time.')
            for field in ('guildId', 'channelId'):
                if not re.fullmatch(r'\d{1,20}', str(payload.get(field, ''))):
                    raise ValueError('Choose a server and channel.')
            message = normalize_message(payload.get('message', {}))
            item = {'id': payload.get('id') or uuid.uuid4().hex, 'name': text(payload.get('name', 'Announcement'), 100, 'Announcement name', True),
                    'due': due, 'when': payload['when'], 'timezone': text(payload.get('timezone', ''), 100, 'Timezone'),
                    'guildId': str(payload['guildId']), 'channelId': str(payload['channelId']),
                    'channelName': text(payload.get('channelName', ''), 150, 'Channel name'),
                    'message': message, 'status': 'pending', 'error': None, 'createdAt': time.time()}
            if payload.get('id'):
                return self.change_schedule(item['id'], ['pending', 'missed', 'failed', 'cancelled'], **{k: v for k, v in item.items() if k != 'id'})
            return self.save('schedules', item)
        if action == 'schedule.cancel':
            hub_scope.require_record(self.get('schedules', payload.get('id')))
            return self.change_schedule(payload.get('id'), ['pending', 'failed', 'missed'], status='cancelled')
        if action == 'status.save':
            mode = payload.get('mode', 'custom')
            status = payload.get('status', 'online')
            activity = payload.get('activity', 'playing')
            lines = payload.get('lines', [])
            interval = payload.get('interval', 60)
            if mode not in ('custom', 'penguins') or status not in ('online', 'idle', 'dnd', 'invisible') or activity not in ('playing', 'watching', 'listening', 'competing'):
                raise ValueError('Invalid bot status option.')
            if not isinstance(lines, list) or len(lines) > 20 or (mode == 'custom' and not lines):
                raise ValueError('Enter between one and twenty rotating status lines.')
            lines = [text(line, 128, 'Status line', True) for line in lines]
            if not isinstance(interval, int) or not 30 <= interval <= 86400:
                raise ValueError('Rotation interval must be between 30 and 86,400 seconds.')
            return self.save('preferences', {'id': 'presence', 'mode': mode, 'status': status, 'activity': activity, 'lines': lines, 'interval': interval})
        raise ValueError('Unknown local action.')


class SignupView(discord.ui.View):
    async def interaction_check(self, interaction):
        if hub_scope.allowed(interaction.guild_id):
            return True
        await interaction.response.send_message(hub_scope.MESSAGE, ephemeral=True)
        return False

    def __init__(self, features, event):
        super().__init__(timeout=None)
        self.features = features
        self.event_id = event['id']
        counts = {key: 0 for key in CHOICES}
        for vote in features.store.votes(event['id']):
            counts[vote['choice']] += 1
        for choice, label in CHOICES.items():
            button = discord.ui.Button(label=f'{label} · {counts[choice]}',
                style={'attending': discord.ButtonStyle.success, 'maybe': discord.ButtonStyle.primary, 'unavailable': discord.ButtonStyle.secondary}[choice],
                custom_id=f'azb:event:{event["id"]}:{choice}', disabled=event.get('closed', False))
            async def callback(interaction, selected=choice):
                await features.rsvp(event['id'], interaction, selected)
            button.callback = callback
            self.add_item(button)


class Features:
    def __init__(self, bot, store=None):
        self.bot = bot
        self.store = store or Store()
        self.event_locks = {}
        self.presence_signature = None
        self.presence_next = 0
        self.presence_index = 0

    def restore(self):
        for event in self.store.list('events'):
            if hub_scope.allowed(event.get('guildId')) and event.get('messageId') and not event.get('closed'):
                self.bot.add_view(SignupView(self, event), message_id=int(event['messageId']))
        for rule in self.store.list('twitch'):
            if not hub_scope.allowed(rule.get('guildId')) and rule.get('enabled'):
                self.store.save('twitch', {**rule, 'enabled': False})
        for item in self.store.list('schedules'):
            if item['status'] == 'sending':
                self.store.change_schedule(item['id'], ['sending'], status='uncertain', error='The app stopped during delivery. Check Discord before scheduling another copy.')

    def channel(self, guild_id, channel_id):
        hub_scope.require_guild(guild_id)
        guild = self.bot.get_guild(int(guild_id))
        channel = guild.get_channel_or_thread(int(channel_id)) if guild else None
        if channel is None or not isinstance(channel, (discord.TextChannel, discord.Thread)):
            raise ValueError('This channel is not available to the bot.')
        return channel

    def record_message(self, message, payload=None, source='bot', event_id=None):
        if not message.guild or not hub_scope.allowed(message.guild.id):
            return
        old = self.store.get('history', str(message.id)) or {}
        if payload is None and old.get('message'):
            payload = old['message']
        if payload is None:
            first = message.embeds[0] if message.embeds else None
            payload = {'content': message.content, 'embed': None, 'links': [], 'files': [], 'allowEveryone': False}
            if first:
                payload['embed'] = {'title': first.title or '', 'description': first.description or '', 'color': str(first.colour or discord.Colour(0x8b5cf6)),
                                    'image': first.image.url or '', 'thumbnail': first.thumbnail.url or '', 'footer': first.footer.text or '', 'url': first.url or ''}
            for row in message.components:
                for component in getattr(row, 'children', []):
                    if getattr(component, 'url', None):
                        payload['links'].append({'label': component.label, 'url': component.url})
        return self.store.save('history', {**old, 'id': str(message.id), 'guildId': str(message.guild.id),
            'channelId': str(message.channel.id), 'channelName': message.channel.name, 'guildName': message.guild.name,
            'url': message.jump_url, 'message': payload, 'createdAt': message.created_at.timestamp(),
            'attachments': [{'id': str(a.id), 'name': a.filename, 'url': a.url, 'size': a.size} for a in message.attachments],
            'source': old.get('source', source) if source == 'bot' else source,
            'eventId': event_id or old.get('eventId'), 'deleted': old.get('deleted', False)})

    async def send(self, payload, source='app'):
        hub_scope.require_guild(payload.get('guildId'))
        message = normalize_message(payload)
        channel = self.channel(payload['guildId'], payload['channelId'])
        permissions = channel.permissions_for(channel.guild.me)
        if not permissions.view_channel or not (permissions.send_messages_in_threads if isinstance(channel, discord.Thread) else permissions.send_messages):
            raise ValueError('The bot does not have permission to send in this channel.')
        files = []
        try:
            for item in message['files']:
                file_path = self.store.directory / 'attachments' / item['id']
                if not file_path.is_file():
                    raise ValueError(f'Attachment {item["name"]} is missing. Choose it again.')
                if file_path.stat().st_size > channel.guild.filesize_limit:
                    raise ValueError(f'{item["name"]} is larger than this server’s upload limit.')
                files.append(discord.File(file_path, filename=item['name']))
            view = None
            if message['links']:
                view = discord.ui.View(timeout=None)
                for link in message['links']:
                    view.add_item(discord.ui.Button(label=link['label'], url=link['url']))
            sent = await channel.send(content=message['content'] or None, embed=build_embed(message['embed']),
                                      files=files, view=view, allowed_mentions=allowed_mentions(message))
            self.record_message(sent, message, source)
            return {'id': str(sent.id), 'url': sent.jump_url, 'channel': channel.name}
        finally:
            for file in files:
                file.close()

    async def schedule_tick(self, now=None):
        now = time.time() if now is None else now
        for item in self.store.list('schedules'):
            if not hub_scope.allowed(item.get('guildId')):
                if item['status'] == 'pending':
                    self.store.change_schedule(item['id'], ['pending'], status='cancelled', error=hub_scope.MESSAGE)
                continue
            if item['status'] != 'pending' or item['due'] > now:
                continue
            try:
                if now - item['due'] > 900:
                    self.store.change_schedule(item['id'], ['pending'], status='missed', error='More than 15 minutes late while the bot was offline. Reschedule when ready.')
                    continue
                item = self.store.change_schedule(item['id'], ['pending'], status='sending')
            except ValueError:
                continue
            try:
                result = await self.send({**item['message'], 'guildId': item['guildId'], 'channelId': item['channelId']}, source='scheduled')
                self.store.change_schedule(item['id'], ['sending'], status='sent', result=result, sentAt=time.time())
                print(f'Scheduled announcement sent: {item["name"]}', flush=True)
            except (ValueError, discord.Forbidden, discord.NotFound) as exc:
                self.store.change_schedule(item['id'], ['sending'], status='failed', error=str(exc))
            except Exception as exc:
                self.store.change_schedule(item['id'], ['sending'], status='uncertain', error=f'Delivery not confirmed ({type(exc).__name__}). Check Discord before sending another copy.')

    def event_embed(self, event):
        votes = self.store.votes(event['id'])
        result = discord.Embed(title=event['title'], description=event.get('description', ''), color=0x8b5cf6)
        result.add_field(name='When', value=f'<t:{int(event["startsAt"])}:F>\n<t:{int(event["startsAt"])}:R>', inline=False)
        for choice, label in CHOICES.items():
            result.add_field(name=label, value=str(sum(v['choice'] == choice for v in votes)))
        result.set_footer(text='Signups closed' if event.get('closed') else 'Choose a button below. You can change your response.')
        return result

    async def rsvp(self, key, interaction, choice):
        if not hub_scope.allowed(interaction.guild_id):
            await interaction.response.send_message(hub_scope.MESSAGE, ephemeral=True)
            return
        await interaction.response.defer(ephemeral=True)
        async with self.event_locks.setdefault(key, asyncio.Lock()):
            event = self.store.get('events', key)
            if not event or event.get('closed') or str(interaction.guild_id) != event['guildId'] or str(interaction.message.id) != event.get('messageId'):
                await interaction.followup.send('These signups are closed or unavailable.', ephemeral=True)
                return
            self.store.vote(key, interaction.user.id, interaction.user.display_name, choice)
            try:
                await interaction.message.edit(embed=self.event_embed(event), view=SignupView(self, event), allowed_mentions=discord.AllowedMentions.none())
            except discord.HTTPException:
                await interaction.followup.send('Your response is saved. The public count could not refresh yet.', ephemeral=True)
                return
            await interaction.followup.send(f'Your response is now **{CHOICES[choice]}**.', ephemeral=True)

    async def apply_presence(self, facts, force=False):
        config = self.store.get('preferences', 'presence') or {'mode': 'penguins', 'status': 'online', 'activity': 'watching', 'lines': [], 'interval': 60}
        signature = json.dumps(config, sort_keys=True)
        if not force and signature == self.presence_signature and time.time() < self.presence_next:
            return
        if signature != self.presence_signature:
            self.presence_index = 0
        lines = config['lines'] if config['mode'] == 'custom' else ['🐧 ' + line for line in facts]
        name = lines[self.presence_index % len(lines)]
        activity = getattr(discord.ActivityType, config['activity']) if config['mode'] == 'custom' else discord.ActivityType.watching
        await self.bot.change_presence(status=getattr(discord.Status, config['status']), activity=discord.Activity(type=activity, name=name))
        self.presence_index += 1
        self.presence_signature = signature
        self.presence_next = time.time() + config['interval']

    async def action(self, action, payload):
        if action == 'send':
            return await self.send(payload)
        if action == 'history.import':
            channel = self.channel(payload['guildId'], payload['channelId'])
            count = 0
            async for message in channel.history(limit=100):
                if message.author.id == self.bot.user.id:
                    self.record_message(message); count += 1
            return {'count': count}
        if action in ('history.edit', 'history.delete'):
            record = self.store.get('history', payload.get('id'))
            if not record or record.get('deleted'):
                raise ValueError('This message is unavailable or already deleted.')
            hub_scope.require_record(record)
            channel = self.channel(record['guildId'], record['channelId'])
            try:
                original = await channel.fetch_message(int(record['id']))
            except discord.NotFound:
                self.store.save('history', {**record, 'deleted': True})
                raise ValueError('This message was already deleted in Discord.')
            if original.author.id != self.bot.user.id:
                raise ValueError('Only this bot’s messages can be changed.')
            if action == 'history.delete':
                await original.delete()
                self.store.save('history', {**record, 'deleted': True})
                if record.get('eventId'):
                    event = self.store.get('events', record['eventId'])
                    if event:
                        self.store.save('events', {**event, 'closed': True, 'deleted': True})
                return True
            if record.get('eventId'):
                raise ValueError('Manage signup messages from Events to preserve their buttons.')
            changed = normalize_message(payload.get('message', {}))
            if changed['files'] != record['message'].get('files', []):
                raise ValueError('Editing preserves existing attachments. Send a new message to change uploads.')
            view = discord.ui.View(timeout=None) if changed['links'] else None
            if view:
                for link in changed['links']:
                    view.add_item(discord.ui.Button(label=link['label'], url=link['url']))
            # Keep existing uploads when editing; new attachments are sent as new messages.
            edited = await original.edit(content=changed['content'] or None, embed=build_embed(changed['embed']), view=view, allowed_mentions=allowed_mentions(changed))
            self.record_message(edited, changed, record.get('source', 'app'))
            return {'id': str(edited.id), 'url': edited.jump_url, 'channel': channel.name}
        if action == 'event.create':
            starts = timestamp(payload.get('when'))
            if starts <= time.time():
                raise ValueError('Choose a future event time.')
            channel = self.channel(payload['guildId'], payload['channelId'])
            event = {'id': uuid.uuid4().hex, 'title': text(payload.get('title', ''), 256, 'Event title', True),
                     'description': text(payload.get('description', ''), 3500, 'Event description'), 'startsAt': starts,
                     'guildId': str(channel.guild.id), 'channelId': str(channel.id), 'channelName': channel.name,
                     'closed': False, 'createdAt': time.time()}
            self.store.save('events', event)
            try:
                message = await channel.send(embed=self.event_embed(event), view=SignupView(self, event), allowed_mentions=discord.AllowedMentions.none())
            except Exception:
                self.store.save('events', {**event, 'closed': True, 'error': 'Posting was not confirmed. Check Discord before posting again.'})
                raise
            event.update(messageId=str(message.id), url=message.jump_url)
            self.store.save('events', event)
            self.record_message(message, source='event', event_id=event['id'])
            return event
        if action == 'event.close':
            key = payload.get('id')
            async with self.event_locks.setdefault(key, asyncio.Lock()):
                event = self.store.get('events', key)
                if not event or not event.get('messageId'):
                    raise ValueError('Event not found.')
                hub_scope.require_record(event)
                message = await self.channel(event['guildId'], event['channelId']).fetch_message(int(event['messageId']))
                event['closed'] = True
                await message.edit(embed=self.event_embed(event), view=SignupView(self, event), allowed_mentions=discord.AllowedMentions.none())
                self.store.save('events', event)
                return event
        raise ValueError('Unknown feature action.')


if __name__ == '__main__':
    try:
        request = json.loads(sys.stdin.readline())
        if request.get('action') not in LOCAL_ACTIONS:
            raise ValueError('This action requires the running bot.')
        result = Store().local(request['action'], request.get('payload', {}))
        print(json.dumps({'result': result}))
    except Exception as exc:
        print(json.dumps({'error': str(exc)}))
        sys.exit(1)
