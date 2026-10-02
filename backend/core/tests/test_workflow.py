"""Workflow guard tests — the ported lib/workflow.ts must refuse identically."""

from django.test import SimpleTestCase

from core.workflow import STATUS_FLOW, TransitionContext, can_transition, is_reopen


def ctx(status='reported', role='safety_manager', open_capas=0, progress=None):
    return TransitionContext(
        status=status, user_role=role, open_capas=open_capas, investigation_progress=progress
    )


class StatusFlowTests(SimpleTestCase):
    def test_edges_match_the_frontend_machine(self):
        self.assertEqual(STATUS_FLOW['draft'], ['reported'])
        self.assertEqual(STATUS_FLOW['reported'], ['investigation', 'closed'])
        self.assertEqual(STATUS_FLOW['investigation'], ['rca_pending', 'capa', 'closed'])
        self.assertEqual(STATUS_FLOW['rca_pending'], ['investigation', 'capa', 'closed'])
        self.assertEqual(STATUS_FLOW['capa'], ['closed'])
        self.assertEqual(STATUS_FLOW['closed'], ['investigation'])

    def test_same_status_is_refused(self):
        result = can_transition(ctx(status='closed', role='admin'), 'closed')
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, 'The record is already Closed.')

    def test_illegal_edge_is_refused(self):
        result = can_transition(ctx(status='draft'), 'capa')
        self.assertFalse(result.reason == '')
        self.assertEqual(result.reason, 'A Draft record cannot move directly to CAPA.')


class PermissionTests(SimpleTestCase):
    def test_investigator_cannot_close(self):
        result = can_transition(ctx(status='capa', role='investigator'), 'closed')
        self.assertFalse(result.ok)
        self.assertEqual(
            result.reason, 'Only safety managers and administrators can officially close incidents.'
        )

    def test_investigator_cannot_reopen(self):
        result = can_transition(ctx(status='closed', role='investigator'), 'investigation')
        self.assertFalse(result.ok)

    def test_auditor_cannot_move_anything(self):
        for status, targets in STATUS_FLOW.items():
            for target in targets:
                result = can_transition(ctx(status=status, role='auditor'), target)
                self.assertFalse(result.ok, f'auditor moved {status}→{target}')

    def test_unknown_role_is_denied_with_reason(self):
        result = can_transition(ctx(status='reported', role=None), 'investigation')
        self.assertFalse(result.ok)
        self.assertEqual(result.reason, 'Only safety staff and investigators can edit occurrence records.')

    def test_manager_can_close_and_reopen(self):
        self.assertTrue(can_transition(ctx(status='capa', role='safety_manager'), 'closed').ok)
        self.assertTrue(can_transition(ctx(status='closed', role='safety_manager'), 'investigation').ok)


class ClosureGuardTests(SimpleTestCase):
    def test_open_capas_block_closure_singular(self):
        result = can_transition(ctx(status='capa', open_capas=1), 'closed')
        self.assertFalse(result.ok)
        self.assertEqual(
            result.reason,
            '1 corrective action is still open — complete and verify it first.',
        )

    def test_open_capas_block_closure_plural(self):
        result = can_transition(ctx(status='investigation', open_capas=3), 'closed')
        self.assertFalse(result.ok)
        self.assertEqual(
            result.reason,
            '3 corrective actions are still open — complete and verify them first.',
        )

    def test_incomplete_investigation_blocks_closure(self):
        result = can_transition(ctx(status='investigation', progress=68), 'closed')
        self.assertFalse(result.ok)
        self.assertEqual(
            result.reason,
            'The investigation is 68% complete — closure requires it to reach 100%.',
        )

    def test_complete_investigation_and_no_capas_closes(self):
        result = can_transition(ctx(status='investigation', progress=100), 'closed')
        self.assertTrue(result.ok)

    def test_no_investigation_allows_closure(self):
        result = can_transition(ctx(status='reported', progress=None), 'closed')
        self.assertTrue(result.ok)


class ReopenTests(SimpleTestCase):
    def test_is_reopen(self):
        self.assertTrue(is_reopen('closed', 'investigation'))
        self.assertFalse(is_reopen('closed', 'closed'))
        self.assertFalse(is_reopen('investigation', 'closed'))
