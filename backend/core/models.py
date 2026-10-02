"""
Core domain models — 1:1 mirrors of src/types with CharField primary keys so
seeded fixture ids (inc_002, capa_001, …) stay stable across client/server.

Two deliberate deviations from "pure" modelling, both in service of the
frontend contract:

1. Embedded objects the TS types declare inline (risk, location, flight,
   fiveWhys, factors, stageHistory, crew, capaIds, attachments, mentions) are
   JSONFields — the client treats them as opaque payloads.
2. Anything the register filters or sorts on is ALSO denormalised into an
   indexed column (risk_score, severity, airport_iata, aircraft_reg,
   flight_number, investigator_name, reporter_name, category_label) so list
   queries never dig through JSON and search/sort parity with the mock's
   in-memory haystack is exact.
"""

from django.db import models
from django.utils import timezone

from core.domain import CATEGORY_LABEL, INCIDENT_STATUS_LABEL  # noqa: F401  (re-exported for seeds)


def user_display_name(user_id: str | None, users_cache: dict | None = None) -> str:
    """Port of userName(): 'Anonymous reporter' | real name | 'Unassigned'."""
    if user_id == 'anonymous':
        return 'Anonymous reporter'
    if not user_id:
        return 'Unassigned'
    if users_cache is not None:
        return users_cache.get(user_id, 'Unassigned')
    from accounts.models import User

    user = User.objects.filter(pk=user_id).first()
    return user.name if user else 'Unassigned'


