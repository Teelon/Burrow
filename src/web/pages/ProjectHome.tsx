import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { FileText, Kanban, Plus } from 'lucide-react'
import { useBoards, useCreateBoard, useProjects } from '../lib/queries'

export function ProjectHome() {
  const navigate = useNavigate()
  const { projectId } = useParams({ strict: false }) as { projectId?: string }
  const { data: projects = [] } = useProjects()
  const project = projects.find((p) => p.id === projectId) || projects[0]
  const currentProjectId = project?.id
  const { data: boards = [] } = useBoards(currentProjectId)
  const createBoardMutation = useCreateBoard()

  const handleCreateBoard = async () => {
    if (!currentProjectId) return
    const name = window.prompt('New Board Name:', 'Sprint Board')
    if (!name?.trim()) return
    const res = await createBoardMutation.mutateAsync({
      projectId: currentProjectId,
      name: name.trim(),
    })
    navigate({
      to: '/p/$projectId/boards/$boardId',
      params: {
        projectId: currentProjectId,
        boardId: res.id,
      },
    })
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6 space-y-8">
      {/* Project Banner / Title */}
      <div className="space-y-2 border-b border-neutral-200/60 dark:border-neutral-800/60 pb-6">
        <div className="text-4xl mb-2">{project?.icon || '📁'}</div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          {project?.name || 'Project Overview'}
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Manage notepads, cards, and boards scoped to this project.
        </p>
      </div>

      {/* Quick Action Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900/50 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-sm">
              <FileText className="w-4 h-4 text-primary" />
              <span>Notepads</span>
            </div>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Rich-text notes with nested tree organisation, slash commands, and covers.
          </p>
          <div className="pt-2">
            <span className="text-xs text-neutral-400 italic">
              Create notepads from the sidebar (+)
            </span>
          </div>
        </div>

        <div className="p-5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-white dark:bg-neutral-900/50 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-medium text-sm">
              <Kanban className="w-4 h-4 text-emerald-500" />
              <span>Kanban Boards</span>
            </div>
            <button
              onClick={handleCreateBoard}
              className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700"
              title="Add Board"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Visual task boards with drag-and-drop columns, priorities, assignees, and quick-add.
          </p>
          <div className="pt-2 space-y-1">
            {boards.length === 0 ? (
              <span className="text-xs text-neutral-400 italic">
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
                  className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-primary transition"
                >
                  {b.icon || '📋'} {b.name}
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
