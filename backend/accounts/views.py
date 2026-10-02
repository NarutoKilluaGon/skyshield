"""
Auth endpoints — the network twin of src/services/auth.ts (mockAuth).

Contract (all under /api/v1/auth/, camelCase wire):
  POST login/                     {email, password, remember?} → SessionData | 401/429 {message}
  POST logout/                    → 204
  GET  session/                   → SessionData | 401
  POST register/                  {name, email, password, organisation, termsAccepted} → SessionData | 400
  POST password-reset/            {email} → {token} (demo mode) | 200 {}
  POST password-reset/confirm/    {token, newPassword} → 204 | 400
  POST invites/                   {email, name, org?} → {token, link}
  POST invites/<token>/accept/    {password} → SessionData | 400/404

Rules ported 1:1 from the mock: 5-failure/10-minute lockout, ≥10-char
passwords, common-password rejection, first-user-in-org is admin, alias
emails (demo@skyshield.aero → usr_001), demo fallback tokens.
"""

import uuid

from django.conf import settings
from django.contrib.auth import logout as auth_logout
from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import (
    Invite,
    PasswordResetToken,
    User,
    clear_failed_attempts,
    lockout_status,
    record_failed_attempt,
    session_payload,
    start_session,
)
from accounts.serializers import UserSerializer

COMMON_PASSWORDS = {
    'password',
    'password123',
    '1234567890',
    '12345678',
    '123456789',
    'qwerty1234',
    'admin1234',
    'guest1234',
    'skyshield',
}

# Demo-mode fallback tokens the mock accepted for the forgot-password flow.
DEMO_RESET_TOKENS = {'abc123': 'demo@skyshield.aero', 'demo-token': 'demo@skyshield.aero'}

BAD_CREDENTIALS = 'Email or password is incorrect'


def find_user_by_email(email: str) -> tuple[User | None, str | None]:
    """Resolve an email to a user, honouring alias emails. Returns (user, alias)."""
    normalized = email.strip().lower()
    user = User.objects.filter(email__iexact=normalized).first()
    if user:
        return user, None
    for candidate in User.objects.exclude(alias_emails=[]):
        aliases = [str(a).lower() for a in (candidate.alias_emails or [])]
        if normalized in aliases:
            return candidate, normalized
    return None, None


def password_rule_error(password: str) -> str | None:
    if len(password or '') < 10:
        return 'Password must be at least 10 characters.'
    if (password or '').lower() in COMMON_PASSWORDS:
        return 'This password is too common. Choose a stronger password.'
    return None


def make_initials(name: str) -> str:
    initials = ''.join(part[0] for part in name.split() if part)[:2].upper()
    return initials or 'U'


