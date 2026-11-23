"""Your Discord bot, with a local stdin/stdout bridge for AZ Bot Hub."""
import asyncio
import json
import logging
import math
import os
from pathlib import Path
import random
import re
import sys
import threading

import discord
from discord.ext import commands, tasks
from dotenv import load_dotenv
sys.path.insert(0, str(Path(__file__).resolve().parent))
from hub_features import Features, LIVE_ACTIONS
from hub_twitch import TwitchWatcher
import hub_scope

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / '.env')
HUB_MODE = '--hub' in sys.argv
FACTS = [
    'Penguins can’t fly, but they are amazing swimmers',
    'Emperor penguins can dive over 500 meters deep',
    'Penguins use pebbles to build nests',
    'A group of penguins in water is called a raft',
    'Penguins can drink seawater',
    'Some penguins mate for life',
    'Penguins slide on their bellies to save energy',
    'Baby penguins are called chicks',
]


def emit(kind, **data):
    if HUB_MODE:
        print('@AZHUB@' + json.dumps({'type': kind, **data}, ensure_ascii=True), flush=True)


def snowflake(value):
    if not re.fullmatch(r'[0-9]{1,20}', str(value)):
        raise ValueError('Choose a valid Discord server, channel, or member.')
    return int(value)


def message_options(payload):
    content = payload.get('content', '')
    if not isinstance(content, str) or not content.strip():
        raise ValueError('Write a message first.')
    if len(content.encode('utf-16-le')) // 2 > 2000:
        raise ValueError('Discord messages can contain up to 2,000 characters.')
    user_ids = set(re.findall(r'<@!?(\d{1,20})>', content))
    role_ids = set(re.findall(r'<@&(\d{1,20})>', content))
    if len(user_ids) > 100 or len(role_ids) > 100:
        raise ValueError('A message can mention at most 100 members and 100 roles.')
    mentions = discord.AllowedMentions(
        everyone=payload.get('allowEveryone') is True,
        users=[discord.Object(id=int(i)) for i in user_ids],
        roles=[discord.Object(id=int(i)) for i in role_ids],
        replied_user=False,
    )
    return content, mentions


def can_send(channel):
    if not isinstance(channel, (discord.TextChannel, discord.Thread)) or channel.guild.me is None:
        return False
    perms = channel.permissions_for(channel.guild.me)
    if not perms.view_channel:
        return False
    if isinstance(channel, discord.Thread):
        return perms.send_messages_in_threads and not channel.locked and not channel.archived
    return perms.send_messages


