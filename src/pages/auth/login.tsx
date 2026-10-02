import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wordmark } from '@/components/common/logo'
import { useAuth } from '@/lib/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'
  const { signIn } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signIn(email, password, remember)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setError('')
    setLoading(true)
    try {
      await signIn('demo@skyshield.aero', 'demo1234', false)
      navigate(next, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo sign in failed')
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
          <h1 className="text-lg font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Enter your credentials to access your account.
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
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-ink-muted">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="size-4 rounded border-line-strong"
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Sign in
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDemoLogin}
              disabled={loading}
              className="w-full"
            >
              Use demo account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-muted">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="text-ink underline-offset-4 hover:underline">
              Sign up
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