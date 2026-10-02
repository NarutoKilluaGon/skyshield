"""
Incident workflow guards — a 1:1 port of src/lib/workflow.ts.

`can_transition` answers one question: may this record move to that status,
as this role, in this state of the world? Refusals carry the exact
human-readable reasons the UI already knows, so a server-side denial renders
identically to a client-side one.
"""

from dataclasses import dataclass

from core.domain import INCIDENT_STATUS_LABEL
from core.permissions import denial_reason, has_permission

# The allowed edges of the incident state machine.
STATUS_FLOW: dict[str, list[str]] = {
    'draft': ['reported'],
    'reported': ['investigation', 'closed'],
    'investigation': ['rca_pending', 'capa', 'closed'],
    'rca_pending': ['investigation', 'capa', 'closed'],
    'capa': ['closed'],
    'closed': ['investigation'],  # re-open
}


@dataclass
class TransitionContext:
    status: str
    user_role: str | None
    open_capas: int
    investigation_progress: int | None


@dataclass
class TransitionResult:
    ok: bool
    reason: str = ''


def label(status: str) -> str:
    return INCIDENT_STATUS_LABEL.get(status, status)


def required_permission(current: str, to: str) -> str:
    """Closure and re-opening are manager decisions; everything else is editing."""
    return 'incident.close' if (to == 'closed' or current == 'closed') else 'incident.edit'


def can_transition(ctx: TransitionContext, to: str) -> TransitionResult:
    current = ctx.status

    if current == to:
        return TransitionResult(False, f'The record is already {label(to)}.')

    # 1. The edge must exist in the state machine.
    if to not in STATUS_FLOW.get(current, []):
        return TransitionResult(
            False, f'A {label(current)} record cannot move directly to {label(to)}.'
        )

    # 2. The actor must hold the permission for this class of move.
    permission = required_permission(current, to)
    if not has_permission(ctx.user_role, permission):
        return TransitionResult(False, denial_reason(ctx.user_role, permission))

    # 3. Closure guards — the record has to earn "Closed".
    if to == 'closed':
        if ctx.open_capas > 0:
            n = ctx.open_capas
            return TransitionResult(
                False,
                f'{n} corrective action{" is" if n == 1 else "s are"} still open — '
                f'complete and verify {"it" if n == 1 else "them"} first.',
            )
        if ctx.investigation_progress is not None and ctx.investigation_progress < 100:
            return TransitionResult(
                False,
                f'The investigation is {ctx.investigation_progress}% complete — '
                f'closure requires it to reach 100%.',
            )

    return TransitionResult(True)


def is_reopen(current: str, to: str) -> bool:
    return current == 'closed' and to != 'closed'
