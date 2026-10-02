"""
Data API views — the network twin of src/services/*.

Semantics are ported from the mock services so the frontend behaves
identically with VITE_USE_MOCK=false:

- incidents list: the register's filter/sort/page envelope {items,total,page,pageSize}
- create: template merge over the first seeded incident (mock createIncident)
- transition: workflow guards + optimistic locking + same-transaction audit
- reveal-reporter: audited privacy disclosure
- comments: @mention notifications in the same transaction
- anonymous intake: throttle + honeypot + safety-desk notification

Guards run server-side on the SESSION user's role — the client copy in
lib/workflow.ts and lib/permissions.ts is UX only (BACKEND_PLAN §2.1).
"""

import hashlib
import io
import time
from datetime import datetime, time as dtime, timezone as dt_timezone

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import models as db_models
from django.db import transaction
from django.db.models import Q
from django.http import FileResponse, Http404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from core import analytics
from core.domain import CATEGORY_LABEL  # noqa: F401 (kept for parity checks)
from core.models import (
    CAPA,
    RCA,
    Aircraft,
    AuditLog,
    ComplianceRequirement,
    EvidenceItem,
    Incident,
    IncidentComment,
    Investigation,
    Notification,
    SiteData,
    TimelineEvent,
    new_id,
    next_list_order,
    next_sequential_ref,
    write_audit,
)
from core.permissions import denial_reason, has_permission
from core.serializers import (
    CAPASerializer,
    RCASerializer,
    AircraftSerializer,
    AuditLogSerializer,
    ComplianceRequirementSerializer,
    EvidenceItemSerializer,
    IncidentCommentSerializer,
    IncidentSerializer,
    InvestigationSerializer,
    NotificationSerializer,
    TimelineEventSerializer,
)
from core.workflow import TransitionContext, can_transition
from core.domain import INCIDENT_STATUS_LABEL
from core.throttles import AnonIntakeThrottle

# ---------------------------------------------------------------- helpers


def role_of(request) -> str | None:
    return getattr(request.user, 'role', None)


def actor_id_of(request) -> str:
    return getattr(request.user, 'id', None) or 'system'


def deny(permission: str, role: str | None) -> Response:
    return Response({'message': denial_reason(role, permission)}, status=status.HTTP_403_FORBIDDEN)


def client_ip(request) -> str:
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def parse_dt(value):
    """ISO string → aware datetime (None/'' pass through)."""
    if value in (None, ''):
        return None
    if isinstance(value, datetime):
        return value if timezone.is_aware(value) else timezone.make_aware(value, dt_timezone.utc)
    parsed = parse_datetime(str(value))
    if parsed is None:
        try:  # date-only payloads
            parsed = datetime.combine(datetime.fromisoformat(str(value)).date(), dtime.min)
        except ValueError:
            return None
    return parsed if timezone.is_aware(parsed) else timezone.make_aware(parsed, dt_timezone.utc)


INCIDENT_FIELDS = [
    'title', 'description', 'category', 'status', 'risk', 'aircraft_id', 'flight',
    'location', 'phase', 'reporter_id', 'investigator_id', 'crew', 'department',
    'operator', 'immediate_actions', 'injuries', 'damage_category',
    'investigation_id', 'rca_id', 'capa_ids', 'evidence_count', 'confidentiality',
    'occurrence_category', 'regulatory_notification', 'notified_authority',
    'version', 'reporter_revealed', 'occurred_at', 'reported_at', 'closed_at',
]
INCIDENT_DATETIME_FIELDS = {'occurred_at', 'reported_at', 'closed_at'}


def apply_payload(instance, data: dict, fields: list[str], datetime_fields: set[str] = frozenset()):
    """Whitelisted merge — the mock services do `{...record, ...payload}`."""
    for field in fields:
        if field in data:
            value = data[field]
            if field in datetime_fields:
                value = parse_dt(value)
            setattr(instance, field, value)


def envelope(request, queryset, serializer_cls, default_page_size=10):
    """{items,total,page,pageSize} — the Paginated<T> contract."""
    try:
        page = max(int(request.query_params.get('page') or 1), 1)
    except ValueError:
        page = 1
    try:
        page_size = int(request.query_params.get('pageSize') or default_page_size)
    except ValueError:
        page_size = default_page_size
    page_size = max(1, min(page_size, 1000))
    total = queryset.count()
    start = (page - 1) * page_size
    items = serializer_cls(queryset[start : start + page_size], many=True).data
    return Response({'items': items, 'total': total, 'page': page, 'page_size': page_size})