class Aircraft(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    registration = models.CharField(max_length=24, unique=True)
    type = models.CharField(max_length=64)
    manufacturer = models.CharField(max_length=64)
    model = models.CharField(max_length=64)
    operator = models.CharField(max_length=120)
    year_of_delivery = models.IntegerField()
    total_cycles = models.IntegerField()
    total_hours = models.FloatField()
    base = models.CharField(max_length=64)
    status = models.CharField(max_length=24)
    last_maintenance_at = models.DateTimeField()
    next_inspection_at = models.DateTimeField()

    class Meta:
        ordering = ['id']


class Incident(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    ref = models.CharField(max_length=32, unique=True, db_index=True)
    version = models.IntegerField(null=True, blank=True)
    reporter_revealed = models.BooleanField(default=False)

    reported_at = models.DateTimeField()
    occurred_at = models.DateTimeField(db_index=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    title = models.CharField(max_length=240)
    description = models.TextField()
    category = models.CharField(max_length=40, db_index=True)
    status = models.CharField(max_length=24, db_index=True)

    risk = models.JSONField(default=dict)
    aircraft_id = models.CharField(max_length=64, blank=True, default='')
    flight = models.JSONField(null=True, blank=True)
    location = models.JSONField(default=dict)
    phase = models.CharField(max_length=24)

    reporter_id = models.CharField(max_length=64, blank=True, default='')
    investigator_id = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    crew = models.JSONField(default=list)
    department = models.CharField(max_length=120, blank=True, default='')
    operator = models.CharField(max_length=120, blank=True, default='')
    immediate_actions = models.TextField(blank=True, default='')
    injuries = models.IntegerField(default=0)
    damage_category = models.CharField(max_length=24, default='none')

    investigation_id = models.CharField(max_length=64, null=True, blank=True)
    rca_id = models.CharField(max_length=64, null=True, blank=True)
    capa_ids = models.JSONField(default=list)
    evidence_count = models.IntegerField(default=0)

    confidentiality = models.CharField(max_length=24, default='internal')
    occurrence_category = models.CharField(max_length=24, blank=True, default='')
    regulatory_notification = models.BooleanField(default=False)
    notified_authority = models.CharField(max_length=64, null=True, blank=True)

    # ---- denormalised for filter/sort/search parity with the mock store ----
    list_order = models.BigIntegerField(default=0, db_index=True)  # mock array order; new rows prepend
    severity = models.CharField(max_length=16, blank=True, default='')
    risk_score = models.IntegerField(default=0)
    airport_iata = models.CharField(max_length=8, blank=True, default='')
    location_city = models.CharField(max_length=80, blank=True, default='')
    location_airport_name = models.CharField(max_length=120, blank=True, default='')
    aircraft_reg = models.CharField(max_length=24, blank=True, default='')
    flight_number = models.CharField(max_length=24, blank=True, default='')
    investigator_name = models.CharField(max_length=120, blank=True, default='')
    reporter_name = models.CharField(max_length=120, blank=True, default='')
    category_label = models.CharField(max_length=60, blank=True, default='')

    class Meta:
        ordering = ['list_order']

    def sync_denorm(self, users_cache: dict | None = None) -> None:
        """Recompute denormalised columns from the JSON payload fields."""
        risk = self.risk or {}
        self.severity = str(risk.get('severity') or risk.get('Severity') or '')
        try:
            self.risk_score = int(risk.get('score', 0) or 0)
        except (TypeError, ValueError):
            self.risk_score = 0
        location = self.location or {}
        self.airport_iata = str(location.get('iata', '') or '')
        self.location_city = str(location.get('city', '') or '')
        self.location_airport_name = str(location.get('airport', '') or '')
        aircraft = Aircraft.objects.filter(pk=self.aircraft_id).first()
        self.aircraft_reg = aircraft.registration if aircraft else ''
        flight = self.flight or {}
        self.flight_number = str(flight.get('flightNumber') or flight.get('flight_number') or '')
        self.investigator_name = user_display_name(self.investigator_id, users_cache)
        self.reporter_name = user_display_name(self.reporter_id, users_cache)
        self.category_label = CATEGORY_LABEL.get(self.category, self.category)

    def save(self, *args, **kwargs):
        self.sync_denorm()
        super().save(*args, **kwargs)


class Investigation(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    incident_id = models.CharField(max_length=64, db_index=True)
    name = models.CharField(max_length=200)
    stage = models.CharField(max_length=32)
    progress = models.IntegerField(default=0)
    lead_investigator_id = models.CharField(max_length=64, blank=True, default='')
    team_member_ids = models.JSONField(default=list)
    opened_at = models.DateTimeField()
    due_at = models.DateTimeField()
    priority = models.CharField(max_length=16)
    stage_history = models.JSONField(default=list)
    findings = models.JSONField(default=list)
    interviews = models.JSONField(default=list)
    open_questions = models.JSONField(default=list)
    list_order = models.BigIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ['list_order']


class EvidenceItem(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    incident_id = models.CharField(max_length=64, db_index=True)
    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=16)
    size_kb = models.IntegerField(default=0)
    uploaded_by = models.CharField(max_length=120, blank=True, default='')
    uploaded_at = models.DateTimeField()
    hash = models.CharField(max_length=80, blank=True, default='')
    verified = models.BooleanField(default=False)
    # M4: real uploads. Seeded items keep file=None (metadata-only history);
    # items created through POST /media/ store the bytes and the SHA-256.
    file = models.FileField(upload_to='evidence/', null=True, blank=True, max_length=240)
    content_type = models.CharField(max_length=120, blank=True, default='')
    list_order = models.BigIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ['list_order']


class TimelineEvent(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    incident_id = models.CharField(max_length=64, db_index=True)
    at = models.DateTimeField()
    actor = models.CharField(max_length=120, blank=True, default='')
    title = models.CharField(max_length=200)
    detail = models.TextField(blank=True, default='')
    kind = models.CharField(max_length=16, default='system')
    list_order = models.BigIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ['list_order']


class RCA(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    incident_id = models.CharField(max_length=64, db_index=True)
    title = models.CharField(max_length=200)
    method = models.CharField(max_length=24)
    status = models.CharField(max_length=24)
    five_whys = models.JSONField(null=True, blank=True)
    factors = models.JSONField(default=list)
    identified_root_causes = models.JSONField(default=list)
    recommendations = models.JSONField(default=list)
    author_id = models.CharField(max_length=64, blank=True, default='')
    reviewer_id = models.CharField(max_length=64, null=True, blank=True)
    created_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    list_order = models.BigIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ['list_order']


class CAPA(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    ref = models.CharField(max_length=32, unique=True)
    incident_id = models.CharField(max_length=64, db_index=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    type = models.CharField(max_length=16)
    owner_id = models.CharField(max_length=64, blank=True, default='')
    priority = models.CharField(max_length=16)
    status = models.CharField(max_length=16, db_index=True)
    due_date = models.DateTimeField()
    opened_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    progress = models.IntegerField(default=0)
    effectiveness_check = models.CharField(max_length=16, null=True, blank=True)
    completion_evidence = models.TextField(null=True, blank=True)
    linked_finding = models.TextField(blank=True, default='')
    # M4: descriptors {name, at, by, sizeKb, hash, mediaId} for files uploaded
    # through POST /media/ with entityType=capa.
    attachments = models.JSONField(default=list)
    list_order = models.BigIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ['list_order']


class ComplianceRequirement(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    code = models.CharField(max_length=40)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    authority = models.CharField(max_length=32)
    category = models.CharField(max_length=32)
    status = models.CharField(max_length=32)
    score = models.IntegerField(default=0)
    evidence = models.TextField(blank=True, default='')
    attachments = models.JSONField(null=True, blank=True)
    owner_id = models.CharField(max_length=64, blank=True, default='')
    last_review_at = models.DateTimeField()
    next_review_at = models.DateTimeField()
    list_order = models.BigIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ['list_order']


class Notification(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True, default='')
    severity = models.CharField(max_length=16)
    category = models.CharField(max_length=24)
    at = models.DateTimeField()
    read = models.BooleanField(default=False)
    link = models.CharField(max_length=200, null=True, blank=True)
    actor = models.CharField(max_length=120, null=True, blank=True)
    for_user_id = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    list_order = models.BigIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ['list_order']


class AuditLog(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    at = models.DateTimeField(db_index=True)
    actor_id = models.CharField(max_length=64, blank=True, default='')
    entity = models.CharField(max_length=24)
    entity_id = models.CharField(max_length=64, db_index=True)
    action = models.CharField(max_length=240)
    field = models.CharField(max_length=64, null=True, blank=True)
    # `from` is a Python reserved word; the wire key stays `from` via the
    # serializer (db_column keeps the column name honest too).
    from_value = models.TextField(null=True, blank=True, db_column='from')
    to = models.TextField(null=True, blank=True)
    ip = models.CharField(max_length=64, blank=True, default='')
    note = models.TextField(null=True, blank=True)
    list_order = models.BigIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ['list_order']


class IncidentComment(models.Model):
    id = models.CharField(primary_key=True, max_length=64, editable=False)
    incident_id = models.CharField(max_length=64, db_index=True)
    author_id = models.CharField(max_length=64, blank=True, default='')
    at = models.DateTimeField()
    body = models.TextField()
    mentions = models.JSONField(default=list)

    class Meta:
        ordering = ['at']


class SiteData(models.Model):
    """Single-row JSON blobs: compliance summary, dashboard metrics, seed meta."""

    key = models.CharField(primary_key=True, max_length=64)
    data = models.JSONField(default=dict)

    @classmethod
    def get(cls, key: str, default=None):
        row = cls.objects.filter(pk=key).first()
        return row.data if row else default

    @classmethod
    def put(cls, key: str, data) -> None:
        cls.objects.update_or_create(pk=key, defaults={'data': data})


class IdempotencyRecord(models.Model):
    """
    M5 — stored answer for a mutating request that carried an Idempotency-Key.

    Scoped to (session, key, method, path): replaying the same key returns the
    original response instead of executing the mutation twice, which is what
    the offline queue relies on when a flushed report is retried after an
    ambiguous failure. Only 2xx answers are recorded; failures stay retryable.
    """

    session_key = models.CharField(max_length=64)
    key = models.CharField(max_length=80)
    method = models.CharField(max_length=8)
    path = models.CharField(max_length=240)
    status_code = models.IntegerField()
    content_type = models.CharField(max_length=120, default='application/json')
    body = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['session_key', 'key', 'method', 'path'],
                name='uniq_idempotency_scope',
            )
        ]


def next_sequential_ref(existing_refs, prefix: str) -> str:
    """Port of store-pure.nextSequentialRef: P_006-258 → P_006-259 (3-pad)."""
    maximum = 0
    for ref in existing_refs:
        if not ref.startswith(f'{prefix}-'):
            continue
        try:
            n = int(ref[len(prefix) + 1 :])
        except ValueError:
            continue
        maximum = max(maximum, n)
    return f'{prefix}-{maximum + 1:03d}'


def new_id(prefix: str) -> str:
    import uuid

    return f'{prefix}_{uuid.uuid4()}'


def next_list_order(model) -> int:
    """Mock collections unshift new rows; list_order keeps that ordering."""
    lowest = model.objects.order_by('list_order').values_list('list_order', flat=True).first()
    return (lowest - 1) if lowest is not None else 0


def write_audit(
    *,
    actor_id: str,
    entity: str,
    entity_id: str,
    action: str,
    field: str | None = None,
    from_value: str | None = None,
    to: str | None = None,
    ip: str = '',
    note: str | None = None,
) -> AuditLog:
    """
    Append an audit entry. Callers wrap mutations in transaction.atomic() so
    the entry lands or rolls back with the change it describes (S12 rule).
    """
    entry = AuditLog(
        id=new_id('aud'),
        at=timezone.now(),
        actor_id=actor_id or '',
        entity=entity,
        entity_id=entity_id,
        action=action,
        field=field,
        from_value=from_value,
        to=to,
        ip=ip or '',
        note=note,
        list_order=next_list_order(AuditLog),
    )
    entry.save()
    return entry
