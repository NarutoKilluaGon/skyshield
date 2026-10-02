"""Shared camelCase↔snake_case key helpers (the parser/renderer live in the
project package; the seed command needs the key transform without DRF)."""

import re

_CAMEL_RE = re.compile(r'_+([a-z0-9])')
_SNAKE_RE = re.compile(r'(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])')


def camelize_key(key: str) -> str:
    return _CAMEL_RE.sub(lambda m: m.group(1).upper(), key)


def snakeize_key(key: str) -> str:
    return _SNAKE_RE.sub('_', key).lower()
