import { describe, expect, it } from 'vitest'
import { can, hasPermission, permissionDenialReason, ROLE_PERMISSIONS } from './permissions'

describe('role permissions', () => {
  it('reserves closure for managers and admins', () => {
    expect(hasPermission('safety_manager', 'incident.close')).toBe(true)
    expect(hasPermission('admin', 'incident.close')).toBe(true)
    expect(hasPermission('investigator', 'incident.close')).toBe(false)
    expect(hasPermission('safety_officer', 'incident.close')).toBe(false)
    expect(hasPermission('auditor', 'incident.close')).toBe(false)
  })

  it('lets investigators work but not verify effectiveness', () => {
    expect(hasPermission('investigator', 'rca.edit')).toBe(true)
    expect(hasPermission('investigator', 'capa.edit')).toBe(true)
    expect(hasPermission('investigator', 'capa.verify')).toBe(false)
    expect(hasPermission('safety_manager', 'capa.verify')).toBe(true)
  })

  it('keeps auditors read-only with export', () => {
    for (const p of ['incident.view', 'investigation.view', 'rca.view', 'capa.view', 'export.data'] as const)
      expect(hasPermission('auditor', p)).toBe(true)
    for (const p of ['incident.create', 'incident.edit', 'rca.edit', 'capa.edit', 'users.manage'] as const)
      expect(hasPermission('auditor', p)).toBe(false)
  })

  it('lets safety officers file but not analyse', () => {
    expect(hasPermission('safety_officer', 'incident.create')).toBe(true)
    expect(hasPermission('safety_officer', 'rca.edit')).toBe(false)
    expect(hasPermission('safety_officer', 'export.data')).toBe(false)
  })

  it('reserves user administration for admins', () => {
    expect(hasPermission('admin', 'users.manage')).toBe(true)
    expect(hasPermission('safety_manager', 'users.manage')).toBe(false)
  })

  it('can() accepts users, roles and nothing', () => {
    expect(can({ role: 'admin' } as never, 'incident.close')).toBe(true)
    expect(can('investigator', 'incident.close')).toBe(false)
    expect(can(null, 'incident.view')).toBe(false)
    expect(can(undefined, 'incident.view')).toBe(false)
  })

  it('explains every denial and stays silent when allowed', () => {
    expect(permissionDenialReason('investigator', 'incident.close')).toMatch(/safety managers and administrators/i)
    expect(permissionDenialReason('safety_manager', 'incident.close')).toBe('')
    expect(permissionDenialReason(null, 'incident.view')).toBeTruthy()
  })

  it('has a permission list for every role', () => {
    for (const role of ['admin', 'safety_manager', 'investigator', 'safety_officer', 'auditor'] as const)
      expect(Array.isArray(ROLE_PERMISSIONS[role])).toBe(true)
  })
})
