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
import { Button } from '../../ui/Button'
import { Chip } from '../../ui/Chip'
import { StatusDiamond } from '../../ui/StatusDiamond'
import { priorityDiamondColor } from '../../ui/status'
import { type CardItem, type ColumnItem } from './types'

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
    <Chip
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onClick}
      active={overlay}
      className={`cursor-grab truncate px-2 py-1 text-[11px] normal-case tracking-normal active:cursor-grabbing ${
        isDragging ? 'opacity-30' : ''
      } ${overlay ? 'rotate-2 scale-105' : ''} ${overdue ? 'border-[var(--danger)]' : ''}`}
    >
      <StatusDiamond color={priorityDiamondColor(card.priority)} />
      <span className="truncate">{card.title || 'Untitled'}</span>
    </Chip>
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
      className={`min-h-28 border p-1.5 transition-colors ${
        isOver
          ? 'border-[var(--accent)] bg-[var(--hi)]'
          : 'border-[var(--line)]'
      } ${!inMonth ? 'bg-[var(--surface2)]/60 opacity-50' : 'bg-[var(--surface)]/40'}`}
    >
      <div className="mb-1 flex items-center justify-between px-0.5">
        <span
          className={`text-[11px] font-semibold tabular-nums ${
            isToday
              ? 'chamfer-sm flex h-6 min-w-6 items-center justify-center bg-[var(--accent)] text-[var(--accent-ink)] px-1'
              : inMonth
                ? 'text-[var(--text)]'
                : 'text-[var(--muted)]'
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
    <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 bg-[var(--bg)] text-[var(--text)]">
      {/* Month navigation */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2
            className="text-sm md:text-base text-[var(--text)] uppercase tracking-wider"
            style={{ fontFamily: 'Archivo, sans-serif', fontVariationSettings: "'wdth' 122, 'wght' 800" }}
          >
            {monthLabel}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--muted)] hover:bg-[var(--hi)] hover:text-[var(--text)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--muted)] hover:bg-[var(--hi)] hover:text-[var(--text)]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const now = new Date()
            setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1))
          }}
        >
          Today
        </Button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Unscheduled tray: cards without a due date (drag onto a day) */}
        {unscheduled.length > 0 && (
          <div className="mb-3 border border-dashed border-[var(--line)] bg-[var(--surface2)] p-2">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
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
              className="px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]"
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
