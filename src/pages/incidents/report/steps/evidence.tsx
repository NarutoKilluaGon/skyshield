import { useRef, useState } from 'react'
import { CloudUpload, FileText, FileType2, Film, ImageIcon, Paperclip, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtBytes } from '@/lib/format'
import { shortHash } from '@/lib/hash'
import { ACCEPT } from '../use-report-form'
import type { ReportForm } from '../use-report-form'

/** Step 5 — drag-and-drop evidence intake with hash-registered attachments. */
export function EvidenceStep({ rf }: { rf: ReportForm }) {
  const { evidence, addFiles, removeEvidence } = rf
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          addFiles(e.dataTransfer.files)
        }}
        onClick={() => fileRef.current?.click()}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-9 text-center transition-colors duration-150',
          dragging
            ? 'border-brand bg-brand/[0.07]'
            : 'border-line-strong bg-canvas-deep/40 hover:border-brand/50 hover:bg-surface-2/40',
        )}
      >
        <span className="flex size-9 items-center justify-center rounded-lg border border-line bg-surface-2">
          {dragging ? (
            <CloudUpload className="size-4 text-brand" />
          ) : (
            <Paperclip className="size-4 text-ink-muted" />
          )}
        </span>
        <p className="text-sm font-medium text-ink-soft">
          {dragging ? 'Release to attach' : 'Drop evidence here or click to browse'}
        </p>
        <p className="max-w-sm text-xs leading-relaxed text-ink-muted">
          Images, PDF, documents, data extracts and video. Maximum 50 MB per file. Every upload is
          hash registered for chain of custody.
        </p>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {evidence.length > 0 && (
        <ul className="divide-y divide-line-soft overflow-hidden rounded-lg border border-line">
          {evidence.map((ev) => {
            const Icon =
              ev.kind === 'image'
                ? ImageIcon
                : ev.kind === 'video'
                  ? Film
                  : ev.kind === 'pdf'
                    ? FileText
                    : FileType2
            return (
              <li key={ev.id} className="flex items-center gap-2.5 bg-surface-2/40 px-3 py-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-canvas-deep">
                  <Icon className="size-3.5 text-ink-muted" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink-soft">{ev.name}</span>
                  <span className="block truncate font-mono text-xs text-ink-muted">
                    {fmtBytes(ev.sizeKb)} · {ev.kind} · hash{' '}
                    {ev.hash ? shortHash(ev.hash) : 'computing…'}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => removeEvidence(ev.id)}
                  className="rounded p-1 text-ink-muted transition-colors hover:bg-crit/12 hover:text-crit-ink"
                  aria-label={`Remove ${ev.name}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {evidence.length === 0 && (
        <p className="text-center text-xs text-ink-muted">
          No evidence attached yet. You can add documents after submission from the incident
          workspace.
        </p>
      )}
    </>
  )
}
