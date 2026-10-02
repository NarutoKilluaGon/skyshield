"""
M6 — server-side metrics and analytics.

Every figure the dashboard and the analytics page show is computed here from
the live tables (incidents, investigations, RCA, CAPA, compliance). The
bucketing mirrors the frontend maths 1:1 (src/pages/analytics.tsx and the
DashboardMetrics shape in src/types) so the two modes never disagree about
what a number means; the frontend keeps its client-side copies for mock mode
only.
"""

from datetime import datetime, timedelta, timezone as dt_timezone

from core.domain import CATEGORY_LABEL, SEVERITY_ORDER, risk_level
from core.models import CAPA, RCA, Aircraft, Incident, Investigation, SiteData

MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

SEVERITY_LABEL = {
    'critical': 'Critical',
    'high': 'High',
    'medium': 'Medium',
    'low': 'Low',
    'negligible': 'Negligible',
}
SEVERITY_COLOR = {
    'critical': 'var(--color-crit)',
    'high': 'var(--color-alert)',
    'medium': 'var(--color-warn)',
    'low': 'var(--color-ok)',
    'negligible': 'var(--color-neutral)',
}
PHASE_LABEL = {
    'gate': 'At Gate',
    'pushback': 'Pushback',
    'taxi': 'Taxi',
    'takeoff': 'Take-off',
    'climb': 'Climb',
    'cruise': 'Cruise',
    'descent': 'Descent',
    'approach': 'Approach',
    'landing': 'Landing',
    'maintenance': 'Maintenance',
    'ground_ops': 'Ground Operations',
}
RISK_BAND_META = [
    ('low', 'Low', 'var(--color-ok)'),
    ('moderate', 'Moderate', 'var(--color-warn)'),
    ('high', 'High', 'var(--color-alert)'),
    ('critical', 'Critical', 'var(--color-crit)'),
]

CLOSED_CAPA_STATUSES = ('completed', 'verified')
ACTIVE_STATUSES = ('reported', 'investigation', 'rca_pending', 'capa')
DUE_SOON_DAYS = 14
SLA_CLOSE_DAYS = 30


def _now() -> datetime:
    return datetime.now(dt_timezone.utc)


def _pct(n: int, d: int) -> int:
    return round(n / d * 100) if d > 0 else 0


def _delta_pct(cur: float, prev: float) -> float:
    if prev == 0:
        return 100.0 if cur > 0 else 0.0
    return round((cur - prev) / prev * 100, 1)


def _month_bounds(count: int) -> list[tuple[str, datetime, datetime]]:
    """Last `count` months (oldest first) as (label, start, exclusive_end) in UTC."""
    now = _now()
    out = []
    for k in range(count - 1, -1, -1):
        year, month = now.year, now.month - k
        while month <= 0:
            month += 12
            year -= 1
        start = datetime(year, month, 1, tzinfo=dt_timezone.utc)
        end_year, end_month = (year + 1, 1) if month == 12 else (year, month + 1)
        end = datetime(end_year, end_month, 1, tzinfo=dt_timezone.utc)
        out.append((MONTHS[month - 1], start, end))
    return out


