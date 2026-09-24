import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useUpdateCard } from '../../../lib/queries'
import { PRIORITY_DOTS, type CardItem, type ColumnItem } from './types'

interface CalendarViewProps {
  boardId: string
  columns: ColumnItem[]
  onCardClick: (cardId: string) => void
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function CalendarChip({
  card,
  onClick,
  overlay = false,
}: {
  card: CardItem
  onClick?: () => void
  overlay?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `cal:${card.id}`,
    disabled: overlay,
  })

  const overdue = card.dueDate != null && card.dueDate < Date.now()

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`flex cursor-grab items-center gap-1 truncate rounded-md border border-neutral-200/80 bg-white px-1.5 py-0.5 text-[11px] text-neutral-700 shadow-xs transition select-none active:cursor-grabbing hover:border-neutral-300 dark:border-neutral-800/80 dark:bg-neutral-900 dark:text-neutral-300 ${
        isDragging ? 'opacity-30' : ''
      } ${overlay ? 'rotate-2 scale-105 shadow-lg' : ''} ${overdue ? 'border-rose-300 dark:border-rose-900/60' : ''}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
          card.priority ? PRIORITY_DOTS[card.priority] ?? 'bg-neutral-400' : 'bg-neutral-300'
        }`}
      />
      <span className="truncate">{card.title || 'Untitled'}</span>
    </div>
  )
}

function DayCell({
  date,
  inMonth,
  isToday,
  cards,
  onCardClick,
}: {
  date: Date
  inMonth: boolean
  isToday: boolean
  cards: CardItem[]
  onCardClick: (cardId: string) => void
}) {
  const key = dayKey(date)
  const { setNodeRef, isOver } = useDroppable({ id: `day:${key}` })

  return (
    <div
      ref={setNodeRef}
      className={`min-h-28 rounded-lg border p-1.5 transition-colors ${
        isOver
          ? 'border-primary/70 bg-primary/5 ring-2 ring-primary/30'
          : 'border-neutral-200/70 dark:border-neutral-800/70'
      } ${!inMonth ? 'bg-neutral-50/60 opacity-50 dark:bg-neutral-950/40' : ''}`}
    >
      <div className="mb-1 flex items-center justify-between px-0.5">
        <span
          className={`text-[11px] font-semibold tabular-nums ${
            isToday
              ? 'flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white'
              : inMonth
                ? 'text-neutral-600 dark:text-neutral-300'
                : 'text-neutral-400'
          }`}
        >
          {date.getDate()}
        </span>
      </div>
      <div className="space-y-1">
        {cards.map((card) => (
          <CalendarChip key={card.id} card={card} onClick={() => onCardClick(card.id)} />
        ))}
      </div>
    </div>
  )
}

/**
 * Monthly grid placing cards by `dueDate` (FEATURE_PLAN 2.2).
 * Drag a chip (scheduled or from the Unscheduled tray) onto a day to reschedule.
 */
export function CalendarView({ boardId, columns, onCardClick }: CalendarViewProps) {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [activeCard, setActiveCard] = useState<CardItem | null>(null)
  const updateCard = useUpdateCard()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const allCards = useMemo(() => columns.flatMap((c) => c.cards), [columns])

  const { scheduledByDay, unscheduled } = useMemo(() => {
    const byDay = new Map<string, CardItem[]>()
    const noDate: CardItem[] = []
    for (const card of allCards) {
      if (card.dueDate == null) {
        noDate.push(card)
        continue
      }
      const key = dayKey(new Date(card.dueDate))
      const list = byDay.get(key)
      if (list) list.push(card)
      else byDay.set(key, [card])
    }
    return { scheduledByDay: byDay, unscheduled: noDate }
  }, [allCards])

  const days = useMemo(() => {
    const year = monthCursor.getFullYear()
    const month = monthCursor.getMonth()
    const first = new Date(year, month, 1)
    const gridStart = new Date(year, month, 1 - first.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart)
      d.setDate(gridStart.getDate() + i)
      return d
    })
  }, [monthCursor])

  const todayKey = dayKey(new Date())

  const shiftMonth = (delta: number) =>
    setMonthCursor((cur) => new Date(cur.getFullYear(), cur.getMonth() + delta, 1))

  const handleDragStart = (event: DragStartEvent) => {
    const raw = String(event.active.id)
    if (!raw.startsWith('cal:')) return
    const id = raw.slice(4)
    setActiveCard(allCards.find((c) => c.id === id) ?? null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveCard(null)
    const { active, over } = event
    if (!over) return

    const rawActive = String(active.id)
    const rawOver = String(over.id)
    if (!rawActive.startsWith('cal:') || !rawOver.startsWith('day:')) return

    const cardId = rawActive.slice(4)
    const key = rawOver.slice(4)
    const card = allCards.find((c) => c.id === cardId)
    if (!card) return

    // Same day? nothing to do.
    if (card.dueDate != null && dayKey(new Date(card.dueDate)) === key) return

    // Keep the original time-of-day, move only the date (local time).
    const parts = key.split('-').map(Number)
    const [y, m, d] = parts
    if (!y || !m || !d) return

    const src = card.dueDate != null ? new Date(card.dueDate) : null
    const next = new Date(
      y,
      m - 1,
      d,
      src ? src.getHours() : 12,
      src ? src.getMinutes() : 0,
      src ? src.getSeconds() : 0,
      src ? src.getMilliseconds() : 0,
    )
    updateCard.mutate({ cardId, boardId, dueDate: next.getTime() })
  }

  const monthLabel = monthCursor.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            {monthLabel}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            const now = new Date()
            setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1))
          }}
          className="rounded-lg border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          Today
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Unscheduled tray: cards without a due date (drag onto a day) */}
        {unscheduled.length > 0 && (
          <div className="mb-3 rounded-xl border border-dashed border-neutral-300 p-2 dark:border-neutral-700">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
              <CalendarDays className="h-3 w-3" />
              Unscheduled
            </div>
            <div className="flex flex-wrap gap-1.5">
              {unscheduled.map((card) => (
                <CalendarChip
                  key={card.id}
                  card={card}
                  onClick={() => onCardClick(card.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1.5 pb-1">
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="px-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Month grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((date) => {
            const key = dayKey(date)
            return (
              <DayCell
                key={key}
                date={date}
                inMonth={date.getMonth() === monthCursor.getMonth()}
                isToday={key === todayKey}
                cards={scheduledByDay.get(key) ?? []}
                onCardClick={onCardClick}
              />
            )
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeCard ? <CalendarChip card={activeCard} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
