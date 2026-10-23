import { useEffect, useState } from 'react';
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';
import { createReactInlineContentSpec, createReactBlockSpec } from '@blocknote/react';
import { Calendar, FileText, Kanban, Layout, Tag } from 'lucide-react';

function getInitials(name?: string | null): string {
  const parts = (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const first = parts[0];
  if (!first) return '?';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/**
 * Custom inline mention content spec — Basalt angular chips / Modern rounded pills on token surfaces.
 */
export const Mention = createReactInlineContentSpec(
  {
    type: 'mention',
    propSchema: {
      kind: {
        default: 'user',
        values: ['user', 'notepad', 'card', 'date', 'tag'] as const,
      },
      id: { default: '' },
      label: { default: '' },
      isoDate: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const { kind, id, label, isoDate } = props.inlineContent.props;

      if (kind === 'date') {
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium theme-radius-xs bg-[var(--surface2)] text-[var(--text)] border border-[var(--line)] select-none">
            <Calendar className="w-3 h-3 text-[var(--muted)]" />
            <span>{label || isoDate || 'Date'}</span>
          </span>
        );
      }

      if (kind === 'user') {
        const userInitials = getInitials(label || 'Former member');
        return (
          <span className="inline-flex items-center gap-1.5 h-[28px] pl-1 pr-3 chamfer-btn bg-[var(--hi)] text-[var(--hi-ink)] border border-[var(--line)] font-semibold text-[12px] select-none align-middle">
            <span className="w-5 h-5 clip-hex bg-[var(--accent)] text-[var(--accent-ink)] inline-flex items-center justify-center text-[9px] font-extrabold shrink-0">
              {userInitials}
            </span>
            <span>{label || 'Former member'}</span>
          </span>
        );
      }

      if (kind === 'notepad') {
        return (
          <span
            onClick={(e) => {
              e.stopPropagation();
              if (id) {
                const pid = window.location.pathname.split('/')[2];
                if (pid) {
                  window.location.href = `/p/${pid}/notepads/${id}`;
                }
              }
            }}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium theme-radius-xs bg-[var(--surface2)] text-[var(--text)] border border-[var(--line)] select-none cursor-pointer hover:underline"
          >
            <FileText className="w-3 h-3 text-purple-500" />
            <span>{label || 'Deleted notepad'}</span>
          </span>
        );
      }

      const isTag = kind === 'tag' || (typeof label === 'string' && label.startsWith('#'));
      if (isTag) {
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium theme-radius-xs bg-[var(--surface2)] text-[var(--text)] border border-[var(--line)] border-l-2 border-l-[var(--c2)] select-none">
            <Tag className="w-3 h-3 text-[var(--muted)]" />
            <span>{label || 'Tag'}</span>
          </span>
        );
      }

      if (kind === 'card') {
        const handleCardClick = async (e: React.MouseEvent) => {
          e.stopPropagation();
          if (!id) return;
          const pid = window.location.pathname.split('/')[2];
          if (!pid) return;

          try {
            const res = await fetch(`/api/cards/summary?ids=${id}`);
            if (res.ok) {
              const list = await res.json();
              if (Array.isArray(list) && list.length > 0 && list[0]?.boardId) {
                window.location.href = `/p/${pid}/boards/${list[0].boardId}?cardId=${id}`;
                return;
              }
            }
            window.location.href = `/p/${pid}/boards/${id}`;
          } catch {
            window.location.href = `/p/${pid}/boards/${id}`;
          }
        };

        return (
          <span
            onClick={handleCardClick}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium theme-radius-xs bg-[var(--surface2)] text-[var(--text)] border border-[var(--line)] border-l-2 border-l-[var(--c2)] select-none cursor-pointer hover:underline"
          >
            <Kanban className="w-3 h-3 text-emerald-500" />
            <span>{label || 'Deleted card'}</span>
          </span>
        );
      }

      return <span>@{label}</span>;
    },
  },
);

/**
 * Live notepad link preview component — flat Basalt surface, angular.
 */
