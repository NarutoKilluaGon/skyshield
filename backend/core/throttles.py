"""
Anonymous intake throttle — server mirror of the client-side throttle in
services/incidents.ts (one report per window + daily cap, per IP).

Cache-based (locmem in dev; swap CACHES for redis in production). The view
calls `retry_after_for` before doing work and `record` only after a real
record was created — honeypot drops never consume the budget, exactly like
the mock.
"""

import time
from datetime import datetime, timezone

from django.conf import settings
from django.core.cache import cache


class AnonIntakeThrottle:
    def _ident(self, request) -> str:
        forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        if forwarded:
            return forwarded.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR', 'unknown')

    def _keys(self, request) -> tuple[str, str]:
        ident = self._ident(request)
        day = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        return f'skyshield:anon:last:{ident}', f'skyshield:anon:day:{day}:{ident}'

    def retry_after_for(self, request) -> int | None:
        """Seconds the caller must wait, or None when the request may proceed."""
        window = settings.SKYSHIELD_ANON_INTAKE_WINDOW_SECONDS
        daily_max = settings.SKYSHIELD_ANON_INTAKE_DAILY_MAX
        last_key, day_key = self._keys(request)
        now = time.time()

        last = cache.get(last_key)
        if last is not None and now - float(last) < window:
            return max(1, int(window - (now - float(last))) + 1)

        count = cache.get(day_key, 0)
        if count >= daily_max:
            midnight = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
            seconds_to_tomorrow = int((midnight.timestamp() + 86400) - now)
            return max(seconds_to_tomorrow, 1)
        return None

    def record(self, request) -> None:
        """Consume one unit of budget after a successful (non-honeypot) intake."""
        window = settings.SKYSHIELD_ANON_INTAKE_WINDOW_SECONDS
        last_key, day_key = self._keys(request)
        cache.set(last_key, time.time(), timeout=window + 60)
        count = cache.get(day_key, 0)
        cache.set(day_key, count + 1, timeout=86400 + 60)
