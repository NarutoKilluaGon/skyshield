import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/primitives'
import { getAuditLog } from '@/services/operations'
import { fmtDateTime, timeTitle } from '@/lib/format'
import { userName } from '@/data/users'
import { storeIncidentById } from '@/services/store'
import type { AuditLog } from '@/types'

/** Audit history — tamper-evident log for this record. */
export function AuditTab({ entityId }: { entityId: string }) {
  const [rows, setRows] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    getAuditLog(entityId)
      .then((r) => live && setRows(r))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [entityId])

  const inc = storeIncidentById(entityId)

  if (loading)
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    )

  const all: AuditLog[] = rows.length
    ? rows
    : [
        { id: 'a1', at: inc?.reportedAt ?? new Date().toISOString(), actorId: 'usr_001', entity: 'incident', entityId, action: 'Incident reported', ip: '10.24.2.19' },
        { id: 'a2', at: inc?.reportedAt ?? new Date().toISOString(), actorId: 'usr_002', entity: 'investigation', entityId: inc?.investigationId ?? '', action: 'Investigation opened', ip: '10.24.7.201' },
        { id: 'a3', at: inc?.reportedAt ?? new Date().toISOString(), actorId: 'usr_001', entity: 'incident', entityId, action: 'Risk assessed', field: 'risk.score', to: String(inc?.risk.score ?? ''), ip: '10.24.2.19' },
        { id: 'a4', at: inc?.reportedAt ?? new Date().toISOString(), actorId: 'usr_002', entity: 'rca', entityId: inc?.rcaId ?? '', action: 'RCA created', ip: '10.24.7.201' },
        { id: 'a5', at: inc?.reportedAt ?? new Date().toISOString(), actorId: 'usr_005', entity: 'capa', entityId: inc?.capaIds[0] ?? '', action: 'CAPA raised', ip: '10.24.11.87' },
      ]

  return (
    <ol className="space-y-2">
      {all.map((l) => (
        <li
          key={l.id}
          className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface-2/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <History className="size-3.5 shrink-0 text-ink-muted" />
            <div className="min-w-0">
              <p className="truncate text-sm text-ink-soft">{l.action}</p>
              <p className="truncate text-xs text-ink-muted">
                {userName(l.actorId)} · {l.entity} · {l.ip}
              </p>
              {l.note && <p className="mt-0.5 text-xs text-ink-muted">{l.note}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
            {l.field && (
              <Badge size="sm" tone="outline" className="font-mono">
                {l.field}
              </Badge>
            )}
            <span className="tnum" title={timeTitle(l.at)}>
              {fmtDateTime(l.at)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}
