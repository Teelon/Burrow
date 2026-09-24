import { useState } from 'react'
import { Copy, Check, Trash2, UserPlus, KeyRound, ExternalLink, X } from 'lucide-react'
import {
  useMembers,
  useInvites,
  useCreateInvite,
  useRevokeInvite,
  useMe,
} from '../lib/queries'

interface CreatedInviteInfo {
  url: string
  token: string
  email: string
  role: string
}

export function MembersSettings() {
  const { data: me } = useMe()
  const { data: members = [], refetch: refetchMembers } = useMembers()
  const { data: invites = [] } = useInvites()
  const createInvite = useCreateInvite()
  const revokeInvite = useRevokeInvite()

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [createdInvite, setCreatedInvite] = useState<CreatedInviteInfo | null>(null)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOwner = me?.role === 'owner'

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setError(null)

    try {
      const res = (await createInvite.mutateAsync({
        email: inviteEmail.trim(),
        role: inviteRole,
      })) as { url: string; token: string; email: string; role: string }
      setCreatedInvite({
        url: res.url,
        token: res.token,
        email: res.email,
        role: res.role,
      })
      setInviteEmail('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invite')
    }
  }

  const handleCopyUrl = () => {
    if (createdInvite?.url) {
      navigator.clipboard.writeText(createdInvite.url)
      setCopiedUrl(true)
      setTimeout(() => setCopiedUrl(false), 2000)
    }
  }

  const handleCopyToken = () => {
    if (createdInvite?.token) {
      navigator.clipboard.writeText(createdInvite.token)
      setCopiedToken(true)
      setTimeout(() => setCopiedToken(false), 2000)
    }
  }

  const handleRoleChange = async (
    userId: string,
    newRole: 'owner' | 'editor' | 'viewer',
  ) => {
    setError(null)
    try {
      const res = await fetch(`/api/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string }
        }
        throw new Error(data.error?.message || 'Failed to change role')
      }
      refetchMembers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change role')
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return
    setError(null)
    try {
      const res = await fetch(`/api/members/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string }
        }
        throw new Error(data.error?.message || 'Failed to remove member')
      }
      refetchMembers()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    }
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Workspace Members
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Manage workspace teammates, roles, and pending invitations.
        </p>
      </div>

      {error && (
        <div className="p-3 text-xs rounded-lg bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
          {error}
        </div>
      )}

      {/* Invite Member Section (Owner only) */}
      {isOwner && (
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" /> Invite a teammate
          </h2>
          <form onSubmit={handleCreateInvite} className="flex flex-wrap gap-2">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="flex-1 min-w-[200px] px-3 py-1.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <select
              value={inviteRole}
              onChange={(e) =>
                setInviteRole(e.target.value as 'editor' | 'viewer')
              }
              className="px-3 py-1.5 text-sm border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              type="submit"
              disabled={createInvite.isPending}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 hover:opacity-90 disabled:opacity-50"
            >
              {createInvite.isPending ? 'Inviting…' : 'Generate Invite'}
            </button>
          </form>

          {createdInvite && (
            <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Invitation created for {createdInvite.email} ({createdInvite.role})</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCreatedInvite(null)}
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Invite Link */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
                    Invite Link (for one-click sign-up)
                  </span>
                  <a
                    href={createdInvite.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary hover:underline flex items-center gap-1"
                  >
                    Open link <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="p-2.5 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-mono text-neutral-700 dark:text-neutral-300">
                    {createdInvite.url}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 text-xs font-medium rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition"
                  >
                    {copiedUrl ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedUrl ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Invite Token */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-neutral-500" /> Invite Token (for manual entry on registration page)
                </span>
                <div className="p-2.5 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 text-xs">
                  <code className="font-mono font-semibold text-neutral-900 dark:text-neutral-100 select-all tracking-wider">
                    {createdInvite.token}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 text-xs font-medium rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition"
                  >
                    {copiedToken ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedToken ? 'Copied' : 'Copy Token'}</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                The recipient can click the link to register instantly, or enter this invite token manually if they are on the sign-up page.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Members List */}
      <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800 shadow-xs overflow-hidden">
        <div className="px-5 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-50/50 dark:bg-neutral-800/20">
          Members ({members.length})
        </div>

        {members.map((member) => (
          <div
            key={member.userId}
            className="px-5 py-3.5 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-medium text-sm shrink-0">
                {member.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate flex items-center gap-2">
                  <span>{member.name}</span>
                  {member.userId === me?.user?.id && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                      You
                    </span>
                  )}
                </div>
                <div className="text-xs text-neutral-500 truncate">
                  {member.email}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isOwner && member.userId !== me?.user?.id ? (
                <select
                  value={member.role}
                  onChange={(e) =>
                    handleRoleChange(
                      member.userId,
                      e.target.value as 'owner' | 'editor' | 'viewer',
                    )
                  }
                  className="text-xs px-2.5 py-1 border border-neutral-200 dark:border-neutral-800 rounded-lg bg-neutral-50 dark:bg-neutral-800"
                >
                  <option value="owner">Owner</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
              ) : (
                <span className="text-xs px-2 py-0.5 rounded-full capitalize bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
                  {member.role}
                </span>
              )}

              {isOwner && member.userId !== me?.user?.id && (
                <button
                  onClick={() => handleRemoveMember(member.userId)}
                  className="p-1.5 text-neutral-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
                  title="Remove member"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pending Invites List */}
      {isOwner && invites.length > 0 && (
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900 divide-y divide-neutral-200 dark:divide-neutral-800 shadow-xs overflow-hidden">
          <div className="px-5 py-3 text-xs font-semibold text-neutral-400 uppercase tracking-wider bg-neutral-50/50 dark:bg-neutral-800/20">
            Pending Invites ({invites.length})
          </div>

          {invites.map((inv) => (
            <div
              key={inv.id}
              className="px-5 py-3 flex items-center justify-between text-sm"
            >
              <div>
                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                  {inv.email}
                </span>
                <span className="ml-2 text-xs text-neutral-500 capitalize">
                  ({inv.role})
                </span>
              </div>
              <button
                onClick={() => revokeInvite.mutate(inv.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
