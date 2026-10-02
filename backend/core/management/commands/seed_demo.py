"""
Seed the demo register from the exported frontend fixtures.

`node scripts/export-fixtures.mjs` dumps src/data/*.ts to
backend/fixtures/demo-seed.json with RAW dates; this command rebases them to
"today" exactly like services/store.ts does in the browser (anchor = newest
occurrence, whole-day offset, `.000Z` normalised to `Z`, date-only strings
kept date-only, strings the mock's ISO regex rejects left untouched).

Idempotent: wipes every demo table first, so `seed_demo` doubles as the
"Reset demo data" of the API.
"""

import json
import re
from datetime import datetime, timedelta, timezone as dt_timezone
from pathlib import Path

from django.contrib.sessions.models import Session
from django.core.management.base import BaseCommand
from django.db import models as dj_models
from django.db import transaction
from django.utils.dateparse import parse_datetime

from accounts.models import Invite, PasswordResetToken, User
from core.camelcase_helpers import snakeize_key
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
)

DEMO_PASSWORD = 'demo1234'
ISO_DATE = re.compile(r'^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?)?$')
DAY = timedelta(days=1)


def parse_dt(value):
    if not isinstance(value, str):
        return value
    parsed = parse_datetime(value)
    if parsed is None:
        return value
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=dt_timezone.utc)
    return parsed


def shift_iso_dates(value, days: int):
    """Port of store-pure.shiftIsoDates — same regex gate, same output format."""
    if days == 0:
        return value
    if isinstance(value, str):
        if not ISO_DATE.match(value):
            return value
        date_only = len(value) == 10
        parsed = parse_dt(value + 'T00:00:00Z' if date_only else value)
        if not isinstance(parsed, datetime):
            return value
        shifted = parsed + timedelta(days=days)
        if date_only:
            return shifted.strftime('%Y-%m-%d')
        return shifted.strftime('%Y-%m-%dT%H:%M:%SZ')
    if isinstance(value, list):
        return [shift_iso_dates(item, days) for item in value]
    if isinstance(value, dict):
        return {
            (shift_iso_dates(k, days) if isinstance(k, str) and ISO_DATE.match(k) else k): shift_iso_dates(v, days)
            for k, v in value.items()
        }
    return value


def rebase_days(anchor_iso: str, now: datetime) -> int:
    """Port of store-pure.rebaseDays: whole UTC days between anchor and today."""
    anchor = parse_dt(anchor_iso)
    if not isinstance(anchor, datetime):
        return 0
    start_now = datetime(now.year, now.month, now.day, tzinfo=dt_timezone.utc)
    start_anchor = datetime(anchor.year, anchor.month, anchor.day, tzinfo=dt_timezone.utc)
    return round((start_now - start_anchor).total_seconds() / 86400)


def seed_model(model, items, offset_days: int, list_order=True):
    """
    Generic fixture → model loader: camelCase wire keys are snakeized onto
    concrete fields, DateTimeFields are parsed, `list_order` keeps the mock's
    array order. Unknown keys are ignored.
    """
    fields = {f.name: f for f in model._meta.concrete_fields}
    rows = []
    for index, item in enumerate(items):
        shifted = shift_iso_dates(item, offset_days)
        kwargs = {}
        for key, value in shifted.items():
            attr = 'from_value' if (model is AuditLog and key == 'from') else snakeize_key(key)
            field = fields.get(attr)
            if field is None or field.primary_key and attr == 'id' and not isinstance(value, str):
                continue
            if isinstance(field, dj_models.DateTimeField):
                value = parse_dt(value)
            kwargs[attr] = value
        if list_order and 'list_order' in fields:
            kwargs.setdefault('list_order', index)
        rows.append(model(**kwargs))
    return model.objects.bulk_create(rows)


