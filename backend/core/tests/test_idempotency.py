"""M5 — Idempotency-Key replay semantics for mutating API requests."""

from rest_framework import status

from core.models import IdempotencyRecord, Incident, IncidentComment
from core.tests.base import SeededAPITestCase


class IdempotencyTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()
        self.incident = Incident.objects.order_by('list_order').first()
        self.url = f'/api/v1/incidents/{self.incident.id}/comments/'

    def _post(self, key: str, body: str = 'Idempotent probe comment'):
        return self.client.post(
            self.url, {'body': body}, format='json', HTTP_IDEMPOTENCY_KEY=key
        )

    def test_replay_returns_the_stored_answer_without_re_executing(self):
        first = self._post('key-abc')
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.content)
        comments_after_first = IncidentComment.objects.filter(incident_id=self.incident.id).count()

        second = self._post('key-abc')
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.headers.get('Idempotency-Replayed'), 'true')
        self.assertEqual(second.json()['id'], first.json()['id'])
        self.assertEqual(
            IncidentComment.objects.filter(incident_id=self.incident.id).count(),
            comments_after_first,
        )

    def test_different_keys_execute_independently(self):
        first = self._post('key-1')
        second = self._post('key-2')
        self.assertNotEqual(first.json()['id'], second.json()['id'])
        self.assertIsNone(first.headers.get('Idempotency-Replayed'))

    def test_key_is_scoped_per_session(self):
        first = self._post('shared-key')
        self.client.logout()
        self.login(email='a.sharma@skysafety.aero')
        second = self._post('shared-key')
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(second.json()['id'], first.json()['id'])

    def test_failures_are_not_recorded(self):
        # Empty body → 400; the key must stay unused.
        rejected = self._post('key-fail', body='   ')
        self.assertEqual(rejected.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(IdempotencyRecord.objects.filter(key='key-fail').count(), 0)

        # Unknown incident → 404 with the same key; still nothing recorded.
        missing = self.client.post(
            '/api/v1/incidents/inc_missing/comments/',
            {'body': 'probe'},
            format='json',
            HTTP_IDEMPOTENCY_KEY='key-404',
        )
        self.assertEqual(missing.status_code, 404)
        self.assertEqual(IdempotencyRecord.objects.filter(key='key-404').count(), 0)

        # A later valid request with the rejected key executes for real.
        retry = self._post('key-fail')
        self.assertEqual(retry.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(retry.headers.get('Idempotency-Replayed'))

    def test_requests_without_key_are_untouched(self):
        response = self.client.post(self.url, {'body': 'plain comment'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(IdempotencyRecord.objects.count(), 0)

    def test_get_requests_are_never_recorded(self):
        self.client.get('/api/v1/incidents/', HTTP_IDEMPOTENCY_KEY='key-get')
        self.assertEqual(IdempotencyRecord.objects.filter(key='key-get').count(), 0)

    def test_create_incident_replay_does_not_duplicate(self):
        payload = {
            'title': 'Idempotent occurrence probe',
            'description': 'Filed twice with the same key; must exist once.',
        }
        total_before = Incident.objects.count()
        first = self.client.post(
            '/api/v1/incidents/', payload, format='json', HTTP_IDEMPOTENCY_KEY='key-create'
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.content)
        second = self.client.post(
            '/api/v1/incidents/', payload, format='json', HTTP_IDEMPOTENCY_KEY='key-create'
        )
        self.assertEqual(second.json()['id'], first.json()['id'])
        self.assertEqual(second.json()['ref'], first.json()['ref'])
        self.assertEqual(Incident.objects.count(), total_before + 1)
