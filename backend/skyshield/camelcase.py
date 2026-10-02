"""
camelCase ↔ snake_case wire translation.

The frontend contract (src/types) is camelCase; Django/DRF internals are
snake_case. Instead of adding a dependency (djangorestframework-camel-case)
we translate recursively at the renderer/parser boundary:

- parser:   request JSON keys  camelCase → snake_case
- renderer: response JSON keys snake_case → camelCase

The transform is symmetric, so keys that arrive already-snake (or already
camel, like the seeded JSONField contents) round-trip unchanged: keys without
underscores are never touched by the camelizer, and the server never reads
nested JSONField keys (filtering/sorting uses denormalised columns).
"""
import re

from rest_framework.parsers import JSONParser
from rest_framework.renderers import JSONRenderer

from core.camelcase_helpers import camelize_key, snakeize_key  # noqa: F401 (re-exported)


def transform(data, fn):
    """Recursively rewrite every dict key with `fn`."""
    if isinstance(data, dict):
        return {fn(k) if isinstance(k, str) else k: transform(v, fn) for k, v in data.items()}
    if isinstance(data, (list, tuple)):
        return [transform(item, fn) for item in data]
    return data


class CamelCaseJSONRenderer(JSONRenderer):
    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is not None:
            data = transform(data, camelize_key)
        return super().render(data, accepted_media_type, renderer_context)


class CamelCaseJSONParser(JSONParser):
    def parse(self, stream, media_type=None, parser_context=None):
        data = super().parse(stream, media_type=media_type, parser_context=parser_context)
        return transform(data, snakeize_key)
