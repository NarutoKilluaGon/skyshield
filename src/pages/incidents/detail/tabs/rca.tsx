import { useNavigate } from 'react-router-dom'
import { GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { ContributingFactors } from '@/components/rca/contributing-factors'
import { userName } from '@/data/users'
import { EmptyState, type DetailData } from '../shared'

/** RCA — analysis summary, root causes and contributing factors. */
export function RcaTab({ d }: { d: DetailData }) {
  const navigate = useNavigate()
  const { rca, incident } = d

  if (!rca)
    return (
      <EmptyState
        icon={GitBranch}
        title="No root cause analysis started"
        body="Open an RCA to record the causal chain, contributing factors and recommendations for this occurrence."
        action={
          <Button size="sm" className="gap-1.5" onClick={() => navigate(`/rca/${incident.id}`)}>
            <GitBranch className="size-3.5" /> Start RCA
          </Button>
        }
      />
    )

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-ink">{rca.title}</h3>
            <p className="mt-0.5 text-xs text-ink-muted">
              Method: {rca.method.replace('_', ' ')} · Author {userName(rca.authorId)}
              {rca.reviewerId && ` · Reviewer ${userName(rca.reviewerId)}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              size="lg"
              tone={rca.status === 'completed' ? 'green' : rca.status === 'in_review' ? 'amber' : 'brand'}
            >
              {rca.status.replace('_', ' ')}
            </Badge>
            <Button size="sm" variant="secondary" onClick={() => navigate(`/rca/${incident.id}`)}>
              Open workspace
            </Button>
          </div>
        </div>
      </Card>

      {rca.identifiedRootCauses.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-ink">Identified root causes</h3>
          <ul className="mt-2.5 space-y-2">
            {rca.identifiedRootCauses.map((c, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-crit/25 bg-crit/[0.05] px-2.5 py-2 text-sm leading-relaxed text-ink-soft"
              >
                <span className="mt-px shrink-0 text-xs font-semibold text-crit-ink tnum">RC{i + 1}</span>
                {c}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ContributingFactors factors={rca.factors} />
    </div>
  )
}
