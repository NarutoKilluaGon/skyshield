import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Wordmark } from '@/components/common/logo'
import { useAuth } from '@/lib/auth'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { acceptInvite } = useAuth()

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 10) {
      setError('Password must be at least 10 characters')
      return
    }
    setLoading(true)
    try {
      await acceptInvite(token ?? '', password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation')
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
          <h1 className="text-lg font-semibold text-ink">Accept your invitation</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Set a password to join your organisation on SkyShield.
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
              <label htmlFor="invite-password" className="mb-1.5 block text-sm font-medium text-ink">
                Password
              </label>
              <div className="relative">
                <Input
                  id="invite-password"
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

            <Button type="submit" disabled={loading} className="w-full">
              {loading && <Loader2 className="size-4 animate-spin" />}
              Accept invitation
            </Button>
          </form>
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