function LiveNotepadLink({ notepadId }: { notepadId: string }) {
  const [data, setData] = useState<{
    title: string;
    icon?: string | null;
    deleted: boolean;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/notepads/${notepadId}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json: any) =>
        setData({ title: json.title, icon: json.icon, deleted: !!json.deletedAt }),
      )
      .catch(() => setData({ title: 'Deleted Notepad', deleted: true }));
  }, [notepadId]);

  if (!data) {
    return (
      <div className="my-2 p-2.5 border border-[var(--line)] bg-[var(--surface2)] flex items-center gap-2 text-xs text-[var(--muted)]">
        <FileText className="w-3.5 h-3.5 text-purple-400" />
        <span>Loading notepad…</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        if (!data.deleted) {
          const pid = window.location.pathname.split('/')[2];
          if (pid) {
            window.location.href = `/p/${pid}/notepads/${notepadId}`;
          }
        }
      }}
      className={`my-2 p-3 border border-l-4 flex items-center justify-between gap-3 text-sm transition cursor-pointer select-none ${
        data.deleted
          ? 'border-[var(--line)] bg-[var(--surface2)] text-[var(--muted)] opacity-70'
          : 'border-[var(--line)] border-l-[var(--accent)] bg-[var(--surface2)] hover:bg-[var(--hi)]'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-base">{data.icon || '📄'}</span>
        <span className="font-semibold text-[var(--text)]">{data.title || 'Untitled'}</span>
      </div>
      {data.deleted && (
        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)]">
          Deleted
        </span>
      )}
    </div>
  );
}

/**
 * Custom block for notepadLink.
 */
export const NotepadLinkBlock = createReactBlockSpec(
  {
    type: 'notepadLink',
    propSchema: {
      notepadId: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const { notepadId } = props.block.props;
      return <LiveNotepadLink notepadId={notepadId} />;
    },
  },
);

function LiveCardLink({ cardId }: { cardId: string }) {
  const [data, setData] = useState<{
    boardId?: string;
    title: string;
    boardName: string;
    columnName: string;
    priority?: string | null;
    deleted: boolean;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/cards/summary?ids=${cardId}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((list: any[]) => {
        if (list.length > 0) {
          const item = list[0];
          setData({
            boardId: item.boardId,
            title: item.title,
            boardName: item.boardName,
            columnName: item.columnName,
            priority: item.priority,
            deleted: false,
          });
        } else {
          setData({ title: 'Deleted Card', boardName: '', columnName: '', deleted: true });
        }
      })
      .catch(() =>
        setData({ title: 'Deleted Card', boardName: '', columnName: '', deleted: true }),
      );
  }, [cardId]);

  if (!data) {
    return (
      <div className="my-2 p-2.5 border border-[var(--line)] bg-[var(--surface2)] flex items-center gap-2 text-xs text-[var(--muted)]">
        <Kanban className="w-3.5 h-3.5 text-emerald-400" />
        <span>Loading task card…</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        if (!data.deleted && data.boardId) {
          const pid = window.location.pathname.split('/')[2];
          if (pid) {
            window.location.href = `/p/${pid}/boards/${data.boardId}?cardId=${cardId}`;
          }
        }
      }}
      className={`my-2 p-3 border border-l-4 flex items-center justify-between gap-3 text-sm transition select-none ${
        data.deleted
          ? 'border-[var(--line)] bg-[var(--surface2)] text-[var(--muted)] opacity-70'
          : 'border-[var(--line)] border-l-[var(--c2)] bg-[var(--surface2)] hover:bg-[var(--hi)] cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Kanban className="w-4 h-4 text-emerald-500 shrink-0" />
        <div>
          <div className="font-semibold text-[var(--text)]">{data.title || 'Untitled'}</div>
          {!data.deleted && (
            <div className="text-[11px] text-[var(--muted)]">
              {data.boardName} &bull; {data.columnName}
            </div>
          )}
        </div>
      </div>
      {data.deleted ? (
        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)]">
          Deleted
        </span>
      ) : data.priority ? (
        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 bg-[var(--surface)] border border-[var(--line)] border-l-2 border-l-[var(--c2)] text-[var(--text)]">
          {data.priority}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Custom block for cardLink.
 */
export const CardLinkBlock = createReactBlockSpec(
  {
    type: 'cardLink',
    propSchema: {
      cardId: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const { cardId } = props.block.props;
      return <LiveCardLink cardId={cardId} />;
    },
  },
);

/**
 * Live board link preview component — flat Basalt surface, angular.
 */
function LiveBoardLink({ boardId }: { boardId: string }) {
  const [data, setData] = useState<{
    name: string;
    deleted: boolean;
  } | null>(null);

  useEffect(() => {
    fetch(`/api/boards/${boardId}`)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((json: any) =>
        setData({ name: json.name, deleted: false }),
      )
      .catch(() => setData({ name: 'Deleted Board', deleted: true }));
  }, [boardId]);

  if (!data) {
    return (
      <div className="my-2 p-2.5 border border-[var(--line)] bg-[var(--surface2)] flex items-center gap-2 text-xs text-[var(--muted)]">
        <Layout className="w-3.5 h-3.5 text-blue-400" />
        <span>Loading board…</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        if (!data.deleted) {
          const pid = window.location.pathname.split('/')[2];
          if (pid) {
            window.location.href = `/p/${pid}/boards/${boardId}`;
          }
        }
      }}
      className={`my-2 p-3 border border-l-4 flex items-center justify-between gap-3 text-sm transition select-none ${
        data.deleted
          ? 'border-[var(--line)] bg-[var(--surface2)] text-[var(--muted)] opacity-70'
          : 'border-[var(--line)] border-l-blue-500 bg-[var(--surface2)] hover:bg-[var(--hi)] cursor-pointer'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Layout className="w-4 h-4 text-blue-500 shrink-0" />
        <span className="font-semibold text-[var(--text)]">{data.name || 'Untitled Board'}</span>
      </div>
      {data.deleted && (
        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 bg-[var(--surface)] border border-[var(--line)] text-[var(--muted)]">
          Deleted
        </span>
      )}
    </div>
  );
}

/**
 * Custom block for boardLink.
 */
export const BoardLinkBlock = createReactBlockSpec(
  {
    type: 'boardLink',
    propSchema: {
      boardId: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const { boardId } = props.block.props;
      return <LiveBoardLink boardId={boardId} />;
    },
  },
);

/**
 * Burrow BlockNote schema combining default blocks with custom mentions and link blocks.
 */
export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    notepadLink: NotepadLinkBlock(),
    cardLink: CardLinkBlock(),
    boardLink: BoardLinkBlock(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: Mention,
  },
});

export type BurrowSchema = typeof schema;
