import { Link } from 'react-router-dom'
import { Wordmark } from '@/components/common/logo'
import { Button } from '@/components/ui/button'
import { authService } from '@/services/auth'

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-dvh">
      <div className="flex w-full flex-col px-6 py-8 md:w-[420px] md:px-12">
        <Link to="/" className="inline-block w-fit">
          <Wordmark />
        </Link>

        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-lg font-semibold text-ink">Check your email</h1>
          <p className="mt-1 text-sm text-ink-muted">
            We&apos;ve sent a verification link to your email address.
          </p>

          <div className="mt-6 rounded-md border border-line bg-surface p-4">
            <p className="text-sm text-ink-muted">
              Click the link in the email to verify your address and complete your registration.
              The link will expire in 24 hours.
            </p>
            <div className="mt-4 pt-3 border-t border-line-soft">
              <Button
                type="button"
                onClick={async () => {
                  localStorage.setItem('skyshield.first_run', '1')
                  const current = authService.getCurrentSession()
                  if (!current) {
                    await authService.signIn('demo@skyshield.aero', 'SkyShield2026!')
                  }
                  window.location.href = '/dashboard?firstRun=1'
                }}
                className="w-full"
              >
                Verify email (Demo)
              </Button>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-sm text-ink-muted">
              Didn&apos;t receive the email? Check your spam folder or{' '}
              <Link to="/signup" className="text-ink underline-offset-4 hover:underline">
                try again
              </Link>
              .
            </p>
          </div>

          <p className="mt-6 text-center text-sm text-ink-muted">
            <Link to="/login" className="text-ink underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>

      <div className="hidden flex-1 items-center justify-center bg-canvas-deep md:flex">
        <div className="max-w-md px-12">
          <div className="rounded-lg border border-line bg-surface p-6">
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={i}
                  className={`aspect-square rounded-sm ${
                    i === 12
                      ? 'bg-brand'
                      : i === 7 || i === 17
                        ? 'bg-warn'
                        : i === 3 || i === 21
                          ? 'bg-alert'
                          : 'bg-surface-3'
                  }`}
                />
              ))}
            </div>
            <p className="mt-4 text-sm text-ink-muted">
              Every safety report, followed through to a closed action.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}