class HubBot(commands.Bot):
    async def setup_hook(self):
        self.features = Features(self)
        self.features.restore()
        self.twitch = TwitchWatcher(self.features)
        self.twitch_alerts.start()
        self.status_rotation.start()
        self.announcements.start()
        if HUB_MODE:
            self.heartbeat.start()
            loop = asyncio.get_running_loop()

            def read_commands():
                for line in sys.stdin:
                    try:
                        command = json.loads(line)
                    except (ValueError, TypeError):
                        continue
                    if loop.is_closed():
                        return
                    asyncio.run_coroutine_threadsafe(self.handle_command(command), loop)
                if not loop.is_closed():
                    asyncio.run_coroutine_threadsafe(self.close(), loop)

            threading.Thread(target=read_commands, daemon=True, name='az-hub-control').start()
        # Discord can throttle command synchronization after repeated restarts.
        # Keep it in the background so it never delays the gateway connection.
        self.command_sync_task = asyncio.create_task(self.sync_commands())

    async def sync_commands(self):
        await self.wait_until_ready()
        try:
            target = discord.Object(id=int(hub_scope.GUILD_ID))
            self.tree.clear_commands(guild=target)
            await self.tree.sync(guild=target)
            synced = await self.tree.sync()
            print(f'Synced {len(synced)} command(s)', flush=True)
        except discord.HTTPException as exc:
            print(f'Command sync failed: {exc}', flush=True)

    def publish_state(self, status=None):
        latency = round(self.latency * 1000) if math.isfinite(self.latency) else None
        emit('state', state={
            'status': status or ('running' if self.is_ready() else 'connecting'),
            'latency': latency,
            'user': {'id': str(self.user.id), 'name': self.user.display_name,
                     'avatar': str(self.user.display_avatar.url)} if self.user else None,
            'guilds': [{'id': str(g.id), 'name': g.name, 'members': g.member_count,
                        'icon': str(g.icon.url) if g.icon else None} for g in self.guilds],
        })

    async def on_ready(self):
        print(f'Logged in as {self.user}', flush=True)
        self.publish_state('running')

    async def on_disconnect(self):
        if not self.is_closed():
            self.publish_state('connecting')

    async def on_resumed(self):
        self.publish_state('running')

    async def on_guild_join(self, guild):
        self.publish_state()

    async def on_guild_remove(self, guild):
        self.publish_state()

    @tasks.loop(seconds=5)
    async def status_rotation(self):
        try:
            await self.features.apply_presence(FACTS)
        except Exception as exc:
            print(f'Status update failed: {exc}', flush=True)

    @tasks.loop(seconds=5)
    async def announcements(self):
        if self.is_ready():
            try:
                await self.features.schedule_tick()
            except Exception as exc:
                print(f'Announcement scheduler error: {exc}', flush=True)

    @tasks.loop(seconds=5)
    async def twitch_alerts(self):
        if self.is_ready():
            try:
                await self.twitch.tick()
            except Exception:
                print('Twitch monitor could not save its status. Check the local data folder.', flush=True)

    @twitch_alerts.before_loop
    async def before_twitch(self):
        await self.wait_until_ready()

    @announcements.before_loop
    async def before_announcements(self):
        await self.wait_until_ready()

    @status_rotation.before_loop
    async def before_status(self):
        await self.wait_until_ready()

    @tasks.loop(seconds=10)
    async def heartbeat(self):
        self.publish_state()

    @heartbeat.before_loop
    async def before_heartbeat(self):
        await self.wait_until_ready()

    async def close(self):
        self.twitch_alerts.cancel()
        self.status_rotation.cancel()
        self.announcements.cancel()
        self.heartbeat.cancel()
        if getattr(self, 'command_sync_task', None):
            self.command_sync_task.cancel()
        await super().close()

    def selected_guild(self, payload):
        hub_scope.require_guild(payload.get('guildId'))
        guild = self.get_guild(snowflake(payload.get('guildId')))
        if guild is None:
            raise ValueError('This bot is no longer in that server. Select another server.')
        return guild

    async def dispatch_action(self, action, payload):
        with hub_scope.website_request(payload) as clean:
            return await self._dispatch_action(action, clean)

    async def _dispatch_action(self, action, payload):
        if 'guildId' in payload:
            hub_scope.require_guild(payload['guildId'])
        if not self.is_ready():
            raise ValueError('Wait for the bot to connect to Discord.')
        if action == 'twitch.check':
            return await self.twitch.tick(force=True)
        if action == 'twitch.preview':
            return await self.twitch.preview(payload.get('id'))
        if action == 'twitch.send':
            return await self.twitch.send_now(payload.get('token'))
        if action == 'status.apply':
            await self.features.apply_presence(FACTS, force=True)
            return True
        if action in LIVE_ACTIONS:
            return await self.features.action(action, payload)
        guild = self.selected_guild(payload)
        if action == 'channels':
            channels = sorted([c for c in [*guild.text_channels, *guild.threads] if can_send(c)],
                              key=lambda c: (getattr(c.category, 'position', -1) if isinstance(c, discord.TextChannel) else 999,
                                             getattr(c, 'position', 0), c.name))
            return [{'id': str(c.id), 'name': c.name,
                     'category': c.category.name if isinstance(c, discord.TextChannel) and c.category else ('Threads' if isinstance(c, discord.Thread) else 'Text channels')}
                    for c in channels]
        if action == 'roles':
            return [{'id': str(r.id), 'name': r.name, 'mentionable': r.mentionable or guild.me.guild_permissions.mention_everyone}
                    for r in reversed(guild.roles) if not r.is_default()]
        if action == 'members':
            query = str(payload.get('query', '')).strip()[:100]
            if not query:
                return []
            if re.fullmatch(r'\d{15,20}', query):
                members = [await guild.fetch_member(int(query))]
            else:
                # REST search avoids requiring the privileged gateway member intent.
                data = await self.http.request(discord.http.Route('GET', '/guilds/{guild_id}/members/search', guild_id=guild.id),
                                               params={'query': query, 'limit': 25})
                members = [discord.Member(data=item, guild=guild, state=guild._state) for item in data]
            return [{'id': str(m.id), 'name': m.display_name, 'username': m.name} for m in members]
        raise ValueError('Unknown bot action.')

    async def on_message(self, message):
        if message.guild and self.user and message.author.id == self.user.id and hasattr(self, 'features'):
            try:
                self.features.record_message(message)
            except Exception as exc:
                print(f'Could not save message history: {exc}', flush=True)

    async def handle_command(self, command):
        if not isinstance(command, dict):
            return
        request_id = command.get('id')
        try:
            action = command.get('action')
            if action == 'shutdown':
                emit('response', id=request_id, result=True)
                await self.close()
                return
            payload = command.get('payload', {})
            if not isinstance(payload, dict):
                raise ValueError('Invalid request.')
            result = await self.dispatch_action(action, payload)
            emit('response', id=request_id, result=result)
        except discord.Forbidden:
            emit('response', id=request_id, error='Discord denied access. Check the bot’s server and channel permissions.')
        except discord.NotFound:
            emit('response', id=request_id, error='That Discord member or channel could not be found.')
        except (ValueError, discord.HTTPException) as exc:
            emit('response', id=request_id, error=str(exc))
        except Exception as exc:
            logging.exception('Bot action failed')
            emit('response', id=request_id, error=f'The action failed ({type(exc).__name__}). Check the activity log.')


