import { useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { FileText, Kanban, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useBoards, useCreateBoard, useProjects, useRecentNotepads } from '../lib/queries';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PromptDialog } from '../components/ui/PromptDialog';

export function ProjectHome() {
  const navigate = useNavigate();
  const { projectId } = useParams({ strict: false }) as { projectId?: string };
  const { data: projects = [] } = useProjects();
  const project = projects.find((p) => p.id === projectId) || projects[0];
  const currentProjectId = project?.id;
  const { data: boards = [] } = useBoards(currentProjectId);
  const { data: recentNotepads = [] } = useRecentNotepads(currentProjectId);
  const createBoardMutation = useCreateBoard();
  const [createBoardOpen, setCreateBoardOpen] = useState(false);

  const handleCreateBoard = () => {
    if (!currentProjectId) return;
    setCreateBoardOpen(true);
  };

  return (
    <div className="flex-1 overflow-y-auto">
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-8">
      {/* Project Banner / Title */}
      <div className="space-y-2 border-b border-[var(--hair)] pb-6">
        <div className="text-4xl mb-2">{project?.icon || '📁'}</div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">
          {project?.name || 'Project Overview'}
        </h1>
        <p className="text-sm text-[var(--muted)]">
          Manage notepads, cards, and boards scoped to this project.
        </p>
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-sm text-[var(--text)]">
              <FileText className="w-4 h-4 text-[var(--accent)]" />
              <span>Notepads</span>
            </div>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Rich-text notes with nested tree organisation, slash commands, and covers.
          </p>
          <div className="pt-2 space-y-1">
            {recentNotepads.length === 0 ? (
              <span className="text-xs text-[var(--muted)] italic">
                No notepads yet. Click + in sidebar to create one.
              </span>
            ) : (
              recentNotepads.slice(0, 5).map((np) => (
                <Link
                  key={np.id}
                  to="/p/$projectId/notepads/$notepadId"
                  params={{
                    projectId: currentProjectId!,
                    notepadId: np.id,
                  }}
                  className="flex items-center gap-2 text-xs font-medium text-[var(--text)] hover:text-[var(--accent)] transition min-h-[44px] sm:min-h-0"
                >
                  <span>{np.icon || '📄'}</span>
                  <span className="truncate">{np.title || 'Untitled'}</span>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-sm text-[var(--text)]">
              <Kanban className="w-4 h-4 text-emerald-500" />
              <span>Kanban Boards</span>
            </div>
            <Button
              variant="ghost"
              onClick={handleCreateBoard}
              className="p-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 text-[var(--muted)] hover:text-[var(--text)]"
              title="Add Board"
            >
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Visual task boards with drag-and-drop columns, priorities, assignees, and quick-add.
          </p>
          <div className="pt-2 space-y-1">
            {boards.length === 0 ? (
              <span className="text-xs text-[var(--muted)] italic">
                No boards yet. Click + to create one.
              </span>
            ) : (
              boards.map((b) => (
                <Link
                  key={b.id}
                  to="/p/$projectId/boards/$boardId"
                  params={{
                    projectId: currentProjectId!,
                    boardId: b.id,
                  }}
                  className="block text-xs font-medium text-[var(--text)] hover:text-[var(--accent)] transition min-h-[44px] sm:min-h-0"
                >
                  {b.icon || '📋'} {b.name}
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>

    <PromptDialog
      open={createBoardOpen}
      title="Create Board"
      message="Enter a name for the new board."
      defaultValue="Sprint Board"
      placeholder="Board name"
      confirmLabel="Create"
      busy={createBoardMutation.isPending}
      onConfirm={async (name) => {
        if (!currentProjectId) return;
        try {
          const res = await createBoardMutation.mutateAsync({
            projectId: currentProjectId,
            name,
          });
          setCreateBoardOpen(false);
          navigate({
            to: '/p/$projectId/boards/$boardId',
            params: {
              projectId: currentProjectId,
              boardId: res.id,
            },
          });
        } catch (err: any) {
          toast.error(err?.message || 'Failed to create board');
        }
      }}
      onCancel={() => setCreateBoardOpen(false)}
    />
    </div>
  );
}
