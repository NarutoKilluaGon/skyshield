import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wordmark } from '@/components/common/logo'
import { useAuth } from '@/lib/auth'

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { resetPassword } = useAuth()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters')
      return
    }
    setLoading(true)
    try {
      await resetPassword(token ?? '', password)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
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
          <h1 className="text-lg font-semibold text-ink">Set a new password</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Choose a strong password for your account.
          </p>

          {success ? (
            <div className="mt-6 rounded-md border border-ok/30 bg-ok-wash px-4 py-3 text-sm text-ok-ink">
              <p className="font-medium">Password updated</p>
              <p className="mt-1">Your password has been reset successfully.</p>
              <Button
                onClick={() => navigate('/login', { replace: true })}
                className="mt-3"
                variant="outline"
              >
                Sign in
              </Button>
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
                <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-ink">
                  New password
                </label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={10}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 10 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-ink">
                  Confirm password
                </label>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full">
                {loading && <Loader2 className="size-4 animate-spin" />}
                Reset password
              </Button>
            </form>
          )}
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