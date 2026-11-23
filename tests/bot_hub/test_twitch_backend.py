import json
import os
import tempfile
import unittest
from unittest.mock import AsyncMock, MagicMock, patch
from hub_features import Store
from hub_twitch import credentials, public_state, TwitchWatcher


class BackendTwitchTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(self.temp.name)
        self.env = patch.dict(os.environ, {'TWITCH_CLIENT_ID': 'backend-client', 'TWITCH_CLIENT_SECRET': 'backend-secret'})
        self.env.start()
        self.features = MagicMock(store=self.store)
        self.features.send = AsyncMock(return_value={'url': 'https://discord.com/channels/1/2/3'})
        self.watcher = TwitchWatcher(self.features)
        self.rule = self.store.local('twitch.save', {'login': 'example', 'guildId': '1', 'channelId': '2'})
        self.stream = {'id': 'stream1', 'user_login': 'example', 'user_name': 'Example',
                       'title': 'Community night', 'game_name': 'GTA V', 'type': 'live'}

    def tearDown(self):
        self.env.stop()
        self.store.db.close()
        self.temp.cleanup()

    def test_environment_only_credentials_never_reach_public_responses(self):
        self.store.save('private', {'id': 'twitch', 'clientId': 'old-client', 'secret': 'old-secret'})
        self.assertEqual(credentials()['secret'], 'backend-secret')
        state = public_state(self.store)
        self.assertTrue(state['configured'])
        for value in ('backend-client', 'backend-secret', 'old-secret', 'clientId', 'clientSecret'):
            self.assertNotIn(value, json.dumps(state))
        with self.assertRaises(ValueError):
            self.store.local('twitch.credentials', {'clientId': 'attacker', 'clientSecret': 'secret'})

    def test_secret_rotation_changes_cached_token_revision(self):
        before = credentials()['revision']
        with patch.dict(os.environ, {'TWITCH_CLIENT_SECRET': 'rotated'}):
            self.assertNotEqual(before, credentials()['revision'])

    async def test_first_live_is_skipped_and_next_stream_is_sent_once(self):
        await self.watcher.process(self.rule, self.stream)
        self.features.send.assert_not_awaited()
        await self.watcher.process(self.rule, None)
        stream = {**self.stream, 'id': 'stream2'}
        await self.watcher.process(self.rule, stream)
        await self.watcher.process(self.rule, stream)
        self.features.send.assert_awaited_once()
        # A fresh watcher, as on a backend restart, preserves duplicate protection.
        await TwitchWatcher(self.features).process(self.rule, stream)
        self.features.send.assert_awaited_once()

    async def test_uncertain_delivery_is_not_retried(self):
        rule = {**self.rule, 'announceCurrent': True}
        self.features.send = AsyncMock(side_effect=TimeoutError('private details'))
        await self.watcher.process(rule, self.stream)
        await self.watcher.process(rule, self.stream)
        self.features.send.assert_awaited_once()
        self.assertNotIn('private details', json.dumps(public_state(self.store)))

    async def test_missing_server_credentials_pauses_checks(self):
        with patch.dict(os.environ, {'TWITCH_CLIENT_SECRET': ''}):
            self.watcher.fetch_streams = AsyncMock()
            await self.watcher.tick(force=True)
            self.watcher.fetch_streams.assert_not_awaited()
            self.assertFalse(public_state(self.store)['configured'])

    async def test_manual_preview_does_not_send(self):
        self.watcher.fetch_streams = AsyncMock(return_value={'example': self.stream})
        preview = await self.watcher.preview(self.rule['id'])
        self.assertIn('token', preview)
        self.features.send.assert_not_awaited()
