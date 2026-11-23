import asyncio
from datetime import datetime, timezone
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import AsyncMock, MagicMock
import discord
from hub_features import Store, Features, SignupView, normalize_message


class StorageTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(self.temp.name)

    def tearDown(self):
        self.store.db.close()
        self.temp.cleanup()

    def schedule(self, due=None):
        return self.store.local('schedule.save', {'when': datetime.fromtimestamp(due or time.time() + 60, timezone.utc).isoformat(), 'guildId': '1', 'channelId': '2', 'message': {'content': 'Meeting'}})

    def test_templates_survive_reopen(self):
        saved = self.store.local('template.save', {'name': 'Recruitment', 'message': {'content': '**Hello**', 'links': [{'label': 'Join', 'url': 'https://example.com'}]}})
        other = Store(self.temp.name)
        try:
            self.assertEqual(other.get('templates', saved['id'])['message']['content'], '**Hello**')
        finally:
            other.db.close()

    def test_schedule_claim_is_atomic_and_blocks_edits(self):
        item = self.schedule()
        self.store.change_schedule(item['id'], ['pending'], status='sending')
        with self.assertRaises(ValueError):
            self.store.change_schedule(item['id'], ['pending'], status='sending')
        with self.assertRaises(ValueError):
            self.store.local('schedule.cancel', {'id': item['id']})

    def test_expired_schedule_and_timezone_are_validated(self):
        with self.assertRaises(ValueError):
            self.schedule(time.time() - 1)
        with self.assertRaises(ValueError):
            self.store.local('schedule.save', {'when': '2027-01-01T20:00', 'guildId': '1', 'channelId': '2', 'message': {'content': 'Hi'}})

    def test_embed_only_and_files_only_are_valid(self):
        self.assertIsNotNone(normalize_message({'embed': {'title': 'Announcement'}})['embed'])
        self.assertEqual(len(normalize_message({'files': [{'id': 'a' * 32, 'name': 'image.png'}]})['files']), 1)

    def test_attachment_paths_and_unsafe_links_are_rejected(self):
        for payload in [{'files': [{'id': '../.env', 'name': 'token'}]}, {'embed': {'title': 'x', 'url': 'javascript:alert(1)'}}, {'content': 'x', 'links': [{'label': 'Bad', 'url': 'file:///etc/passwd'}]}]:
            with self.assertRaises(ValueError):
                normalize_message(payload)

    def test_embed_aggregate_limit_and_status_limits(self):
        with self.assertRaises(ValueError):
            normalize_message({'embed': {'title': 'x' * 256, 'description': 'y' * 4096, 'footer': 'z' * 2048}})
        with self.assertRaises(ValueError):
            self.store.local('status.save', {'mode': 'custom', 'lines': ['x'], 'interval': 1})

    def test_one_vote_per_member_changes_choice(self):
        self.store.vote('event', '123', 'Alex', 'attending')
        self.store.vote('event', '123', 'Alex', 'maybe')
        self.assertEqual(self.store.votes('event'), [{'id': '123', 'name': 'Alex', 'choice': 'maybe'}])


class FeatureAsyncTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(self.temp.name)
        self.bot = MagicMock()
        self.bot.change_presence = AsyncMock()
        self.features = Features(self.bot, self.store)

    async def asyncTearDown(self):
        self.store.db.close()
        self.temp.cleanup()

    def pending(self, due):
        return self.store.save('schedules', {'id': 's', 'status': 'pending', 'due': due, 'name': 'Test', 'guildId': '1', 'channelId': '2', 'message': {'content': 'Hi'}})

    async def test_scheduler_sends_once(self):
        self.pending(time.time() - 1)
        self.features.send = AsyncMock(return_value={'id': '123'})
        await self.features.schedule_tick()
        await self.features.schedule_tick()
        self.features.send.assert_awaited_once()
        self.assertEqual(self.store.get('schedules', 's')['status'], 'sent')

    async def test_scheduler_does_not_repeat_uncertain_delivery(self):
        self.pending(time.time() - 1)
        self.features.send = AsyncMock(side_effect=TimeoutError())
        await self.features.schedule_tick()
        await self.features.schedule_tick()
        self.features.send.assert_awaited_once()
        self.assertEqual(self.store.get('schedules', 's')['status'], 'uncertain')

    async def test_missed_announcement_is_not_posted_late(self):
        self.pending(time.time() - 901)
        self.features.send = AsyncMock()
        await self.features.schedule_tick()
        self.features.send.assert_not_awaited()
        self.assertEqual(self.store.get('schedules', 's')['status'], 'missed')

    async def test_inflight_schedule_is_held_after_restart(self):
        self.pending(time.time())
        self.store.change_schedule('s', ['pending'], status='sending')
        self.features.restore()
        self.assertEqual(self.store.get('schedules', 's')['status'], 'uncertain')

    def event(self):
        return self.store.save('events', {'id': 'event', 'title': 'Gang night', 'guildId': '1', 'channelId': '2', 'messageId': '3', 'startsAt': time.time() + 3600, 'closed': False})

    async def test_event_views_are_persistent_and_restore_votes(self):
        event = self.event()
        self.store.vote('event', '4', 'Alex', 'attending')
        view = SignupView(self.features, event)
        self.assertTrue(view.is_persistent())
        self.assertEqual(view.children[0].label, 'Attending · 1')
        self.features.restore()
        self.bot.add_view.assert_called_once()

    async def test_rsvp_can_change_and_closed_events_reject_updates(self):
        event = self.event()
        interaction = MagicMock(guild_id=1)
        interaction.user.id = 4; interaction.user.display_name = 'Alex'
        interaction.message.id = 3
        interaction.response.defer = AsyncMock(); interaction.followup.send = AsyncMock(); interaction.message.edit = AsyncMock()
        await self.features.rsvp('event', interaction, 'attending')
        await self.features.rsvp('event', interaction, 'maybe')
        self.assertEqual(self.store.votes('event')[0]['choice'], 'maybe')
        self.store.save('events', {**event, 'closed': True})
        await self.features.rsvp('event', interaction, 'unavailable')
        self.assertEqual(self.store.votes('event')[0]['choice'], 'maybe')

    async def test_presence_rotates_and_respects_interval(self):
        self.store.local('status.save', {'mode': 'custom', 'status': 'idle', 'activity': 'watching', 'lines': ['One', 'Two'], 'interval': 30})
        await self.features.apply_presence([])
        self.assertEqual(self.bot.change_presence.call_args.kwargs['activity'].name, 'One')
        await self.features.apply_presence([])
        self.assertEqual(self.bot.change_presence.await_count, 1)
        await self.features.apply_presence([], force=True)
        self.assertEqual(self.bot.change_presence.call_args.kwargs['activity'].name, 'Two')

    async def test_message_edit_rejects_another_author(self):
        self.store.save('history', {'id': '3', 'guildId': '1', 'channelId': '2', 'message': {'content': 'Hi'}})
        channel = MagicMock(); channel.fetch_message = AsyncMock(return_value=MagicMock(author=MagicMock(id=9)))
        self.bot.user.id = 8; self.features.channel = lambda *args: channel
        with self.assertRaisesRegex(ValueError, 'Only this bot'):
            await self.features.action('history.delete', {'id': '3'})
