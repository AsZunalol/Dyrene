"""Twitch polling and persistent go-live alerts; credentials come only from the server environment."""
import asyncio
import os
import hashlib
import json
import re
import time
import uuid
from urllib.parse import urlparse

import aiohttp
import discord
import hub_scope

LOCAL_ACTIONS = {'twitch.list', 'twitch.save', 'twitch.delete'}
DEFAULT_MESSAGE = '**{streamer} is live!**\n{title}\nPlaying {game}\n{url}'


def credentials():
    client_id = os.getenv('TWITCH_CLIENT_ID', '').strip()
    secret = os.getenv('TWITCH_CLIENT_SECRET', '').strip()
    return {'clientId': client_id, 'secret': secret,
            'revision': hashlib.sha256((client_id + ':' + secret).encode()).hexdigest()}


def login_name(value):
    if not isinstance(value, str):
        raise ValueError('Enter a Twitch username or channel link.')
    value = value.strip().lower()
    if value.startswith(('https://', 'http://')):
        parsed = urlparse(value)
        if parsed.hostname not in ('twitch.tv', 'www.twitch.tv') or parsed.username or parsed.password:
            raise ValueError('Use a twitch.tv channel link.')
        value = parsed.path.strip('/')
    if not re.fullmatch(r'[a-z0-9_]{1,25}', value):
        raise ValueError('Enter a Twitch username, without spaces, or a twitch.tv channel link.')
    return value


def public_state(store):
    config = credentials()
    return {'configured': bool(config.get('clientId') and config.get('secret')),
            'health': store.get('twitch-health', 'current') or {},
            'activity': [item for item in store.list('twitch-activity') if hub_scope.allowed(item.get('guildId'))][:200],
            'streamers': [dict(item, state=store.get('twitch-state', item['id']) or {})
                          for item in store.list('twitch') if hub_scope.allowed(item.get('guildId'))]}


def activity(store, kind, message, rule=None, **details):
    item = {'id': uuid.uuid4().hex, 'at': time.time(), 'kind': kind, 'message': message,
            'guildId': rule.get('guildId') if rule else hub_scope.GUILD_ID,
            'login': rule['login'] if rule else '', 'channelName': rule.get('channelName', '') if rule else '', **details}
    store.save('twitch-activity', item)
    with store.db:
        store.db.execute("DELETE FROM records WHERE kind='twitch-activity' AND rowid NOT IN (SELECT rowid FROM records WHERE kind='twitch-activity' ORDER BY rowid DESC LIMIT 500)")


def delivery_state(delivery):
    status = delivery.get('status')
    result = {'deliveryStatus': status, 'error': None, 'messageUrl': delivery.get('result', {}).get('url')}
    result['delivery'] = {
        'skipped': 'Already live on the first check. Use Send live alert now, or wait for the next stream.',
        'sent': 'Go-live message sent. Automatic repeats are blocked for this stream.',
        'claimed': 'Delivery unconfirmed. Check Discord before posting manually.',
        'uncertain': 'Delivery unconfirmed. Check Discord before posting manually.',
        'failed': 'Could not send. Fix the error, then use Send live alert now to try again.'
    }.get(status, 'Checked this stream. Waiting for the next update.')
    if status in ('failed', 'uncertain', 'claimed'):
        result['error'] = delivery.get('error') or result['delivery']
    return result


