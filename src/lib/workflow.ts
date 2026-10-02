/**
 * Incident workflow rules (master 5.3) — pure and unit-tested.
 *
 * `canTransition` answers one question: may this record move to that status,
 * as this role, in this state of the world? Every refusal carries a
 * human-readable reason so the UI can explain a disabled button instead of
 * silently blocking. The service layer (`transitionIncident`) applies these
 * rules and writes the audit entry in the same operation.
 */
import type { IncidentStatus, UserRole } from '@/types'
import { INCIDENT_STATUS } from '@/lib/domain'
import { hasPermission, permissionDenialReason, type Permission } from '@/lib/permissions'

/** The allowed edges of the incident state machine. */
export const STATUS_FLOW: Record<IncidentStatus, IncidentStatus[]> = {
  draft: ['reported'],
  reported: ['investigation', 'closed'],
  investigation: ['rca_pending', 'capa', 'closed'],
  rca_pending: ['investigation', 'capa', 'closed'],
  capa: ['closed'],
  closed: ['investigation'], // re-open
}

export interface TransitionContext {
  status: IncidentStatus
  userRole?: UserRole | null
  /** CAPAs linked to the record that are not completed/verified. */
  openCapas: number
  /** Progress (0–100) of the linked investigation, or null when none exists. */
  investigationProgress: number | null
}

export type TransitionResult = { ok: true } | { ok: false; reason: string }

const label = (s: IncidentStatus) => INCIDENT_STATUS[s].label

/** Closure and re-opening are manager decisions; everything else is editing. */
const requiredPermission = (from: IncidentStatus, to: IncidentStatus): Permission =>
  to === 'closed' || from === 'closed' ? 'incident.close' : 'incident.edit'

export function canTransition(ctx: TransitionContext, to: IncidentStatus): TransitionResult {
  const { status } = ctx

  if (status === to) return { ok: false, reason: `The record is already ${label(to)}.` }

  // 1. The edge must exist in the state machine.
  if (!STATUS_FLOW[status]?.includes(to))
    return {
      ok: false,
      reason: `A ${label(status)} record cannot move directly to ${label(to)}.`,
    }

  // 2. The actor must hold the permission for this class of move.
  const permission = requiredPermission(status, to)
  if (!hasPermission(ctx.userRole, permission))
    return { ok: false, reason: permissionDenialReason(ctx.userRole, permission) }

  // 3. Closure guards — the record has to earn "Closed".
  if (to === 'closed') {
    if (ctx.openCapas > 0)
      return {
        ok: false,
        reason: `${ctx.openCapas} corrective action${ctx.openCapas === 1 ? ' is' : 's are'} still open — complete and verify ${ctx.openCapas === 1 ? 'it' : 'them'} first.`,
      }
    if (ctx.investigationProgress !== null && ctx.investigationProgress < 100)
      return {
        ok: false,
        reason: `The investigation is ${ctx.investigationProgress}% complete — closure requires it to reach 100%.`,
      }
  }

  return { ok: true }
}

/** True when the move is a re-open out of the closed state. */
export const isReopen = (from: IncidentStatus, to: IncidentStatus) =>
  from === 'closed' && to !== 'closed'