class Command(BaseCommand):
    help = 'Seed the SkyShield demo register from backend/fixtures/demo-seed.json.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fixture',
            default=str(Path(__file__).resolve().parents[3] / 'fixtures' / 'demo-seed.json'),
            help='Path to the exported demo seed JSON.',
        )
        parser.add_argument(
            '--offset-days',
            type=int,
            default=None,
            help='Force a date offset instead of rebasing to today (deterministic tests).',
        )

    def handle(self, *args, **options):
        self.verbosity = int(options.get('verbosity', 1))
        fixture_path = Path(options['fixture'])
        data = json.loads(fixture_path.read_text())
        now = datetime.now(dt_timezone.utc)

        anchor = max((incident['occurredAt'] for incident in data['incidents']), default=None)
        offset_days = (
            options['offset_days'] if options['offset_days'] is not None else rebase_days(anchor, now)
        )

        with transaction.atomic():
            self.say('Wiping demo tables…')
            for model in (
                IncidentComment, AuditLog, Notification, TimelineEvent, EvidenceItem,
                CAPA, RCA, ComplianceRequirement, Investigation, Incident, Aircraft,
                SiteData, Invite, PasswordResetToken, User, Session,
            ):
                model.objects.all().delete()

            self.say('Seeding users…')
            users = []
            for item in data['users']:
                user = User(
                    id=item['id'],
                    name=item['name'],
                    initials=item.get('initials', ''),
                    role=item['role'],
                    title=item.get('title', ''),
                    email=item['email'],
                    base=item.get('base', 'DEL — HQ'),
                    phone=item.get('phone'),
                    license_number=item.get('licenseNumber'),
                    avatar_tone=item.get('avatarTone', 'brand'),
                    is_active=item.get('active', True),
                    last_active_at=parse_dt(shift_iso_dates(item['lastActiveAt'], offset_days)),
                    alias_emails=['demo@skyshield.aero'] if item['id'] == 'usr_001' else [],
                    organisation='SkyShield Operations',
                    email_verified=True,
                )
                user.set_password(DEMO_PASSWORD)
                users.append(user)
            User.objects.bulk_create(users)

            self.say('Seeding aircraft…')
            seed_model(Aircraft, data['aircraft'], offset_days, list_order=False)

            self.say('Seeding incidents…')
            incidents = seed_model(Incident, data['incidents'], offset_days)
            users_cache = {user.id: user.name for user in users}
            for incident in incidents:
                incident.sync_denorm(users_cache)
            Incident.objects.bulk_update(
                incidents,
                [
                    'severity', 'risk_score', 'airport_iata', 'location_city',
                    'location_airport_name', 'aircraft_reg', 'flight_number',
                    'investigator_name', 'reporter_name', 'category_label',
                ],
            )

            self.say('Seeding investigations, evidence, timeline…')
            seed_model(Investigation, data['investigations'], offset_days)
            evidence_rows = [
                dict(item, incidentId=incident_id)
                for incident_id, items in data['evidence'].items()
                for item in items
            ]
            seed_model(EvidenceItem, evidence_rows, offset_days)
            timeline_rows = [
                dict(item, incidentId=incident_id)
                for incident_id, items in data['timeline'].items()
                for item in items
            ]
            seed_model(TimelineEvent, timeline_rows, offset_days)

            self.say('Seeding RCA, CAPA, compliance…')
            seed_model(RCA, data['rcas'], offset_days)
            seed_model(CAPA, data['capas'], offset_days)
            seed_model(ComplianceRequirement, data['compliance'], offset_days)

            self.say('Seeding notifications and audit log…')
            seed_model(Notification, data['notifications'], offset_days)
            seed_model(AuditLog, data['auditLog'], offset_days)

            SiteData.put('complianceSummary', shift_iso_dates(data['complianceSummary'], offset_days))
            # M6: the dashboard/analytics figures are computed from the tables
            # now (core/analytics.py); only the compliance score history stays
            # seeded reference data.
            SiteData.put('complianceTrend', data.get('complianceTrend') or [])
            # Template records for the mock's "merge over first row" creates.
            SiteData.put('incidentTemplateId', data['incidents'][0]['id'])
            SiteData.put('rcaTemplateId', data['rcas'][0]['id'])
            SiteData.put('capaTemplateId', data['capas'][0]['id'])
            SiteData.put(
                'seedMeta',
                {
                    'seededAt': now.strftime('%Y-%m-%dT%H:%M:%SZ'),
                    'offsetDays': offset_days,
                    'fixture': str(fixture_path),
                },
            )

        self.say(
            self.style.SUCCESS(
                f'Seeded (offset {offset_days:+d}d): '
                f'{User.objects.count()} users, {Aircraft.objects.count()} aircraft, '
                f'{Incident.objects.count()} incidents, {Investigation.objects.count()} investigations, '
                f'{EvidenceItem.objects.count()} evidence, {TimelineEvent.objects.count()} timeline, '
                f'{RCA.objects.count()} RCAs, {CAPA.objects.count()} CAPAs, '
                f'{ComplianceRequirement.objects.count()} requirements, '
                f'{Notification.objects.count()} notifications, {AuditLog.objects.count()} audit entries.'
            )
        )

    def say(self, message):
        if self.verbosity > 0:
            self.stdout.write(message)
