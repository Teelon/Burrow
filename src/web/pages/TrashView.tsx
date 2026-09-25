import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { FileText, Kanban, RefreshCw, Trash2 } from 'lucide-react';
import {
  usePermanentDeleteBoard,
  usePermanentDeleteNotepad,
  useProjects,
  useRestoreBoard,
  useRestoreNotepad,
  useTrash,
} from '../lib/queries';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SegmentedControl } from '../components/ui/SegmentedControl';

export function TrashView() {
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const { data: projects = [] } = useProjects();
  const project = projects.find((p) => p.id === projectId) || projects[0];
  const currentProjectId = project?.id;

  const { data: trash, isLoading } = useTrash(currentProjectId);
  const restoreNotepad = useRestoreNotepad();
  const permanentDeleteNotepad = usePermanentDeleteNotepad();
  const restoreBoard = useRestoreBoard();
  const permanentDeleteBoard = usePermanentDeleteBoard();

  const [activeTab, setActiveTab] = useState<'all' | 'notepads' | 'boards'>('all');
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'notepad' | 'board';
    id: string;
    name: string;
  } | null>(null);

  const notepads = trash?.notepads || [];
  const boards = trash?.boards || [];

  const handleRestoreNotepad = (notepadId: string) => {
    if (!currentProjectId) return;
    restoreNotepad.mutate({ notepadId, projectId: currentProjectId });
  };

  const handlePermanentDeleteNotepad = (notepadId: string, title: string) => {
    if (!currentProjectId) return;
    setConfirmDelete({ type: 'notepad', id: notepadId, name: title });
  };

  const handleRestoreBoard = (boardId: string) => {
    if (!currentProjectId) return;
    restoreBoard.mutate({ boardId, projectId: currentProjectId });
  };

  const handlePermanentDeleteBoard = (boardId: string, name: string) => {
    if (!currentProjectId) return;
    setConfirmDelete({ type: 'board', id: boardId, name });
  };

  const totalCount = notepads.length + boards.length;

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--hair)] pb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text)] flex items-center gap-2.5">
            <Trash2 className="w-6 h-6 text-[var(--danger)]" />
            <span>Trash</span>
          </h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Items in trash for project <span className="font-semibold">{project?.name}</span>.
            Restored notepads are re-attached to their parent, or to the project root if the parent
            is still in trash.
          </p>
        </div>

        {/* Tab filters — geometric segmented control */}
        <SegmentedControl
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'all' | 'notepads' | 'boards')}
          options={[
            { value: 'all', label: `All (${totalCount})` },
            { value: 'notepads', label: `Notepads (${notepads.length})` },
            { value: 'boards', label: `Boards (${boards.length})` },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-[var(--muted)]">Loading trash…</div>
      ) : totalCount === 0 ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-12 h-12 bg-[var(--surface2)] border border-[var(--line)] flex items-center justify-center mx-auto text-[var(--muted)]">
            <Trash2 className="w-6 h-6" />
          </div>
          <div className="text-sm font-semibold text-[var(--text)]">Trash is empty</div>
          <p className="text-xs text-[var(--muted)] max-w-sm mx-auto">
            Deleted notepads and boards will appear here. You can restore them or permanently delete
            them anytime.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Trashed Notepads */}
          {(activeTab === 'all' || activeTab === 'notepads') &&
            notepads.map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-[var(--surface)] border border-[var(--line)] border-l-4 border-l-[var(--c1)] flex items-center justify-between gap-3 hover:bg-[var(--hi)] transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-[var(--surface2)] border border-[var(--line)] flex items-center justify-center shrink-0 text-base">
                    {item.icon || <FileText className="w-4 h-4 text-purple-500" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)] truncate">
                      {item.title || 'Untitled'}
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">
                      Deleted {new Date(item.deletedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    onClick={() => handleRestoreNotepad(item.id)}
                    className="px-2.5 py-1.5 text-xs font-semibold min-h-[44px] sm:min-h-0 flex items-center gap-1.5"
                    title="Restore"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handlePermanentDeleteNotepad(item.id, item.title)}
                    className="px-2.5 py-1.5 text-xs font-semibold min-h-[44px] sm:min-h-0 flex items-center gap-1.5"
                    title="Permanently Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </Button>
                </div>
              </div>
            ))}

          {/* Trashed Boards */}
          {(activeTab === 'all' || activeTab === 'boards') &&
            boards.map((b) => (
              <div
                key={b.id}
                className="p-3.5 bg-[var(--surface)] border border-[var(--line)] border-l-4 border-l-[var(--c2)] flex items-center justify-between gap-3 hover:bg-[var(--hi)] transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-[var(--surface2)] border border-[var(--line)] flex items-center justify-center shrink-0 text-base">
                    {b.icon || <Kanban className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[var(--text)] truncate">
                      {b.name || 'Untitled Board'}
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">
                      Deleted {new Date(b.deletedAt).toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="secondary"
                    onClick={() => handleRestoreBoard(b.id)}
                    className="px-2.5 py-1.5 text-xs font-semibold min-h-[44px] sm:min-h-0 flex items-center gap-1.5"
                    title="Restore"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Restore</span>
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => handlePermanentDeleteBoard(b.id, b.name)}
                    className="px-2.5 py-1.5 text-xs font-semibold min-h-[44px] sm:min-h-0 flex items-center gap-1.5"
                    title="Permanently Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </Button>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>

    {confirmDelete && (
      <ConfirmDialog
        open
        title={`Permanently delete ${confirmDelete.type === 'notepad' ? 'notepad' : 'board'}?`}
        message={
          confirmDelete.type === 'notepad'
            ? `Are you sure you want to permanently delete "${confirmDelete.name}"? This cannot be undone.`
            : `Are you sure you want to permanently delete board "${confirmDelete.name}" and all its cards? This cannot be undone.`
        }
        confirmLabel="Permanently Delete"
        danger
        busy={permanentDeleteNotepad.isPending || permanentDeleteBoard.isPending}
        onConfirm={async () => {
          if (!currentProjectId) return;
          try {
            if (confirmDelete.type === 'notepad') {
              await permanentDeleteNotepad.mutateAsync({
                notepadId: confirmDelete.id,
                projectId: currentProjectId,
              });
            } else {
              await permanentDeleteBoard.mutateAsync({
                boardId: confirmDelete.id,
                projectId: currentProjectId,
              });
            }
            setConfirmDelete(null);
          } catch {
            setConfirmDelete(null);
          }
        }}
        onCancel={() => setConfirmDelete(null)}
      />
    )}
    </div>
  );
}
