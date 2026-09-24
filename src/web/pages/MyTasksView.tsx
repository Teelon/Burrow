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

type StatusFilter = 'all' | 'open' | 'completed'

const PRIORITY_BADGES: Record<string, { label: string; class: string }> = {
  low: { label: 'Low', class: 'bg-slate-100 text-slate-700 dark:bg-slate-900/60 dark:text-slate-300' },
  medium: { label: 'Medium', class: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' },
  high: { label: 'High', class: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
  urgent: { label: 'Urgent', class: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
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

  return (
    <div
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800/80 shadow-xs hover:border-neutral-300 dark:hover:border-neutral-700 hover:shadow-sm transition"
    >
      {/* Complete checkbox */}
      <button
        onClick={onComplete}
        title={task.isCompleted ? 'Mark as open' : 'Mark as complete'}
        className={`shrink-0 transition ${
          task.isCompleted
            ? 'text-emerald-500 hover:text-emerald-600'
            : 'text-neutral-300 dark:text-neutral-600 hover:text-emerald-500'
        }`}
      >
        {task.isCompleted ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <Circle className="w-5 h-5" />
        )}
      </button>

      {/* Title + meta */}
      <button onClick={onOpen} className="flex-1 min-w-0 text-left space-y-1">
        <div
          className={`text-sm font-medium leading-snug truncate ${
            task.isCompleted
              ? 'text-neutral-400 line-through'
              : 'text-neutral-900 dark:text-neutral-100'
          }`}
        >
          {task.title || 'Untitled'}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-neutral-400">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-medium">
            <span>{task.projectIcon || '📁'}</span>
            <span className="truncate max-w-[140px]">{task.projectName}</span>
          </span>
          <span className="text-neutral-300 dark:text-neutral-600">·</span>
          <span className="truncate max-w-[140px]">
            {task.boardName} / {task.columnName}
          </span>
          {task.tags.map((tag) => (
            <span
              key={tag.id}
              className="px-1.5 py-0.5 rounded font-medium"
              style={{
                backgroundColor: `${tag.color || '#64748b'}20`,
                color: tag.color || '#64748b',
              }}
            >
              #{tag.name}
            </span>
          ))}
        </div>
      </button>

      {/* Right side: priority, due date, snooze */}
      <div className="flex items-center gap-2 shrink-0">
        {task.priority && PRIORITY_BADGES[task.priority] && (
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              PRIORITY_BADGES[task.priority]!.class
            }`}
          >
            {PRIORITY_BADGES[task.priority]!.label}
          </span>
        )}

        {task.dueDate !== null && (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
              overdue ? 'text-rose-500' : 'text-neutral-400'
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
            className="p-1 rounded-md text-neutral-300 dark:text-neutral-600 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 opacity-0 group-hover:opacity-100 transition"
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
      <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        {title}
      </h2>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-200/70 dark:bg-neutral-800 text-neutral-500 font-medium">
        {count}
      </span>
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

  const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
    { value: 'open', label: 'Open' },
    { value: 'completed', label: 'Completed' },
    { value: 'all', label: 'All' },
  ]

  return (
    <div className="h-full overflow-y-auto bg-neutral-50/40 dark:bg-neutral-950/40">
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <Inbox className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              My Tasks
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Status tabs */}
            <div className="flex items-center p-0.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatus(tab.value)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    status === tab.value
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Project filter */}
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="px-2.5 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl text-xs outline-none text-neutral-700 dark:text-neutral-300"
            >
              <option value="all">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon || '📁'} {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grouped task sections */}
        {isLoading ? (
          <div className="py-16 text-center text-sm text-neutral-400">Loading tasks…</div>
        ) : tasks.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-2 text-neutral-400">
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
              tone="text-rose-500"
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
              tone="text-amber-500"
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
              tone="text-emerald-500"
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
              tone="text-neutral-400"
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
              tone="text-emerald-500"
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
