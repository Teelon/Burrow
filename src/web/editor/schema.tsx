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
      return (
        <div className="my-2 p-3 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between gap-3 text-sm hover:border-neutral-300 dark:hover:border-neutral-700 transition">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-500 shrink-0" />
            <span className="font-medium text-neutral-800 dark:text-neutral-200">
              Linked Notepad
            </span>
          </div>
          <span className="text-xs font-mono text-neutral-400">{notepadId}</span>
        </div>
      )
    },
  },
)

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
      return (
        <div className="my-2 p-3 border border-neutral-200 dark:border-neutral-800 rounded-xl bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between gap-3 text-sm hover:border-neutral-300 dark:hover:border-neutral-700 transition">
          <div className="flex items-center gap-2">
            <Kanban className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="font-medium text-neutral-800 dark:text-neutral-200">
              Linked Task Card
            </span>
          </div>
          <span className="text-xs font-mono text-neutral-400">{cardId}</span>
        </div>
      )
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
