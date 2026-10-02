import { useState } from 'react'
import { Cpu, Cloud, FileText, Plus, Trash2, User, Building2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input, Textarea } from '@/components/ui/input'
import { FACTOR_CATEGORIES, type FactorCategoryId } from '@/lib/domain'
import type { ContributingFactor } from '@/types'

const ICONS = {
  human: User,
  technical: Cpu,
  environmental: Cloud,
  organizational: Building2,
  procedural: FileText,
} as const

const WEIGHT: Record<ContributingFactor['weight'], { label: string; tone: 'red' | 'amber' | 'neutral' }> = {
  primary: { label: 'Primary', tone: 'red' },
  contributing: { label: 'Contributing', tone: 'amber' },
  latent: { label: 'Latent', tone: 'neutral' },
}

const NEXT_WEIGHT: Record<ContributingFactor['weight'], ContributingFactor['weight']> = {
  primary: 'contributing',
  contributing: 'latent',
  latent: 'primary',
}

export function ContributingFactors({
  factors,
  editable = false,
  onChange,
  className,
}: {
  factors: ContributingFactor[]
  editable?: boolean
  onChange?: (next: ContributingFactor[]) => void
  className?: string
}) {
  const [adding, setAdding] = useState<FactorCategoryId | null>(null)
  const [label, setLabel] = useState('')
  const [detail, setDetail] = useState('')
  const [weight, setWeight] = useState<ContributingFactor['weight']>('contributing')

  const groups = FACTOR_CATEGORIES.map((c) => ({
    ...c,
    items: factors.filter((f) => f.category === c.id),
  }))

  const commit = () => {
    if (!adding || !label.trim()) return
    onChange?.([
      ...factors,
      {
        id: `f_${Date.now()}`,
        rcaId: factors[0]?.rcaId ?? 'rca',
        category: adding,
        label: label.trim(),
        detail: detail.trim(),
        weight,
      },
    ])
    setLabel('')
    setDetail('')
    setWeight('contributing')
    setAdding(null)
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => {
          const Icon = ICONS[g.id as keyof typeof ICONS]
          const primary = g.items.filter((f) => f.weight === 'primary').length

          return (
            <Card
              key={g.id}
              className={cn(
                'flex flex-col overflow-hidden transition-colors',
                adding === g.id && 'border-brand/45',
              )}
            >
              <div className="flex items-center gap-2 border-b border-line-soft px-3 py-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-3 text-ink-soft">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-ink">{g.label}</h3>
                  <p className="truncate text-xs text-ink-muted">{g.hint}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {primary > 0 && (
                    <Badge size="sm" tone="red">
                      {primary} primary
                    </Badge>
                  )}
                  <Badge size="sm" tone="neutral" className="tnum">
                    {g.items.length}
                  </Badge>
                </div>
              </div>

              <ul className="flex-1 divide-y divide-line-soft">
                {g.items.length === 0 && (
                  <li className="px-3 py-4 text-center text-xs text-ink-muted">
                    No factors recorded in this category.
                  </li>
                )}
                {g.items.map((f) => (
                  <li key={f.id} className="group px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-ink-soft">{f.label}</p>
                        {f.detail && (
                          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{f.detail}</p>
                        )}
                        {editable ? (
                          <button
                            type="button"
                            title="Cycle weight: primary → contributing → latent"
                            aria-label={`Weight of ${f.label}: ${WEIGHT[f.weight].label}. Activate to change.`}
                            onClick={() =>
                              onChange?.(
                                factors.map((x) =>
                                  x.id === f.id ? { ...x, weight: NEXT_WEIGHT[x.weight] } : x,
                                ),
                              )
                            }
                            className="mt-1.5 inline-flex rounded-badge transition-opacity hover:opacity-80"
                          >
                            <Badge size="sm" tone={WEIGHT[f.weight].tone}>
                              {WEIGHT[f.weight].label} ⇄
                            </Badge>
                          </button>
                        ) : (
                          <Badge size="sm" tone={WEIGHT[f.weight].tone} className="mt-1.5">
                            {WEIGHT[f.weight].label}
                          </Badge>
                        )}
                      </div>
                      {editable && (
                        <button
                          type="button"
                          onClick={() => onChange?.(factors.filter((x) => x.id !== f.id))}
                          aria-label={`Remove ${f.label}`}
                          className="shrink-0 rounded p-1 text-ink-muted opacity-0 transition-opacity hover:bg-crit/12 hover:text-crit-ink group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {editable && (
                <div className="border-t border-line-soft p-2">
                  {adding === g.id ? (
                    <div className="space-y-1.5">
                      <Input
                        autoFocus
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                        placeholder="Factor title"
                        className="h-7 text-sm"
                      />
                      <Textarea
                        rows={2}
                        value={detail}
                        onChange={(e) => setDetail(e.target.value)}
                        placeholder="How did this contribute?"
                        className="min-h-[48px] text-xs"
                      />
                      <div className="flex gap-1">
                        {(['primary', 'contributing', 'latent'] as const).map((w) => (
                          <button
                            key={w}
                            type="button"
                            onClick={() => setWeight(w)}
                            className={cn(
                              'rounded border px-1.5 py-0.5 text-xs transition-colors',
                              weight === w
                                ? 'border-brand/45 bg-brand/12 text-brand'
                                : 'border-line text-ink-muted hover:bg-surface-2',
                            )}
                          >
                            {WEIGHT[w].label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <Button size="xs" onClick={commit} className="flex-1 gap-1">
                          Add
                        </Button>
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setAdding(null)}
                          aria-label="Cancel"
                          className="text-ink-muted"
                        >
                          <X />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setAdding(g.id as FactorCategoryId)}
                      className="w-full gap-1 text-ink-muted"
                    >
                      <Plus className="size-3" /> Add factor
                    </Button>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

    </div>
  )
}
