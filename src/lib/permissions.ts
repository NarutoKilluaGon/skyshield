import type { UserRole } from '@/types'

export type Permission =
  | 'incident.create'
  | 'incident.view'
  | 'incident.edit'
  | 'incident.close'
  | 'investigation.create'
  | 'investigation.edit'
  | 'investigation.view'
  | 'rca.create'
  | 'rca.edit'
  | 'rca.view'
  | 'capa.create'
  | 'capa.edit'
  | 'capa.verify'
  | 'capa.view'
  | 'export.data'
  | 'settings.view'
  | 'settings.manage'
  | 'users.manage'
  | 'invites.manage'

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: [
    'incident.create',
    'incident.view',
    'incident.edit',
    'incident.close',
    'investigation.create',
    'investigation.edit',
    'investigation.view',
    'rca.create',
    'rca.edit',
    'rca.view',
    'capa.create',
    'capa.edit',
    'capa.verify',
    'capa.view',
    'export.data',
    'settings.view',
    'settings.manage',
    'users.manage',
    'invites.manage',
  ],
  safety_manager: [
    'incident.create',
    'incident.view',
    'incident.edit',
    'incident.close',
    'investigation.create',
    'investigation.edit',
    'investigation.view',
    'rca.create',
    'rca.edit',
    'rca.view',
    'capa.create',
    'capa.edit',
    'capa.verify',
    'capa.view',
    'export.data',
    'settings.view',
    'settings.manage',
  ],
  investigator: [
    'incident.create',
    'incident.view',
    'incident.edit',
    'investigation.create',
    'investigation.edit',
    'investigation.view',
    'rca.create',
    'rca.edit',
    'rca.view',
    'capa.create',
    'capa.edit',
    'capa.view',
    'export.data',
    'settings.view',
  ],
  safety_officer: [
    'incident.create',
    'incident.view',
    'incident.edit',
    'investigation.view',
    'rca.view',
    'capa.view',
  ],
  auditor: [
    'incident.view',
    'investigation.view',
    'rca.view',
    'capa.view',
    'export.data',
  ],
} as const

const REASONS: Record<Permission, string> = {
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

export function hasPermission(role: UserRole | undefined | null, permission: Permission): boolean {
  if (!role) return false
  const permissions = ROLE_PERMISSIONS[role]
  return permissions ? permissions.includes(permission) : false
}

export function can(
  userOrRole: { role: UserRole } | UserRole | null | undefined,
  permission: Permission,
): boolean {
  if (!userOrRole) return false
  const role = typeof userOrRole === 'string' ? userOrRole : userOrRole.role
  return hasPermission(role, permission)
}

export function permissionDenialReason(
  role: UserRole | undefined | null,
  permission: Permission,
): string {
  if (hasPermission(role, permission)) return ''
  return REASONS[permission] || 'Your role does not have permission for this action.'
}