def local(store, action, payload):
    from hub_features import text
    if action == 'twitch.list':
        return public_state(store)
    if action == 'twitch.save':
        hub_scope.require_guild(payload.get('guildId'))
        login = login_name(payload.get('login', ''))
        for key in ('guildId', 'channelId'):
            if not re.fullmatch(r'\d{1,20}', str(payload.get(key, ''))):
                raise ValueError('Choose a Discord server and channel.')
        previous = store.get('twitch', payload.get('id')) if payload.get('id') else None
        if previous:
            hub_scope.require_record(previous)
        if payload.get('id') and not previous:
            raise ValueError('This streamer was removed. Refresh the list.')
        rules = store.list('twitch')
        if not previous and len(rules) >= 100:
            raise ValueError('You can save up to 100 streamer alerts.')
        if any(item['id'] != payload.get('id') and item['login'] == login and item['channelId'] == str(payload['channelId']) for item in rules):
            raise ValueError('This streamer already has an alert in that channel. Edit the existing alert.')
        template = text(payload.get('message', DEFAULT_MESSAGE), 1500, 'Custom message', True)
        item = {'id': previous['id'] if previous else uuid.uuid4().hex, 'login': login,
                'guildId': str(payload['guildId']), 'channelId': str(payload['channelId']),
                'channelName': text(payload.get('channelName', ''), 150, 'Channel name'),
                'message': template, 'enabled': payload.get('enabled', True) is True,
                'allowEveryone': payload.get('allowEveryone') is True,
                'richEmbed': payload.get('richEmbed', previous.get('richEmbed', True) if previous else True) is True,
                'announceCurrent': payload.get('announceCurrent') is True}
        # Retargeting an alert starts a fresh baseline, while editing text preserves delivery memory.
        if previous and any(previous[k] != item[k] for k in ('login', 'channelId', 'guildId')):
            store.delete('twitch-state', item['id'])
        store.save('twitch', item)
        activity(store, 'settings', ('Updated alert.' if previous else 'Added alert.') + (' Automatic alerts enabled.' if item['enabled'] else ' Automatic alerts paused.'), item)
        return item
    if action == 'twitch.delete':
        old = store.get('twitch', payload.get('id'))
        if old:
            hub_scope.require_record(old)
            activity(store, 'settings', 'Removed alert.', old)
        store.delete('twitch', payload.get('id'))
        store.delete('twitch-state', payload.get('id'))
        return True
    raise ValueError('Unknown Twitch action.')


def render_message(rule, stream):
    # Twitch titles are untrusted. They cannot introduce Discord mentions or template fields.
    def safe(value):
        return discord.utils.escape_markdown(discord.utils.escape_mentions(str(value))).replace('<@', '<\u200b@')
    values = {'streamer': safe(stream.get('user_name') or rule['login']),
              'title': safe(stream.get('title') or 'Live on Twitch'),
              'game': safe(stream.get('game_name') or 'Twitch'), 'url': 'https://www.twitch.tv/' + rule['login']}
    content = re.sub(r'\{(streamer|title|game|url)\}', lambda match: values[match[1]], rule['message'])
    # Discord's limit is UTF-16 units. Keep the watch link available even when expanded text is long.
    if len(content.encode('utf-16-le')) > 4000:
        content = content.encode('utf-16-le')[:3700].decode('utf-16-le', errors='ignore') + '\n…\n' + values['url']
    message = {'guildId': rule['guildId'], 'channelId': rule['channelId'], 'content': content,
               'allowEveryone': rule['allowEveryone'], 'links': [{'label': 'Watch on Twitch', 'url': values['url']}]}
    if rule.get('richEmbed', True):
        thumbnail = str(stream.get('thumbnail_url', '')).replace('{width}', '640').replace('{height}', '360')
        parsed = urlparse(thumbnail)
        if parsed.scheme != 'https' or parsed.hostname != 'static-cdn.jtvnw.net' or parsed.username or parsed.password:
            thumbnail = ''
        message['embed'] = {'title': values['title'].encode('utf-16-le')[:512].decode('utf-16-le', errors='ignore'),
                            'description': values['streamer'] + ' is streaming **' + values['game'] + '**',
                            'color': '#9146ff', 'url': values['url'], 'image': thumbnail, 'footer': 'Live on Twitch'}
    return message


