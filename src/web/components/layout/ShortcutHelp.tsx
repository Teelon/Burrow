import { ModalShell } from '../ui/ModalShell'

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const groups: Array<{ title: string; items: Array<[string, string]> }> = [
    {
      title: 'Global',
      items: [
        ['Ctrl / \u2318 K', 'Command palette'],
        ['?', 'Show this shortcuts help'],
      ],
    },
    {
      title: 'Board',
      items: [
        ['J / \u2193', 'Focus next card in column'],
        ['K / \u2191', 'Focus previous card in column'],
        ['L / \u2192', 'Focus first card in next column'],
        ['H / \u2190', 'Focus first card in previous column'],
        ['Enter', 'Open the focused card'],
        ['Space', 'Quick-peek the focused card'],
        ['C', 'Quick-add a card to the focused column'],
        ['P', 'Set priority of the focused card'],
        ['M', 'Set assignee of the focused card'],
      ],
    },
    {
      title: 'Editor',
      items: [
        ['/', 'Slash commands (template, mention…)'],
        ['@', 'Mention'],
        ['#', 'Heading (Markdown)'],
      ],
    },
  ]

  return (
    <ModalShell
      open
      onClose={onClose}
      title="Keyboard shortcuts"
      className="sm:max-w-lg"
    >
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">
              {g.title}
            </div>
            <ul className="divide-y divide-hair">
              {g.items.map(([keys, desc]) => (
                <li
                  key={desc}
                  className="flex items-center justify-between gap-4 py-1.5 text-sm"
                >
                  <span className="text-muted">{desc}</span>
                  <kbd className="shrink-0 border border-line bg-surface2 px-1.5 py-0.5 font-mono text-xs text-text">
                    {keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </ModalShell>
  )
}