def csv_list(request, key: str) -> list[str]:
    raw = request.query_params.get(key)
    if not raw:
        return []
    return [part.strip() for part in raw.split(',') if part.strip()]


SEVERITY_RANK = {name: index * -1 for index, name in enumerate(['critical', 'high', 'medium', 'low', 'negligible'])}
STATUS_RANK = {name: index for index, name in enumerate(['draft', 'reported', 'investigation', 'rca_pending', 'capa', 'closed'])}


def incident_sort(queryset, sort: str | None, direction: str | None):
    """Port of the register's sortValue(): same keys, same orderings."""
    if not sort:
        return queryset
    desc = direction == 'desc'
    from django.db.models import Case, IntegerField, Value, When

    column = {
        'ref': 'ref',
        'occurredAt': 'occurred_at',
        'reportedAt': 'reported_at',
        'score': 'risk_score',
        'risk': 'risk_score',
        'investigator': 'investigator_name',
        'flight': 'flight_number',
        'aircraft': 'aircraft_reg',
        'airport': 'airport_iata',
        'category': 'category_label',
        'title': 'title',
    }.get(sort)
    if column:
        return queryset.order_by(('-' if desc else '') + column, 'list_order')
    if sort == 'severity':
        whens = [When(severity=name, then=Value(rank)) for name, rank in SEVERITY_RANK.items()]
        return queryset.annotate(sort_rank=Case(*whens, default=Value(1), output_field=IntegerField())).order_by(
            ('-' if desc else '') + 'sort_rank', 'list_order'
        )
    if sort == 'status':
        whens = [When(status=name, then=Value(rank)) for name, rank in STATUS_RANK.items()]
        return queryset.annotate(sort_rank=Case(*whens, default=Value(-1), output_field=IntegerField())).order_by(
            ('-' if desc else '') + 'sort_rank', 'list_order'
        )
    return queryset.order_by('list_order')


def filter_incidents(request, queryset):
    """Port of the mock matches(): identical include/exclude semantics."""
    params = request.query_params
    search = (params.get('search') or '').strip()
    if search:
        haystack = Q(ref__icontains=search) | Q(title__icontains=search) | Q(description__icontains=search)
        for column in (
            'flight_number', 'airport_iata', 'location_city', 'location_airport_name',
            'investigator_name', 'reporter_name', 'category_label',
        ):
            haystack |= Q(**{f'{column}__icontains': search})
        queryset = queryset.filter(haystack)

    severities = csv_list(request, 'severity')
    if severities:
        queryset = queryset.filter(severity__in=severities)
    statuses = csv_list(request, 'status')
    if statuses:
        queryset = queryset.filter(status__in=statuses)
    categories = csv_list(request, 'category')
    if categories:
        queryset = queryset.filter(category__in=categories)
    investigators = csv_list(request, 'investigator')
    if investigators:
        queryset = queryset.filter(investigator_id__in=investigators)
    airports = csv_list(request, 'airport')
    if airports:
        queryset = queryset.filter(airport_iata__in=airports)
    aircraft = csv_list(request, 'aircraft')
    if aircraft:
        queryset = queryset.filter(aircraft_reg__in=aircraft)

    date_from = params.get('dateFrom')
    if date_from:
        parsed = parse_dt(f'{date_from}T00:00:00Z' if len(date_from) == 10 else date_from)
        if parsed:
            queryset = queryset.filter(occurred_at__gte=parsed)
    date_to = params.get('dateTo')
    if date_to:
        parsed = parse_dt(f'{date_to}T23:59:59Z' if len(date_to) == 10 else date_to)
        if parsed:
            queryset = queryset.filter(occurred_at__lte=parsed)

    risk_min = params.get('riskMin')
    if risk_min not in (None, ''):
        queryset = queryset.filter(risk_score__gte=int(risk_min))
    risk_max = params.get('riskMax')
    if risk_max not in (None, ''):
        queryset = queryset.filter(risk_score__lte=int(risk_max))
    return queryset


def get_incident_or_404(identifier: str):
    incident = Incident.objects.filter(pk=identifier).first() or Incident.objects.filter(ref=identifier).first()
    return incident


def base36(number: int) -> str:
    digits = '0123456789abcdefghijklmnopqrstuvwxyz'
    if number == 0:
        return '0'
    out = []
    while number:
        number, rem = divmod(number, 36)
        out.append(digits[rem])
    return ''.join(reversed(out))