class TwitchWatcher:
    def __init__(self, features):
        self.features = features
        self.store = features.store
        self.lock = asyncio.Lock()
        self.token = None
        self.token_until = 0
        self.validate_at = 0
        self.revision = None
        self.next_check = 0
        self.previews = {}
        self.rate_limit_until = 0

    async def fetch_streams(self, config, logins):
        if time.time() < self.rate_limit_until:
            raise ValueError('Twitch rate limit reached. Wait before trying again.')
        timeout = aiohttp.ClientTimeout(total=15)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            if self.revision != config['revision']:
                self.token = None
                self.revision = config['revision']
            for attempt in range(2):
                if not self.token or time.time() >= self.token_until:
                    async with session.post('https://id.twitch.tv/oauth2/token', data={
                        'client_id': config['clientId'], 'client_secret': config['secret'],
                        'grant_type': 'client_credentials'}) as response:
                        if response.status != 200:
                            raise ValueError('Twitch could not authenticate. Check your Client ID and Client Secret.')
                        data = await response.json()
                        self.token = data['access_token']
                        self.token_until = time.time() + int(data['expires_in']) - 60
                        self.validate_at = 0
                if time.time() >= self.validate_at:
                    async with session.get('https://id.twitch.tv/oauth2/validate', headers={'Authorization': 'OAuth ' + self.token}) as response:
                        if response.status == 401:
                            self.token = None
                            continue
                        if response.status != 200:
                            raise ValueError('Twitch token validation is temporarily unavailable. Will retry next minute.')
                        self.validate_at = time.time() + 3600
                async with session.get('https://api.twitch.tv/helix/streams',
                    headers={'Client-Id': config['clientId'], 'Authorization': 'Bearer ' + self.token},
                    params=[('first', '100'), *[('user_login', login) for login in logins]]) as response:
                    if response.status == 401:
                        self.token = None
                        continue
                    if response.status == 429:
                        self.next_check = max(time.time() + 60, float(response.headers.get('Ratelimit-Reset', time.time() + 60)))
                        self.rate_limit_until = self.next_check
                        raise ValueError('Twitch rate limit reached. Checks will resume automatically.')
                    if response.status != 200:
                        raise ValueError('Twitch is temporarily unavailable. Will retry next minute.')
                    data = await response.json()
                    return {item['user_login'].lower(): item for item in data['data'] if item.get('type') == 'live'}
            raise ValueError('Twitch rejected the credentials. Update the server Twitch configuration.')

    def claim(self, rule, stream):
        # The destination and stream ID survive editing, removing, or re-adding a rule.
        key = rule['channelId'] + ':' + str(stream['id'])
        with self.store.db:
            cursor = self.store.db.execute('INSERT OR IGNORE INTO records VALUES(?,?,?)',
                ('twitch-delivery', key, json.dumps({'id': key, 'status': 'claimed', 'at': time.time()})))
        return key if cursor.rowcount else None

    async def tick(self, force=False):
        if hub_scope.active_guild.get() is not None:
            # A website refresh must not reset the desktop bot's global polling
            # timer or trigger automatic deliveries for its other destinations.
            return public_state(self.store)
        async with self.lock:
            if not force and time.time() < self.next_check:
                return public_state(self.store)
            # A manual refresh also observes the polling interval / Twitch rate limits.
            if force and time.time() < self.next_check:
                return public_state(self.store)
            self.next_check = time.time() + 60
            config = credentials()
            rules = [item for item in self.store.list('twitch') if item['enabled'] and hub_scope.allowed(item.get('guildId'))]
            health = {'id': 'current', 'checkedAt': time.time(), 'error': None}
            if not config.get('secret'):
                health['message'] = 'Twitch is not configured on the server.'
            elif not rules:
                health['message'] = 'Add or enable a streamer to start live checks.'
            else:
                try:
                    streams = await self.fetch_streams(config, sorted({rule['login'] for rule in rules}))
                    activity(self.store, 'check', f'Checked {len(rules)} alert(s): {len(streams)} streamer(s) live.')
                    for rule in rules:
                        # Re-read after network I/O so removing or pausing a rule takes effect.
                        current = self.store.get('twitch', rule['id'])
                        if current != rule:
                            continue
                        await self.process(rule, streams.get(rule['login']))
                    health['message'] = f'Watching {len(rules)} alert(s). Checking every minute.'
                except Exception as exc:
                    # Never expose HTTP response bodies or credentials through status/logs.
                    health['error'] = str(exc) if isinstance(exc, ValueError) else 'Could not reach Twitch. Check your connection; checks retry automatically.'
                    health['message'] = 'Twitch needs attention.'
                    activity(self.store, 'error', health['error'])
            health['nextCheckAt'] = self.next_check
            self.store.save('twitch-health', health)
            return public_state(self.store)

    async def process(self, rule, stream):
        hub_scope.require_record(rule)
        state = self.store.get('twitch-state', rule['id']) or {}
        initial = not state.get('initialized')
        previous_stream = state.get('streamId')
        state.update(id=rule['id'], initialized=True, live=bool(stream), checkedAt=time.time(), streamId=stream['id'] if stream else None)
        if stream:
            key = self.claim(rule, stream)
            if key:
                if initial and not rule['announceCurrent']:
                    delivery = self.store.save('twitch-delivery', {'id': key, 'status': 'skipped', 'at': time.time()})
                    state.update(delivery_state(delivery))
                    activity(self.store, 'skipped', 'Already live on the first check; waiting for the next stream or a manual send.', rule, streamId=stream['id'])
                else:
                    await self.deliver(rule, stream, render_message(rule, stream), state)
            else:
                delivery = self.store.get('twitch-delivery', rule['channelId'] + ':' + str(stream['id'])) or {}
                state.update(delivery_state(delivery))
                if previous_stream != stream['id']:
                    activity(self.store, 'skipped', 'Automatic repeat blocked. ' + state['delivery'], rule, streamId=stream['id'])
        else:
            state.update(delivery='Checked: offline or not discoverable on Twitch. Waiting for a live stream.', deliveryStatus='offline', error=None, messageUrl=None)
        self.store.save('twitch-state', state)

    async def deliver(self, rule, stream, message, state, manual=False):
        hub_scope.require_record(rule)
        hub_scope.require_guild(message.get('guildId'))
        key = rule['channelId'] + ':' + str(stream['id'])
        claimed = self.store.save('twitch-delivery', {'id': key, 'status': 'claimed', 'at': time.time()})
        state.update(delivery_state(claimed))
        self.store.save('twitch-state', state)
        activity(self.store, 'sending', ('Manual' if manual else 'Automatic') + ' announcement started.', rule, streamId=stream['id'])
        try:
            result = await self.features.send(message, source='twitch')
        except Exception as exc:
            known = isinstance(exc, (ValueError, discord.Forbidden, discord.NotFound))
            if isinstance(exc, discord.Forbidden):
                error = 'Discord denied permission. Allow View Channel, Send Messages, and Embed Links in the destination channel.'
            elif isinstance(exc, discord.NotFound):
                error = 'Discord could not find the destination channel. Edit the alert and select another channel.'
            elif isinstance(exc, ValueError):
                error = str(exc)
            else:
                error = 'Discord delivery could not be confirmed. Check message history and Discord before sending again.'
            delivery = self.store.save('twitch-delivery', {'id': key, 'status': 'failed' if known else 'uncertain', 'at': time.time(), 'error': error})
            state.update(delivery_state(delivery))
            self.store.save('twitch-state', state)
            activity(self.store, 'error', error, rule, streamId=stream['id'])
            if manual:
                raise ValueError(error)
            return None
        delivery = self.store.save('twitch-delivery', {'id': key, 'status': 'sent', 'at': time.time(), 'result': result})
        state.update(delivery_state(delivery))
        self.store.save('twitch-state', state)
        activity(self.store, 'sent', ('Manual' if manual else 'Automatic') + ' announcement sent.', rule, streamId=stream['id'], url=result['url'])
        return result

    async def preview(self, rule_id):
        async with self.lock:
            rule = self.store.get('twitch', rule_id)
            hub_scope.require_record(rule)
            if not rule:
                raise ValueError('This alert was removed. Refresh the list.')
            config = credentials()
            if not config.get('secret'):
                raise ValueError('Twitch is not configured on the server.')
            try:
                streams = await self.fetch_streams(config, [rule['login']])
            except Exception as exc:
                error = str(exc) if isinstance(exc, ValueError) else 'Could not reach Twitch. Try again when your connection is working.'
                activity(self.store, 'error', error, rule)
                raise ValueError(error)
            stream = streams.get(rule['login'])
            if not stream:
                activity(self.store, 'check', 'Manual preview checked Twitch: streamer is offline or not discoverable. Nothing sent.', rule)
                raise ValueError('This streamer is offline or not discoverable on Twitch. Nothing was sent.')
            self.previews = {key: value for key, value in self.previews.items() if value['expiresAt'] > time.time()}
            if len(self.previews) >= 20:
                self.previews.pop(next(iter(self.previews)))
            token = uuid.uuid4().hex
            message = render_message(rule, stream)
            delivery = self.store.get('twitch-delivery', rule['channelId'] + ':' + str(stream['id'])) or {}
            warning = {
                'sent': 'This stream was already announced. Sending now will post another message.',
                'skipped': 'This stream was skipped earlier. Sending now will announce it immediately.',
                'claimed': 'A previous delivery is unconfirmed. Check Discord first to avoid a duplicate.',
                'uncertain': 'A previous delivery is unconfirmed. Check Discord first to avoid a duplicate.',
                'failed': 'The previous delivery failed. Confirm that the problem is fixed before sending.'
            }.get(delivery.get('status'), '')
            preview = {'token': token, 'message': message, 'login': rule['login'], 'channelName': rule.get('channelName') or rule['channelId'],
                       'guildId': rule['guildId'], 'channelId': rule['channelId'], 'warning': warning,
                       'expiresAt': time.time() + 120, 'createdAt': time.time()}
            self.previews[token] = {**preview, 'rule': rule, 'stream': stream, 'deliveryAt': delivery.get('at')}
            activity(self.store, 'preview', 'Prepared a manual announcement preview. Nothing sent yet.', rule, streamId=stream['id'])
            return preview

    async def send_now(self, token):
        async with self.lock:
            # Consume before network I/O. Double clicks and request retries cannot send twice.
            preview = self.previews.pop(str(token), None)
            if not preview or time.time() > preview['expiresAt']:
                raise ValueError('This preview expired or was already used. Open a new preview.')
            rule, stream = preview['rule'], preview['stream']
            hub_scope.require_record(rule)
            hub_scope.require_guild(preview['message'].get('guildId'))
            if self.store.get('twitch', rule['id']) != rule:
                raise ValueError('The alert changed. Open a fresh preview before sending.')
            delivery = self.store.get('twitch-delivery', rule['channelId'] + ':' + str(stream['id'])) or {}
            if delivery.get('at') != preview['deliveryAt']:
                raise ValueError('This stream was handled after your preview opened. Open a fresh preview to review the result.')
            # A preview is a short-lived snapshot. Recheck after 30s to avoid posting an ended/replaced stream.
            if time.time() - preview['createdAt'] > 30:
                config = credentials()
                try:
                    current = (await self.fetch_streams(config, [rule['login']])).get(rule['login'])
                except Exception:
                    activity(self.store, 'error', 'Could not recheck the stream before manual delivery. Nothing sent.', rule)
                    raise ValueError('Could not recheck Twitch. Open a new preview; nothing was sent.')
                if not current or current['id'] != stream['id']:
                    raise ValueError('The stream ended or changed. Open a new preview; nothing was sent.')
            if self.store.get('twitch', rule['id']) != rule:
                raise ValueError('The alert changed while checking Twitch. Open a fresh preview.')
            state = {'id': rule['id'], 'initialized': True, 'live': True, 'checkedAt': time.time(), 'streamId': stream['id']}
            return await self.deliver(rule, stream, preview['message'], state, manual=True)
