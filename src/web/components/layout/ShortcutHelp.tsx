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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-lg rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.title}>
              <div className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                {g.title}
              </div>
              <ul className="divide-y divide-neutral-200/60 dark:divide-neutral-800/60">
                {g.items.map(([keys, desc]) => (
                  <li
                    key={desc}
                    className="flex items-center justify-between gap-4 py-1.5 text-sm"
                  >
                    <span className="text-neutral-600 dark:text-neutral-400">{desc}</span>
                    <kbd className="shrink-0 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-xs text-neutral-700 dark:text-neutral-300">
                      {keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
