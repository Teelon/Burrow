import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Copy, Check, KeyRound, AlertCircle, UserPlus, LogIn, ArrowRight } from 'lucide-react'
import { useMe, useInviteInfo } from '../lib/queries'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { SegmentedControl } from '../components/ui/SegmentedControl'

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
      <div className="flex min-h-screen items-center justify-center p-6 bg-[var(--bg)]">
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent animate-spin keep-round" />
          <span>Loading invitation details…</span>
        </div>
      </div>
    )
  }

  // Invalid or expired invite
  if (inviteError || !inviteInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-[var(--bg)]">
        <div className="w-full max-w-md border border-[var(--line)] chamfer-lg bg-[var(--surface)] p-8 text-center space-y-5">
          <div className="mx-auto w-12 h-12 bg-[var(--surface2)] border border-[var(--line)] border-l-4 border-l-[var(--danger)] text-[var(--danger)] flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-[var(--text)]">
              Invalid or Expired Invitation
            </h1>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              {inviteError instanceof Error
                ? inviteError.message
                : 'This invitation link is not valid or has expired. Please ask your workspace owner to send you a new invite.'}
            </p>
          </div>
          {token && (
            <div className="p-3 bg-[var(--surface2)] border border-[var(--line)] text-xs">
              <span className="text-[var(--muted)] block mb-1">Provided token:</span>
              <code className="font-mono text-[var(--text)] break-all select-all">
                {token}
              </code>
            </div>
          )}
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-block w-full py-2 px-4 min-h-[44px] text-sm font-medium bg-[var(--accent)] text-[var(--accent-ink)] hover:brightness-110 transition"
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
      <div className="flex min-h-screen items-center justify-center p-6 bg-[var(--bg)]">
        <div className="w-full max-w-md border border-[var(--line)] chamfer-lg bg-[var(--surface)] p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[var(--accent)] text-[var(--accent-ink)] mb-1">
              Workspace Invitation
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
              Join {inviteInfo.workspaceName}
            </h1>
            <p className="text-xs text-[var(--muted)]">
              You've been invited to join as an{' '}
              <strong className="capitalize text-[var(--text)]">
                {inviteInfo.role}
              </strong>
              .
            </p>
          </div>

          <div className="p-4 bg-[var(--surface2)] border border-[var(--line)] space-y-2 text-xs">
            <div className="flex items-center justify-between text-[var(--muted)]">
              <span>Signed in as:</span>
              <span className="font-semibold text-[var(--text)]">
                {me.user?.email}
              </span>
            </div>
            <div className="flex items-center justify-between text-[var(--muted)]">
              <span>Invited email:</span>
              <span className="font-medium text-[var(--text)]">
                {inviteInfo.email}
              </span>
            </div>
            <div className="flex items-center justify-between text-[var(--muted)]">
              <span>Assigned role:</span>
              <span className="capitalize font-medium text-[var(--text)]">
                {inviteInfo.role}
              </span>
            </div>
          </div>

          {actionError && (
            <div className="p-3 text-xs bg-[var(--surface2)] text-[var(--text)] border border-[var(--line)] border-l-4 border-l-[var(--danger)]">
              {actionError}
            </div>
          )}

          <div className="space-y-3 pt-2">
            <Button
              variant="primary"
              onClick={handleAcceptLoggedIn}
              disabled={loading}
              className="w-full py-2.5 px-4 text-sm font-medium min-h-[44px]"
            >
              {loading ? 'Joining workspace…' : `Accept & Join ${inviteInfo.workspaceName}`}
            </Button>

            <button
              type="button"
              onClick={async () => {
                await fetch('/api/auth/sign-out', { method: 'POST' }).catch(() => {})
                queryClient.clear()
                window.location.reload()
              }}
              className="w-full text-center text-xs text-[var(--muted)] hover:text-[var(--text)] transition min-h-[44px]"
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
    <div className="flex min-h-screen items-center justify-center p-6 bg-[var(--bg)]">
      <div className="w-full max-w-md border border-[var(--line)] chamfer-lg bg-[var(--surface)] p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[var(--accent)] text-[var(--accent-ink)] mb-1">
            Workspace Invitation
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
            Join {inviteInfo.workspaceName}
          </h1>
          <p className="text-xs text-[var(--muted)]">
            You've been invited to join as an{' '}
            <strong className="capitalize text-[var(--text)]">
              {inviteInfo.role}
            </strong>
            .
          </p>
        </div>

        {/* Invite Token Info Box */}
        <div className="p-3 bg-[var(--surface2)] border border-[var(--line)] space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
            <span className="flex items-center gap-1 font-medium">
              <KeyRound className="w-3.5 h-3.5 text-[var(--muted)]" />
              Invite Token
            </span>
            <button
              type="button"
              onClick={handleCopyToken}
              className="flex items-center gap-1 text-[11px] text-[var(--accent)] hover:underline min-h-[44px] sm:min-h-0"
            >
              {copiedToken ? (
                <>
                  <Check className="w-3 h-3 text-[var(--c4)]" />
                  <span className="text-[var(--c4)] font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy Token</span>
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-xs font-medium text-[var(--text)] truncate select-all">
            {token}
          </div>
        </div>

        {/* Tab Toggle: Create Account vs Sign In */}
        <SegmentedControl
          value={mode}
          onValueChange={(v) => {
            setMode(v as 'signup' | 'signin')
            setActionError(null)
          }}
          options={[
            { value: 'signup', label: (<span className="inline-flex items-center gap-1.5"><UserPlus className="w-3.5 h-3.5" />Create Account</span>) },
            { value: 'signin', label: (<span className="inline-flex items-center gap-1.5"><LogIn className="w-3.5 h-3.5" />Sign In</span>) },
          ]}
          fullWidth
        />

        {actionError && (
          <div className="p-3 text-xs bg-[var(--surface2)] text-[var(--text)] border border-[var(--line)] border-l-4 border-l-[var(--danger)]">
            {actionError}
          </div>
        )}

        {mode === 'signup' ? (
          <form onSubmit={handleSignUpAndJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text)] mb-1">
                Full Name
              </label>
              <Input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ada Lovelace"
                className="w-full px-3 py-2 text-base sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text)] mb-1">
                Email
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 text-base sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text)] mb-1">
                Password
              </label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-base sm:text-sm"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full py-2 px-4 text-sm font-medium min-h-[44px]"
            >
              {loading ? 'Creating account…' : `Create Account & Join`}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSignInAndJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text)] mb-1">
                Email
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 text-base sm:text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[var(--text)] mb-1">
                Password
              </label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 text-base sm:text-sm"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full py-2 px-4 text-sm font-medium min-h-[44px]"
            >
              {loading ? 'Signing in…' : `Sign In & Join`}
            </Button>
          </form>
        )}

        <div className="pt-2 text-center border-t border-[var(--hair)]">
          <Link
            to="/login"
            search={{ inviteToken: token, email: inviteInfo.email, mode: 'signup' }}
            className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--text)] transition min-h-[44px]"
          >
            Prefer standard login page? Open here <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
