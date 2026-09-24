import { useState } from 'react'
import { useParams, useNavigate, Link } from '@tanstack/react-router'
import { useMe } from '../lib/queries'

export function InviteAccept() {
  const { token } = useParams({ strict: false }) as { token?: string }
  const navigate = useNavigate()
  const { data: me, isLoading } = useMe()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleAccept = async () => {
    if (!token) return
    setError(null)
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

      navigate({ to: '/' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite')
    } finally {
      setLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="text-sm text-neutral-400">Loading…</div>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950">
        <div className="w-full max-w-sm border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 p-8 shadow-xl text-center space-y-4">
          <h1 className="text-xl font-bold">You've been invited!</h1>
          <p className="text-xs text-neutral-500">
            Please sign in or create an account with your invite token to accept.
          </p>
          <div className="pt-2">
            <Link
              to="/login"
              className="inline-block w-full py-2 px-4 text-sm font-medium rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
            >
              Sign up or Sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6 bg-neutral-50 dark:bg-neutral-950">
      <div className="w-full max-w-sm border border-neutral-200 dark:border-neutral-800 rounded-2xl bg-white dark:bg-neutral-900 p-8 shadow-xl text-center space-y-4">
        <h1 className="text-xl font-bold">Join Workspace</h1>
        <p className="text-xs text-neutral-500">
          You are currently signed in as <strong>{me.user?.email}</strong>. Click below to accept the invitation and join the workspace.
        </p>

        {error && (
          <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
            {error}
          </div>
        )}

        <button
          onClick={handleAccept}
          disabled={loading}
          className="w-full py-2 px-4 text-sm font-medium rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 disabled:opacity-50 transition"
        >
          {loading ? 'Joining…' : 'Accept Invitation'}
        </button>
      </div>
    </div>
  )
}
