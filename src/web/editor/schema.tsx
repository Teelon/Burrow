import { useEffect, useState } from 'react'
import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
} from '@blocknote/core'
import {
  createReactInlineContentSpec,
  createReactBlockSpec,
} from '@blocknote/react'
import { Calendar, FileText, Kanban, User } from 'lucide-react'

/**
 * Custom inline mention content spec.
 */
export const Mention = createReactInlineContentSpec(
  {
    type: 'mention',
    propSchema: {
      kind: {
        default: 'user',
        values: ['user', 'notepad', 'card', 'date'] as const,
      },
      id: { default: '' },
      label: { default: '' },
      isoDate: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const { kind, label, isoDate } = props.inlineContent.props

      if (kind === 'date') {
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 select-none">
            <Calendar className="w-3 h-3 text-neutral-500" />
            <span>{label || isoDate || 'Date'}</span>
          </span>
        )
      }

      if (kind === 'user') {
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 select-none">
            <User className="w-3 h-3 text-blue-500" />
            <span>@{label || 'Former member'}</span>
          </span>
        )
      }

      if (kind === 'notepad') {
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 select-none cursor-pointer hover:underline">
            <FileText className="w-3 h-3 text-purple-500" />
            <span>{label || 'Deleted notepad'}</span>
          </span>
        )
      }

      if (kind === 'card') {
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 select-none cursor-pointer hover:underline">
            <Kanban className="w-3 h-3 text-emerald-500" />
            <span>{label || 'Deleted card'}</span>
          </span>
        )
      }

      return <span>@{label}</span>
    },
  },
)

/**
 * Live notepad link preview component
 */
function LiveNotepadLink({ notepadId }: { notepadId: string }) {
  const [data, setData] = useState<{ title: string; icon?: string | null; deleted: boolean } | null>(null)

  useEffect(() => {
    fetch(`/api/notepads/${notepadId}`)
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((json: any) => setData({ title: json.title, icon: json.icon, deleted: !!json.deletedAt }))
      .catch(() => setData({ title: 'Deleted Notepad', deleted: true }))
  }, [notepadId])

  if (!data) {
    return (
      <div className="my-2 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 flex items-center gap-2 text-xs text-neutral-400">
        <FileText className="w-3.5 h-3.5 text-purple-400" />
        <span>Loading notepad…</span>
      </div>
    )
  }

  return (
    <div
      onClick={() => {
        if (!data.deleted) {
          const pid = window.location.pathname.split('/')[2]
          if (pid) {
            window.location.href = `/p/${pid}/notepads/${notepadId}`
          }
        }
      }}
      className={`my-2 p-3 border rounded-xl flex items-center justify-between gap-3 text-sm transition cursor-pointer select-none ${
        data.deleted
          ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 text-neutral-400 opacity-70'
          : 'border-purple-200/80 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-950/20 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-xs'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-base">{data.icon || '📄'}</span>
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
          {data.title || 'Untitled'}
        </span>
      </div>
      {data.deleted && (
        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-500">
          Deleted
        </span>
      )}
    </div>
  )
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
      const { notepadId } = props.block.props
      return <LiveNotepadLink notepadId={notepadId} />
    },
  },
)

function LiveCardLink({ cardId }: { cardId: string }) {
  const [data, setData] = useState<{
    title: string
    boardName: string
    columnName: string
    priority?: string | null
    deleted: boolean
  } | null>(null)

  useEffect(() => {
    fetch(`/api/cards/summary?ids=${cardId}`)
      .then((res) => {
        if (!res.ok) throw new Error()
        return res.json()
      })
      .then((list: any[]) => {
        if (list.length > 0) {
          const item = list[0]
          setData({
            title: item.title,
            boardName: item.boardName,
            columnName: item.columnName,
            priority: item.priority,
            deleted: false,
          })
        } else {
          setData({ title: 'Deleted Card', boardName: '', columnName: '', deleted: true })
        }
      })
      .catch(() => setData({ title: 'Deleted Card', boardName: '', columnName: '', deleted: true }))
  }, [cardId])

  if (!data) {
    return (
      <div className="my-2 p-2.5 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 flex items-center gap-2 text-xs text-neutral-400">
        <Kanban className="w-3.5 h-3.5 text-emerald-400" />
        <span>Loading task card…</span>
      </div>
    )
  }

  return (
    <div
      className={`my-2 p-3 border rounded-xl flex items-center justify-between gap-3 text-sm transition select-none ${
        data.deleted
          ? 'border-neutral-200 dark:border-neutral-800 bg-neutral-100/50 dark:bg-neutral-900/30 text-neutral-400 opacity-70'
          : 'border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-xs'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Kanban className="w-4 h-4 text-emerald-500 shrink-0" />
        <div>
          <div className="font-semibold text-neutral-800 dark:text-neutral-200">
            {data.title || 'Untitled'}
          </div>
          {!data.deleted && (
            <div className="text-[11px] text-neutral-400">
              {data.boardName} &bull; {data.columnName}
            </div>
          )}
        </div>
      </div>
      {data.deleted ? (
        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-500">
          Deleted
        </span>
      ) : data.priority ? (
        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
          {data.priority}
        </span>
      ) : null}
    </div>
  )
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
      const { cardId } = props.block.props
      return <LiveCardLink cardId={cardId} />
    },
  },
)

/**
 * Burrow BlockNote schema combining default blocks with custom mentions and link blocks.
 */
export const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    notepadLink: NotepadLinkBlock(),
    cardLink: CardLinkBlock(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    mention: Mention,
  },
})

export type BurrowSchema = typeof schema
