"""M6 — server-side dashboard metrics and analytics aggregation."""

from datetime import datetime, timedelta, timezone as dt_timezone

from core.analytics import ACTIVE_STATUSES, CLOSED_CAPA_STATUSES
from core.models import CAPA, RCA, Incident
from core.tests.base import SeededAPITestCase


class DashboardMetricsTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()
        self.data = self.client.get('/api/v1/dashboard/metrics/').json()

    def test_kpis_mirror_the_tables(self):
        kpis = self.data['kpis']
        self.assertEqual([k['id'] for k in kpis], ['kpi_active', 'kpi_investigation', 'kpi_rca', 'kpi_capa_overdue'])
        active = Incident.objects.filter(status__in=ACTIVE_STATUSES).count()
        self.assertEqual(kpis[0]['value'], active)
        self.assertEqual(kpis[1]['value'], Incident.objects.filter(status='investigation').count())
        self.assertEqual(kpis[2]['value'], RCA.objects.exclude(status='completed').count())
        now = datetime.now(dt_timezone.utc)
        overdue = CAPA.objects.exclude(status__in=CLOSED_CAPA_STATUSES).filter(due_date__lt=now).count()
        self.assertEqual(kpis[3]['value'], overdue)
        for kpi in kpis:
            self.assertEqual(len(kpi['series']), 12)

    def test_mixes_and_totals(self):
        active = Incident.objects.filter(status__in=ACTIVE_STATUSES).count()
        self.assertEqual(sum(m['value'] for m in self.data['severityMix']), active)
        self.assertEqual([m['name'] for m in self.data['severityMix']], ['critical', 'high', 'medium', 'low', 'negligible'])
        self.assertEqual(self.data['totalCapas'], CAPA.objects.count())
        self.assertEqual(
            self.data['completedCapas'], CAPA.objects.filter(status__in=CLOSED_CAPA_STATUSES).count()
        )
        non_draft = Incident.objects.exclude(status='draft').count()
        self.assertEqual(sum(t['value'] for t in self.data['typeMix']), non_draft)

    def test_trend_and_sla_series_shapes(self):
        self.assertEqual(len(self.data['trend']), 12)
        for point in self.data['trend']:
            self.assertEqual(set(point), {'month', 'reported', 'closed', 'capex'})
        self.assertEqual(len(self.data['capaSlaSeries']), 6)
        for point in self.data['capaSlaSeries']:
            self.assertEqual(set(point), {'month', 'open', 'completed', 'overdue', 'dueSoon'})

    def test_rates_and_sync(self):
        total = RCA.objects.count()
        expected = round(RCA.objects.filter(status='completed').count() / total * 100) if total else 0
        self.assertEqual(self.data['rcaCompletionRate'], expected)
        self.assertEqual(self.data['systemStatus'], 'operational')
        synced = datetime.strptime(self.data['lastSyncAt'], '%Y-%m-%dT%H:%M:%SZ').replace(tzinfo=dt_timezone.utc)
        self.assertLess(abs((datetime.now(dt_timezone.utc) - synced).total_seconds()), 120)

    def test_metrics_move_with_the_data(self):
        before = self.data['kpis'][0]['value']
        incident = Incident.objects.order_by('list_order').first()
        incident.status = 'closed'
        incident.closed_at = datetime.now(dt_timezone.utc)
        incident.save(update_fields=['status', 'closed_at'])
        after = self.client.get('/api/v1/dashboard/metrics/').json()
        self.assertEqual(after['kpis'][0]['value'], before - 1)


class AnalyticsTests(SeededAPITestCase):
    def setUp(self):
        super().setUp()
        self.login()

    def test_counts_match_the_register(self):
        data = self.client.get('/api/v1/analytics/', {'period': '12m'}).json()
        since = datetime.now(dt_timezone.utc) - timedelta(days=365)
        expected = Incident.objects.exclude(status='draft').filter(occurred_at__gte=since).count()
        self.assertEqual(data['counts']['rows'], expected)
        self.assertEqual(data['windowDays'], 365)
        self.assertEqual([k['id'] for k in data['kpis']], ['a_total', 'a_closure', 'a_risk', 'a_capa'])
        self.assertEqual(data['kpis'][0]['value'], expected)
        self.assertEqual(len(data['weekly']), data['kpis'][0]['series'].__len__())

    def test_filters_scope_the_payload(self):
        all_rows = self.client.get('/api/v1/analytics/', {'period': '12m'}).json()['counts']['rows']
        crit = self.client.get('/api/v1/analytics/', {'period': '12m', 'severity': 'critical'}).json()
        since = datetime.now(dt_timezone.utc) - timedelta(days=365)
        expected = Incident.objects.filter(severity='critical').exclude(status='draft').filter(occurred_at__gte=since).count()
        self.assertEqual(crit['counts']['rows'], expected)
        self.assertLessEqual(crit['counts']['rows'], all_rows)
        self.assertTrue(all(s['key'] == 'critical' for s in crit['severity']))

    def test_period_windows(self):
        data = self.client.get('/api/v1/analytics/', {'period': '12w'}).json()
        self.assertEqual(data['windowDays'], 84)
        self.assertTrue(12 <= len(data['weekly']) <= 14)
        self.assertLessEqual(len(data['complianceTrend']), 3)

    def test_payload_shape(self):
        data = self.client.get('/api/v1/analytics/', {'period': '6m'}).json()
        self.assertEqual(data['windowDays'], 182)
        for key in ('weekly', 'monthly', 'severity', 'riskDist', 'types', 'aircraft', 'airports', 'phases', 'rcaSeries', 'capaSeries', 'scopedCapas'):
            self.assertIsInstance(data[key], list)
        self.assertEqual(len(data['rcaSeries']), 6)
        self.assertEqual(len(data['riskDist']), 4)
        for band in data['riskDist']:
            self.assertEqual(set(band), {'label', 'bucket', 'count', 'color'})
        for row in data['scopedCapas']:
            self.assertEqual(set(row), {'ref', 'status', 'dueDate', 'progress'})

    def test_monthly_reported_sums_to_the_window(self):
        data = self.client.get('/api/v1/analytics/', {'period': '12m'}).json()
        self.assertEqual(sum(m['reported'] for m in data['monthly']), data['counts']['rows'])
        self.assertLessEqual(
            sum(m['closed'] for m in data['monthly']),
            Incident.objects.filter(closed_at__isnull=False).count(),
        )

    def test_requires_authentication(self):
        self.client.logout()
        response = self.client.get('/api/v1/analytics/')
        self.assertIn(response.status_code, (401, 403))
