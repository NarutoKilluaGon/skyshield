"""
Role → permission matrix and denial reasons, ported 1:1 from
src/lib/permissions.ts. The server re-checks every mutation; the client copy
only drives UI affordances (BACKEND_PLAN §2.1: never bypass guards).
"""

from rest_framework.permissions import BasePermission

ROLE_PERMISSIONS: dict[str, frozenset[str]] = {
    'admin': frozenset(
        [
            'incident.create', 'incident.view', 'incident.edit', 'incident.close',
            'investigation.create', 'investigation.edit', 'investigation.view',
            'rca.create', 'rca.edit', 'rca.view',
            'capa.create', 'capa.edit', 'capa.verify', 'capa.view',
            'export.data', 'settings.view', 'settings.manage', 'users.manage', 'invites.manage',
        ]
    ),
    'safety_manager': frozenset(
        [
            'incident.create', 'incident.view', 'incident.edit', 'incident.close',
            'investigation.create', 'investigation.edit', 'investigation.view',
            'rca.create', 'rca.edit', 'rca.view',
            'capa.create', 'capa.edit', 'capa.verify', 'capa.view',
            'export.data', 'settings.view', 'settings.manage',
        ]
    ),
    'investigator': frozenset(
        [
            'incident.create', 'incident.view', 'incident.edit',
            'investigation.create', 'investigation.edit', 'investigation.view',
            'rca.create', 'rca.edit', 'rca.view',
            'capa.create', 'capa.edit', 'capa.view',
            'export.data', 'settings.view',
        ]
    ),
    'safety_officer': frozenset(
        [
            'incident.create', 'incident.view', 'incident.edit',
            'investigation.view', 'rca.view', 'capa.view',
        ]
    ),
    'auditor': frozenset(
        ['incident.view', 'investigation.view', 'rca.view', 'capa.view', 'export.data']
    ),
}

REASONS = {
    'incident.create': 'Only registered reporters and safety staff can file occurrences.',
    'incident.view': 'Read-only access required.',
    'incident.edit': 'Only safety staff and investigators can edit occurrence records.',
    'incident.close': 'Only safety managers and administrators can officially close incidents.',
    'investigation.create': 'Only safety managers and investigators can open investigations.',
    'investigation.edit': 'Only assigned investigators and safety managers can modify investigations.',
    'investigation.view': 'Investigation access required.',
    'rca.create': 'Only investigators and safety managers can initiate root cause analysis.',
    'rca.edit': 'Only investigators and safety managers can edit causal chains.',
    'rca.view': 'Root cause analysis view access required.',
    'capa.create': 'Only investigators and safety managers can raise CAPAs.',
    'capa.edit': 'Only action owners, investigators and safety managers can edit CAPAs.',
    'capa.verify': 'Only safety managers can verify CAPA effectiveness.',
    'capa.view': 'CAPA access required.',
    'export.data': 'Export access required.',
    'settings.view': 'Settings access restricted for safety officers and auditors.',
    'settings.manage': 'Administrator or safety manager access required.',
    'users.manage': 'Only organisation administrators can manage users.',
    'invites.manage': 'Only organisation administrators can send invitations.',
}


def has_permission(role: str | None, permission: str) -> bool:
    if not role:
        return False
    return permission in ROLE_PERMISSIONS.get(role, frozenset())


def denial_reason(role: str | None, permission: str) -> str:
    if has_permission(role, permission):
        return ''
    return REASONS.get(permission, 'Your role does not have permission for this action.')


class RolePermission(BasePermission):
    """
    DRF permission reading `required_permission` off the view. Denials answer
    403 with the same human-readable reason the frontend matrix produces.
    """

    message = 'Your role does not have permission for this action.'

    def has_permission(self, request, view):
        permission = getattr(view, 'required_permission', None)
        if not permission:
            return True
        role = getattr(request.user, 'role', None)
        if has_permission(role, permission):
            return True
        self.message = denial_reason(role, permission)
        return False
