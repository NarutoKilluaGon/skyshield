"""API-wide middleware: CSRF cookie provisioning + security headers + idempotency."""

from django.http import HttpResponse
from django.middleware.csrf import get_token


class EnsureCsrfCookieMiddleware:
    """
    The SPA reads the `csrftoken` cookie to build its X-CSRFToken header
    (services/client.ts). Guarantee the cookie exists on every /api/ response
    so the very first login → subsequent mutation sequence works, and so the
    rotated token after login/logout is always delivered.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/'):
            get_token(request)
        return self.get_response(request)


class ApiSecurityHeadersMiddleware:
    """
    The security headers from docs/DEPLOY.md, applied to API responses.
    (The frontend host adds the full set including CSP at the edge; the API
    keeps its own answers unframeable and unsniffable.)
    """

    HEADERS = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
        'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    }

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.path.startswith('/api/'):
            for key, value in self.HEADERS.items():
                response.setdefault(key, value)
        return response


class IdempotencyMiddleware:
    """
    M5 — honor `Idempotency-Key` on mutating API requests.

    The first 2xx answer for (session, key, method, path) is stored verbatim;
    a replay returns the stored response with `Idempotency-Replayed: true`
    instead of executing the mutation again. This is what makes the offline
    queue's retry-after-ambiguous-failure safe: the queued report carries a
    stable key, so a flush that timed out client-side but landed server-side
    never files a duplicate. Failures (4xx/5xx) are never recorded — they stay
    retryable, and the queue keeps its canonical 409/422 shapes.
    """

    MUTATING = {'POST', 'PATCH', 'PUT'}

    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _scope(request):
        key = request.META.get('HTTP_IDEMPOTENCY_KEY', '')
        session_key = request.session.session_key if hasattr(request, 'session') else None
        if not key or not session_key or request.method not in IdempotencyMiddleware.MUTATING:
            return None
        if not request.path.startswith('/api/'):
            return None
        return session_key, key[:80], request.method, request.path[:240]

    def __call__(self, request):
        from core.models import IdempotencyRecord

        scope = self._scope(request)
        if scope is None:
            return self.get_response(request)
        session_key, key, method, path = scope

        record = IdempotencyRecord.objects.filter(
            session_key=session_key, key=key, method=method, path=path
        ).first()
        if record is not None:
            response = HttpResponse(record.body, status=record.status_code, content_type=record.content_type)
            response['Idempotency-Replayed'] = 'true'
            return response

        response = self.get_response(request)
        if 200 <= response.status_code < 300 and response.streaming is False:
            IdempotencyRecord.objects.get_or_create(
                session_key=session_key,
                key=key,
                method=method,
                path=path,
                defaults={
                    'status_code': response.status_code,
                    'content_type': response.headers.get('Content-Type', 'application/json'),
                    'body': response.content.decode('utf-8', errors='replace'),
                },
            )
        return response
