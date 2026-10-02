/**
 * How-it-works guided tour — a full-screen, chapter-based walkthrough of the
 * whole platform, opened from the landing page ("How it works" buttons in the
 * nav, hero, workflow, CTA and footer).
 *
 * Built for presenting: direction-aware chapter transitions, staggered
 * reveals, an autoplay mode, keyboard navigation (←/→, Home/End, Esc), a
 * clickable chapter rail, and one-sentence takeaways a presenter can read
 * aloud. All motion degrades under prefers-reduced-motion (CSS kit).
 *
 * Pattern sources: full-screen modal showcase (Cruip Open template, MIT),
 * interactive product-tour conventions (Storylane/Hexus SaaS tour guidance),
 * staggered item reveals (Aceternity/Magic UI) — rebuilt on this repo's
 * Radix Dialog, token system and hooks with zero new dependencies.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CirclePlay,
  CirclePause,
  RotateCcw,
  X,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/common/logo'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { TOUR_CHAPTERS } from './tour-chapters'

const AUTOPLAY_MS = 9000

/* ------------------------------------------------------------------ */
/* Context + trigger button                                            */
/* ------------------------------------------------------------------ */

interface TourContextValue {
  openTour: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function useHowItWorksTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useHowItWorksTour must be used within HowItWorksTourProvider')
  return ctx
}

type TourButtonProps = ComponentPropsWithoutRef<typeof Button> & {
  label?: ReactNode
  withIcon?: boolean
}

/** A button that opens the guided tour. Drop it anywhere inside the provider. */
export function HowItWorksButton({ label = 'How it works', withIcon = true, ...props }: TourButtonProps) {
  const { openTour } = useHowItWorksTour()
  return (
    <Button data-tour-open onClick={openTour} {...props}>
      {withIcon && <CirclePlay className="size-4 text-brand" aria-hidden="true" />}
      {label}
    </Button>
  )
}

/* ------------------------------------------------------------------ */
/* Provider (mounts the dialog once for the landing page)              */
/* ------------------------------------------------------------------ */

export function HowItWorksTourProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const value = useMemo<TourContextValue>(() => ({ openTour: () => setOpen(true) }), [])

  return (
    <TourContext.Provider value={value}>
      {children}
      <HowItWorksTourDialog open={open} onOpenChange={setOpen} />
    </TourContext.Provider>
  )
}

/* ------------------------------------------------------------------ */
/* The dialog                                                          */
/* ------------------------------------------------------------------ */

function HowItWorksTourDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const total = TOUR_CHAPTERS.length
  const [index, setIndex] = useState(0)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [playing, setPlaying] = useState(false)
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const chapter = TOUR_CHAPTERS[index]
  const Visual = chapter.visual

  const goTo = useCallback(
    (nextIndex: number, dir: 'next' | 'prev') => {
      setDirection(dir)
      setIndex(Math.min(Math.max(nextIndex, 0), total - 1))
    },
    [total],
  )

  const next = useCallback(() => {
    setIndex((i) => {
      if (i >= total - 1) {
        setPlaying(false)
        return i
      }
      setDirection('next')
      return i + 1
    })
  }, [total])

  const back = useCallback(() => {
    setIndex((i) => {
      if (i <= 0) return i
      setDirection('prev')
      return i - 1
    })
  }, [])

  // Reset every time the tour opens, so a presentation always starts clean.
  useEffect(() => {
    if (open) {
      setIndex(0)
      setDirection('next')
      setPlaying(false)
    }
  }, [open])

  // Autoplay — presentation mode.
  useEffect(() => {
    if (!open || !playing) return
    const id = window.setInterval(() => {
      setIndex((i) => {
        if (i >= total - 1) {
          setPlaying(false)
          return i
        }
        setDirection('next')
        return i + 1
      })
    }, AUTOPLAY_MS)
    return () => window.clearInterval(id)
  }, [open, playing, total])

  // Keyboard navigation (Radix handles Escape and the focus trap).
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      next()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      back()
    } else if (event.key === 'Home') {
      event.preventDefault()
      goTo(0, 'prev')
    } else if (event.key === 'End') {
      event.preventDefault()
      goTo(total - 1, 'next')
    } else if (event.key === ' ' && event.target === event.currentTarget) {
      event.preventDefault()
      setPlaying((p) => !p)
    }
  }

  const handleDemo = async () => {
    onOpenChange(false)
    try {
      await signIn('demo@skyshield.aero', 'demo1234', false)
      navigate('/dashboard')
    } catch {
      navigate('/dashboard')
    }
  }

  const isLast = index === total - 1
  const progress = ((index + 1) / total) * 100

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        onKeyDown={onKeyDown}
        data-tour-dialog
        aria-label="How SkyShield works — guided tour"
        className="left-0 top-0 h-dvh w-full max-w-none -translate-x-0 -translate-y-0 rounded-none border-0 bg-canvas p-0"
      >
        <div className="flex h-full flex-col">
          {/* -------------------------------------------- header */}
          <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-canvas px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Wordmark />
              <span aria-hidden="true" className="hidden h-4 w-px bg-line sm:block" />
              <DialogTitle className="truncate text-sm font-semibold text-ink">
                How SkyShield works
              </DialogTitle>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-ink-muted" data-tour-counter>
                {index + 1} / {total}
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close tour"
                data-tour-close
                className="flex size-8 items-center justify-center rounded-md text-ink-muted transition-colors duration-120 hover:bg-surface-3 hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
          </header>

          {/* --------------------------------- rail + chapter body */}
          <div className="flex min-h-0 flex-1">
            {/* Chapter rail (desktop) */}
            <nav
              aria-label="Tour chapters"
              className="hidden w-60 shrink-0 flex-col border-r border-line bg-canvas-deep lg:flex xl:w-64"
            >
              <ol className="no-scrollbar flex-1 overflow-y-auto p-3">
                {TOUR_CHAPTERS.map((c, i) => {
                  const Icon = c.icon
                  const active = i === index
                  const done = i < index
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        data-tour-goto={c.id}
                        onClick={() => goTo(i, i > index ? 'next' : 'prev')}
                        aria-current={active ? 'step' : undefined}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors duration-120',
                          active
                            ? 'bg-surface-3 font-medium text-ink'
                            : 'text-ink-muted hover:bg-surface hover:text-ink-soft',
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-6 shrink-0 items-center justify-center rounded',
                            active ? 'bg-brand text-on-brand' : done ? 'bg-brand-wash text-brand' : 'bg-surface-2 text-ink-faint',
                          )}
                        >
                          {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{c.label}</span>
                        <span className="font-mono text-xs text-ink-faint">{i + 1}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </nav>

            {/* Chapter content */}
            <main className="no-scrollbar min-w-0 flex-1 overflow-y-auto" data-tour-chapter={chapter.id}>
              {/* Mobile chapter chips */}
              <div className="no-scrollbar flex gap-1.5 overflow-x-auto border-b border-line-soft px-4 py-2.5 lg:hidden">
                {TOUR_CHAPTERS.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => goTo(i, i > index ? 'next' : 'prev')}
                    aria-label={`Chapter ${i + 1}: ${c.label}`}
                    aria-current={i === index ? 'step' : undefined}
                    className={cn(
                      'shrink-0 rounded-full border px-3 py-1 text-xs transition-colors duration-120',
                      i === index
                        ? 'border-brand/60 bg-brand-wash font-medium text-brand'
                        : 'border-line-soft text-ink-muted hover:text-ink-soft',
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div
                key={chapter.id + direction}
                className={cn(
                  'mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 xl:grid-cols-2 xl:gap-12',
                  direction === 'next' ? 'tour-enter-next' : 'tour-enter-prev',
                )}
              >
                {/* Text column */}
                <div className="min-w-0">
                  <div className="tour-item flex items-center gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-md bg-brand-wash text-brand">
                      <chapter.icon className="size-4" />
                    </span>
                    <span className="font-mono text-xs text-ink-muted">
                      Chapter {index + 1} of {total}
                      {chapter.screen && <span className="text-ink-faint"> · in the app: {chapter.screen}</span>}
                    </span>
                  </div>

                  <h2 className="tour-item mt-4 font-condensed text-xl font-semibold tracking-tight text-ink sm:text-display-2" style={{ animationDelay: '60ms' }}>
                    {chapter.title}
                  </h2>

                  <p className="tour-item mt-3 max-w-[62ch] text-base leading-relaxed text-ink-soft" style={{ animationDelay: '120ms' }}>
                    {chapter.lede}
                  </p>

                  <ul className="mt-6 space-y-4">
                    {chapter.bullets.map((bullet, i) => (
                      <li
                        key={bullet.title}
                        className="tour-item border-l-2 border-line-strong pl-4"
                        style={{ animationDelay: `${200 + i * 110}ms` }}
                      >
                        <p className="text-sm font-semibold text-ink">{bullet.title}</p>
                        <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-ink-muted">{bullet.body}</p>
                      </li>
                    ))}
                  </ul>

                  <p
                    className="tour-item mt-6 rounded-panel border border-brand/30 bg-brand-wash/40 px-4 py-3 text-sm leading-relaxed text-ink-soft"
                    style={{ animationDelay: `${260 + chapter.bullets.length * 110}ms` }}
                  >
                    <span className="font-mono text-xs text-brand">In one sentence · </span>
                    {chapter.takeaway}
                  </p>
                </div>

                {/* Visual column */}
                <div className="flex min-w-0 items-center">
                  <div className="tour-item w-full rounded-panel border border-line bg-surface p-5 sm:p-6" style={{ animationDelay: '160ms' }}>
                    <div className="min-h-[260px]">
                      <Visual />
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>

          {/* -------------------------------------------- footer */}
          <footer className="shrink-0 border-t border-line bg-canvas">
            {/* Reading progress */}
            <div aria-hidden="true" className="h-px w-full bg-line-soft">
              <div
                className="h-full bg-brand transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
              <p className="hidden font-mono text-xs text-ink-faint md:block">
                ← → navigate · Space autoplay · Esc close
              </p>

              <div className="flex items-center gap-2 md:ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={back}
                  disabled={index === 0}
                  data-tour-back
                  className="gap-1.5"
                >
                  <ArrowLeft className="size-3.5" />
                  Back
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPlaying((p) => !p)}
                  aria-pressed={playing}
                  data-tour-play
                  className="gap-1.5"
                  title={playing ? 'Pause autoplay' : 'Play slideshow (9s per chapter)'}
                >
                  {playing ? <CirclePause className="size-3.5" /> : <CirclePlay className="size-3.5" />}
                  <span className="hidden sm:inline">{playing ? 'Pause' : 'Autoplay'}</span>
                </Button>

                {isLast ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goTo(0, 'prev')}
                      data-tour-restart
                      className="gap-1.5"
                    >
                      <RotateCcw className="size-3.5" />
                      Restart
                    </Button>
                    <Button size="sm" onClick={handleDemo} data-tour-demo className="btn-shine gap-1.5">
                      Explore the live demo
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </>
                ) : (
                  <Button size="sm" onClick={next} data-tour-next className="btn-shine gap-1.5">
                    Next
                    <ArrowRight className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  )
}
