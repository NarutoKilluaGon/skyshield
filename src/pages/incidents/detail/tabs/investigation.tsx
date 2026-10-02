import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { PriorityBadge } from '@/components/common/badges'
import { Avatar } from '@/components/common/avatar'
import { RCAWorkflow } from '@/components/dashboard/rca-workflow'
import { fmtDateLong, fmtDateTime } from '@/lib/format'
import { userById, userName } from '@/data/users'
import { EmptyState, type DetailData } from '../shared'

/** Investigation — case header, eight-stage workflow, team, history, findings. */
export function InvestigationTab({ d }: { d: DetailData }) {
  const navigate = useNavigate()
  const inv = d.inv
  if (!inv)
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="No investigation opened"
        body="This occurrence has not been escalated to a formal investigation. Investigations are opened from the investigations workspace."
        action={
          <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => navigate('/investigations')}>
            <ClipboardCheck className="size-3.5" /> Go to investigations
          </Button>
        }
      />
    )

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink">{inv.name}</h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              Opened {fmtDateLong(inv.openedAt)} · Target closure {fmtDateLong(inv.dueAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={inv.priority} />
            <Badge size="lg" tone="neutral" className="gap-1.5">
              {inv.progress}% complete
            </Badge>
          </div>
        </div>
        <div className="mt-4">
          <RCAWorkflow stage={inv.stage} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-ink">Investigation team</h3>
          <ul className="mt-3 space-y-2.5">
            {[{ id: inv.leadInvestigatorId, lead: true }, ...inv.teamMemberIds.map((id) => ({ id, lead: false }))].map(
              ({ id, lead }) => {
                const u = userById(id)
                return (
                  <li key={id} className="flex items-center gap-2.5">
                    <Avatar user={u} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{u?.name}</p>
                      <p className="truncate text-xs text-ink-muted">{u?.title}</p>
                    </div>
                    {lead && <Badge size="sm" tone="brand">Lead</Badge>}
                  </li>
                )
              },
            )}
          </ul>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-ink">Stage history</h3>
          <ul className="mt-3 space-y-2.5">
            {inv.stageHistory.map((h) => (
              <li key={h.stage} className="flex gap-2.5">
                <CheckCircle2 className="mt-px size-3.5 shrink-0 text-ok" />
                <div className="min-w-0">
                  <p className="text-sm text-ink-soft">
                    {h.stage.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {fmtDateTime(h.at)} · {userName(h.by)}
                  </p>
                  {h.note && <p className="mt-0.5 text-xs text-ink-muted">{h.note}</p>}
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {inv.findings.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-ink">Findings</h3>
            <ul className="mt-2.5 space-y-2">
              {inv.findings.map((f, i) => (
                <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-brand" />
                  {f}
                </li>
              ))}
            </ul>
          </Card>
        )}

        {inv.openQuestions.length > 0 && (
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-ink">Open questions</h3>
            <ul className="mt-2.5 space-y-2">
              {inv.openQuestions.map((q, i) => (
                <li
                  key={i}
                  className="rounded-md border border-warn/25 bg-warn/[0.06] px-2.5 py-2 text-xs leading-relaxed text-ink-soft"
                >
                  {q}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}