def _start_of_week(d: datetime) -> datetime:
    return (d - timedelta(days=d.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)


def _cumulative_rate(
    items: list[tuple[datetime, datetime | None]], month_ends: list[datetime]
) -> list[dict]:
    """[{month, rate, done, opened}] — the analytics page's cumulativeRate()."""
    out = []
    for end in month_ends:
        opened = sum(1 for created, _ in items if created <= end)
        done = sum(1 for created, completed in items if created <= end and completed and completed <= end)
        out.append({'month': MONTHS[end.month - 1], 'rate': _pct(done, opened), 'done': done, 'opened': opened})
    return out


def _month_ends(count: int) -> list[datetime]:
    """Last-day-of-month instants (exclusive upper bounds) for the last `count` months."""
    return [end for _, _, end in _month_bounds(count)]


# ------------------------------------------------------------------ dashboard


def dashboard_metrics() -> dict:
    """The DashboardMetrics payload — src/types DashboardMetrics + capaSlaSeries."""
    now = _now()
    incidents = list(Incident.objects.all())
    active = [i for i in incidents if i.status in ACTIVE_STATUSES]
    closed = [i for i in incidents if i.status == 'closed' and i.closed_at]
    capas = list(CAPA.objects.all())
    rcas = list(RCA.objects.all())
    investigations = list(Investigation.objects.all())
    bounds12 = _month_bounds(12)

    # --- KPI 1: total active incidents, with a 12-month active-at-month-end series
    active_series = []
    for _, _, end in bounds12:
        reported = sum(1 for i in incidents if i.status != 'draft' and i.occurred_at < end)
        shut = sum(1 for i in incidents if i.closed_at and i.closed_at < end)
        active_series.append(max(0, reported - shut))
    sev_counts = {s: sum(1 for i in active if i.severity == s) for s in SEVERITY_ORDER}
    kpi_active = {
        'id': 'kpi_active',
        'label': 'Total Active Incidents',
        'value': len(active),
        'delta': _delta_pct(len(active), active_series[-2] if len(active_series) > 1 else 0),
        'deltaLabel': f'{"+" if len(active) >= (active_series[-2] if len(active_series) > 1 else 0) else ""}'
        f'{round(_delta_pct(len(active), active_series[-2] if len(active_series) > 1 else 0), 1)}% from last month',
        'accent': 'orange',
        'series': active_series,
        'footnote': f"{sev_counts['high']} high · {sev_counts['medium']} medium · {sev_counts['low']} low",
    }

    # --- KPI 2: under investigation
    investigating = [i for i in active if i.status == 'investigation']
    open_investigations = [v for v in investigations if v.stage not in ('closed', 'completed')]
    high_priority = sum(1 for v in open_investigations if v.priority in ('high', 'critical'))
    durations = sorted((now - v.opened_at).days for v in open_investigations)
    median_days = durations[len(durations) // 2] if durations else 0
    inv_by_month = [
        sum(1 for v in investigations if start <= v.opened_at < end) for _, start, end in bounds12
    ]
    kpi_investigation = {
        'id': 'kpi_investigation',
        'label': 'Under Investigation',
        'value': len(investigating),
        'delta': _delta_pct(inv_by_month[-1], inv_by_month[-2]),
        'deltaLabel': f'{high_priority} high priority',
        'accent': 'blue',
        'series': inv_by_month,
        'footnote': f'Median open duration {median_days} days',
    }

    # --- KPI 3: pending RCA
    pending_rcas = [r for r in rcas if r.status != 'completed']
    in_review = sum(1 for r in pending_rcas if r.status == 'in_review')
    in_progress = sum(1 for r in pending_rcas if r.status == 'in_progress')
    rca_by_month = [sum(1 for r in rcas if start <= r.created_at < end) for _, start, end in bounds12]
    kpi_rca = {
        'id': 'kpi_rca',
        'label': 'Pending RCA',
        'value': len(pending_rcas),
        'delta': _delta_pct(rca_by_month[-1], rca_by_month[-2]),
        'deltaLabel': f'{in_review} in review',
        'accent': 'amber',
        'series': rca_by_month,
        'footnote': f'{in_progress} in progress',
    }

    # --- KPI 4: overdue CAPAs
    def is_open(c: CAPA) -> bool:
        return c.status not in CLOSED_CAPA_STATUSES

    def capa_done_at(c: CAPA):
        return c.completed_at or c.verified_at

    overdue = [c for c in capas if is_open(c) and c.due_date < now]
    overdue_series = [
        sum(1 for c in capas if is_open_at(c, end) and c.due_date < end) for _, _, end in bounds12
    ]
    oldest = max(((now - c.due_date).days for c in overdue), default=0)
    kpi_overdue = {
        'id': 'kpi_capa_overdue',
        'label': 'Overdue CAPAs',
        'value': len(overdue),
        'delta': round(_delta_pct(len(overdue), overdue_series[-2]), 1),
        'deltaLabel': 'Requires immediate attention' if overdue else 'None overdue',
        'accent': 'red' if overdue else 'green',
        'series': overdue_series,
        'footnote': f'Oldest overdue {oldest} days' if overdue else 'No action past its due date',
    }

    # --- 12-month trend: reported / closed / CAPAs opened
    trend = []
    for label, start, end in bounds12:
        trend.append(
            {
                'month': label,
                'reported': sum(1 for i in incidents if start <= i.occurred_at < end),
                'closed': sum(1 for i in incidents if i.closed_at and start <= i.closed_at < end),
                'capex': sum(1 for c in capas if start <= c.opened_at < end),
            }
        )

    severity_mix = [
        {'name': s, 'value': sev_counts[s], 'color': SEVERITY_COLOR[s]} for s in SEVERITY_ORDER
    ]

    type_counts: dict[str, int] = {}
    for i in incidents:
        if i.status == 'draft':
            continue
        type_counts[i.category] = type_counts.get(i.category, 0) + 1
    type_mix = [
        {'name': CATEGORY_LABEL.get(cat, cat), 'value': n}
        for cat, n in sorted(type_counts.items(), key=lambda kv: -kv[1])
    ]

    on_time = sum(1 for i in closed if (i.closed_at - i.occurred_at).days <= SLA_CLOSE_DAYS)
    open_capas = [c for c in capas if is_open(c)]
    due_soon = [
        c
        for c in open_capas
        if c.due_date >= now and (c.due_date - now).days <= DUE_SOON_DAYS
    ]
    completed_capas = [c for c in capas if not is_open(c)]

    bounds6 = _month_bounds(6)
    capa_sla = []
    for label, start, end in bounds6:
        capa_sla.append(
            {
                'month': label,
                'open': sum(1 for c in capas if is_open_at(c, end)),
                'completed': sum(1 for c in capas if capa_done_at(c) and start <= capa_done_at(c) < end),
                'overdue': sum(1 for c in capas if is_open_at(c, end) and c.due_date < end),
                'dueSoon': sum(
                    1
                    for c in capas
                    if is_open_at(c, end) and end <= c.due_date < end + timedelta(days=DUE_SOON_DAYS)
                ),
            }
        )

    return {
        'kpis': [kpi_active, kpi_investigation, kpi_rca, kpi_overdue],
        'trend': trend,
        'severityMix': severity_mix,
        'typeMix': type_mix,
        'slaCompliance': round(on_time / len(closed) * 100, 1) if closed else 100.0,
        'openCapas': len(open_capas),
        'completedCapas': len(completed_capas),
        'overdueCapas': len(overdue),
        'dueSoonCapas': len(due_soon),
        'totalCapas': len(capas),
        'rcaCompletionRate': _pct(sum(1 for r in rcas if r.status == 'completed'), len(rcas)),
        'capaCompletionRate': _pct(len(completed_capas), len(capas)),
        'systemStatus': 'operational' if len(overdue) <= 5 else 'degraded',
        'lastSyncAt': now.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'capaSlaSeries': capa_sla,
    }


def is_open_at(c: CAPA, bound: datetime) -> bool:
    """Snapshot: opened before `bound` and not completed/verified before it."""
    if c.opened_at >= bound:
        return False
    done = c.completed_at or c.verified_at
    return done is None or done >= bound


# ------------------------------------------------------------------ analytics


def _resolve_window(period: str) -> tuple[int, datetime, datetime]:
    now = _now()
    year_start = datetime(now.year, 1, 1, tzinfo=dt_timezone.utc)
    if period == '12w':
        days = 84
    elif period == '6m':
        days = 182
    elif period == 'ytd':
        days = max(1, -((year_start - now) // timedelta(days=1)))  # ceil, mirrors the client
    else:
        days = 365
    since = year_start if period == 'ytd' else now - timedelta(days=days)
    return days, since, since - timedelta(days=days)


def analytics_payload(period: str, severity: str, category: str, registration: str) -> dict:
    """The /analytics/ aggregation consumed by src/pages/analytics.tsx."""
    window_days, since, prev_since = _resolve_window(period)
    incidents = list(Incident.objects.exclude(status='draft').order_by('list_order'))

    aircraft_id_by_reg = {a.registration: a.id for a in Aircraft.objects.all()}
    aircraft_type_by_id = {a.id: a.type for a in Aircraft.objects.all()}
    target_aircraft_id = aircraft_id_by_reg.get(registration) if registration != 'all' else None

    def attr_match(i: Incident) -> bool:
        if severity != 'all' and i.severity != severity:
            return False
        if category != 'all' and i.category != category:
            return False
        if target_aircraft_id is not None and i.aircraft_id != target_aircraft_id:
            return False
        return True

    rows = [i for i in incidents if attr_match(i) and i.occurred_at >= since]
    prev_rows = [i for i in incidents if attr_match(i) and prev_since <= i.occurred_at < since]
    row_ids = {i.id for i in rows}

    # weekly buckets (Monday-start, mirroring startOfWeek in analytics.tsx)
    weekly = []
    index = {}
    d = _start_of_week(since)
    while d <= _now():
        key = d.strftime('%Y-%m-%d')
        index[key] = len(weekly)
        weekly.append({'key': key, 'label': f'{d.day} {MONTHS[d.month - 1]}', 'reported': 0, 'closed': 0, 'highSeverity': 0})
        d += timedelta(days=7)
    for i in rows:
        wk = index.get(_start_of_week(i.occurred_at).strftime('%Y-%m-%d'))
        if wk is None:
            continue
        weekly[wk]['reported'] += 1
        if i.severity in ('critical', 'high'):
            weekly[wk]['highSeverity'] += 1
        if i.closed_at:
            ck = index.get(_start_of_week(i.closed_at).strftime('%Y-%m-%d'))
            if ck is not None:
                weekly[ck]['closed'] += 1

    # monthly reported/closed
    monthly_map: dict[str, dict] = {}
    for i in rows:
        key = i.occurred_at.strftime('%Y-%m')
        entry = monthly_map.setdefault(key, {'month': MONTHS[i.occurred_at.month - 1], 'reported': 0, 'closed': 0})
        entry['reported'] += 1
        if i.closed_at:
            ckey = i.closed_at.strftime('%Y-%m')
            centry = monthly_map.setdefault(ckey, {'month': MONTHS[i.closed_at.month - 1], 'reported': 0, 'closed': 0})
            centry['closed'] += 1
    monthly = [monthly_map[k] for k in sorted(monthly_map)]

    severity_data = []
    for s in SEVERITY_ORDER:
        n = sum(1 for i in rows if i.severity == s)
        if n:
            severity_data.append({'name': SEVERITY_LABEL[s], 'key': s, 'value': n, 'color': SEVERITY_COLOR[s]})

    risk_dist = [
        {
            'label': label,
            'bucket': level,
            'count': sum(1 for i in rows if risk_level(i.risk_score) == level),
            'color': color,
        }
        for level, label, color in RISK_BAND_META
    ]

    type_counts: dict[str, int] = {}
    for i in rows:
        type_counts[i.category] = type_counts.get(i.category, 0) + 1
    type_data = [
        {'name': CATEGORY_LABEL.get(c, c), 'value': type_counts[c]}
        for c in CATEGORY_LABEL
        if type_counts.get(c)
    ]
    type_data.sort(key=lambda t: -t['value'])

    aircraft_counts: dict[str, int] = {}
    for i in rows:
        name = aircraft_type_by_id.get(i.aircraft_id, 'Unknown')
        aircraft_counts[name] = aircraft_counts.get(name, 0) + 1
    aircraft_data = sorted(
        ({'name': k, 'value': v} for k, v in aircraft_counts.items()), key=lambda t: -t['value']
    )

    airport_counts: dict[str, dict] = {}
    for i in rows:
        iata = i.airport_iata or '—'
        entry = airport_counts.setdefault(iata, {'name': iata, 'city': i.location_city or '', 'value': 0})
        entry['value'] += 1
    airport_data = sorted(airport_counts.values(), key=lambda a: -a['value'])[:8]

    phase_counts = {p: sum(1 for i in rows if i.phase == p) for p in PHASE_LABEL}
    phase_data = sorted(
        ({'name': PHASE_LABEL[p], 'value': n} for p, n in phase_counts.items() if n),
        key=lambda t: -t['value'],
    )

    scoped_capas = list(CAPA.objects.filter(incident_id__in=row_ids).order_by('list_order'))
    rcas = list(RCA.objects.all().order_by('list_order'))
    ends6 = _month_ends(6)
    rca_series = _cumulative_rate([(r.created_at, r.completed_at) for r in rcas], ends6)
    capa_series = _cumulative_rate(
        [(c.opened_at, c.completed_at or c.verified_at) for c in scoped_capas], ends6
    )

    now = _now()
    closed_n = sum(1 for i in rows if i.status == 'closed')
    prev_closed_n = sum(1 for i in prev_rows if i.status == 'closed')
    mean_score = round(sum(i.risk_score for i in rows) / len(rows), 1) if rows else 0.0
    prev_mean = round(sum(i.risk_score for i in prev_rows) / len(prev_rows), 1) if prev_rows else 0.0
    open_scoped = [c for c in scoped_capas if c.status not in CLOSED_CAPA_STATUSES]

    kpis = [
        {
            'id': 'a_total',
            'label': 'Occurrences',
            'value': len(rows),
            'delta': round(_delta_pct(len(rows), len(prev_rows))) if prev_rows else (100 if rows else 0),
            'deltaLabel': 'vs prior window',
            'accent': 'blue',
            'series': [w['reported'] for w in weekly],
            'footnote': 'Filtered register count',
        },
        {
            'id': 'a_closure',
            'label': 'Closure rate',
            'value': _pct(closed_n, len(rows)),
            'unit': '%',
            'delta': _pct(closed_n, len(rows)) - _pct(prev_closed_n, len(prev_rows)),
            'deltaLabel': 'pts vs prior window',
            'accent': 'green',
            'series': [w['closed'] for w in weekly],
            'footnote': 'Closed ÷ filtered occurrences',
        },
        {
            'id': 'a_risk',
            'label': 'Mean risk score',
            'value': mean_score,
            'delta': round(mean_score - prev_mean, 1),
            'deltaLabel': 'pts vs prior window',
            'accent': 'red' if mean_score >= 10 else 'amber',
            'series': [w['highSeverity'] if w['reported'] else 0 for w in weekly],
            'footnote': 'Severity × likelihood, filtered mean',
        },
        {
            'id': 'a_capa',
            'label': 'Open CAPAs',
            'value': len(open_scoped),
            'delta': 0,
            'deltaLabel': 'current',
            'accent': 'orange' if open_scoped else 'green',
            'series': [c['opened'] - c['done'] for c in capa_series],
            'footnote': 'Linked to filtered occurrences',
        },
    ]

    trend_points = 3 if period == '12w' else 6 if period == '6m' else 12
    compliance_trend = list(SiteData.get('complianceTrend') or [])[-trend_points:]

    return {
        'windowDays': window_days,
        'since': since.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'prevSince': prev_since.strftime('%Y-%m-%dT%H:%M:%SZ'),
        # Only the figures the page cannot derive from the arrays itself.
        'counts': {
            'rows': len(rows),
            'atOrAbove': sum(1 for i in rows if i.risk_score >= 15),
            'rcaDone': sum(1 for r in rcas if r.status == 'completed'),
            'rcaTotal': len(rcas),
            'capaClosed': sum(1 for c in scoped_capas if c.status in CLOSED_CAPA_STATUSES),
            'capaTotal': len(scoped_capas),
            'capaOverdue': sum(1 for c in open_scoped if c.due_date < now),
        },
        'weekly': weekly,
        'monthly': monthly,
        'severity': severity_data,
        'riskDist': risk_dist,
        'types': type_data,
        'aircraft': aircraft_data,
        'airports': airport_data,
        'phases': phase_data,
        'rcaSeries': rca_series,
        'capaSeries': capa_series,
        'kpis': kpis,
        'scopedCapas': [
            {
                'ref': c.ref,
                'status': c.status,
                'dueDate': c.due_date.strftime('%Y-%m-%dT%H:%M:%SZ'),
                'progress': c.progress,
            }
            for c in scoped_capas
        ],
        'complianceTrend': compliance_trend,
    }
