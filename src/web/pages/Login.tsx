import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useMe } from '../lib/queries'

export function Login() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: me, isLoading: meLoading } = useMe()

  const searchParams =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search)
      : null
  const queryInviteToken =
    searchParams?.get('inviteToken') || searchParams?.get('token') || ''
  const queryEmail = searchParams?.get('email') || ''
  const queryMode = searchParams?.get('mode')

  const [isSignUp, setIsSignUp] = useState(
    () => queryMode === 'signup' || !!queryInviteToken,
  )
  const [email, setEmail] = useState(() => queryEmail)
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [bootstrapToken, setBootstrapToken] = useState('')
  const [inviteToken, setInviteToken] = useState(() => queryInviteToken)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Redirect to app if already authenticated
  useEffect(() => {
    if (!meLoading && me) {
      navigate({ to: '/' })
    }
  }, [me, meLoading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const endpoint = isSignUp
        ? '/api/auth/sign-up/email'
        : '/api/auth/sign-in/email'

      const payload: Record<string, string> = { email, password }
      if (isSignUp) {
        payload.name = name
        if (bootstrapToken.trim()) payload.bootstrapToken = bootstrapToken.trim()
        if (inviteToken.trim()) payload.inviteToken = inviteToken.trim()
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string }
          message?: string
        }
        throw new Error(data.error?.message || data.message || 'Authentication failed')
      }

      // If user signed in (not signed up) and there was an invite token, accept it
      const effectiveInviteToken = queryInviteToken || inviteToken.trim()
      if (!isSignUp && effectiveInviteToken) {
        await fetch('/api/invites/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: effectiveInviteToken }),
        }).catch(() => {})
      }

      // Successfully signed in / up; clear query cache and navigate to root
      queryClient.clear()
      navigate({ to: '/' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-sm border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Burrow
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {isSignUp ? 'Create your account' : 'Sign in to your workspace'}
          </p>
        </div>

        {error && (
          <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
            {error}
          </div>
        )}

        {queryInviteToken && (
          <div className="p-3 text-xs rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Workspace invitation detected. Complete registration below to join.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {isSignUp && (
            <>
              {!inviteToken.trim() && (
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    Bootstrap Token (First user setting up Burrow only)
                  </label>
                  <input
                    type="text"
                    value={bootstrapToken}
                    onChange={(e) => setBootstrapToken(e.target.value)}
                    placeholder="Leave blank unless initial server setup"
                    className="w-full px-3 py-2 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary font-mono text-xs"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    Invite Token (Teammate invitations)
                  </label>
                  {queryInviteToken && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Pre-filled from link
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  placeholder="Enter invite token"
                  className="w-full px-3 py-2 text-sm font-mono text-xs border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
                  If you received an invite link like <code className="font-mono">/invite/TOKEN</code>, the token is the code at the end of the URL.
                </p>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 text-sm font-medium rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 disabled:opacity-50 transition shadow-sm"
          >
            {loading ? 'Please wait…' : isSignUp ? 'Sign up' : 'Sign in'}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp)
              setError(null)
            }}
            className="text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  )
}
