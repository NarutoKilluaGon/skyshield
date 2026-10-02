"""Data API tests — contract parity with the mock services (src/services/*)."""

from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APIClient

from accounts.models import User
from core.models import CAPA, AuditLog, Incident, IncidentComment, Investigation, Notification, SiteData
from core.tests.base import SeededAPITestCase


class IncidentListTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()

    def test_envelope_shape_and_camel_case(self):
        response = self.client.get('/api/v1/incidents/?page=1&pageSize=5')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(sorted(payload.keys()), ['items', 'page', 'pageSize', 'total'])
        self.assertEqual(payload['total'], 80)
        self.assertEqual(len(payload['items']), 5)
        first = payload['items'][0]
        for key in ('id', 'ref', 'reportedAt', 'occurredAt', 'aircraftId', 'reporterId', 'capaIds', 'evidenceCount'):
            self.assertIn(key, first)
        self.assertIn('severity', first['risk'])
        self.assertNotIn('reported_at', first)

    def test_mock_array_order_is_the_default_order(self):
        # The fixture order (inc_002 first) is what db.incidents serves.
        response = self.client.get('/api/v1/incidents/?pageSize=3')
        refs = [item['ref'] for item in response.json()['items']]
        self.assertEqual(refs[0], 'P_006-257')

    def test_status_filter_csv(self):
        response = self.client.get('/api/v1/incidents/?status=closed&pageSize=100')
        payload = response.json()
        self.assertTrue(payload['total'] > 0)
        self.assertTrue(all(item['status'] == 'closed' for item in payload['items']))

    def test_severity_and_risk_range_filters(self):
        response = self.client.get('/api/v1/incidents/?severity=critical,high&riskMin=12&pageSize=100')
        for item in response.json()['items']:
            self.assertIn(item['risk']['severity'], ('critical', 'high'))
            self.assertGreaterEqual(item['risk']['score'], 12)

    def test_search_matches_the_mock_haystack(self):
        # reporter name is part of the haystack (userName(reporterId))
        response = self.client.get('/api/v1/incidents/?search=Anonymous&pageSize=100')
        self.assertEqual(response.status_code, 200)
        # category label search ("Tyre / Brake" for tire_brake)
        response = self.client.get('/api/v1/incidents/?search=Tyre&pageSize=100')
        self.assertTrue(all(item['category'] == 'tire_brake' for item in response.json()['items']))
        # airport IATA
        response = self.client.get('/api/v1/incidents/?search=BLR&pageSize=100')
        self.assertTrue(response.json()['total'] > 0)

    def test_aircraft_filter_is_by_registration(self):
        from core.models import Aircraft

        aircraft = Aircraft.objects.get(registration='VT-ANM')
        response = self.client.get('/api/v1/incidents/?aircraft=VT-ANM&pageSize=100')
        self.assertTrue(response.json()['total'] > 0)
        for item in response.json()['items']:
            self.assertEqual(item['aircraftId'], aircraft.id)

    def test_date_range_filter(self):
        all_items = self.client.get('/api/v1/incidents/?pageSize=200').json()['items']
        dates = sorted(item['occurredAt'] for item in all_items)
        mid = dates[len(dates) // 2][:10]
        response = self.client.get(f'/api/v1/incidents/?dateFrom={mid}&pageSize=200')
        self.assertTrue(all(item['occurredAt'] >= f'{mid}T00:00:00Z' for item in response.json()['items']))

    def test_sort_by_occurred_desc_and_severity(self):
        response = self.client.get('/api/v1/incidents/?sort=occurredAt&dir=desc&pageSize=100')
        dates = [item['occurredAt'] for item in response.json()['items']]
        self.assertEqual(dates, sorted(dates, reverse=True))

        # Mock sortValue for severity is SEVERITY_ORDER.indexOf(s) * -1, so an
        # ascending sort puts negligible first (rank -4) and critical last.
        response = self.client.get('/api/v1/incidents/?sort=severity&dir=asc&pageSize=100')
        order = ['critical', 'high', 'medium', 'low', 'negligible']
        ranks = [order.index(item['risk']['severity']) for item in response.json()['items']]
        self.assertEqual(ranks, sorted(ranks, reverse=True))

    def test_sort_by_status_uses_workflow_order(self):
        response = self.client.get('/api/v1/incidents/?sort=status&dir=asc&pageSize=100')
        order = ['draft', 'reported', 'investigation', 'rca_pending', 'capa', 'closed']
        ranks = [order.index(item['status']) for item in response.json()['items']]
        self.assertEqual(ranks, sorted(ranks))


class IncidentDetailTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()

    def test_detail_by_id_and_by_ref(self):
        by_id = self.client.get('/api/v1/incidents/inc_002/').json()
        by_ref = self.client.get('/api/v1/incidents/P_006-257/').json()
        self.assertEqual(by_id['id'], by_ref['id'])
        self.assertEqual(by_id['ref'], 'P_006-257')

    def test_missing_incident_404(self):
        response = self.client.get('/api/v1/incidents/inc_nope/')
        self.assertEqual(response.status_code, 404)

    def test_evidence_and_timeline(self):
        evidence = self.client.get('/api/v1/incidents/inc_001/evidence/').json()
        self.assertIsInstance(evidence, list)
        self.assertTrue(len(evidence) > 0)
        self.assertIn('sizeKb', evidence[0])
        timeline = self.client.get('/api/v1/incidents/inc_001/timeline/').json()
        self.assertIsInstance(timeline, list)


class IncidentCreateTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()

    def test_create_merges_over_the_template_like_the_mock(self):
        before = Incident.objects.count()
        max_ref = max(int(ref.split('-')[1]) for ref in Incident.objects.values_list('ref', flat=True))
        payload = {
            'title': 'Nose wheel shimmy on landing roll',
            'description': 'Crew reported a shimmy during rollout on RWY 28L.',
            'category': 'tire_brake',
            'status': 'reported',
            'risk': {
                'severity': 'high',
                'likelihood': 3,
                'score': 12,
                'level': 'high',
                'assessedBy': 'usr_001',
                'assessedAt': '2026-10-01T10:00:00Z',
            },
            'phase': 'landing',
            'aircraftId': 'ac_002',
            'reporterId': 'usr_001',
            'crew': ['Capt. Test'],
            'department': 'Flight Operations',
            'operator': 'Skyline Air',
            'immediateActions': 'Inspection scheduled',
            'injuries': 0,
            'evidenceCount': 3,
            'confidentiality': 'internal',
            'regulatoryNotification': False,
            'occurrenceCategory': 'GI',
        }
        response = self.client.post('/api/v1/incidents/', payload, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        created = response.json()
        self.assertEqual(Incident.objects.count(), before + 1)
        self.assertTrue(created['id'].startswith('inc_'))
        self.assertEqual(created['ref'], f'P_006-{max_ref + 1:03d}')
        # Mock overrides: capaIds [] and evidenceCount 0 regardless of payload.
        self.assertEqual(created['capaIds'], [])
        self.assertEqual(created['evidenceCount'], 0)
        # Template fields the wizard omits come from the first seeded incident.
        self.assertEqual(created['location']['iata'], 'BLR')
        self.assertIsNotNone(created['flight'])
        self.assertEqual(created['flight']['flightNumber'], 'SKY3238')
        # New rows prepend like unshift.
        first = self.client.get('/api/v1/incidents/?pageSize=1').json()['items'][0]
        self.assertEqual(first['id'], created['id'])

    def test_create_requires_incident_create_permission(self):
        self.login(email='p.iyer@skysafety.aero')  # auditor: read-only
        response = self.client.post('/api/v1/incidents/', {'title': 'x'}, format='json')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['message'], 'Only registered reporters and safety staff can file occurrences.')


class IncidentPatchTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()

    def test_patch_bumps_version(self):
        incident = Incident.objects.get(pk='inc_005')
        self.assertIsNone(incident.version)
        response = self.client.patch('/api/v1/incidents/inc_005/', {'department': 'Flight Ops'}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['version'], 1)
        response = self.client.patch('/api/v1/incidents/inc_005/', {'department': 'Cabin'}, format='json')
        self.assertEqual(response.json()['version'], 2)

    def test_patch_with_stale_expected_version_conflicts_409(self):
        self.client.patch('/api/v1/incidents/inc_005/', {'department': 'A'}, format='json')
        response = self.client.patch(
            '/api/v1/incidents/inc_005/', {'department': 'B', 'expectedVersion': 0}, format='json'
        )
        self.assertEqual(response.status_code, 409)

    def test_patch_status_runs_the_guards(self):
        # Arrange: investigation open at 68%, no CAPAs — closure must be refused.
        incident = Incident.objects.filter(status='investigation').order_by('list_order').first()
        incident.capa_ids = []
        incident.save(update_fields=['capa_ids'])
        investigation = Investigation.objects.filter(incident_id=incident.id).first()
        if investigation is None:
            investigation = Investigation.objects.create(
                id='inv_test', incident_id=incident.id, name='t', stage='investigation',
                progress=68, opened_at=timezone_now(), due_at=timezone_now(), priority='high',
            )
        else:
            investigation.progress = 68
            investigation.save(update_fields=['progress'])
        response = self.client.patch(f'/api/v1/incidents/{incident.id}/', {'status': 'closed'}, format='json')
        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()['reason'],
            'The investigation is 68% complete — closure requires it to reach 100%.',
        )

    def test_auditor_cannot_patch(self):
        self.login(email='p.iyer@skysafety.aero')
        response = self.client.patch('/api/v1/incidents/inc_005/', {'department': 'nope'}, format='json')
        self.assertEqual(response.status_code, 403)


class TransitionTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()

    def reported_incident(self) -> Incident:
        return Incident.objects.filter(status='reported').order_by('list_order').first()

    def test_happy_path_writes_audit_in_the_same_transaction(self):
        incident = self.reported_incident()
        audits_before = AuditLog.objects.count()
        response = self.client.post(
            f'/api/v1/incidents/{incident.id}/transition/', {'to': 'investigation'}, format='json'
        )
        self.assertEqual(response.status_code, 200, response.content)
        payload = response.json()
        self.assertEqual(payload['status'], 'investigation')
        self.assertEqual(payload['version'], 1)
        entry = AuditLog.objects.order_by('list_order').first()
        self.assertEqual(AuditLog.objects.count(), audits_before + 1)
        self.assertEqual(entry.entity_id, incident.id)
        self.assertEqual(entry.action, 'Status Reported → Investigation')
        self.assertEqual(entry.field, 'status')
        self.assertEqual(entry.from_value, 'reported')
        self.assertEqual(entry.to, 'investigation')
        self.assertEqual(entry.actor_id, 'usr_001')

    def test_illegal_edge_422_with_reason(self):
        incident = self.reported_incident()
        response = self.client.post(
            f'/api/v1/incidents/{incident.id}/transition/', {'to': 'rca_pending'}, format='json'
        )
        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()['reason'], 'A Reported record cannot move directly to RCA Pending.'
        )
        incident.refresh_from_db()
        self.assertEqual(incident.status, 'reported')

    def test_investigator_cannot_close(self):
        self.login(email='r.singh@skysafety.aero')
        incident = Incident.objects.filter(status='capa').first()
        incident.capa_ids = []
        incident.save(update_fields=['capa_ids'])
        response = self.client.post(f'/api/v1/incidents/{incident.id}/transition/', {'to': 'closed'}, format='json')
        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json()['reason'],
            'Only safety managers and administrators can officially close incidents.',
        )

    def test_open_capa_blocks_closure(self):
        incident = Incident.objects.filter(status='capa').exclude(capa_ids=[]).first()
        if incident is None:
            self.skipTest('no capa incident in seed')
        Investigation.objects.filter(incident_id=incident.id).update(progress=100)
        response = self.client.post(f'/api/v1/incidents/{incident.id}/transition/', {'to': 'closed'}, format='json')
        self.assertEqual(response.status_code, 422)
        self.assertIn('corrective action', response.json()['reason'])

    def test_closure_sets_closed_at_and_version_conflict_409(self):
        incident = self.reported_incident()
        incident.status = 'capa'
        incident.capa_ids = []
        incident.version = 7
        incident.save()
        Investigation.objects.filter(incident_id=incident.id).delete()
        response = self.client.post(
            f'/api/v1/incidents/{incident.id}/transition/', {'to': 'closed', 'expectedVersion': 6}, format='json'
        )
        self.assertEqual(response.status_code, 409)
        response = self.client.post(
            f'/api/v1/incidents/{incident.id}/transition/', {'to': 'closed', 'expectedVersion': 7}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['status'], 'closed')
        self.assertIsNotNone(payload['closedAt'])
        self.assertEqual(payload['version'], 8)

    def test_null_expected_version_skips_the_check(self):
        incident = self.reported_incident()
        response = self.client.post(
            f'/api/v1/incidents/{incident.id}/transition/', {'to': 'investigation', 'expectedVersion': None}, format='json'
        )
        self.assertEqual(response.status_code, 200)


class RevealReporterTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()

    def test_reveal_is_audited_and_bumps_version(self):
        incident = Incident.objects.filter(confidentiality='restricted').first()
        if incident is None:
            self.skipTest('no restricted incident in seed')
        response = self.client.post(f'/api/v1/incidents/{incident.id}/reveal-reporter/', {}, format='json')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['reporterRevealed'])
        entry = AuditLog.objects.order_by('list_order').first()
        self.assertEqual(entry.action, 'Reporter identity revealed (confidential record)')
        self.assertEqual(entry.field, 'reporterId')
        self.assertEqual(entry.entity_id, incident.id)


class CommentTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()

    def test_comment_with_mention_creates_targeted_notification(self):
        before = Notification.objects.count()
        response = self.client.post(
            '/api/v1/incidents/inc_002/comments/',
            {'body': 'Looping in @A. Sharma and @r.singh for the tyre inspection history.'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        comment = response.json()
        self.assertEqual(comment['authorId'], 'usr_001')
        self.assertIn('usr_002', comment['mentions'])
        self.assertIn('usr_003', comment['mentions'])

        notifications = Notification.objects.order_by('list_order')[:2]
        self.assertEqual(Notification.objects.count(), before + 2)
        self.assertEqual(notifications[0].title, 'J. Miller mentioned you on P_006-257')
        self.assertEqual(notifications[0].for_user_id, 'usr_002')
        self.assertEqual(notifications[0].severity, 'info')
        self.assertEqual(notifications[0].category, 'assignment')
        self.assertEqual(notifications[0].link, '/incidents/inc_002')

    def test_mention_notifications_are_only_visible_to_their_target(self):
        self.client.post('/api/v1/incidents/inc_002/comments/', {'body': 'cc @A. Sharma'}, format='json')
        # usr_001 sees only broadcast notifications (forUserId null)
        visible = self.client.get('/api/v1/notifications/').json()
        self.assertFalse(any(n.get('forUserId') == 'usr_002' for n in visible))
        # usr_002 sees the mention
        self.login(email='a.sharma@skysafety.aero')
        visible = self.client.get('/api/v1/notifications/').json()
        self.assertTrue(any(n.get('forUserId') == 'usr_002' for n in visible))

    def test_empty_comment_rejected(self):
        response = self.client.post('/api/v1/incidents/inc_002/comments/', {'body': '   '}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['message'], 'Comment is empty.')

    def test_comments_list_sorted_ascending(self):
        self.client.post('/api/v1/incidents/inc_002/comments/', {'body': 'first comment here'}, format='json')
        self.client.post('/api/v1/incidents/inc_002/comments/', {'body': 'second comment here'}, format='json')
        comments = self.client.get('/api/v1/incidents/inc_002/comments/').json()
        self.assertEqual([c['body'] for c in comments], ['first comment here', 'second comment here'])
        self.assertEqual(IncidentComment.objects.filter(incident_id='inc_002').count(), 2)


class AnonymousIntakeTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        cache.clear()
        self.anon = APIClient()  # no login at all

    def post(self, **overrides):
        payload = {
            'whatHappened': 'Saw a fuel stain under the starboard wing during the evening walk-around at the stand.',
            'where': 'Apron stand 12, BLR',
            'when': '2026-10-01T18:30',
            'contact': '',
            'honeypot': '',
            **overrides,
        }
        return self.anon.post('/api/v1/incidents/anonymous/', payload, format='json')

    def test_creates_triage_record_notification_and_audit(self):
        before = Incident.objects.count()
        response = self.post()
        self.assertEqual(response.status_code, 201, response.content)
        payload = response.json()
        self.assertTrue(payload['id'].startswith('inc_'))
        self.assertTrue(payload['ref'].startswith('P_006-'))
        self.assertEqual(Incident.objects.count(), before + 1)

        incident = Incident.objects.get(pk=payload['id'])
        self.assertEqual(incident.status, 'reported')
        self.assertEqual(incident.category, 'near_miss')
        self.assertEqual(incident.reporter_id, 'anonymous')
        self.assertEqual(incident.reporter_name, 'Anonymous reporter')
        self.assertEqual(incident.confidentiality, 'restricted')
        self.assertEqual(incident.risk['severity'], 'medium')
        self.assertEqual(incident.risk['score'], 6)
        self.assertEqual(incident.risk['level'], 'moderate')
        self.assertEqual(incident.location['iata'], '—')
        self.assertIsNone(incident.flight)
        self.assertEqual(incident.version, 1)
        self.assertIn('No contact offered — fully anonymous.', incident.description)

        notification = Notification.objects.order_by('list_order').first()
        self.assertEqual(notification.title, 'Anonymous report needs triage')
        self.assertEqual(notification.severity, 'warning')
        entry = AuditLog.objects.order_by('list_order').first()
        self.assertEqual(entry.action, 'Anonymous report accepted (needs triage)')
        self.assertEqual(entry.ip, 'public-intake')

    def test_too_short_description_rejected(self):
        response = self.post(whatHappened='too short')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()['message'], 'Please describe what happened in at least 20 characters.')

    def test_honeypot_drops_silently_with_convincing_ref(self):
        response = self.post(honeypot='i-am-a-bot')
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload['id'], 'dropped')
        self.assertTrue(payload['ref'].startswith('ANON-'))
        self.assertEqual(Notification.objects.filter(title='Anonymous report needs triage').count(), 0)

    def test_throttle_one_per_window_with_retry_after(self):
        self.assertEqual(self.post().status_code, 201)
        response = self.post()
        self.assertEqual(response.status_code, 429)
        self.assertIn('Retry-After', response.headers)

    @override_settings(SKYSHIELD_ANON_INTAKE_WINDOW_SECONDS=0)
    def test_daily_cap(self):
        for _ in range(10):
            response = self.post()
            self.assertEqual(response.status_code, 201, response.content)
        response = self.post()
        self.assertEqual(response.status_code, 429)


class NotificationTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()

    def test_mark_one_and_all(self):
        target = Notification.objects.filter(for_user_id__isnull=True).order_by('list_order').first()
        response = self.client.patch('/api/v1/notifications/', {'id': target.id, 'read': True}, format='json')
        self.assertEqual(response.status_code, 200)
        target.refresh_from_db()
        self.assertTrue(target.read)

        response = self.client.patch('/api/v1/notifications/', {'all': True}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(
            Notification.objects.filter(for_user_id__isnull=True, read=False).exists()
        )

    def test_mark_all_does_not_touch_other_users_targeted_notifications(self):
        Notification.objects.create(
            id='ntf_targeted', title='t', body='b', severity='info', category='assignment',
            at=timezone_now(), read=False, for_user_id='usr_002', list_order=-999,
        )
        self.client.patch('/api/v1/notifications/', {'all': True}, format='json')
        self.assertFalse(Notification.objects.get(pk='ntf_targeted').read)


def timezone_now():
    from django.utils import timezone

    return timezone.now()


class AuditLogTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()

    def test_wire_key_is_from_not_from_value(self):
        response = self.client.get('/api/v1/audit-log/')
        self.assertEqual(response.status_code, 200)
        entries = response.json()
        seeded = next(e for e in entries if e['id'] == 'log_001')
        self.assertIn('from', seeded)
        self.assertNotIn('fromValue', seeded)
        self.assertEqual(seeded['to'], 'EECU_Bench_Test_Report.pdf')

    def test_entity_id_filter(self):
        response = self.client.get('/api/v1/audit-log/?entityId=inv_001')
        entries = response.json()
        self.assertTrue(entries)
        self.assertTrue(all(e['entityId'] == 'inv_001' for e in entries))


class OperationsTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()

    def test_investigations_list_is_plain_array_with_incident_filter(self):
        response = self.client.get('/api/v1/investigations/')
        payload = response.json()
        self.assertIsInstance(payload, list)
        self.assertEqual(len(payload), 9)
        response = self.client.get('/api/v1/investigations/?incidentId=inc_002')
        payload = response.json()
        self.assertTrue(all(v['incidentId'] == 'inc_002' for v in payload))

    def test_investigation_patch_updates_progress(self):
        investigation = Investigation.objects.first()
        response = self.client.patch(
            f'/api/v1/investigations/{investigation.id}/', {'progress': 100, 'stage': 'verification'}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['progress'], 100)
        investigation.refresh_from_db()
        self.assertEqual(investigation.stage, 'verification')

    def test_investigation_patch_denied_for_auditor(self):
        self.login(email='p.iyer@skysafety.aero')
        investigation = Investigation.objects.first()
        response = self.client.patch(f'/api/v1/investigations/{investigation.id}/', {'progress': 1}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_rca_list_and_incident_filter(self):
        response = self.client.get('/api/v1/rca/')
        self.assertIsInstance(response.json(), list)
        some_rca = response.json()[0]
        response = self.client.get(f"/api/v1/rca/?incidentId={some_rca['incidentId']}")
        self.assertTrue(any(r['id'] == some_rca['id'] for r in response.json()))

    def test_start_rca_template_merge_with_explicit_empties(self):
        # The UI's startRCA() posts explicit empty collections to avoid
        # inheriting the template's chain — the merge must honour that.
        response = self.client.post(
            '/api/v1/rca/',
            {
                'incidentId': 'inc_005',
                'title': 'P_006-252 — root cause analysis',
                'method': 'five_whys',
                'status': 'not_started',
                'fiveWhys': None,
                'factors': [],
                'identifiedRootCauses': [],
                'recommendations': [],
                'authorId': 'usr_001',
                'reviewerId': None,
                'createdAt': '2026-10-01T10:00:00Z',
                'completedAt': None,
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        created = response.json()
        self.assertTrue(created['id'].startswith('rca_'))
        self.assertIsNone(created['fiveWhys'])
        self.assertEqual(created['factors'], [])
        self.assertEqual(created['status'], 'not_started')

    def test_rca_patch_denied_for_safety_officer(self):
        self.login(email='m.kumar@skysafety.aero')
        rca_id = self.client.get('/api/v1/rca/').json()[0]['id']
        response = self.client.patch(f'/api/v1/rca/{rca_id}/', {'status': 'in_progress'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_capa_create_sequential_ref_and_patch_verify_permission(self):
        max_ref_before = max(int(ref.split('-')[-1]) for ref in CAPA.objects.values_list('ref', flat=True))
        response = self.client.post(
            '/api/v1/capa/',
            {'incidentId': 'inc_002', 'title': 'Replace shimmy damper', 'priority': 'high'},
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.content)
        created = response.json()
        self.assertEqual(created['ref'], f'CAPA-2026-{max_ref_before + 1:03d}')

        # investigator may edit but NOT verify
        self.login(email='r.singh@skysafety.aero')
        response = self.client.patch(f'/api/v1/capa/{created["id"]}/', {'progress': 50}, format='json')
        self.assertEqual(response.status_code, 200)
        response = self.client.patch(
            f'/api/v1/capa/{created["id"]}/', {'status': 'verified', 'effectivenessCheck': 'passed'}, format='json'
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()['message'], 'Only safety managers can verify CAPA effectiveness.')

        # safety manager may verify
        self.login()
        response = self.client.patch(
            f'/api/v1/capa/{created["id"]}/',
            {'status': 'verified', 'effectivenessCheck': 'passed', 'verifiedAt': '2026-10-01T12:00:00Z'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'verified')

    def test_compliance_endpoints(self):
        response = self.client.get('/api/v1/compliance/requirements/')
        payload = response.json()
        self.assertIsInstance(payload, list)
        self.assertEqual(len(payload), 14)
        summary = self.client.get('/api/v1/compliance/requirements/summary/').json()
        self.assertIn('overall', summary)

        response = self.client.patch(
            f'/api/v1/compliance/requirements/{payload[0]["id"]}/', {'status': 'compliant', 'score': 100}, format='json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'compliant')

    def test_compliance_patch_denied_for_investigator(self):
        self.login(email='r.singh@skysafety.aero')
        requirement_id = self.client.get('/api/v1/compliance/requirements/').json()[0]['id']
        response = self.client.patch(f'/api/v1/compliance/requirements/{requirement_id}/', {'score': 1}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_dashboard_metrics_and_reference_data(self):
        metrics = self.client.get('/api/v1/dashboard/metrics/').json()
        self.assertIn('kpis', metrics)
        self.assertIn('slaCompliance', metrics)
        users = self.client.get('/api/v1/users/').json()
        self.assertEqual(len(users), 8)
        self.assertIn('licenseNumber', users[0])
        aircraft = self.client.get('/api/v1/aircraft/').json()
        self.assertEqual(len(aircraft), 10)
        self.assertIn('totalHours', aircraft[0])
        analytics = self.client.get('/api/v1/analytics/')
        self.assertEqual(analytics.status_code, 200)


class HealthTests(SeededAPITestCase):
    def test_health_is_public(self):
        response = APIClient().get('/api/health/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'ok')

    def test_csrf_cookie_is_provisioned_on_api_responses(self):
        response = APIClient().get('/api/health/')
        self.assertIn('csrftoken', response.cookies)
