import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BlockNoteEditor } from '@blocknote/core'
import { ListTree, X } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { StatusDiamond } from '../components/ui/StatusDiamond'

interface HeadingEntry {
  id: string
  level: number
  text: string
}

interface DocumentOutlineProps {
  editor: BlockNoteEditor<any, any, any>
  /** Scroll container that owns the editor DOM (used for data-id lookups). */
  containerRef: React.RefObject<HTMLDivElement | null>
}

function inlineText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const rec = item as Record<string, unknown>
        if (typeof rec.text === 'string') return rec.text
        if (Array.isArray(rec.content)) return inlineText(rec.content)
        if (rec.type === 'mention') {
          const props = rec.props as Record<string, unknown> | undefined
          return typeof props?.label === 'string' ? props.label : ''
        }
      }
      return ''
    })
    .join('')
}

function collectHeadings(blocks: unknown[], out: HeadingEntry[]) {
  for (const raw of blocks) {
    if (!raw || typeof raw !== 'object') continue
    const block = raw as Record<string, unknown>
    if (block.type === 'heading' && typeof block.id === 'string') {
      const props = block.props as Record<string, unknown> | undefined
      const level = typeof props?.level === 'number' ? props.level : 1
      out.push({ id: block.id, level, text: inlineText(block.content).trim() || 'Untitled' })
    }
    if (Array.isArray(block.children)) collectHeadings(block.children, out)
  }
}

/**
 * Floating table of contents: extracts heading blocks, smooth-scrolls to them
 * on click, and highlights the section currently in view.
 */
export function DocumentOutline({ editor, containerRef }: DocumentOutlineProps) {
  const [open, setOpen] = useState(false)
  const [headings, setHeadings] = useState<HeadingEntry[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const refresh = useCallback(() => {
    const out: HeadingEntry[] = []
    collectHeadings(editor.document, out)
    setHeadings(out)
  }, [editor])

  // Recompute outline whenever the document changes.
  useEffect(() => {
    refresh()
    const unbind = editor.onChange(refresh)
    return unbind
  }, [editor, refresh])

  // Highlight the active section while scrolling.
  useEffect(() => {
    if (!open || headings.length === 0) return
    const root = containerRef.current
    if (!root) return

    const elements: HTMLElement[] = []
    for (const heading of headings) {
      const el = root.querySelector<HTMLElement>(`[data-id="${heading.id}"]`)
      if (el) elements.push(el)
    }
    if (elements.length === 0) return

    let best: { id: string; top: number } | null = null
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement
          const id = el.getAttribute('data-id')
          if (!id) continue
          if (entry.isIntersecting) {
            const top = entry.boundingClientRect.top
            if (!best || top < best.top) best = { id, top }
          }
        }
        if (best) setActiveId(best.id)
      },
      { root: null, rootMargin: '-72px 0px -60% 0px', threshold: [0, 1] },
    )
    for (const el of elements) observer.observe(el)
    observerRef.current = observer
    return () => observer.disconnect()
  }, [open, headings, containerRef])

  const scrollTo = (heading: HeadingEntry) => {
    const root = containerRef.current
    const el = root?.querySelector<HTMLElement>(`[data-id="${heading.id}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveId(heading.id)
    }
  }

  const ordered = useMemo(() => headings, [headings])

  return (
    <div className="no-print relative">
      {/* Toggle button */}
      <Button
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        title={open ? 'Hide outline' : 'Show outline (table of contents)'}
        className={`p-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 border ${
          open
            ? 'text-[var(--accent-ink)] bg-[var(--accent)] border-[var(--accent)]'
            : 'text-[var(--muted)] border-[var(--line)] hover:text-[var(--text)]'
        }`}
      >
        <ListTree className="w-4 h-4" />
      </Button>

      {/* Floating outline panel — angular Basalt surface */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 max-h-[70vh] overflow-y-auto bg-[var(--surface)] border border-[var(--line)] z-30 p-2">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              On this page
            </span>
            <button
              onClick={() => setOpen(false)}
              className="p-0.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 text-[var(--muted)] hover:text-[var(--text)]"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {ordered.length === 0 ? (
            <div className="px-2 py-3 text-xs text-[var(--muted)] italic">
              No headings yet. Add H1–H3 blocks to build an outline.
            </div>
          ) : (
            <nav className="space-y-0.5">
              {ordered.map((heading) => (
                <button
                  key={heading.id}
                  onClick={() => scrollTo(heading)}
                  className={`w-full text-left px-2 py-1 min-h-[44px] sm:min-h-0 text-xs transition truncate flex items-center gap-2 ${
                    activeId === heading.id
                      ? 'bg-[var(--accent)] text-[var(--accent-ink)] font-medium'
                      : 'text-[var(--muted)] hover:bg-[var(--hi)] hover:text-[var(--text)]'
                  }`}
                  style={{ paddingLeft: `${8 + (heading.level - 1) * 12}px` }}
                >
                  <StatusDiamond
                    color={
                      activeId === heading.id ? 'var(--accent-ink)' : 'var(--muted)'
                    }
                    size={6}
                  />
                  <span className="truncate">{heading.text}</span>
                </button>
              ))}
            </nav>
          )}
        </div>
      )}
    </div>
  )
}
