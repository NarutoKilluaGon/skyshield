import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useBlocker } from 'react-router-dom'
import { ArrowRight, Check, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/common/badges'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth'
import { fmtDateTime } from '@/lib/format'
import { useReportForm, type ReportMode } from './use-report-form'
import { QuickReport } from './quick-report'
import { GuidedWizard } from './guided-wizard'

const MODES: { id: ReportMode; label: string; hint: string }[] = [
  { id: 'quick', label: 'Quick report', hint: 'The essentials on one screen' },
  { id: 'guided', label: 'Guided wizard', hint: 'All seven steps' },
]

export default function ReportIncidentPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const paramMode = params.get('mode')
  const modeOverride =
    paramMode === 'guided' ? 'guided' : paramMode === 'quick' ? 'quick' : undefined

  const rf = useReportForm(user?.id, modeOverride)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  // Warn on browser unload while an unsaved draft exists.
  useEffect(() => {
    if (!rf.dirty || rf.submitted) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [rf.dirty, rf.submitted])

  // Warn on in-app navigation (data router blocker).
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      rf.dirty && !rf.submitted && currentLocation.pathname !== nextLocation.pathname,
  )

  /* ------------------------------------------------------- confirmation */

  if (rf.submitted)
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card className="p-6 text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-card border border-ok/32 bg-ok/10">
            <Check className="size-5 text-ok-ink" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-ink">Occurrence filed</h2>
          <p className="mt-1.5 text-base text-ink-muted">
            Record <span className="font-mono font-semibold text-brand">{rf.submitted.ref}</span> has
            been entered into the Safety Management System and queued for initial assessment.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <Badge size="lg" tone="amber">
              Risk score {rf.score} · {rf.band.label.toUpperCase()}
            </Badge>
            <StatusBadge status="reported" />
          </div>
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/incidents')}>
              Incident register
            </Button>
            <Button onClick={() => navigate(`/incidents/${rf.submitted?.id}`)} className="gap-1.5">
              Open record <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </Card>
      </div>
    )

  /* ------------------------------------------------------------ render */

  return (
    <div className="space-y-4">
      <PageHeader
        title="Report Incident"
        subtitle="File a reportable occurrence into the Safety Management System. All fields marked with an asterisk are mandatory."
        actions={
          <Button
            variant="ghost"
            onClick={() => (rf.dirty ? setConfirmDiscard(true) : navigate(-1))}
            className="gap-1.5 text-ink-muted"
          >
            <X className="size-3.5" /> Discard
          </Button>
        }
      />

      {/* Mode toggle + autosave state */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Report mode"
          className="inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5"
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={rf.mode === m.id}
              title={m.hint}
              onClick={() => rf.setMode(m.id)}
              className={cn(
                'rounded px-3 py-1.5 text-sm font-medium transition-colors duration-120',
                rf.mode === m.id
                  ? 'bg-surface-3 text-ink'
                  : 'text-ink-muted hover:text-ink-soft',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <p className="flex items-center gap-1.5 font-mono text-xs text-ink-muted" aria-live="polite">
          <Save className="size-3" />
          {rf.savedAt ? `Draft saved ${fmtDateTime(rf.savedAt)}` : 'Autosave on'}
        </p>
      </div>

      {/* Restored-draft banner */}
      {rf.restoredAt && (
        <div
          role="status"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-warn/35 bg-warn-wash px-3.5 py-2.5"
        >
          <p className="text-sm text-ink-soft">
            Restored an unsaved draft from{' '}
            <span className="font-mono text-ink">{fmtDateTime(rf.restoredAt)}</span>.
          </p>
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="outline" size="sm" onClick={rf.discardDraft}>
              Start fresh
            </Button>
            <Button variant="ghost" size="sm" onClick={rf.dismissRestoreNote} aria-label="Dismiss">
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {rf.mode === 'quick' ? <QuickReport rf={rf} /> : <GuidedWizard rf={rf} />}

      {/* Discard confirmation */}
      <Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Discard this report?</DialogTitle>
            <DialogDescription>
              The form and its autosaved draft will be deleted. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDiscard(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                rf.discardDraft()
                setConfirmDiscard(false)
                navigate(-1)
              }}
            >
              Discard report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* In-app leave guard */}
      {blocker.state === 'blocked' && (
        <Dialog open onOpenChange={(o) => !o && blocker.reset?.()}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle>Leave this report?</DialogTitle>
              <DialogDescription>
                Your draft is autosaved and will be restored when you return to this page.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => blocker.reset?.()}>
                Keep editing
              </Button>
              <Button onClick={() => blocker.proceed?.()}>Leave page</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
