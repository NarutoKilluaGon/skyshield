import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wordmark } from '@/components/common/logo'
import { useAuth } from '@/lib/auth'

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh">
      <div className="flex w-full flex-col px-6 py-8 md:w-[420px] md:px-12">
        <Link to="/" className="inline-block w-fit">
          <Wordmark />
        </Link>

        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-lg font-semibold text-ink">Reset your password</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          {sent ? (
            <div className="mt-6 rounded-md border border-ok/30 bg-ok-wash px-4 py-3 text-sm text-ok-ink">
              <p className="font-medium">Check your email</p>
              <p className="mt-1">
                If an account exists for {email}, we&apos;ve sent a password reset link. It will
                expire in 30 minutes.
              </p>
              <Link
                to="/login"
                className="mt-3 inline-block text-sm text-ink underline-offset-4 hover:underline"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-crit/30 bg-crit-wash px-3 py-2 text-sm text-crit-ink"
                >
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-ink">
                  Email
                </label>
                <Input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="size-4 animate-spin" />}
                Send reset link
              </Button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-ink-muted">
            Remember your password?{' '}
            <Link to="/login" className="text-ink underline-offset-4 hover:underline">
              Sign in
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