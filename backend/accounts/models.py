"""
Accounts app — the `User` model mirroring src/types User, plus the
demo-session conveniences the mock auth service provided (alias emails,
invites, password-reset tokens, failed-attempt lockout).
"""

import math

from django.conf import settings
from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.db import models
from django.utils import timezone

ROLES = [
    ('safety_manager', 'Safety Manager'),
    ('investigator', 'Investigator'),
    ('safety_officer', 'Safety Officer'),
    ('auditor', 'Auditor'),
    ('admin', 'Administrator'),
]

AVATAR_TONES = ['brand', 'violet', 'amber', 'teal', 'rose']


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError('Users must have an email address')
        user = self.model(email=self.normalize_email(email), **extra)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user


class User(AbstractBaseUser):
    """
    Wire shape (camelCase): id, name, initials, role, title, email, base,
    phone?, licenseNumber?, avatarTone, active, lastActiveAt.
    """

    id = models.CharField(primary_key=True, max_length=64, editable=False)
    name = models.CharField(max_length=120)
    initials = models.CharField(max_length=8, default='')
    role = models.CharField(max_length=32, choices=ROLES, default='safety_officer')
    title = models.CharField(max_length=120, default='')
    email = models.CharField(max_length=254, unique=True)
    base = models.CharField(max_length=120, default='DEL — HQ')
    phone = models.CharField(max_length=40, null=True, blank=True)
    license_number = models.CharField(max_length=60, null=True, blank=True)
    avatar_tone = models.CharField(max_length=16, choices=[(t, t) for t in AVATAR_TONES], default='brand')
    is_active = models.BooleanField(default=True)
    last_active_at = models.DateTimeField(default=timezone.now)

    # Extra emails that resolve to this account (demo@skyshield.aero → usr_001).
    alias_emails = models.JSONField(default=list, blank=True)
    organisation = models.CharField(max_length=160, default='SkyShield Operations')
    email_verified = models.BooleanField(default=False)

    # Lockout: 5 failed attempts inside a 10-minute window (services/auth.ts).
    failed_count = models.IntegerField(default=0)
    failed_first_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    # Not a Django-admin user; kept so contrib.auth helpers behave.
    is_staff = models.BooleanField(default=False)
    is_superuser = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS: list[str] = []

    class Meta:
        ordering = ['id']

    def __str__(self) -> str:
        return f'{self.name} <{self.email}>'

    def has_perm(self, perm, obj=None) -> bool:  # pragma: no cover - unused
        return False

    def has_module_perms(self, app_label) -> bool:  # pragma: no cover - unused
        return False


class AnonymousApiUser:
    """
    Stand-in for request.user when unauthenticated. The workflow guard needs
    `role = None` (not a missing attribute) so permission denials produce the
    same human-readable reasons as the frontend matrix.
    """

    is_authenticated = False
    is_active = False
    role = None
    id = None
    pk = None

    def __str__(self) -> str:
        return 'AnonymousUser'


class Invite(models.Model):
    """Team invite created on the settings page; accepted at /invite/<token>."""

    token = models.CharField(primary_key=True, max_length=64, editable=False)
    email = models.CharField(max_length=254)
    name = models.CharField(max_length=120)
    org = models.CharField(max_length=160, default='SkyShield Operations')
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)


class PasswordResetToken(models.Model):
    """Reset tokens are returned to the caller in demo mode (no mail backend)."""

    token = models.CharField(primary_key=True, max_length=64, editable=False)
    email = models.CharField(max_length=254)
    created_at = models.DateTimeField(auto_now=timezone.now)
    used_at = models.DateTimeField(null=True, blank=True)


LOCKOUT_ATTEMPTS = 5
LOCKOUT_WINDOW = timezone.timedelta(minutes=10)


def lockout_status(user: User) -> tuple[bool, int]:
    """(locked, remaining_minutes) mirroring mockAuth.getLockoutStatus()."""
    if not user.failed_first_at or user.failed_count < LOCKOUT_ATTEMPTS:
        return False, 0
    elapsed = timezone.now() - user.failed_first_at
    if elapsed > LOCKOUT_WINDOW:
        return False, 0
    remaining_minutes = math.ceil((LOCKOUT_WINDOW - elapsed).total_seconds() / 60)
    return True, max(remaining_minutes, 1)


def record_failed_attempt(user: User) -> None:
    now = timezone.now()
    if not user.failed_first_at or now - user.failed_first_at > LOCKOUT_WINDOW:
        user.failed_first_at = now
        user.failed_count = 1
    else:
        user.failed_count += 1
    user.save(update_fields=['failed_count', 'failed_first_at'])


def clear_failed_attempts(user: User) -> None:
    if user.failed_count or user.failed_first_at:
        user.failed_count = 0
        user.failed_first_at = None
        user.save(update_fields=['failed_count', 'failed_first_at'])


def session_payload(user: User, remember: bool, org: str, logged_in_at: int) -> dict:
    """The SessionData contract from src/services/auth.ts."""
    from accounts.serializers import UserSerializer

    return {
        'user': UserSerializer(user).data,
        'org': org,
        'remember': remember,
        'loggedInAt': logged_in_at,
    }


def start_session(request, user: User, remember: bool) -> dict:
    """Log the user in and stamp the SkyShield session metadata."""
    from django.contrib.auth import login

    user.backend = 'django.contrib.auth.backends.ModelBackend'
    login(request, user)
    logged_in_at = int(timezone.now().timestamp() * 1000)
    request.session['skyshield'] = {
        'org': user.organisation,
        'remember': remember,
        'logged_in_at': logged_in_at,
    }
    # remember → 24 h cookie; otherwise a browser-session cookie (mock parity:
    # sessionStorage + session cookie).
    request.session.set_expiry(settings.SESSION_COOKIE_AGE if remember else 0)
    user.last_active_at = timezone.now()
    user.save(update_fields=['last_active_at'])
    return session_payload(user, remember, org=user.organisation, logged_in_at=logged_in_at)
