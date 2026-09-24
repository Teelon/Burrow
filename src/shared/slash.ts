export type SlashContext = 'notepad' | 'card' | 'quickadd'

export type SlashActionType =
  | 'basic'
  | 'list'
  | 'structure'
  | 'image'
  | 'notepad'
  | 'task'
  | 'board'
  | 'due'
  | 'priority'
  | 'assign'
  | 'tag'
  | 'move'
  | 'date'
  | 'mention'

export interface SlashCommand {
  id: string
  label: string
  aliases: string[]
  group: 'Basic' | 'Lists' | 'Structural' | 'Links & References' | 'Task & Metadata'
  contexts: SlashContext[]
  action: SlashActionType
  icon?: string
}

export const SLASH_COMMANDS: SlashCommand[] = [
  // Basic
  {
    id: 'text',
    label: 'Text',
    aliases: ['paragraph', 'p'],
    group: 'Basic',
    contexts: ['notepad', 'card'],
    action: 'basic',
    icon: 'Type',
  },
  {
    id: 'h1',
    label: 'Heading 1',
    aliases: ['heading', 'title', 'h1', 'large'],
    group: 'Basic',
    contexts: ['notepad', 'card'],
    action: 'basic',
    icon: 'Heading1',
  },
  {
    id: 'h2',
    label: 'Heading 2',
    aliases: ['heading', 'subheading', 'h2', 'medium'],
    group: 'Basic',
    contexts: ['notepad', 'card'],
    action: 'basic',
    icon: 'Heading2',
  },
  {
    id: 'h3',
    label: 'Heading 3',
    aliases: ['heading', 'subheading', 'h3', 'small'],
    group: 'Basic',
    contexts: ['notepad', 'card'],
    action: 'basic',
    icon: 'Heading3',
  },

  // Lists
  {
    id: 'bullet',
    label: 'Bullet List',
    aliases: ['list', 'bullet', 'unordered', 'ul'],
    group: 'Lists',
    contexts: ['notepad', 'card'],
    action: 'list',
    icon: 'List',
  },
  {
    id: 'numbered',
    label: 'Numbered List',
    aliases: ['numbered', 'ordered', 'ol', '1.'],
    group: 'Lists',
    contexts: ['notepad', 'card'],
    action: 'list',
    icon: 'ListOrdered',
  },
  {
    id: 'todo',
    label: 'To-do List',
    aliases: ['todo', 'checklist', 'checkbox', 'task', 'check'],
    group: 'Lists',
    contexts: ['notepad', 'card'],
    action: 'list',
    icon: 'CheckSquare',
  },

  // Structural
  {
    id: 'quote',
    label: 'Quote',
    aliases: ['blockquote', 'cite', '>'],
    group: 'Structural',
    contexts: ['notepad', 'card'],
    action: 'structure',
    icon: 'Quote',
  },
  {
    id: 'code',
    label: 'Code Block',
    aliases: ['code', 'pre', 'snippet', 'syntax'],
    group: 'Structural',
    contexts: ['notepad', 'card'],
    action: 'structure',
    icon: 'Code',
  },
  {
    id: 'divider',
    label: 'Divider',
    aliases: ['line', 'hr', 'separator'],
    group: 'Structural',
    contexts: ['notepad', 'card'],
    action: 'structure',
    icon: 'Minus',
  },

  // Links & References
  {
    id: 'notepad',
    label: 'Notepad Link',
    aliases: ['note', 'doc', 'page', 'link', 'notepad'],
    group: 'Links & References',
    contexts: ['notepad', 'card', 'quickadd'],
    action: 'notepad',
    icon: 'FileText',
  },
  {
    id: 'task',
    label: 'Task Card',
    aliases: ['task', 'card', 'ticket', 'issue'],
    group: 'Links & References',
    contexts: ['notepad', 'card'],
    action: 'task',
    icon: 'Kanban',
  },
  {
    id: 'board',
    label: 'Board Link',
    aliases: ['board', 'kanban', 'project'],
    group: 'Links & References',
    contexts: ['notepad'],
    action: 'board',
    icon: 'Layout',
  },
  {
    id: 'today',
    label: 'Today',
    aliases: ['date', 'now', 'today'],
    group: 'Links & References',
    contexts: ['notepad', 'card'],
    action: 'date',
    icon: 'Calendar',
  },
  {
    id: 'tomorrow',
    label: 'Tomorrow',
    aliases: ['date', 'tomorrow'],
    group: 'Links & References',
    contexts: ['notepad', 'card'],
    action: 'date',
    icon: 'Calendar',
  },
  {
    id: 'mention',
    label: 'Mention',
    aliases: ['at', 'person', 'member', 'who', '@'],
    group: 'Links & References',
    contexts: ['notepad', 'card'],
    action: 'mention',
    icon: 'AtSign',
  },

  // Task & Metadata (Card & QuickAdd context)
  {
    id: 'due',
    label: 'Due Date',
    aliases: ['due', 'deadline', 'date', 'when'],
    group: 'Task & Metadata',
    contexts: ['card', 'quickadd'],
    action: 'due',
    icon: 'CalendarClock',
  },
  {
    id: 'priority',
    label: 'Priority',
    aliases: ['priority', 'urgent', 'high', 'medium', 'low', 'p1', 'p2'],
    group: 'Task & Metadata',
    contexts: ['card', 'quickadd'],
    action: 'priority',
    icon: 'Flag',
  },
  {
    id: 'assign',
    label: 'Assign Member',
    aliases: ['assign', 'owner', 'who', 'assignee', 'member'],
    group: 'Task & Metadata',
    contexts: ['card', 'quickadd'],
    action: 'assign',
    icon: 'UserPlus',
  },
  {
    id: 'tag',
    label: 'Tag',
    aliases: ['tag', 'label', '#'],
    group: 'Task & Metadata',
    contexts: ['card', 'quickadd'],
    action: 'tag',
    icon: 'Tag',
  },
  {
    id: 'move',
    label: 'Move Column',
    aliases: ['move', 'column', 'status', 'stage'],
    group: 'Task & Metadata',
    contexts: ['card'],
    action: 'move',
    icon: 'ArrowRight',
  },
]

export function getSlashCommandsForContext(
  context: SlashContext,
  query = '',
): SlashCommand[] {
  const q = query.toLowerCase().trim()
  return SLASH_COMMANDS.filter((cmd) => {
    if (!cmd.contexts.includes(context)) return false
    if (!q) return true
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.aliases.some((alias) => alias.toLowerCase().includes(q))
    )
  })
}
