import json
import tempfile
import time
import unittest
from unittest.mock import AsyncMock, MagicMock, call
from hub_features import Store, Features, SignupView
from hub_twitch import TwitchWatcher, public_state
from bot import HubBot
import hub_scope


class GuildScopeTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.scope_token = hub_scope.active_guild.set('1')
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(self.temp.name)
        self.bot = MagicMock()
        self.features = Features(self.bot, self.store)

    def tearDown(self):
        self.store.db.close()
        self.temp.cleanup()
        hub_scope.active_guild.reset(self.scope_token)

    async def test_native_commands_restore_the_original_global_registration(self):
        client = MagicMock()
        client.wait_until_ready = AsyncMock()
        client.guilds = [MagicMock(id=1), MagicMock(id=9)]
        client.tree.sync = AsyncMock(return_value=[])
        await HubBot.sync_commands(client)
        client.tree.copy_global_to.assert_not_called()
        self.assertEqual(client.tree.sync.await_count, 2)
        self.assertEqual(client.tree.sync.await_args_list[0].kwargs['guild'].id, 1)
        self.assertEqual(client.tree.sync.await_args_list[1], call())
        self.assertEqual(client.tree.clear_commands.call_args.kwargs['guild'].id, 1)

    async def test_direct_send_and_command_requests_block_before_discord_access(self):
        with self.assertRaisesRegex(ValueError, 'The Strays'):
            await self.features.send({'guildId': '9', 'channelId': '2', 'content': 'No'})
        self.bot.get_guild.assert_not_called()
        with self.assertRaisesRegex(ValueError, 'The Strays'):
            await HubBot._dispatch_action(self.bot, 'members', {'guildId': '9', 'query': 'Alex'})
        self.bot.is_ready.assert_not_called()
        self.bot.get_guild.return_value.get_channel_or_thread.return_value = None
        with self.assertRaisesRegex(ValueError, 'not available'):
            self.features.channel('1', '999')

    def test_library_and_rules_exclude_other_servers(self):
        for kind in ('history', 'events', 'schedules', 'twitch'):
            for guild in ('1', '9'):
                self.store.save(kind, {'id': guild, 'guildId': guild, 'enabled': True})
        library = self.store.local('library', {})
        for kind in ('history', 'events', 'schedules'):
            self.assertEqual([item['guildId'] for item in library[kind]], ['1'])
        self.assertEqual([item['guildId'] for item in public_state(self.store)['streamers']], ['1'])
        for action in ('schedule.save', 'twitch.save'):
            with self.assertRaisesRegex(ValueError, 'The Strays'):
                self.store.local(action, {'guildId': '9', 'channelId': '2'})

    async def test_saved_ids_cannot_bypass_server_restriction(self):
        self.store.save('history', {'id': 'other', 'guildId': '9', 'channelId': '2'})
        self.store.save('events', {'id': 'other', 'guildId': '9', 'channelId': '2', 'messageId': '3'})
        self.store.save('schedules', {'id': 'other', 'guildId': '9', 'status': 'pending'})
        for action in ('history.edit', 'history.delete', 'event.close'):
            with self.assertRaisesRegex(ValueError, 'The Strays'):
                await self.features.action(action, {'id': 'other'})
        with self.assertRaisesRegex(ValueError, 'The Strays'):
            self.store.local('schedule.cancel', {'id': 'other'})
        self.bot.get_guild.assert_not_called()

    async def test_old_schedules_and_event_buttons_cannot_run_elsewhere(self):
        self.store.save('schedules', {'id': 'other', 'guildId': '9', 'status': 'pending', 'due': time.time() - 1})
        self.store.save('events', {'id': 'other', 'guildId': '9', 'messageId': '3'})
        self.features.send = AsyncMock()
        self.features.restore()
        self.bot.add_view.assert_not_called()
        await self.features.schedule_tick()
        self.features.send.assert_not_awaited()
        self.assertEqual(self.store.get('schedules', 'other')['status'], 'cancelled')
        interaction = MagicMock(guild_id=9)
        interaction.response.send_message = AsyncMock()
        await self.features.rsvp('other', interaction, 'attending')
        self.assertEqual(self.store.votes('other'), [])
        self.assertFalse(await SignupView.interaction_check(None, interaction))

    async def test_twitch_preview_tokens_and_automatic_sends_cannot_escape(self):
        self.features.send = AsyncMock()
        watcher = TwitchWatcher(self.features)
        watcher.fetch_streams = AsyncMock()
        rule = {'id': 'other', 'guildId': '9', 'channelId': '2', 'login': 'example', 'enabled': True}
        self.store.save('twitch', rule)
        with self.assertRaisesRegex(ValueError, 'The Strays'):
            await watcher.preview('other')
        watcher.fetch_streams.assert_not_awaited()
        with self.assertRaisesRegex(ValueError, 'The Strays'):
            await watcher.process(rule, {'id': 'live'})
        watcher.previews['old-token'] = {'expiresAt': time.time() + 60, 'rule': rule, 'stream': {}, 'message': {'guildId': '9'}}
        with self.assertRaisesRegex(ValueError, 'The Strays'):
            await watcher.send_now('old-token')
        self.features.send.assert_not_awaited()
        self.features.restore()
        self.assertFalse(self.store.get('twitch', 'other')['enabled'])

    async def test_native_desktop_requests_remain_unrestricted(self):
        token = hub_scope.active_guild.set(None)
        try:
            rule = self.store.local('twitch.save', {'guildId': '9', 'channelId': '2', 'login': 'native'})
            self.assertEqual(rule['guildId'], '9')
            self.assertEqual(len(public_state(self.store)['streamers']), 1)
            self.features.restore()
            self.assertTrue(self.store.get('twitch', rule['id'])['enabled'])
            with self.assertRaisesRegex(ValueError, 'The Strays'):
                self.store.local('twitch.save', {'guildId': '9', 'channelId': '2', 'login': 'website', '_websiteGuildId': '1'})
            self.assertTrue(hub_scope.allowed('9'), 'website restriction must not leak into the desktop request')
            # A website cannot operate on an outside-server ID, even without a guild in its payload.
            with self.assertRaisesRegex(ValueError, 'The Strays'):
                self.store.local('twitch.delete', {'id': rule['id'], '_websiteGuildId': '1'})
            self.store.local('twitch.delete', {'id': rule['id']})
            self.assertIsNone(self.store.get('twitch', rule['id']))
        finally:
            hub_scope.active_guild.reset(token)

    async def test_website_scope_is_isolated_between_concurrent_requests(self):
        import asyncio
        token = hub_scope.active_guild.set(None)
        try:
            async def website():
                with hub_scope.website_request({'_websiteGuildId': '1'}):
                    await asyncio.sleep(0)
                    self.assertFalse(hub_scope.allowed('9'))
            async def desktop():
                await asyncio.sleep(0)
                self.assertTrue(hub_scope.allowed('9'))
            await asyncio.gather(website(), desktop())
            self.assertTrue(hub_scope.allowed('9'))
        finally:
            hub_scope.active_guild.reset(token)

    async def test_website_refresh_does_not_delay_native_automatic_alerts(self):
        watcher = TwitchWatcher(self.features)
        watcher.next_check = 123
        watcher.fetch_streams = AsyncMock()
        await watcher.tick(force=True)
        self.assertEqual(watcher.next_check, 123)
        watcher.fetch_streams.assert_not_awaited()
