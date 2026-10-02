import { useState } from 'react'
import { ArrowDown, CircleHelp, Lightbulb, Pencil, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/input'
import { Tip } from '@/components/ui/primitives'
import { userName } from '@/data/users'
import { fmtDateTime } from '@/lib/format'
import type { FiveWhys as FiveWhysModel } from '@/types'

const WHYS_TONE = [
  { ring: 'border-transparent/35', bg: 'bg-brand-wash', text: 'text-brand', label: 'Why 1' },
  { ring: 'border-brand/32', bg: 'bg-brand/10', text: 'text-brand', label: 'Why 2' },
  { ring: 'border-transparent/32', bg: 'bg-warn-wash', text: 'text-warn-ink', label: 'Why 3' },
  { ring: 'border-transparent/32', bg: 'bg-alert-wash', text: 'text-alert-ink', label: 'Why 4' },
  { ring: 'border-transparent/35', bg: 'bg-crit-wash', text: 'text-crit-ink', label: 'Why 5' },
]

/**
 * Five Whys analysis. Editable when `editable` — add, edit and remove levels,
 * with a root-cause statement at the end of the chain.
 */
export function FiveWhys({
  model,
  editable = false,
  onChange,
  className,
}: {
  model: FiveWhysModel
  editable?: boolean
  onChange?: (next: FiveWhysModel) => void
  className?: string
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [rootDraft, setRootDraft] = useState(model.rootCause)
  const [editRoot, setEditRoot] = useState(false)

  const tone = (i: number) => WHYS_TONE[Math.min(i, WHYS_TONE.length - 1)]

  const patch = (next: Partial<FiveWhysModel>) => onChange?.({ ...model, ...next })

  const addLevel = () => {
    const id = `w_${Date.now()}`
    patch({
      whys: [
        ...model.whys,
        { id, question: 'Why did that happen?', answer: '' },
      ],
    })
    setEditingId(id)
    setDraft('')
  }

  const removeLevel = (id: string) => {
    patch({ whys: model.whys.filter((w) => w.id !== id) })
    if (editingId === id) setEditingId(null)
  }

  const startEdit = (id: string, answer: string) => {
    setEditingId(id)
    setDraft(answer)
  }

  const commit = (id: string) => {
    patch({
      whys: model.whys.map((w) => (w.id === id ? { ...w, answer: draft } : w)),
      updatedAt: new Date().toISOString(),
    })
    setEditingId(null)
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* problem statement */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line-soft bg-surface-2/40 px-3.5 py-2.5">
          <CircleHelp className="size-3.5 text-brand" />
          <h3 className="text-sm font-semibold text-ink">Problem statement</h3>
          <div className="ml-auto flex items-center gap-1.5">
            <Badge
              size="sm"
              tone={model.status === 'accepted' ? 'green' : model.status === 'in_review' ? 'amber' : 'brand'}
            >
              {model.status.replace('_', ' ')}
            </Badge>
            {editable && (
              <Button variant="ghost" size="xs" onClick={() => patch({ status: 'in_review' })}>
                Submit for review
              </Button>
            )}
          </div>
        </div>
        <div className="px-3.5 py-3">
          <p className="text-base font-medium leading-relaxed text-ink">{model.problem}</p>
          <p className="mt-2 text-xs text-ink-muted">
            {userName(model.authorId)} · last updated {fmtDateTime(model.updatedAt)}
          </p>
        </div>
      </Card>

      {/* chain */}
      <ol className="space-y-0">
        {model.whys.map((w, i) => {
          const t = tone(i)
          const isLast = i === model.whys.length - 1
          const editing = editingId === w.id

          return (
            <li key={w.id} className="relative pl-7">
              {!isLast && (
                <span
                  className="absolute bottom-0 left-[13px] top-8 w-px bg-line-soft"
                  aria-hidden="true"
                />
              )}
              <span
                className="absolute left-0 top-1 flex size-[27px] items-center justify-center rounded-lg border font-semibold tnum"
                style={{
                  borderColor: t.ring.replace('border-', ''),
                  background: t.bg,
                  color: t.text,
                  fontSize: 10.5,
                }}
              >
                {i + 1}
              </span>

              <div className="mb-2 rounded-lg border border-line bg-surface p-3 transition-colors hover:border-line-strong">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <Badge
                      size="sm"
                      tone="outline"
                      className={cn(t.ring, t.bg, t.text)}
                    >
                      {t.label}
                    </Badge>
                    <p className="mt-1.5 text-sm font-medium text-ink-soft">{w.question}</p>
                  </div>
                  {editable && (
                    <div className="flex shrink-0 items-center gap-1">
                      {!editing && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => startEdit(w.id, w.answer)}
                          aria-label={`Edit ${t.label}`}
                        >
                          <Pencil />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => removeLevel(w.id)}
                        disabled={model.whys.length <= 1}
                        aria-label={`Remove ${t.label}`}
                        className="text-ink-muted hover:text-crit-ink"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>

                {editing ? (
                  <div className="mt-2.5">
                    <Textarea
                      rows={3}
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="State the reason for the level above…"
                    />
                    <div className="mt-2 flex items-center gap-1.5">
                      <Button size="sm" onClick={() => commit(w.id)} className="gap-1">
                        Save level
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        className="text-ink-muted"
                      >
                        <X className="mr-1 size-3.5" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p
                    className={cn(
                      'mt-2 text-sm leading-relaxed',
                      w.answer ? 'text-ink-soft' : 'italic text-ink-muted',
                    )}
                  >
                    {w.answer || 'No answer recorded for this level.'}
                  </p>
                )}
              </div>

              {!isLast && (
                <div className="flex h-6 items-center pl-1">
                  <ArrowDown className="size-3.5 text-ink-muted" />
                </div>
              )}
            </li>
          )
        })}
      </ol>

      {editable && (
        <Button variant="outline" size="sm" onClick={addLevel} className="w-full gap-1.5">
          <Plus className="size-3.5" /> Add why level
        </Button>
      )}

      {/* root cause */}
      <Card
        className={cn(
          'overflow-hidden',
          isComplete(model) && 'border-transparent/35',
        )}
      >
        <div className="flex items-center gap-2 border-b border-line-soft bg-crit/[0.05] px-3.5 py-2.5">
          <Lightbulb className="size-3.5 text-warn-ink" />
          <h3 className="text-sm font-semibold text-ink">Root cause</h3>
          <Tip label="The systemic condition that allowed the occurrence. Addressing this prevents recurrence, not just the immediate event.">
            <span className="ml-auto text-xs text-ink-muted underline decoration-dotted underline-offset-2">
              guidance
            </span>
          </Tip>
        </div>
        <div className="px-3.5 py-3">
          {editRoot ? (
            <>
              <Textarea
                rows={4}
                autoFocus
                value={rootDraft}
                onChange={(e) => setRootDraft(e.target.value)}
                placeholder="State the systemic root cause…"
              />
              <div className="mt-2 flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => {
                    patch({ rootCause: rootDraft, updatedAt: new Date().toISOString() })
                    setEditRoot(false)
                  }}
                >
                  Save root cause
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setRootDraft(model.rootCause)
                    setEditRoot(false)
                  }}
                  className="text-ink-muted"
                >
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-2">
              <p className="flex-1 text-base leading-relaxed text-ink">{model.rootCause}</p>
              {editable && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    setRootDraft(model.rootCause)
                    setEditRoot(true)
                  }}
                  aria-label="Edit root cause"
                >
                  <Pencil />
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

const isComplete = (m: FiveWhysModel) => m.whys.length >= 5 && m.whys.every((w) => w.answer.trim().length > 0)

/** Compact read-only chain for list views. */
export function FiveWhysMini({ model, className }: { model: FiveWhysModel; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <p className="text-sm font-medium text-ink">{model.problem}</p>
      <ol className="space-y-1">
        {model.whys.map((w, i) => (
          <li key={w.id} className="flex gap-2 text-xs leading-snug">
            <span className="mt-px shrink-0 text-xs font-semibold text-ink-muted tnum">W{i + 1}</span>
            <span className="min-w-0 flex-1 truncate text-ink-muted">
              {w.answer || w.question}
            </span>
          </li>
        ))}
      </ol>
      <p className="border-t border-line-soft pt-1.5 text-xs leading-relaxed text-ink-soft">
        <span className="font-semibold text-crit-ink">Root cause:</span> {model.rootCause}
      </p>
    </div>
  )
}
