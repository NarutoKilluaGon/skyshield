"""
Output serializers — the wire shapes are the interfaces in src/types.

These are deliberately read-heavy: input handling lives in the views, which
apply the mock service semantics field-by-field (template merges, version
bumps, denormalisation) instead of trusting bulk ModelSerializer writes.
"""

from rest_framework import serializers

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
    TimelineEvent,
)


class IncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = [
            'id', 'ref', 'version', 'reporter_revealed',
            'reported_at', 'occurred_at', 'closed_at',
            'title', 'description', 'category', 'status',
            'risk', 'aircraft_id', 'flight', 'location', 'phase',
            'reporter_id', 'investigator_id', 'crew', 'department', 'operator',
            'immediate_actions', 'injuries', 'damage_category',
            'investigation_id', 'rca_id', 'capa_ids', 'evidence_count',
            'confidentiality', 'occurrence_category', 'regulatory_notification',
            'notified_authority',
        ]


class InvestigationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Investigation
        fields = [
            'id', 'incident_id', 'name', 'stage', 'progress',
            'lead_investigator_id', 'team_member_ids', 'opened_at', 'due_at',
            'priority', 'stage_history', 'findings', 'interviews', 'open_questions',
        ]


class EvidenceItemSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = EvidenceItem
        fields = [
            'id', 'name', 'kind', 'size_kb', 'uploaded_by', 'uploaded_at',
            'hash', 'verified', 'content_type', 'url',
        ]

    def get_url(self, obj) -> str | None:
        """Authenticated download route when real bytes exist (M4)."""
        return f'/api/v1/media/{obj.id}/download/' if obj.file else None


class TimelineEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimelineEvent
        fields = ['id', 'at', 'actor', 'title', 'detail', 'kind']


class RCASerializer(serializers.ModelSerializer):
    class Meta:
        model = RCA
        fields = [
            'id', 'incident_id', 'title', 'method', 'status', 'five_whys',
            'factors', 'identified_root_causes', 'recommendations',
            'author_id', 'reviewer_id', 'created_at', 'completed_at',
        ]


class CAPASerializer(serializers.ModelSerializer):
    class Meta:
        model = CAPA
        fields = [
            'id', 'ref', 'incident_id', 'title', 'description', 'type',
            'owner_id', 'priority', 'status', 'due_date', 'opened_at',
            'completed_at', 'verified_at', 'progress', 'effectiveness_check',
            'completion_evidence', 'linked_finding', 'attachments',
        ]


class ComplianceRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = ComplianceRequirement
        fields = [
            'id', 'code', 'title', 'description', 'authority', 'category',
            'status', 'score', 'evidence', 'attachments', 'owner_id',
            'last_review_at', 'next_review_at',
        ]


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'title', 'body', 'severity', 'category', 'at', 'read', 'link', 'actor', 'for_user_id']


class AuditLogSerializer(serializers.ModelSerializer):
    # The wire contract uses `from` (AuditLog type in src/types) — a Python
    # reserved word, hence the explicit rename after the standard render.
    from_value = serializers.CharField(allow_null=True, allow_blank=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'at', 'actor_id', 'entity', 'entity_id', 'action', 'field', 'from_value', 'to', 'ip', 'note']

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        if 'from_value' in rep:
            rep['from'] = rep.pop('from_value')
        return rep


class IncidentCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentComment
        fields = ['id', 'incident_id', 'author_id', 'at', 'body', 'mentions']


class AircraftSerializer(serializers.ModelSerializer):
    class Meta:
        model = Aircraft
        fields = [
            'id', 'registration', 'type', 'manufacturer', 'model', 'operator',
            'year_of_delivery', 'total_cycles', 'total_hours', 'base', 'status',
            'last_maintenance_at', 'next_inspection_at',
        ]
