import { useState } from 'react'
import { Loader2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wordmark } from '@/components/common/logo'
import { submitAnonymousReport, ThrottleError } from '@/services/incidents'
import { isRateLimited, rateLimitMessage } from '@/services/client'

export default function AnonymousReportPage() {
  const [whatHappened, setWhatHappened] = useState('')
  const [where, setWhere] = useState('')
  const [when, setWhen] = useState('')
  const [contact, setContact] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Throttled, honeypot-guarded and real: the record enters the register
      // for triage and the safety desk is notified.
      const res = await submitAnonymousReport({
        whatHappened,
        where,
        when,
        contact,
        honeypot,
      })
      setReference(res.ref)
      setSubmitted(true)
    } catch (err) {
      setError(
        err instanceof ThrottleError
          ? err.message
          : isRateLimited(err)
            ? rateLimitMessage(err)
            : err instanceof Error
              ? err.message
              : 'The report could not be submitted. Please try again.',
      )
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-ok-wash">
            <svg className="size-6 text-ok-ink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mt-4 text-lg font-semibold text-ink">Report submitted</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Your anonymous report has been received. Reference:
          </p>
          <p className="mt-1 font-mono text-sm font-medium text-ink">{reference}</p>
          <p className="mt-4 text-xs text-ink-muted">
            Save this reference if you need to follow up. No identifying information was collected.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-line px-6 py-4">
        <Wordmark />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          <h1 className="text-lg font-semibold text-ink">Report an incident anonymously</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Just culture: reporting an incident will not result in punishment. All reports are
            reviewed by the safety team.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="what" className="mb-1.5 block text-sm font-medium text-ink">
                What happened?
              </label>
              <textarea
                id="what"
                required
                rows={4}
                value={whatHappened}
                onChange={(e) => setWhatHappened(e.target.value)}
                placeholder="Describe the incident or safety concern..."
                className="w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="where" className="mb-1.5 block text-sm font-medium text-ink">
                Where did it happen?
              </label>
              <Input
                id="where"
                type="text"
                required
                value={where}
                onChange={(e) => setWhere(e.target.value)}
                placeholder="Airport, aircraft, or location"
              />
            </div>

            <div>
              <label htmlFor="when" className="mb-1.5 block text-sm font-medium text-ink">
                When did it happen?
              </label>
              <Input
                id="when"
                type="datetime-local"
                required
                value={when}
                onChange={(e) => setWhen(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="contact" className="mb-1.5 block text-sm font-medium text-ink">
                Contact (optional)
              </label>
              <Input
                id="contact"
                type="text"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Email or phone number (optional)"
              />
              <p className="mt-1 text-xs text-ink-muted">
                Leave blank to remain fully anonymous.
              </p>
            </div>

            {/* Honeypot — hidden from users, catches bots */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                type="text"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            {error && (
              <p
                role="alert"
                data-throttle-error
                className="flex items-start gap-2 rounded-md border border-crit/35 bg-crit-wash px-3 py-2 text-xs leading-relaxed text-crit-ink"
              >
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Submit report
            </Button>
          </form>
        </div>
      </main>
    </div>
  )
}