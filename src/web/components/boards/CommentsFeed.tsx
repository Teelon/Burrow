import { useMemo, useRef, useState } from 'react';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useMe,
  useMembers,
  type CommentItem,
} from '../../lib/queries';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';

interface CommentsFeedProps {
  cardId: string;
}

/** `@[Display Name](userId)` → segments with mention chips. */
function renderContent(content: string) {
  const parts: Array<{ text: string; mention?: { label: string } }> = [];
  const re = /@\[([^\]]*)\]\([A-Za-z0-9_-]+\)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    if (match.index > last) parts.push({ text: content.slice(last, match.index) });
    parts.push({ text: match[0], mention: { label: match[1] || 'someone' } });
    last = match.index + match[0].length;
  }
  if (last < content.length) parts.push({ text: content.slice(last) });
  return parts;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function CommentRow({
  comment,
  canDelete,
  onDelete,
}: {
  comment: CommentItem;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const parts = useMemo(() => renderContent(comment.content), [comment.content]);

  return (
    <div className="group flex items-start gap-2.5 py-2">
      <Avatar name={comment.name || 'Someone'} src={comment.image} size="sm" className="mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text)]">
            {comment.name || 'Someone'}
          </span>
          <span
            className="text-[10px] text-[var(--muted)]"
            title={new Date(comment.createdAt).toLocaleString()}
          >
            {timeAgo(comment.createdAt)}
          </span>
          {canDelete && (
            <button
              onClick={onDelete}
              title="Delete comment"
              aria-label="Delete comment"
              className="p-0.5 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center text-[var(--muted)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="text-xs text-[var(--text)] whitespace-pre-wrap break-words leading-relaxed mt-0.5">
          {parts.map((part, i) =>
            part.mention ? (
              <Badge key={i} tone="neutral">
                @{part.mention.label}
              </Badge>
            ) : (
              <span key={i}>{part.text}</span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

export function CommentsFeed({ cardId }: CommentsFeedProps) {
  const { data: comments = [], isLoading } = useComments(cardId);
  const { data: me } = useMe();
  const { data: members = [] } = useMembers();
  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();

  const [draft, setDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Member picker while typing `@query` right before the caret.
  const mentionQuery = useMemo(() => {
    const el = textareaRef.current;
    if (!el) return null;
    const before = draft.slice(0, el.selectionStart ?? draft.length);
    const match = /@([A-Za-z0-9_ ]{0,24})$/.exec(before);
    return match ? (match[1] ?? '') : null;
    // Note: deliberately depends only on `draft`; `el.selectionStart` is read
    // live so caret moves without typing also refresh the query.
  }, [draft]);

  const mentionMatches =
    mentionQuery !== null
      ? members
          .filter((m) =>
            (m.name || m.email || '').toLowerCase().includes(mentionQuery.toLowerCase()),
          )
          .slice(0, 6)
      : [];

  const insertMention = (member: { userId: string; name?: string | null; email: string }) => {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart ?? draft.length;
    const before = draft.slice(0, caret);
    const after = draft.slice(caret);
    const match = /@([A-Za-z0-9_ ]{0,24})$/.exec(before);
    const start = match ? caret - match[0].length : caret;
    const label = member.name || member.email;
    const insert = `@[${label}](${member.userId}) `;
    setDraft(before.slice(0, start) + insert + after);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + insert.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const send = () => {
    const content = draft.trim();
    if (!content || createComment.isPending) return;
    createComment.mutate(
      { cardId, content },
      {
        onSuccess: () => {
          setDraft('');
          textareaRef.current?.focus();
        },
      },
    );
  };

  return (
    <div className="border-t border-[var(--hair)] pt-4">
      <h3
        className="text-xs uppercase tracking-wider text-[var(--muted)] flex items-center gap-1.5 mb-1"
        style={{
          fontFamily: 'Archivo, sans-serif',
          fontVariationSettings: "'wdth' 122, 'wght' 800",
        }}
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span>Discussion</span>
        {comments.length > 0 && (
          <span className="text-[var(--muted)] font-normal">({comments.length})</span>
        )}
      </h3>

      {isLoading ? (
        <div className="py-3 text-xs text-[var(--muted)]">Loading comments…</div>
      ) : comments.length === 0 ? (
        <div className="py-3 text-xs text-[var(--muted)] italic">
          No comments yet. Start the discussion — use @ to mention teammates.
        </div>
      ) : (
        <div className="divide-y divide-[var(--hair)]">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              canDelete={comment.userId === me?.user?.id || me?.role === 'owner'}
              onDelete={() => {
                if (window.confirm('Delete this comment?')) {
                  deleteComment.mutate({ cardId, commentId: comment.id });
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Composer */}
      <div className="relative mt-2">
        {mentionMatches.length > 0 && (
          <div className="absolute bottom-full left-0 mb-1 w-64 bg-[var(--surface)] border border-[var(--line)] p-1 z-20">
            {mentionMatches.map((m) => (
              <button
                key={m.userId}
                type="button"
                onClick={() => insertMention(m)}
                className="w-full flex items-center gap-2 px-2 py-1.5 min-h-[44px] text-xs text-[var(--text)] hover:bg-[var(--hi)] text-left"
              >
                <Avatar name={m.name || m.email} size="xs" />
                <span className="truncate">{m.name || m.email}</span>
              </button>
            ))}
          </div>
        )}

        {/* Composer stays a multi-line textarea (token classes); Input fits single-line only. */}
        <div className="flex items-end gap-2 bg-[var(--surface)] border border-[var(--line)] focus-within:border-[var(--accent)] p-2 transition">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                send();
              }
            }}
            rows={Math.min(4, Math.max(2, draft.split('\n').length))}
            placeholder="Write a comment… (@mention · ⌘↵ to send)"
            className="flex-1 min-w-0 resize-none bg-transparent text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none leading-relaxed text-[16px] md:text-xs"
          />
          <button
            type="button"
            onClick={send}
            disabled={!draft.trim() || createComment.isPending}
            title="Send (⌘+Enter)"
            aria-label="Send comment"
            className="chamfer-sm p-1.5 min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--accent)] hover:bg-[var(--hi)] disabled:opacity-40 transition shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
