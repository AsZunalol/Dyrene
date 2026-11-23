"""Per-request website boundary; native desktop operations remain unrestricted."""
import json
from pathlib import Path
from contextvars import ContextVar
from contextlib import contextmanager

_config = json.loads((Path(__file__).parent / 'guild_scope.json').read_text(encoding='utf-8'))
GUILD_ID = str(_config['guildId'])
MESSAGE = 'The website can only manage The Strays Discord server.'
active_guild = ContextVar('website_guild', default=None)


@contextmanager
def website_request(payload):
    clean = dict(payload)
    scope = clean.pop('_websiteGuildId', None)
    if scope is None:
        yield clean
        return
    if str(scope) != GUILD_ID:
        raise ValueError(MESSAGE)
    token = active_guild.set(GUILD_ID)
    try:
        yield clean
    finally:
        active_guild.reset(token)


def allowed(guild_id):
    scope = active_guild.get()
    return scope is None or (guild_id is not None and str(guild_id) == scope)


def require_guild(guild_id):
    if not allowed(guild_id):
        raise ValueError(MESSAGE)


def require_record(record):
    if not isinstance(record, dict):
        raise ValueError('This record is unavailable.')
    require_guild(record.get('guildId'))
    return record
