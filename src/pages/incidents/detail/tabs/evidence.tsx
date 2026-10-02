import { Camera, CheckCircle2, Clock, Download, FileText, Paperclip } from 'lucide-react'
import { Separator, Tip } from '@/components/ui/primitives'
import { fmtBytes, fmtDateTime } from '@/lib/format'
import { userName } from '@/data/users'
import { EmptyState, type DetailData } from '../shared'

/** Evidence — hash-registered attachments with chain-of-custody metadata. */
export function EvidenceTab({ d }: { d: DetailData }) {
  const { evidence } = d
  if (!evidence.length)
    return (
      <EmptyState
        icon={Paperclip}
        title="No evidence attached"
        body="Upload photographs, recorder data extracts and reports from the report wizard or an investigation workspace. Every item is hash registered for chain of custody."
      />
    )

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {evidence.map((ev) => {
        const Icon =
          ev.kind === 'image'
            ? Camera
            : ev.kind === 'video'
              ? Camera
              : ev.kind === 'pdf'
                ? FileText
                : Paperclip
        return (
          <div
            key={ev.id}
            className="group flex flex-col rounded-lg border border-line bg-surface-2/50 p-3 transition-colors hover:border-line-strong hover:bg-surface-2"
          >
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-canvas-deep">
                <Icon className="size-3.5 text-ink-muted" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-soft" title={ev.name}>
                  {ev.name}
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {fmtBytes(ev.sizeKb)} · {ev.kind.toUpperCase()}
                </p>
              </div>
              {ev.verified ? (
                <Tip label="Hash verified">
                  <CheckCircle2 className="size-3.5 shrink-0 text-ok" />
                </Tip>
              ) : (
                <Tip label="Awaiting hash verification">
                  <Clock className="size-3.5 shrink-0 text-warn" />
                </Tip>
              )}
            </div>
            <Separator className="my-2.5" />
            <dl className="space-y-1 text-xs">
              {(
                [
                  ['Uploaded by', userName(ev.uploadedBy)],
                  ['Uploaded at', fmtDateTime(ev.uploadedAt)],
                  ['SHA-256', ev.hash],
                ] as [string, string][]
              ).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2">
                  <dt className="text-ink-muted">{k}</dt>
                  <dd className="truncate font-mono text-ink-muted" title={v}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
            {ev.url && (
              <>
                <Separator className="my-2.5" />
                <a
                  href={ev.url}
                  download={ev.name}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs font-medium text-brand transition-colors hover:border-brand/50 hover:bg-brand/[0.06]"
                >
                  <Download className="size-3" /> Download file
                </a>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
