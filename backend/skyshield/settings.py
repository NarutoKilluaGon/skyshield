"""
SkyShield API — Django settings.

Dev defaults are safe for `manage.py runserver` behind the vite proxy
(`/api` → :8000). Everything environment-specific is read from env vars so
production deploys follow docs/DEPLOY.md without editing code.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name: str, default: bool) -> bool:
    return os.environ.get(name, '1' if default else '0').lower() in ('1', 'true', 'yes', 'on')


def env_list(name: str, default: str) -> list[str]:
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(',') if item.strip()]


SECRET_KEY = os.environ.get('SKYSHIELD_SECRET_KEY', 'dev-only-insecure-key-change-me')
DEBUG = env_bool('SKYSHIELD_DEBUG', True)
ALLOWED_HOSTS = env_list('SKYSHIELD_ALLOWED_HOSTS', '*')

# The SPA is served by vite (dev) / nginx (prod) and proxies /api here, so the
# browser Origin is the frontend's. Trust the documented dev origins; override
# in production via SKYSHIELD_CSRF_ORIGINS.
CSRF_TRUSTED_ORIGINS = env_list(
    'SKYSHIELD_CSRF_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,'
    'http://localhost:8000,http://127.0.0.1:8000',
)
CORS_ALLOWED_ORIGINS = env_list('SKYSHIELD_CORS_ORIGINS', '')

# Demo mode keeps the mock-era conveniences the frontend relies on: password
# reset tokens are returned to the caller (no mail backend) and unknown invite
# tokens fall back to the demo invitee. Turn OFF for a real deployment.
SKYSHIELD_DEMO_MODE = env_bool('SKYSHIELD_DEMO_MODE', True)

# Anonymous intake throttle (mirrors the client-side throttle in
# services/incidents.ts): one report per window, daily cap per IP.
SKYSHIELD_ANON_INTAKE_WINDOW_SECONDS = int(os.environ.get('SKYSHIELD_ANON_WINDOW', '120'))
SKYSHIELD_ANON_INTAKE_DAILY_MAX = int(os.environ.get('SKYSHIELD_ANON_DAILY_MAX', '10'))

# Evidence file storage (M4). Local filesystem by default; point
# SKYSHIELD_MEDIA_ROOT at a mounted volume in production (docs/DEPLOY.md).
MEDIA_ROOT = Path(os.environ.get('SKYSHIELD_MEDIA_ROOT', BASE_DIR / 'media'))
MEDIA_URL = '/media/'
# Mirrors the "Maximum 50 MB per file" promise in the report wizard UI.
SKYSHIELD_MAX_UPLOAD_MB = int(os.environ.get('SKYSHIELD_MAX_UPLOAD_MB', '50'))

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth',
    'django.contrib.sessions',
    'rest_framework',
    'accounts',
    'core',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'skyshield.middleware.EnsureCsrfCookieMiddleware',
    'skyshield.middleware.ApiSecurityHeadersMiddleware',
    'skyshield.middleware.IdempotencyMiddleware',
]

ROOT_URLCONF = 'skyshield.urls'
WSGI_APPLICATION = 'skyshield.wsgi.application'
ASGI_APPLICATION = 'skyshield.asgi.application'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {'context_processors': []},
    },
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': os.environ.get('SKYSHIELD_DB', BASE_DIR / 'db.sqlite3'),
    }
}

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS: list[dict] = []  # the API enforces the documented rules itself

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = False
USE_TZ = True

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Sessions: 24 h cap (the client also expires sessions at 24 h), cookie is
# HttpOnly + SameSite=Lax. remember=false downgrades to a browser-session
# cookie per login (set_expiry(0)).
SESSION_COOKIE_AGE = 24 * 60 * 60
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_SECURE = env_bool('SKYSHIELD_COOKIE_SECURE', False)
CSRF_COOKIE_HTTPONLY = False  # the SPA reads csrftoken to build X-CSRFToken
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE = env_bool('SKYSHIELD_COOKIE_SECURE', False)

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
        'LOCATION': 'skyshield-api',
    }
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
    'DEFAULT_RENDERER_CLASSES': ['skyshield.camelcase.CamelCaseJSONRenderer'],
    'DEFAULT_PARSER_CLASSES': ['skyshield.camelcase.CamelCaseJSONParser'],
    'DEFAULT_THROTTLE_CLASSES': ['rest_framework.throttling.UserRateThrottle'],
    'DEFAULT_THROTTLE_RATES': {
        'user': os.environ.get('SKYSHIELD_THROTTLE_USER', '600/min'),
        'anon': os.environ.get('SKYSHIELD_THROTTLE_ANON', '60/min'),
        'login': os.environ.get('SKYSHIELD_THROTTLE_LOGIN', '30/min'),
    },
    # The wire format mirrors src/types exactly: camelCase keys, UTC ISO-8601
    # timestamps ending in Z (what the fixtures and the store already use).
    'DATETIME_FORMAT': '%Y-%m-%dT%H:%M:%SZ',
    'DATE_FORMAT': '%Y-%m-%d',
    'EXCEPTION_HANDLER': 'skyshield.exceptions.skyshield_exception_handler',
    'UNAUTHENTICATED_USER': 'accounts.models.AnonymousApiUser',
    'TEST_REQUEST_DEFAULT_FORMAT': 'json',
}

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': os.environ.get('SKYSHIELD_LOG_LEVEL', 'INFO')},
}