bot = HubBot(command_prefix='!', intents=discord.Intents.default())


@bot.tree.command(name='ping', description='Check if bot is alive')
async def ping(interaction: discord.Interaction):
    await interaction.response.send_message('Pong! 🏓')


@bot.tree.command(name='members', description='Show server member count')
async def members(interaction: discord.Interaction):
    if interaction.guild is None:
        await interaction.response.send_message('Use this command in a server.', ephemeral=True)
    else:
        await interaction.response.send_message(f'👥 This server has {interaction.guild.member_count} members!')


def acquire_lock():
    """Prevent starting the same bot folder twice, including through the old launcher."""
    lock = open(ROOT / '.bot.lock', 'a+b')
    lock.seek(0, 2)
    if lock.tell() == 0:
        lock.write(b'0')
        lock.flush()
    lock.seek(0)
    try:
        if os.name == 'nt':
            import msvcrt
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        lock.close()
        raise RuntimeError('This bot is already running. Stop the other bot window before starting it here.')
    return lock


def main():
    token = os.getenv('DISCORD_TOKEN', '').strip()
    if not token:
        message = 'DISCORD_TOKEN is missing. Add it to the .env file next to bot.py, then start again.'
        emit('error', message=message)
        print(message, flush=True)
        return 1
    lock = None
    desktop_lock = None
    try:
        # Read-only exclusive handle also prevents the desktop copy from starting.
        # This protects the migrated schedules and alerts from duplicate workers.
        legacy = os.getenv('BOT_HUB_DESKTOP_LOCK')
        if legacy and Path(legacy).exists():
            if os.name == 'nt':
                import ctypes
                from ctypes import wintypes
                kernel = ctypes.WinDLL('kernel32', use_last_error=True)
                kernel.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                                              ctypes.c_void_p, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
                kernel.CreateFileW.restype = wintypes.HANDLE
                kernel.CloseHandle.argtypes = [wintypes.HANDLE]
                desktop_lock = kernel.CreateFileW(legacy, 0x80000000, 1, None, 3, 0x80, None)
                if desktop_lock == ctypes.c_void_p(-1).value:
                    desktop_lock = None
                    raise RuntimeError('The desktop bot is already running. Stop it there before starting the website bot.')
            else:
                import fcntl
                desktop_lock = open(legacy, 'rb')
                try:
                    fcntl.flock(desktop_lock.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                except OSError:
                    raise RuntimeError('The desktop bot is already running. Stop it there before starting the website bot.')
        lock = acquire_lock()
        bot.run(token, log_handler=logging.StreamHandler(sys.stderr))
    except discord.LoginFailure:
        emit('error', message='Discord rejected the bot token. Update DISCORD_TOKEN in .env.')
        print('Discord rejected the bot token.', flush=True)
        return 1
    except Exception as exc:
        message = str(exc).replace(token, '[redacted]')
        emit('error', message=message)
        print(message, flush=True)
        return 1
    finally:
        if lock:
            lock.close()
        if desktop_lock:
            if os.name == 'nt':
                kernel.CloseHandle(desktop_lock)
            else:
                desktop_lock.close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
