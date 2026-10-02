import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wordmark } from '@/components/common/logo'
import { useAuth } from '@/lib/auth'

export default function SignupPage() {
  const navigate = useNavigate()
  const { signUp } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const passwordStrength = password.length === 0 ? 0 : password.length < 10 ? 1 : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3 : 2

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!termsAccepted) {
      setError('You must accept the terms and privacy policy')
      return
    }
    setLoading(true)
    try {
      await signUp(name, email, password, organisation, termsAccepted)
      navigate('/verify-email', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-dvh">
      {/* Left column — form */}
      <div className="flex w-full flex-col px-6 py-8 md:w-[420px] md:px-12">
        <Link to="/" className="inline-block w-fit">
          <Wordmark />
        </Link>

        <div className="flex flex-1 flex-col justify-center">
          <h1 className="text-lg font-semibold text-ink">Create your account</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Start managing aviation safety reports for your organisation.
          </p>

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
              <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-ink">
                Full name
              </label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="J. Miller"
              />
            </div>

            <div>
              <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium text-ink">
                Work email
              </label>
              <Input
                id="signup-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium text-ink">
                Password
              </label>
              <div className="relative">
                <Input
                  id="signup-password"
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
              {password.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`h-1 w-8 rounded-full ${
                          passwordStrength >= level
                            ? level === 1
                              ? 'bg-crit'
                              : level === 2
                                ? 'bg-warn'
                                : 'bg-ok'
                            : 'bg-surface-3'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-ink-muted">
                    {passwordStrength === 1 && 'Weak'}
                    {passwordStrength === 2 && 'Fair'}
                    {passwordStrength === 3 && 'Strong'}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label htmlFor="organisation" className="mb-1.5 block text-sm font-medium text-ink">
                Organisation name
              </label>
              <Input
                id="organisation"
                type="text"
                autoComplete="organization"
                required
                value={organisation}
                onChange={(e) => setOrganisation(e.target.value)}
                placeholder="Skyline Air"
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 size-4 rounded border-line-strong"
              />
              <span>
                I agree to the{' '}
                <Link to="/terms" className="text-ink underline-offset-4 hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-ink underline-offset-4 hover:underline">
                  Privacy Policy
                </Link>
              </span>
            </label>

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-ink underline-offset-4 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right column — quiet dark panel */}
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