def parse_mentions(body: str, users) -> list[str]:
    """Port of services/comments.parseMentions — same candidate forms."""
    found: list[str] = []
    seen: set[str] = set()
    lower = body.lower()
    for user in users:
        candidates = [
            f'@{user.name.lower()}',
            f'@{user.initials.lower()}',
            f'@{user.email.split("@")[0].lower()}',
        ]
        if any(candidate in lower for candidate in candidates) and user.id not in seen:
            seen.add(user.id)
            found.append(user.id)
    return found


# ---------------------------------------------------------------- incidents


class IncidentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = filter_incidents(request, Incident.objects.all())
        queryset = incident_sort(queryset, request.query_params.get('sort'), request.query_params.get('dir'))
        return envelope(request, queryset, IncidentSerializer)

    def post(self, request):
        role = role_of(request)
        if not has_permission(role, 'incident.create'):
            return deny('incident.create', role)

        template_id = SiteData.get('incidentTemplateId')
        template = Incident.objects.filter(pk=template_id).first() if template_id else None
        if template is None:
            template = Incident.objects.order_by('list_order').first()
        if template is None:
            return Response({'message': 'The demo register has not been seeded.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Mock createIncident: {...db.incidents[0], ...payload, id, ref,
        # reportedAt, capaIds: [], evidenceCount: 0}
        incident = Incident()
        for field in INCIDENT_FIELDS:
            setattr(incident, field, getattr(template, field))
        apply_payload(incident, request.data, INCIDENT_FIELDS, INCIDENT_DATETIME_FIELDS)
        incident.id = new_id('inc')
        incident.ref = next_sequential_ref(Incident.objects.values_list('ref', flat=True), 'P_006')
        incident.reported_at = timezone.now()
        incident.capa_ids = []
        incident.evidence_count = 0
        incident.list_order = next_list_order(Incident)
        with transaction.atomic():
            incident.save()
        return Response(IncidentSerializer(incident).data, status=status.HTTP_201_CREATED)


class IncidentDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, incident_id: str):
        incident = get_incident_or_404(incident_id)
        if incident is None:
            return Response({'message': f'Incident {incident_id} not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(IncidentSerializer(incident).data)

    def patch(self, request, incident_id: str):
        role = role_of(request)
        if not has_permission(role, 'incident.edit'):
            return deny('incident.edit', role)
        with transaction.atomic():
            incident = Incident.objects.select_for_update().filter(pk=incident_id).first()
            if incident is None:
                return Response({'message': f'Incident {incident_id} not found'}, status=status.HTTP_404_NOT_FOUND)

            data = request.data
            expected_version = data.get('expected_version')
            current_version = incident.version if incident.version is not None else 0
            if expected_version is not None and int(expected_version) != current_version:
                return Response(
                    {'message': f'Incident {incident_id} was modified by someone else; reload and try again.'},
                    status=status.HTTP_409_CONFLICT,
                )

            # Server-side re-validation: a status change through PATCH runs the
            # same guards as the transition endpoint (no bulk backdoor).
            new_status = data.get('status')
            if new_status and new_status != incident.status:
                investigation = Investigation.objects.filter(incident_id=incident.id).first()
                open_capas = CAPA.objects.filter(id__in=incident.capa_ids).exclude(
                    status__in=['completed', 'verified']
                ).count()
                ctx = TransitionContext(
                    status=incident.status,
                    user_role=role,
                    open_capas=open_capas,
                    investigation_progress=investigation.progress if investigation else None,
                )
                verdict = can_transition(ctx, str(new_status))
                if not verdict.ok:
                    return Response({'reason': verdict.reason}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
                if new_status == 'closed' and not incident.closed_at:
                    incident.closed_at = timezone.now()

            apply_payload(incident, data, [f for f in INCIDENT_FIELDS if f != 'version'], INCIDENT_DATETIME_FIELDS)
            incident.version = current_version + 1
            incident.save()
        return Response(IncidentSerializer(incident).data)


class IncidentTransitionView(APIView):
    """POST {to, expectedVersion} — guarded move + audit in one transaction."""

    permission_classes = [IsAuthenticated]

    def post(self, request, incident_id: str):
        to = str(request.data.get('to') or '')
        expected_version = request.data.get('expected_version')
        role = role_of(request)

        with transaction.atomic():
            incident = Incident.objects.select_for_update().filter(pk=incident_id).first()
            if incident is None:
                return Response({'message': f'Incident {incident_id} not found'}, status=status.HTTP_404_NOT_FOUND)

            investigation = Investigation.objects.filter(incident_id=incident.id).first()
            open_capas = CAPA.objects.filter(id__in=incident.capa_ids).exclude(
                status__in=['completed', 'verified']
            ).count()
            ctx = TransitionContext(
                status=incident.status,
                user_role=role,
                open_capas=open_capas,
                investigation_progress=investigation.progress if investigation else None,
            )
            verdict = can_transition(ctx, to)
            if not verdict.ok:
                return Response({'reason': verdict.reason}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

            current_version = incident.version if incident.version is not None else 0
            if expected_version is not None and int(expected_version) != current_version:
                return Response(
                    {'message': f'Incident {incident_id} was modified by someone else; reload and try again.'},
                    status=status.HTTP_409_CONFLICT,
                )

            old_status = incident.status
            incident.status = to
            incident.version = current_version + 1
            if to == 'closed':
                incident.closed_at = timezone.now()
            incident.save()
            write_audit(
                actor_id=actor_id_of(request),
                entity='incident',
                entity_id=incident.id,
                action=f'Status {INCIDENT_STATUS_LABEL.get(old_status, old_status)} → '
                f'{INCIDENT_STATUS_LABEL.get(to, to)}',
                field='status',
                from_value=old_status,
                to=to,
                ip=client_ip(request),
            )
        return Response(IncidentSerializer(incident).data)


class IncidentRevealReporterView(APIView):
    """Audited privacy disclosure (BACKEND_PLAN §2.2)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, incident_id: str):
        with transaction.atomic():
            incident = Incident.objects.select_for_update().filter(pk=incident_id).first()
            if incident is None:
                return Response({'message': f'Incident {incident_id} not found'}, status=status.HTTP_404_NOT_FOUND)
            incident.reporter_revealed = True
            incident.version = (incident.version if incident.version is not None else 0) + 1
            incident.save()
            write_audit(
                actor_id=actor_id_of(request),
                entity='incident',
                entity_id=incident.id,
                action='Reporter identity revealed (confidential record)',
                field='reporterId',
                ip=client_ip(request),
            )
        return Response(IncidentSerializer(incident).data)


# ------------------------------------------------------- anonymous intake


class AnonymousIncidentView(APIView):
    """
    Public occurrence intake — the network twin of submitAnonymousReport():
    IP throttle (1 / 2 min + 10 / day, env-overridable), honeypot drop,
    provisional risk, safety-desk notification and audit in one transaction.
    """

    permission_classes = [AllowAny]
    authentication_classes: list = []
    throttle_classes: list = []

    def post(self, request):
        throttle = AnonIntakeThrottle()
        retry_after = throttle.retry_after_for(request)
        if retry_after is not None:
            return Response(
                {'message': 'Too many reports from this address. Please try again later.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={'Retry-After': str(retry_after)},
            )

        data = request.data
        what = str(data.get('what_happened') or '').strip()
        where = str(data.get('where') or '')
        when = str(data.get('when') or '')
        contact = str(data.get('contact') or '')
        honeypot = str(data.get('honeypot') or '')

        if honeypot.strip():
            # Bots get a convincing success and no record (mock parity).
            ref = f'ANON-{base36(int(time.time() * 1000)).upper()}'
            return Response({'id': 'dropped', 'ref': ref})

        if len(what) < 20:
            return Response(
                {'message': 'Please describe what happened in at least 20 characters.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        template = Incident.objects.order_by('list_order').first()
        if template is None:
            return Response({'message': 'The demo register has not been seeded.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        now = timezone.now()
        severity = 'medium'
        likelihood = 2
        score = 6  # risk_score('medium', 2)
        incident_id = new_id('inc')
        ref = next_sequential_ref(Incident.objects.values_list('ref', flat=True), 'P_006')

        description = (
            f'{what}\n\nLocation: {where or "not stated"}\nOccurred: {when or "not stated"}'
            + (f'Contact offered: {contact}' if contact else '\nNo contact offered — fully anonymous.')
        )

        incident = Incident()
        for field in INCIDENT_FIELDS:
            setattr(incident, field, getattr(template, field))
        incident.id = incident_id
        incident.ref = ref
        incident.title = what[:90]
        incident.description = description
        incident.category = 'near_miss'
        incident.status = 'reported'
        incident.risk = {
            'severity': severity,
            'likelihood': likelihood,
            'score': score,
            'level': 'moderate',
            'assessedBy': 'anonymous',
            'assessedAt': now.strftime('%Y-%m-%dT%H:%M:%SZ'),
            'notes': 'Provisional grading — anonymous intake, awaiting safety-desk triage.',
        }
        incident.aircraft_id = template.aircraft_id or 'ac_001'
        incident.flight = None
        incident.location = {
            'airport': (where or 'Not stated')[:48],
            'iata': '—',
            'city': '—',
            'country': '—',
            'specific': where or 'Not stated',
            'latitude': 0,
            'longitude': 0,
        }
        incident.phase = template.phase or 'cruise'
        incident.reporter_id = 'anonymous'
        incident.crew = []
        incident.department = 'Anonymous intake'
        incident.operator = template.operator or 'Skyline Air'
        incident.immediate_actions = 'None recorded — anonymous intake.'
        incident.injuries = 0
        incident.damage_category = 'none'
        incident.capa_ids = []
        incident.evidence_count = 0
        incident.confidentiality = 'restricted'
        incident.occurrence_category = 'GI'
        incident.regulatory_notification = False
        incident.reported_at = now
        occurred = parse_dt(when) if when else None
        incident.occurred_at = occurred or now
        incident.version = 1
        incident.closed_at = None
        incident.investigation_id = None
        incident.rca_id = None
        incident.investigator_id = None
        incident.notified_authority = None
        incident.reporter_revealed = False
        incident.list_order = next_list_order(Incident)

        with transaction.atomic():
            incident.save()
            notification_order = next_list_order(Notification)
            Notification.objects.create(
                id=new_id('ntf'),
                title='Anonymous report needs triage',
                body=f'{ref} — {what[:90]}',
                severity='warning',
                category='incident',
                at=now,
                read=False,
                link=f'/incidents/{incident_id}',
                actor='Anonymous intake',
                list_order=notification_order,
            )
            write_audit(
                actor_id='anonymous',
                entity='incident',
                entity_id=incident_id,
                action='Anonymous report accepted (needs triage)',
                ip='public-intake',
            )
            AnonIntakeThrottle().record(request)

        return Response({'id': incident_id, 'ref': ref}, status=status.HTTP_201_CREATED)


# ------------------------------------------------------------- comments


class IncidentCommentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, incident_id: str):
        comments = IncidentComment.objects.filter(incident_id=incident_id).order_by('at')
        return Response(IncidentCommentSerializer(comments, many=True).data)

    def post(self, request, incident_id: str):
        incident = get_incident_or_404(incident_id)
        if incident is None:
            return Response({'message': f'Incident {incident_id} not found'}, status=status.HTTP_404_NOT_FOUND)
        body = str(request.data.get('body') or '').strip()
        if not body:
            return Response({'message': 'Comment is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        author_id = actor_id_of(request)
        author = User.objects.filter(pk=author_id).first()
        author_name = author.name if author else 'A colleague'
        candidates = User.objects.filter(is_active=True).exclude(pk=author_id)
        mentions = parse_mentions(body, candidates)
        now = timezone.now()

        with transaction.atomic():
            comment = IncidentComment.objects.create(
                id=new_id('cmt'),
                incident_id=incident.id,
                author_id=author_id,
                at=now,
                body=body,
                mentions=mentions,
            )
            # One targeted notification per mentioned user, same transaction.
            # Mock order: [...mentions.map(...), ...existing] — the first
            # mention ends up at the very front of the bell list.
            if mentions:
                start = next_list_order(Notification) - (len(mentions) - 1)
                for index, uid in enumerate(mentions):
                    Notification.objects.create(
                        id=new_id('ntf'),
                        title=f'{author_name} mentioned you on {incident.ref}',
                        body=f'{body[:110]}…' if len(body) > 110 else body,
                        severity='info',
                        category='assignment',
                        at=now,
                        read=False,
                        link=f'/incidents/{incident.id}',
                        actor=author_name,
                        for_user_id=uid,
                        list_order=start + index,
                    )
        return Response(IncidentCommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class IncidentEvidenceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, incident_id: str):
        items = EvidenceItem.objects.filter(incident_id=incident_id)
        return Response(EvidenceItemSerializer(items, many=True).data)


class IncidentTimelineView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, incident_id: str):
        events = TimelineEvent.objects.filter(incident_id=incident_id)
        return Response(TimelineEventSerializer(events, many=True).data)


# ------------------------------------------------------------------ media
#
# M4 — real evidence uploads. POST /media/ stores bytes on MEDIA_ROOT,
# registers a SHA-256 hash for chain of custody and links the item to an
# incident, a compliance requirement or a CAPA. GET /media/<id>/download/
# streams the bytes back behind the same session auth as every other route.

KIND_BY_CONTENT_TYPE = (
    ('image/', 'image'),
    ('video/', 'video'),
    ('application/pdf', 'pdf'),
    ('text/', 'log'),
)


def kind_of(content_type: str, name: str) -> str:
    for prefix, kind in KIND_BY_CONTENT_TYPE:
        if content_type.startswith(prefix):
            return kind
    if name.lower().endswith('.log'):
        return 'log'
    return 'document'


class MediaUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        upload = request.FILES.get('file')
        if upload is None:
            return Response({'message': 'A file is required (field name "file").'}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
        max_bytes = settings.SKYSHIELD_MAX_UPLOAD_MB * 1024 * 1024
        if upload.size > max_bytes:
            return Response(
                {'message': f'File exceeds the {settings.SKYSHIELD_MAX_UPLOAD_MB} MB limit.'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        digest = hashlib.sha256()
        buffer = io.BytesIO()
        for chunk in upload.chunks():
            digest.update(chunk)
            buffer.write(chunk)

        entity_type = (request.data.get('entityType') or 'incident').lower()
        entity_id = request.data.get('entityId') or ''
        incident_id = request.data.get('incidentId') or ''
        if entity_type == 'incident' and not incident_id:
            return Response(
                {'message': 'incidentId is required for incident evidence.'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )
        if entity_type in ('compliance', 'capa') and not entity_id:
            return Response(
                {'message': f'entityId is required for entityType={entity_type}.'},
                status=status.HTTP_422_UNPROCESSABLE_ENTITY,
            )

        content_type = upload.content_type or 'application/octet-stream'
        actor = actor_id_of(request)
        now = timezone.now()

        with transaction.atomic():
            item = EvidenceItem(
                id=new_id('ev'),
                incident_id=incident_id if entity_type == 'incident' else '',
                name=upload.name[:200],
                kind=kind_of(content_type, upload.name),
                size_kb=max(1, round(upload.size / 1024)),
                uploaded_by=actor,
                uploaded_at=now,
                hash=digest.hexdigest(),
                verified=True,  # hash registered server-side at intake
                content_type=content_type,
                list_order=next_list_order(EvidenceItem),
            )
            item.file.save(f'{item.id}_{upload.name[:120]}', ContentFile(buffer.getvalue()), save=False)
            item.save()

            extra: dict = {}
            if entity_type == 'incident':
                incident = Incident.objects.filter(pk=incident_id).first()
                if incident is None:
                    raise Http404('Incident not found')
                # Increment (not recount): seeded items may be metadata-only
                # history with no EvidenceItem rows, mirroring the mock store.
                Incident.objects.filter(pk=incident_id).update(
                    evidence_count=db_models.F("evidence_count") + 1
                )
                write_audit(
                    actor_id=actor,
                    entity='incident',
                    entity_id=incident_id,
                    action='evidence.upload',
                    to=item.name,
                    ip=client_ip(request),
                    note=f'sha256:{item.hash}',
                )
            else:
                descriptor = {
                    'name': item.name,
                    'at': now.strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'by': actor,
                    'sizeKb': item.size_kb,
                    'hash': item.hash,
                    'mediaId': item.id,
                }
                if entity_type == 'compliance':
                    requirement = ComplianceRequirement.objects.filter(pk=entity_id).first()
                    if requirement is None:
                        raise Http404('Compliance requirement not found')
                    requirement.attachments = [*(requirement.attachments or []), descriptor]
                    requirement.save(update_fields=['attachments'])
                    write_audit(
                        actor_id=actor,
                        entity='compliance',
                        entity_id=entity_id,
                        action='evidence.attach',
                        to=item.name,
                        ip=client_ip(request),
                        note=f'sha256:{item.hash}',
                    )
                    extra['requirement'] = ComplianceRequirementSerializer(requirement).data
                else:
                    capa = CAPA.objects.filter(pk=entity_id).first()
                    if capa is None:
                        raise Http404('CAPA not found')
                    capa.attachments = [*(capa.attachments or []), descriptor]
                    capa.save(update_fields=['attachments'])
                    write_audit(
                        actor_id=actor,
                        entity='capa',
                        entity_id=entity_id,
                        action='evidence.attach',
                        to=item.name,
                        ip=client_ip(request),
                        note=f'sha256:{item.hash}',
                    )
                    extra['capa'] = CAPASerializer(capa).data

        return Response({'media': EvidenceItemSerializer(item).data, **extra}, status=status.HTTP_201_CREATED)


class MediaDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, media_id: str):
        item = EvidenceItem.objects.filter(pk=media_id).first()
        if item is None or not item.file:
            raise Http404('No stored file for this evidence item')
        response = FileResponse(item.file.open('rb'), as_attachment=True, filename=item.name)
        return response


# ---------------------------------------------------------- investigations


class InvestigationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Investigation.objects.all()
        incident_id = request.query_params.get('incidentId')
        if incident_id:
            queryset = queryset.filter(incident_id=incident_id)
        return Response(InvestigationSerializer(queryset, many=True).data)


class InvestigationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    FIELDS = [
        'incident_id', 'name', 'stage', 'progress', 'lead_investigator_id',
        'team_member_ids', 'opened_at', 'due_at', 'priority', 'stage_history',
        'findings', 'interviews', 'open_questions',
    ]

    def get(self, request, investigation_id: str):
        investigation = Investigation.objects.filter(pk=investigation_id).first()
        if investigation is None:
            return Response({'message': f'Investigation {investigation_id} not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(InvestigationSerializer(investigation).data)

    def patch(self, request, investigation_id: str):
        role = role_of(request)
        if not has_permission(role, 'investigation.edit'):
            return deny('investigation.edit', role)
        investigation = Investigation.objects.filter(pk=investigation_id).first()
        if investigation is None:
            return Response({'message': f'Investigation {investigation_id} not found'}, status=status.HTTP_404_NOT_FOUND)
        apply_payload(investigation, request.data, self.FIELDS, {'opened_at', 'due_at'})
        investigation.save()
        return Response(InvestigationSerializer(investigation).data)


# -------------------------------------------------------------------- RCA


class RCAListView(APIView):
    permission_classes = [IsAuthenticated]

    TEMPLATE_FIELDS = [
        'incident_id', 'title', 'method', 'status', 'five_whys', 'factors',
        'identified_root_causes', 'recommendations', 'author_id', 'reviewer_id',
        'created_at', 'completed_at',
    ]

    def get(self, request):
        queryset = RCA.objects.all()
        incident_id = request.query_params.get('incidentId')
        if incident_id:
            queryset = queryset.filter(incident_id=incident_id)
        return Response(RCASerializer(queryset, many=True).data)

    def post(self, request):
        role = role_of(request)
        if not has_permission(role, 'rca.create'):
            return deny('rca.create', role)

        # Mock createRCA: {...db.rcas[0], ...payload, id} — template merge so a
        # partial payload (startRCA) still produces a complete record.
        template_id = SiteData.get('rcaTemplateId')
        template = RCA.objects.filter(pk=template_id).first() if template_id else RCA.objects.order_by('list_order').first()
        rca = RCA()
        if template is not None:
            for field in self.TEMPLATE_FIELDS:
                setattr(rca, field, getattr(template, field))
        apply_payload(rca, request.data, self.TEMPLATE_FIELDS, {'created_at', 'completed_at'})
        rca.id = new_id('rca')
        if rca.created_at is None:
            rca.created_at = timezone.now()
        rca.list_order = next_list_order(RCA)
        rca.save()
        return Response(RCASerializer(rca).data, status=status.HTTP_201_CREATED)


class RCADetailView(APIView):
    permission_classes = [IsAuthenticated]

    FIELDS = RCAListView.TEMPLATE_FIELDS

    def get(self, request, rca_id: str):
        rca = RCA.objects.filter(pk=rca_id).first()
        if rca is None:
            return Response({'message': f'RCA {rca_id} not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(RCASerializer(rca).data)

    def patch(self, request, rca_id: str):
        role = role_of(request)
        if not has_permission(role, 'rca.edit'):
            return deny('rca.edit', role)
        rca = RCA.objects.filter(pk=rca_id).first()
        if rca is None:
            return Response({'message': f'RCA {rca_id} not found'}, status=status.HTTP_404_NOT_FOUND)
        apply_payload(rca, request.data, self.FIELDS, {'created_at', 'completed_at'})
        rca.save()
        return Response(RCASerializer(rca).data)


# ------------------------------------------------------------------- CAPA


class CAPAListView(APIView):
    permission_classes = [IsAuthenticated]

    TEMPLATE_FIELDS = [
        'incident_id', 'title', 'description', 'type', 'owner_id', 'priority',
        'status', 'due_date', 'opened_at', 'completed_at', 'verified_at',
        'progress', 'effectiveness_check', 'completion_evidence', 'linked_finding',
    ]

    def get(self, request):
        queryset = CAPA.objects.all()
        incident_id = request.query_params.get('incidentId')
        if incident_id:
            queryset = queryset.filter(incident_id=incident_id)
        return Response(CAPASerializer(queryset, many=True).data)

    def post(self, request):
        role = role_of(request)
        if not has_permission(role, 'capa.create'):
            return deny('capa.create', role)
        template_id = SiteData.get('capaTemplateId')
        template = CAPA.objects.filter(pk=template_id).first() if template_id else CAPA.objects.order_by('list_order').first()
        capa = CAPA()
        if template is not None:
            for field in self.TEMPLATE_FIELDS:
                setattr(capa, field, getattr(template, field))
        apply_payload(capa, request.data, self.TEMPLATE_FIELDS, {'due_date', 'opened_at', 'completed_at', 'verified_at'})
        capa.id = new_id('capa')
        capa.ref = next_sequential_ref(CAPA.objects.values_list('ref', flat=True), 'CAPA-2026')
        if capa.opened_at is None:
            capa.opened_at = timezone.now()
        capa.list_order = next_list_order(CAPA)
        capa.save()
        return Response(CAPASerializer(capa).data, status=status.HTTP_201_CREATED)


class CAPADetailView(APIView):
    permission_classes = [IsAuthenticated]

    FIELDS = CAPAListView.TEMPLATE_FIELDS

    def get(self, request, capa_id: str):
        capa = CAPA.objects.filter(pk=capa_id).first()
        if capa is None:
            return Response({'message': f'CAPA {capa_id} not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CAPASerializer(capa).data)

    def patch(self, request, capa_id: str):
        role = role_of(request)
        data = request.data
        verifying = data.get('status') == 'verified' or 'effectiveness_check' in data
        required = 'capa.verify' if verifying else 'capa.edit'
        if not has_permission(role, required):
            return deny(required, role)
        capa = CAPA.objects.filter(pk=capa_id).first()
        if capa is None:
            return Response({'message': f'CAPA {capa_id} not found'}, status=status.HTTP_404_NOT_FOUND)
        apply_payload(capa, data, self.FIELDS, {'due_date', 'opened_at', 'completed_at', 'verified_at'})
        capa.save()
        return Response(CAPASerializer(capa).data)


# -------------------------------------------------------------- compliance


class ComplianceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(ComplianceRequirementSerializer(ComplianceRequirement.objects.all(), many=True).data)


class ComplianceSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(SiteData.get('complianceSummary') or {})


class ComplianceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    FIELDS = [
        'code', 'title', 'description', 'authority', 'category', 'status',
        'score', 'evidence', 'attachments', 'owner_id', 'last_review_at', 'next_review_at',
    ]

    def patch(self, request, requirement_id: str):
        role = role_of(request)
        if not has_permission(role, 'settings.manage'):
            return deny('settings.manage', role)
        requirement = ComplianceRequirement.objects.filter(pk=requirement_id).first()
        if requirement is None:
            return Response({'message': f'Requirement {requirement_id} not found'}, status=status.HTTP_404_NOT_FOUND)
        apply_payload(requirement, request.data, self.FIELDS, {'last_review_at', 'next_review_at'})
        requirement.save()
        return Response(ComplianceRequirementSerializer(requirement).data)


# ----------------------------------------------------------- notifications


class NotificationView(APIView):
    """GET list (scoped to the session user) + PATCH {id,read} / {all:true}."""

    permission_classes = [IsAuthenticated]

    def visible(self, request):
        user_id = getattr(request.user, 'id', None)
        return Notification.objects.filter(Q(for_user_id__isnull=True) | Q(for_user_id=user_id))

    def get(self, request):
        return Response(NotificationSerializer(self.visible(request), many=True).data)

    def patch(self, request):
        data = request.data
        queryset = self.visible(request)
        if data.get('all'):
            queryset.update(read=True)
        else:
            notification_id = data.get('id')
            read = bool(data.get('read', True))
            queryset.filter(pk=notification_id).update(read=read)
        return Response({'ok': True})


# -------------------------------------------------------------- audit log


class AuditLogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = AuditLog.objects.all()
        entity_id = request.query_params.get('entityId')
        if entity_id:
            queryset = queryset.filter(entity_id=entity_id)
        return Response(AuditLogSerializer(queryset, many=True).data)


# ------------------------------------------------------- dashboard / misc


class DashboardMetricsView(APIView):
    """M6: every figure computed from the live tables (core/analytics.py)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(analytics.dashboard_metrics())


class AnalyticsView(APIView):
    """
    M6: windowed analytics aggregation for src/pages/analytics.tsx.

    Query params mirror the page's controls: period (12w|6m|12m|ytd),
    severity, type (category) and aircraft (registration); 'all' = unfiltered.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        params = request.query_params
        return Response(
            analytics.analytics_payload(
                period=params.get('period', '12m'),
                severity=params.get('severity', 'all'),
                category=params.get('type', 'all'),
                registration=params.get('aircraft', 'all'),
            )
        )


class AircraftListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(AircraftSerializer(Aircraft.objects.all(), many=True).data)


class UserListView(APIView):
    """The user directory (ENDPOINTS.users) — same data as accounts' view."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from accounts.serializers import UserSerializer

        return Response(UserSerializer(User.objects.all(), many=True).data)
