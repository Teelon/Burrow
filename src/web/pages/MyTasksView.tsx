import { useMemo, useState } from 'react'
import {
  AlarmClock,
  Calendar,
  CheckCircle2,
  Circle,
  Inbox,
  ListTodo,
} from 'lucide-react'
import {
  useBoard,
  useMoveCard,
  useMyTasks,
  useProjects,
  useUpdateCard,
  type MyTaskItem,
} from '../lib/queries'
import { CardPanel } from '../components/boards/CardPanel'
import { api } from '../lib/api'
import { Badge } from '../components/ui/Badge'
import { Select } from '../components/ui/Select'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { StatusDiamond } from '../components/ui/StatusDiamond'

type StatusFilter = 'all' | 'open' | 'completed'

// Basalt Layer-4 priority adapter: angular token classes. Export shape preserved.
const PRIORITY_BADGES: Record<string, { label: string; class: string }> = {
  low: { label: 'Low', class: 'border-l-[var(--c4)]' },
  medium: { label: 'Medium', class: 'border-l-[var(--c3)]' },
  high: { label: 'High', class: 'border-l-[var(--c2)]' },
  urgent: { label: 'Urgent', class: 'border-l-[var(--danger)]' },
}

const PRIORITY_DIAMONDS: Record<string, string> = {
  low: 'var(--c4)',
  medium: 'var(--c3)',
  high: 'var(--c2)',
  urgent: 'var(--danger)',
}

function startOfToday(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function formatDue(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function TaskRow({
  task,
  onOpen,
  onComplete,
  onSnooze,
}: {
  task: MyTaskItem
  onOpen: () => void
  onComplete: () => void
  onSnooze: () => void
}) {
  const overdue = !task.isCompleted && task.dueDate !== null && task.dueDate < startOfToday()
  const priority = task.priority ? PRIORITY_BADGES[task.priority] : undefined
  const diamond = task.priority ? PRIORITY_DIAMONDS[task.priority] : undefined

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2.5 bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--hi)] transition ${
        priority ? `border-l-4 ${priority.class}` : ''
      }`}
    >
      {/* Complete checkbox */}
      <button
        onClick={onComplete}
        title={task.isCompleted ? 'Mark as open' : 'Mark as complete'}
        className={`shrink-0 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 flex items-center justify-center transition ${
          task.isCompleted
            ? 'text-[var(--c4)] hover:brightness-110'
            : 'text-[var(--muted)] hover:text-[var(--c4)]'
        }`}
      >
        {task.isCompleted ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <Circle className="w-5 h-5" />
        )}
      </button>

      {/* Title + meta */}
      <button onClick={onOpen} className="flex-1 min-w-0 text-left space-y-1 min-h-[44px] sm:min-h-0">
        <div
          className={`text-sm font-medium leading-snug truncate ${
            task.isCompleted
              ? 'text-[var(--muted)] line-through'
              : 'text-[var(--text)]'
          }`}
        >
          {task.title || 'Untitled'}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-[var(--muted)]">
          <Badge>
            <span>{task.projectIcon || '📁'}</span>
            <span className="truncate max-w-[140px]">{task.projectName}</span>
          </Badge>
          <span className="text-[var(--muted)]">·</span>
          <span className="truncate max-w-[140px]">
            {task.boardName} / {task.columnName}
          </span>
          {task.tags.map((tag) => (
            <span
              key={tag.id}
              className="px-1.5 py-0.5 font-medium border-l-2"
              style={{ borderLeftColor: tag.color || '#64748b', backgroundColor: 'var(--surface2)' }}
            >
              #{tag.name}
            </span>
          ))}
        </div>
      </button>

      {/* Right side: priority, due date, snooze */}
      <div className="flex items-center gap-2 shrink-0">
        {priority && (
          <Badge className={priority.class}>
            <StatusDiamond color={diamond ?? 'var(--c1)'} size={6} />
            {priority.label}
          </Badge>
        )}

        {task.dueDate !== null && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
              overdue ? 'text-[var(--danger)]' : 'text-[var(--muted)]'
            }`}
          >
            <Calendar className="w-3 h-3" />
            {formatDue(task.dueDate)}
          </span>
        )}

        {!task.isCompleted && (
          <button
            onClick={onSnooze}
            title="Snooze to tomorrow"
            className="p-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 text-[var(--muted)] hover:text-[var(--c2)] hover:bg-[var(--hi)] opacity-0 group-hover:opacity-100 transition"
          >
            <AlarmClock className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  count,
  tone,
}: {
  icon: React.ReactNode
  title: string
  count: number
  tone: string
}) {
  if (count === 0) return null
  return (
    <div className="flex items-center gap-2 pt-3 pb-1.5">
      <span className={tone}>{icon}</span>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        {title}
      </h2>
      <Badge>{count}</Badge>
    </div>
  )
}

