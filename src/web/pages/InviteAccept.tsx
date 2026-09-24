import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Copy, Check, KeyRound, AlertCircle, UserPlus, LogIn, ArrowRight } from 'lucide-react'
import { useMe, useInviteInfo } from '../lib/queries'

export function InviteAccept() {
  const { token } = useParams({ strict: false }) as { token?: string }
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: me, isLoading: meLoading } = useMe()
  const { data: inviteInfo, isLoading: inviteLoading, error: inviteError } = useInviteInfo(token)

  const [mode, setMode] = useState<'signup' | 'signin'>('signup')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [copiedToken, setCopiedToken] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Pre-fill email from invite data
  useEffect(() => {
    if (inviteInfo?.email && !email) {
      setEmail(inviteInfo.email)
    }
  }, [inviteInfo?.email, email])

  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token)
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    }
  }

  // Accept when already logged in
  const handleAcceptLoggedIn = async () => {
    if (!token) return
    setActionError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string }
        }
        throw new Error(data.error?.message || 'Failed to accept invite')
      }

      queryClient.clear()
      navigate({ to: '/' })
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to accept invite')
    } finally {
      setLoading(false)
    }
  }

  // Sign up and join in one step
  const handleSignUpAndJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setActionError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          inviteToken: token,
        }),
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string }
          message?: string
        }
        throw new Error(data.error?.message || data.message || 'Registration failed')
      }

      queryClient.clear()
      navigate({ to: '/' })
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  // Sign in and accept invite
  const handleSignInAndJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setActionError(null)
    setLoading(true)

    try {
      // First sign in
      const signInRes = await fetch('/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      if (!signInRes.ok) {
        const data = (await signInRes.json().catch(() => ({}))) as {
          error?: { message?: string }
          message?: string
        }
        throw new Error(data.error?.message || data.message || 'Sign in failed')
      }

      // Then accept the invite
      const acceptRes = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      if (!acceptRes.ok) {
        const data = (await acceptRes.json().catch(() => ({}))) as {
          error?: { message?: string }
        }
        throw new Error(data.error?.message || 'Signed in, but failed to accept invite')
      }

      queryClient.clear()
      navigate({ to: '/' })
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  if (meLoading || inviteLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span>Loading invitation details…</span>
        </div>
      </div>
    )
  }

  // Invalid or expired invite
  if (inviteError || !inviteInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="w-full max-w-md border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 p-8 shadow-xl text-center space-y-5">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
              Invalid or Expired Invitation
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
              {inviteError instanceof Error
                ? inviteError.message
                : 'This invitation link is not valid or has expired. Please ask your workspace owner to send you a new invite.'}
            </p>
          </div>
          {token && (
            <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs">
              <span className="text-neutral-500 block mb-1">Provided token:</span>
              <code className="font-mono text-neutral-800 dark:text-neutral-200 break-all select-all">
                {token}
              </code>
            </div>
          )}
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-block w-full py-2 px-4 text-sm font-medium rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 transition"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // User already authenticated
  if (me) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="w-full max-w-md border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 p-8 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-1">
              Workspace Invitation
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Join {inviteInfo.workspaceName}
            </h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              You've been invited to join as an{' '}
              <strong className="capitalize text-neutral-800 dark:text-neutral-200">
                {inviteInfo.role}
              </strong>
              .
            </p>
          </div>

          <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 space-y-2 text-xs">
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span>Signed in as:</span>
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {me.user?.email}
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span>Invited email:</span>
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {inviteInfo.email}
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-600 dark:text-neutral-400">
              <span>Assigned role:</span>
              <span className="capitalize font-medium text-neutral-700 dark:text-neutral-300">
                {inviteInfo.role}
              </span>
            </div>
          </div>

          {actionError && (
            <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
              {actionError}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              onClick={handleAcceptLoggedIn}
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 disabled:opacity-50 transition shadow-sm"
            >
              {loading ? 'Joining workspace…' : `Accept & Join ${inviteInfo.workspaceName}`}
            </button>

            <button
              type="button"
              onClick={async () => {
                await fetch('/api/auth/sign-out', { method: 'POST' }).catch(() => {})
                queryClient.clear()
                window.location.reload()
              }}
              className="w-full text-center text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition"
            >
              Sign out to use a different account
            </button>
          </div>
        </div>
      </div>
    )
  }

  // User is not logged in: Full signup / signin form right on the page!
  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-md border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 p-8 shadow-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-1">
            Workspace Invitation
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Join {inviteInfo.workspaceName}
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            You've been invited to join as an{' '}
            <strong className="capitalize text-neutral-800 dark:text-neutral-200">
              {inviteInfo.role}
            </strong>
            .
          </p>
        </div>

        {/* Invite Token Info Box */}
        <div className="p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-xl border border-neutral-200 dark:border-neutral-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="flex items-center gap-1 font-medium">
              <KeyRound className="w-3.5 h-3.5 text-neutral-500" />
              Invite Token
            </span>
            <button
              type="button"
              onClick={handleCopyToken}
              className="flex items-center gap-1 text-[11px] text-primary hover:underline"
            >
              {copiedToken ? (
                <>
                  <Check className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-500 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Token</span>
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate select-all">
            {token}
          </div>
        </div>

        {/* Tab Toggle: Create Account vs Sign In */}
        <div className="flex rounded-lg bg-neutral-100 dark:bg-neutral-800 p-1 text-xs font-medium">
          <button
            type="button"
            onClick={() => {
              setMode('signup')
              setActionError(null)
            }}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
              mode === 'signup'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signin')
              setActionError(null)
            }}
            className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
              mode === 'signin'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </button>
        </div>

        {actionError && (
          <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
            {actionError}
          </div>
        )}

        {mode === 'signup' ? (
          <form onSubmit={handleSignUpAndJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Full Name
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 text-sm font-medium rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 disabled:opacity-50 transition shadow-sm"
            >
              {loading ? 'Creating account…' : `Create Account & Join`}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSignInAndJoin} className="space-y-4">
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 text-sm font-medium rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 disabled:opacity-50 transition shadow-sm"
            >
              {loading ? 'Signing in…' : `Sign In & Join`}
            </button>
          </form>
        )}

        <div className="pt-2 text-center border-t border-neutral-200 dark:border-neutral-800">
          <Link
            to="/login"
            search={{ inviteToken: token, email: inviteInfo.email, mode: 'signup' }}
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition"
          >
            Prefer standard login page? Open here <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
