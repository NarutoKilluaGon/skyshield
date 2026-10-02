"""Auth endpoint tests — parity with src/services/auth.ts (mockAuth)."""

from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import Invite, PasswordResetToken, User
from core.tests.base import SeededAPITestCase


class LoginTests(SeededAPITestCase):
    def test_demo_credentials_return_session_data(self):
        payload = self.login()
        self.assertEqual(payload['user']['id'], 'usr_001')
        self.assertEqual(payload['user']['role'], 'safety_manager')
        self.assertEqual(payload['org'], 'SkyShield Operations')
        self.assertTrue(payload['remember'])
        self.assertIsInstance(payload['loggedInAt'], int)
        # camelCase wire keys only
        self.assertIn('lastActiveAt', payload['user'])
        self.assertIn('avatarTone', payload['user'])
        self.assertNotIn('last_active_at', payload['user'])

    def test_alias_email_signs_in_as_usr_001(self):
        response = self.client.post(
            '/api/v1/auth/login/',
            {'email': 'demo@skyshield.aero', 'password': 'demo1234', 'remember': False},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['user']['id'], 'usr_001')
        self.assertEqual(payload['user']['email'], 'demo@skyshield.aero')
        self.assertFalse(payload['remember'])

    def test_wrong_password_is_401_with_mock_message(self):
        response = self.client.post(
            '/api/v1/auth/login/',
            {'email': 'j.miller@skysafety.aero', 'password': 'wrong-password'},
            format='json',
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()['message'], 'Email or password is incorrect')

    def test_unknown_email_is_401(self):
        response = self.client.post(
            '/api/v1/auth/login/', {'email': 'nobody@example.com', 'password': 'x'}, format='json'
        )
        self.assertEqual(response.status_code, 401)

    def test_disabled_account_cannot_sign_in(self):
        response = self.client.post(
            '/api/v1/auth/login/',
            {'email': 's.banerjee@skysafety.aero', 'password': 'demo1234'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_lockout_after_five_failures_with_exact_message(self):
        for _ in range(5):
            self.client.post(
                '/api/v1/auth/login/',
                {'email': 'a.sharma@skysafety.aero', 'password': 'wrong-password'},
                format='json',
            )
        response = self.client.post(
            '/api/v1/auth/login/',
            {'email': 'a.sharma@skysafety.aero', 'password': 'demo1234'},
            format='json',
        )
        self.assertEqual(response.status_code, 429)
        message = response.json()['message']
        self.assertRegex(message, r'^Account temporarily locked after 5 failed attempts\. Please try again in \d+ minutes?\.$')
        self.assertIn('Retry-After', response.headers)

        # Correct password alone does not bypass the lockout window.
        user = User.objects.get(pk='usr_002')
        self.assertEqual(user.failed_count, 5)

    def test_successful_login_resets_failed_attempts(self):
        self.client.post(
            '/api/v1/auth/login/', {'email': 'r.singh@skysafety.aero', 'password': 'nope-nope'}, format='json'
        )
        self.login(email='r.singh@skysafety.aero')
        user = User.objects.get(pk='usr_003')
        self.assertEqual(user.failed_count, 0)
        self.assertIsNone(user.failed_first_at)


class SessionTests(SeededAPITestCase):
    def test_session_endpoint_returns_current_session(self):
        self.login()
        response = self.client.get('/api/v1/auth/session/')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['user']['id'], 'usr_001')
        self.assertEqual(payload['org'], 'SkyShield Operations')

    def test_session_endpoint_401_when_signed_out(self):
        response = APIClient().get('/api/v1/auth/session/')
        self.assertEqual(response.status_code, 401)

    def test_logout_clears_the_session(self):
        self.login()
        response = self.client.post('/api/v1/auth/logout/')
        self.assertEqual(response.status_code, 204)
        response = self.client.get('/api/v1/auth/session/')
        self.assertEqual(response.status_code, 401)

    def test_data_endpoints_require_auth(self):
        response = APIClient().get('/api/v1/incidents/')
        self.assertIn(response.status_code, (401, 403))


class RegisterTests(SeededAPITestCase):
    def register(self, **overrides):
        payload = {
            'name': 'T. Verifier',
            'email': 't.verifier@neworg.aero',
            'password': 'a-strong-pass-42',
            'organisation': 'New Org',
            'termsAccepted': True,
            **overrides,
        }
        return self.client.post('/api/v1/auth/register/', payload, format='json')

    def test_register_creates_admin_for_new_org_and_signs_in(self):
        response = self.register()
        self.assertEqual(response.status_code, 201, response.content)
        payload = response.json()
        self.assertEqual(payload['user']['role'], 'admin')
        self.assertEqual(payload['user']['title'], 'Administrator')
        self.assertEqual(payload['user']['initials'], 'TV')
        self.assertTrue(payload['user']['id'].startswith('usr_'))
        self.assertEqual(payload['org'], 'New Org')
        # Immediately authenticated.
        self.assertEqual(self.client.get('/api/v1/auth/session/').status_code, 200)

    def test_second_user_in_org_is_safety_officer(self):
        self.register()
        self.client.post('/api/v1/auth/logout/')
        response = self.register(email='second@neworg.aero', name='S. Econd')
        payload = response.json()
        self.assertEqual(payload['user']['role'], 'safety_officer')
        self.assertEqual(payload['user']['title'], 'Safety Officer')

    def test_terms_required(self):
        response = self.register(termsAccepted=False)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json()['message'], 'You must agree to the Terms of Service and Privacy Policy.'
        )

    def test_short_password_rejected(self):
        response = self.register(password='short')
        self.assertEqual(response.json()['message'], 'Password must be at least 10 characters.')

    def test_common_password_rejected(self):
        response = self.register(password='PASSWORD123')
        self.assertEqual(response.json()['message'], 'This password is too common. Choose a stronger password.')

    def test_duplicate_email_rejected(self):
        response = self.register(email='j.miller@skysafety.aero')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['message'], 'An account with this email address already exists.')


