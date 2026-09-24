import { useState } from 'react';
import { Copy, Check, Trash2, UserPlus, KeyRound, ExternalLink, X } from 'lucide-react';
import { useMembers, useInvites, useCreateInvite, useRevokeInvite, useMe } from '../lib/queries';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';

interface CreatedInviteInfo {
  url: string;
  token: string;
  email: string;
  role: string;
}

export function MembersSettings() {
  const { data: me } = useMe();
  const { data: members = [], refetch: refetchMembers } = useMembers();
  const { data: invites = [] } = useInvites();
  const createInvite = useCreateInvite();
  const revokeInvite = useRevokeInvite();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [createdInvite, setCreatedInvite] = useState<CreatedInviteInfo | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = me?.role === 'owner';

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setError(null);

    try {
      const res = (await createInvite.mutateAsync({
        email: inviteEmail.trim(),
        role: inviteRole,
      })) as { url: string; token: string; email: string; role: string };
      setCreatedInvite({
        url: res.url,
        token: res.token,
        email: res.email,
        role: res.role,
      });
      setInviteEmail('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    }
  };

  const handleCopyUrl = () => {
    if (createdInvite?.url) {
      navigator.clipboard.writeText(createdInvite.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleCopyToken = () => {
    if (createdInvite?.token) {
      navigator.clipboard.writeText(createdInvite.token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'owner' | 'editor' | 'viewer') => {
    setError(null);
    try {
      const res = await fetch(`/api/members/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(data.error?.message || 'Failed to change role');
      }
      refetchMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to change role');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/members/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(data.error?.message || 'Failed to remove member');
      }
      refetchMembers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">Workspace Members</h1>
        <p className="text-sm text-[var(--muted)]">
          Manage workspace teammates, roles, and pending invitations.
        </p>
      </div>

      {error && (
        <div className="p-3 text-xs bg-[var(--surface2)] text-[var(--text)] border border-[var(--line)] border-l-4 border-l-[var(--danger)]">
          {error}
        </div>
      )}

      {/* Invite Member Section (Owner only) */}
      {isOwner && (
        <div className="border border-[var(--line)] chamfer-sm bg-[var(--surface)] p-5 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 text-[var(--text)]">
            <UserPlus className="w-4 h-4 text-[var(--accent)]" /> Invite a teammate
          </h2>
          <form onSubmit={handleCreateInvite} className="flex flex-wrap gap-2">
            <Input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@example.com"
              className="flex-1 min-w-[200px] px-3 py-1.5 text-base sm:text-sm min-h-[44px] sm:min-h-0"
            />
            <Select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
              className="px-3 py-1.5 text-sm min-h-[44px] sm:min-h-0"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </Select>
            <Button
              type="submit"
              variant="primary"
              disabled={createInvite.isPending}
              className="px-4 py-1.5 text-sm font-medium min-h-[44px] sm:min-h-0"
            >
              {createInvite.isPending ? 'Inviting…' : 'Generate Invite'}
            </Button>
          </form>

          {createdInvite && (
            <div className="p-4 bg-[var(--surface2)] border border-[var(--line)] border-l-4 border-l-[var(--c4)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text)]">
                  <Check className="w-4 h-4 text-[var(--c4)]" />
                  <span>
                    Invitation created for {createdInvite.email} ({createdInvite.role})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCreatedInvite(null)}
                  className="text-[var(--muted)] hover:text-[var(--text)] p-0.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Invite Link */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--muted)]">
                    Invite Link (for one-click sign-up)
                  </span>
                  <a
                    href={createdInvite.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[var(--accent)] hover:underline flex items-center gap-1"
                  >
                    Open link <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="p-2.5 bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-mono text-[var(--text)]">{createdInvite.url}</span>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 min-h-[44px] sm:min-h-0 text-xs font-medium bg-[var(--surface2)] border border-[var(--line)] hover:bg-[var(--hi)] text-[var(--text)] transition"
                  >
                    {copiedUrl ? (
                      <Check className="w-3.5 h-3.5 text-[var(--c4)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedUrl ? 'Copied' : 'Copy Link'}</span>
                  </button>
                </div>
              </div>

              {/* Invite Token */}
              <div className="space-y-1">
                <span className="text-[11px] font-medium text-[var(--muted)] flex items-center gap-1">
                  <KeyRound className="w-3 h-3 text-[var(--muted)]" /> Invite Token (for manual
                  entry on registration page)
                </span>
                <div className="p-2.5 bg-[var(--surface)] border border-[var(--line)] flex items-center justify-between gap-3 text-xs">
                  <code className="font-mono font-semibold text-[var(--text)] select-all tracking-wider">
                    {createdInvite.token}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyToken}
                    className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 min-h-[44px] sm:min-h-0 text-xs font-medium bg-[var(--surface2)] border border-[var(--line)] hover:bg-[var(--hi)] text-[var(--text)] transition"
                  >
                    {copiedToken ? (
                      <Check className="w-3.5 h-3.5 text-[var(--c4)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>{copiedToken ? 'Copied' : 'Copy Token'}</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-[var(--muted)]">
                The recipient can click the link to register instantly, or enter this invite token
                manually if they are on the sign-up page.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Members List */}
      <div className="border border-[var(--line)] bg-[var(--surface)] divide-y divide-[var(--hair)] overflow-hidden">
        <div className="px-5 py-3 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider bg-[var(--surface2)]">
          Members ({members.length})
        </div>

        {members.map((member) => (
          <div key={member.userId} className="px-5 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={member.name} size="sm" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--text)] truncate flex items-center gap-2">
                  <span>{member.name}</span>
                  {member.userId === me?.user?.id && <Badge>You</Badge>}
                </div>
                <div className="text-xs text-[var(--muted)] truncate">{member.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isOwner && member.userId !== me?.user?.id ? (
                <Select
                  value={member.role}
                  onChange={(e) =>
                    handleRoleChange(member.userId, e.target.value as 'owner' | 'editor' | 'viewer')
                  }
                  className="text-xs px-2.5 py-1 min-h-[44px] sm:min-h-0"
                >
                  <option value="owner">Owner</option>
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </Select>
              ) : (
                <Badge className="capitalize">{member.role}</Badge>
              )}

              {isOwner && member.userId !== me?.user?.id && (
                <Button
                  variant="ghost"
                  onClick={() => handleRemoveMember(member.userId)}
                  className="p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 text-[var(--muted)] hover:text-[var(--danger)]"
                  title="Remove member"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pending Invites List */}
      {isOwner && invites.length > 0 && (
        <div className="border border-[var(--line)] bg-[var(--surface)] divide-y divide-[var(--hair)] overflow-hidden">
          <div className="px-5 py-3 text-xs font-semibold text-[var(--muted)] uppercase tracking-wider bg-[var(--surface2)]">
            Pending Invites ({invites.length})
          </div>

          {invites.map((inv) => (
            <div key={inv.id} className="px-5 py-3 flex items-center justify-between text-sm">
              <div>
                <span className="font-medium text-[var(--text)]">{inv.email}</span>
                <span className="ml-2 text-xs text-[var(--muted)] capitalize">({inv.role})</span>
              </div>
              <button
                onClick={() => revokeInvite.mutate(inv.id)}
                className="text-xs text-[var(--danger)] hover:underline min-h-[44px] sm:min-h-0"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