export function MyTasksView() {
  const [status, setStatus] = useState<StatusFilter>('open')
  const [projectId, setProjectId] = useState<string>('all')
  const [selected, setSelected] = useState<MyTaskItem | null>(null)

  const { data: tasks = [], isLoading } = useMyTasks({
    status,
    projectId: projectId === 'all' ? undefined : projectId,
  })
  const { data: projects = [] } = useProjects()
  const moveCardMutation = useMoveCard()
  const updateCardMutation = useUpdateCard()

  // Columns for the open CardPanel (needed for the status dropdown).
  const { data: openBoard } = useBoard(selected?.boardId)
  const panelColumns = useMemo(
    () => (openBoard?.columns || []).map((c: any) => ({ id: c.id, name: c.name })),
    [openBoard],
  )

  const groups = useMemo(() => {
    const todayStart = startOfToday()
    const todayEnd = todayStart + 86_400_000
    const weekEnd = todayStart + 7 * 86_400_000

    const overdue: MyTaskItem[] = []
    const today: MyTaskItem[] = []
    const upcoming: MyTaskItem[] = []
    const later: MyTaskItem[] = []
    const completed: MyTaskItem[] = []

    for (const task of tasks) {
      if (task.isCompleted) {
        completed.push(task)
        continue
      }
      if (task.dueDate === null) {
        later.push(task)
      } else if (task.dueDate < todayStart) {
        overdue.push(task)
      } else if (task.dueDate < todayEnd) {
        today.push(task)
      } else if (task.dueDate < weekEnd) {
        upcoming.push(task)
      } else {
        later.push(task)
      }
    }

    const byDue = (a: MyTaskItem, b: MyTaskItem) =>
      (a.dueDate ?? Number.MAX_SAFE_INTEGER) - (b.dueDate ?? Number.MAX_SAFE_INTEGER)
    overdue.sort(byDue)
    today.sort(byDue)
    upcoming.sort(byDue)
    completed.sort((a, b) => b.createdAt - a.createdAt)

    return { overdue, today, upcoming, later, completed }
  }, [tasks])

  const handleComplete = (task: MyTaskItem) => {
    if (task.isCompleted) {
      // Re-open: move back to the first non-done column on its board.
      ;(async () => {
        try {
          const res = await api.api.boards[':id'].$get({ param: { id: task.boardId } })
          if (!res.ok) return
          const board = (await res.json()) as { columns: Array<{ id: string; name: string }> }
          const openCol = board.columns.find(
            (c) => !/done|completed|closed|shipped/i.test(c.name),
          )
          if (openCol) {
            moveCardMutation.mutate({
              cardId: task.id,
              boardId: task.boardId,
              columnId: openCol.id,
            })
          }
        } catch {
          /* ignore */
        }
      })()
      return
    }

    // Complete: move into the board's Done/Completed column.
    ;(async () => {
      try {
        const res = await api.api.boards[':id'].$get({ param: { id: task.boardId } })
        if (!res.ok) return
        const board = (await res.json()) as { columns: Array<{ id: string; name: string }> }
        const doneCol = board.columns.find((c) =>
          /done|completed|closed|shipped/i.test(c.name),
        )
        if (!doneCol) {
          window.alert(
            `"${task.boardName}" has no Done/Completed column to move this card into.`,
          )
          return
        }
        moveCardMutation.mutate({
          cardId: task.id,
          boardId: task.boardId,
          columnId: doneCol.id,
        })
      } catch {
        /* ignore */
      }
    })()
  }

  const handleSnooze = (task: MyTaskItem) => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    updateCardMutation.mutate({
      cardId: task.id,
      boardId: task.boardId,
      dueDate: tomorrow.getTime(),
    })
  }

  return (
    <div className="h-full overflow-y-auto bg-[var(--bg)]">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Inbox className="w-6 h-6 text-[var(--accent)]" />
            <h1 className="text-2xl font-bold text-[var(--text)]">
              My Tasks
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Status tabs — geometric segmented control */}
            <SegmentedControl
              value={status}
              onValueChange={(v) => setStatus(v as StatusFilter)}
              options={[
                { value: 'open', label: 'Open' },
                { value: 'completed', label: 'Completed' },
                { value: 'all', label: 'All' },
              ]}
            />

            {/* Project filter */}
            <Select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="px-2.5 py-1.5 text-xs min-h-[44px] sm:min-h-0"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon || '📁'} {p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Grouped task sections */}
        {isLoading ? (
          <div className="py-16 text-center text-sm text-[var(--muted)]">Loading tasks…</div>
        ) : tasks.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-[var(--muted)]">
            <ListTodo className="w-8 h-8" />
            <p className="text-sm">
              {status === 'completed'
                ? 'No completed tasks yet.'
                : 'No tasks assigned to you. Enjoy the quiet!'}
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            <SectionHeader
              icon={<AlarmClock className="w-4 h-4" />}
              title="Overdue"
              count={groups.overdue.length}
              tone="text-[var(--danger)]"
            />
            {groups.overdue.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => setSelected(task)}
                onComplete={() => handleComplete(task)}
                onSnooze={() => handleSnooze(task)}
              />
            ))}

            <SectionHeader
              icon={<Calendar className="w-4 h-4" />}
              title="Due Today"
              count={groups.today.length}
              tone="text-[var(--c2)]"
            />
            {groups.today.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => setSelected(task)}
                onComplete={() => handleComplete(task)}
                onSnooze={() => handleSnooze(task)}
              />
            ))}

            <SectionHeader
              icon={<Calendar className="w-4 h-4" />}
              title="Upcoming / This Week"
              count={groups.upcoming.length}
              tone="text-[var(--c4)]"
            />
            {groups.upcoming.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => setSelected(task)}
                onComplete={() => handleComplete(task)}
                onSnooze={() => handleSnooze(task)}
              />
            ))}

            <SectionHeader
              icon={<ListTodo className="w-4 h-4" />}
              title="Later & No Due Date"
              count={groups.later.length}
              tone="text-[var(--muted)]"
            />
            {groups.later.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => setSelected(task)}
                onComplete={() => handleComplete(task)}
                onSnooze={() => handleSnooze(task)}
              />
            ))}

            <SectionHeader
              icon={<CheckCircle2 className="w-4 h-4" />}
              title="Completed"
              count={groups.completed.length}
              tone="text-[var(--c4)]"
            />
            {groups.completed.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => setSelected(task)}
                onComplete={() => handleComplete(task)}
                onSnooze={() => handleSnooze(task)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Card side panel */}
      {selected && (
        <CardPanel
          cardId={selected.id}
          boardId={selected.boardId}
          projectId={selected.projectId}
          columns={panelColumns}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