def build_user(name: str, email: str, password: str, organisation: str) -> User:
    """Create a user with the mock signUp semantics (first-in-org → admin)."""
    org = organisation.strip() or 'SkyShield Operations'
    is_first_in_org = not User.objects.filter(organisation__iexact=org).exists()
    user = User(
        id=f'usr_{uuid.uuid4().hex[:8]}',
        name=name.strip(),
        initials=make_initials(name),
        role='admin' if is_first_in_org else 'safety_officer',
        title='Administrator' if is_first_in_org else 'Safety Officer',
        email=email.strip().lower(),
        base='DEL — HQ',
        avatar_tone='brand',
        is_active=True,
        last_active_at=timezone.now(),
        organisation=org,
        email_verified=False,
    )
    user.set_password(password)
    user.save()
    return user


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'login'

    def post(self, request):
        email = str(request.data.get('email') or '')
        password = str(request.data.get('password') or '')
        remember = bool(request.data.get('remember', True))

        user, alias = find_user_by_email(email)
        if user is None:
            return Response({'message': BAD_CREDENTIALS}, status=status.HTTP_401_UNAUTHORIZED)

        locked, remaining_minutes = lockout_status(user)
        if locked:
            plural = '' if remaining_minutes == 1 else 's'
            message = (
                f'Account temporarily locked after 5 failed attempts. '
                f'Please try again in {remaining_minutes} minute{plural}.'
            )
            return Response(
                {'message': message, 'retry_after_seconds': remaining_minutes * 60},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={'Retry-After': str(remaining_minutes * 60)},
            )

        if not user.check_password(password):
            record_failed_attempt(user)
            return Response({'message': BAD_CREDENTIALS}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_active:
            return Response({'message': 'This account is disabled.'}, status=status.HTTP_403_FORBIDDEN)

        clear_failed_attempts(user)
        payload = start_session(request, user, remember)
        if alias:
            # The mock signed alias logins in *as the alias* — mirror that so
            # the shell shows the address the user actually typed.
            payload['user']['email'] = alias
        return Response(payload)


class LogoutView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        auth_logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = [SessionAuthentication]
    throttle_classes: list = []

    def get(self, request):
        user = request.user
        if not getattr(user, 'is_authenticated', False):
            return Response({'message': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
        meta = request.session.get('skyshield') or {}
        return Response(
            session_payload(
                user,
                remember=bool(meta.get('remember', True)),
                org=meta.get('org') or user.organisation,
                logged_in_at=int(meta.get('logged_in_at') or timezone.now().timestamp() * 1000),
            )
        )


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        name = str(request.data.get('name') or '').strip()
        email = str(request.data.get('email') or '').strip().lower()
        password = str(request.data.get('password') or '')
        organisation = str(request.data.get('organisation') or '')
        terms = bool(request.data.get('terms_accepted', False))

        if not terms:
            return Response(
                {'message': 'You must agree to the Terms of Service and Privacy Policy.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not name or not email:
            return Response({'message': 'Name and email are required.'}, status=status.HTTP_400_BAD_REQUEST)
        rule_error = password_rule_error(password)
        if rule_error:
            return Response({'message': rule_error}, status=status.HTTP_400_BAD_REQUEST)
        existing, _ = find_user_by_email(email)
        if existing is not None:
            return Response(
                {'message': 'An account with this email address already exists.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            user = build_user(name, email, password, organisation)
            payload = start_session(request, user, remember=True)
        return Response(payload, status=status.HTTP_201_CREATED)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        email = str(request.data.get('email') or '').strip().lower()
        user, _ = find_user_by_email(email)
        if user is None:
            # Never leak which addresses exist; the UI shows the same success.
            return Response({'ok': True})
        token = uuid.uuid4().hex
        PasswordResetToken.objects.create(token=token, email=user.email)
        if settings.SKYSHIELD_DEMO_MODE:
            # Demo parity with the mock: hand the token back so the reset link
            # works without a mail backend.
            return Response({'ok': True, 'token': token})
        return Response({'ok': True})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        token = str(request.data.get('token') or '')
        new_password = str(request.data.get('new_password') or '')
        rule_error = password_rule_error(new_password)
        if rule_error:
            return Response({'message': rule_error}, status=status.HTTP_400_BAD_REQUEST)

        record = PasswordResetToken.objects.filter(token=token, used_at__isnull=True).first()
        email = record.email if record else None
        if email is None and settings.SKYSHIELD_DEMO_MODE and token in DEMO_RESET_TOKENS:
            email = DEMO_RESET_TOKENS[token]
        if email is None:
            return Response(
                {'message': 'This password reset link is invalid or has expired.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user, _ = find_user_by_email(email)
        if user is None:
            return Response(
                {'message': 'This password reset link is invalid or has expired.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            user.set_password(new_password)
            user.save(update_fields=['password'])
            clear_failed_attempts(user)
            if record:
                record.used_at = timezone.now()
                record.save(update_fields=['used_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


class InviteCreateView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes: list = []

    def post(self, request):
        email = str(request.data.get('email') or '').strip().lower()
        name = str(request.data.get('name') or '').strip()
        org = str(request.data.get('org') or request.user.organisation or 'SkyShield Operations')
        if not email or not name:
            return Response({'message': 'Email and name are required.'}, status=status.HTTP_400_BAD_REQUEST)
        token = str(uuid.uuid4())
        Invite.objects.create(token=token, email=email, name=name, org=org)
        return Response({'token': token, 'link': f'/invite/{token}'}, status=status.HTTP_201_CREATED)


class InviteAcceptView(APIView):
    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes = [AnonRateThrottle]

    def post(self, request, token: str):
        password = str(request.data.get('password') or '')
        if len(password) < 10:
            return Response({'message': 'Password must be at least 10 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        invite = Invite.objects.filter(token=token, accepted_at__isnull=True).first()
        if invite is None and settings.SKYSHIELD_DEMO_MODE:
            # Mock parity: unknown tokens fall back to the demo invitee so the
            # /invite/:token page is exercisable without a real invite record.
            invite = Invite(token=token, email='invitee@skyshield.aero', name='Invited Specialist')
            invite.org = 'SkyShield Operations'

        if invite is None:
            return Response(
                {'message': 'This invitation is invalid or has expired.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        with transaction.atomic():
            existing, _ = find_user_by_email(invite.email)
            if existing is not None:
                existing.set_password(password)
                existing.email_verified = True
                existing.save(update_fields=['password', 'email_verified'])
                payload = start_session(request, existing, remember=True)
            else:
                user = build_user(invite.name, invite.email, password, invite.org)
                payload = start_session(request, user, remember=True)
            if invite.pk and Invite.objects.filter(pk=invite.pk).exists():
                invite.accepted_at = timezone.now()
                invite.save(update_fields=['accepted_at'])
        return Response(payload)


class UserListView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes: list = []

    def get(self, request):
        return Response(UserSerializer(User.objects.all(), many=True).data)