class PasswordResetTests(SeededAPITestCase):
    def test_request_returns_token_in_demo_mode_and_confirm_sets_password(self):
        response = self.client.post(
            '/api/v1/auth/password-reset/', {'email': 'a.sharma@skysafety.aero'}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        token = response.json()['token']
        self.assertTrue(PasswordResetToken.objects.filter(token=token).exists())

        response = self.client.post(
            '/api/v1/auth/password-reset/confirm/',
            {'token': token, 'newPassword': 'brand-new-pass-1'},
            format='json',
        )
        self.assertEqual(response.status_code, 204)
        self.login(email='a.sharma@skysafety.aero', password='brand-new-pass-1')

    def test_token_is_single_use(self):
        token = self.client.post(
            '/api/v1/auth/password-reset/', {'email': 'm.kumar@skysafety.aero'}, format='json'
        ).json()['token']
        self.client.post(
            '/api/v1/auth/password-reset/confirm/', {'token': token, 'newPassword': 'first-pass-123'}, format='json'
        )
        response = self.client.post(
            '/api/v1/auth/password-reset/confirm/', {'token': token, 'newPassword': 'second-pass-456'}, format='json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['message'], 'This password reset link is invalid or has expired.')

    def test_demo_fallback_tokens(self):
        response = self.client.post(
            '/api/v1/auth/password-reset/confirm/', {'token': 'abc123', 'newPassword': 'demo-reset-pass'}, format='json'
        )
        self.assertEqual(response.status_code, 204)
        self.login(email='demo@skyshield.aero', password='demo-reset-pass')

    def test_unknown_email_still_answers_ok(self):
        response = self.client.post('/api/v1/auth/password-reset/', {'email': 'ghost@x.io'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('token', response.json())

    def test_confirm_rejects_weak_passwords(self):
        response = self.client.post(
            '/api/v1/auth/password-reset/confirm/', {'token': 'abc123', 'newPassword': 'short'}, format='json'
        )
        self.assertEqual(response.json()['message'], 'Password must be at least 10 characters.')


class InviteTests(SeededAPITestCase):
    def test_create_invite_returns_token_and_link(self):
        self.login()
        response = self.client.post(
            '/api/v1/auth/invites/', {'email': 'new.pilot@skysafety.aero', 'name': 'N. Pilot'}, format='json'
        )
        self.assertEqual(response.status_code, 201)
        payload = response.json()
        self.assertEqual(payload['link'], f"/invite/{payload['token']}")
        self.assertTrue(Invite.objects.filter(token=payload['token']).exists())

    def test_accept_invite_creates_user_and_signs_in(self):
        self.login()
        token = self.client.post(
            '/api/v1/auth/invites/', {'email': 'new.pilot@skysafety.aero', 'name': 'N. Pilot'}, format='json'
        ).json()['token']
        self.client.post('/api/v1/auth/logout/')

        client = APIClient()
        response = client.post(f'/api/v1/auth/invites/{token}/accept/', {'password': 'invite-pass-123'}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        self.assertEqual(payload['user']['email'], 'new.pilot@skysafety.aero')
        self.assertEqual(client.get('/api/v1/auth/session/').status_code, 200)
        invite = Invite.objects.get(token=token)
        self.assertIsNotNone(invite.accepted_at)

    def test_accept_invite_short_password_rejected(self):
        response = APIClient().post('/api/v1/auth/invites/whatever/accept/', {'password': 'short'}, format='json')
        self.assertEqual(response.json()['message'], 'Password must be at least 10 characters.')

    def test_demo_fallback_for_unknown_token(self):
        client = APIClient()
        response = client.post('/api/v1/auth/invites/unknown-token/accept/', {'password': 'fallback-pass-1'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['user']['email'], 'invitee@skyshield.aero')
        self.assertEqual(response.json()['user']['name'], 'Invited Specialist')

    def test_invite_requires_authentication(self):
        response = APIClient().post(
            '/api/v1/auth/invites/', {'email': 'x@y.z', 'name': 'X Y'}, format='json'
        )
        self.assertIn(response.status_code, (401, 403))
