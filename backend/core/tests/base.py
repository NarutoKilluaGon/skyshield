"""Shared test plumbing: seed the real demo fixtures once per class."""

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User


class SeededAPITestCase(TestCase):
    """Seeds backend/fixtures/demo-seed.json with a deterministic offset."""

    offset_days = 6  # matches a "today" six days after the fixture anchor

    @classmethod
    def setUpTestData(cls):
        call_command('seed_demo', offset_days=cls.offset_days, verbosity=0)

    def setUp(self):
        super().setUp()
        cache.clear()  # throttle counters must not leak between tests
        self.client = APIClient()

    def login(self, email='j.miller@skysafety.aero', password='demo1234', remember=True):
        response = self.client.post(
            '/api/v1/auth/login/',
            {'email': email, 'password': password, 'remember': remember},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.content)
        return response.json()

    def login_as(self, user_id: str):
        user = User.objects.get(pk=user_id)
        self.client.force_login(user)
        return user
