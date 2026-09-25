import { useEffect, useRef } from 'react';
import type { DefaultReactSuggestionItem, SuggestionMenuProps } from '@blocknote/react';

export function BasaltSuggestionMenu(props: SuggestionMenuProps<DefaultReactSuggestionItem>) {
  const { items, selectedIndex, onItemClick, loadingState } = props;
  const selectedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Track group headings across the list
  let currentGroup: string | undefined = undefined;

  return (
    <div
      id="bn-suggestion-menu"
      role="listbox"
      className="bn-suggestion-menu bg-[var(--surface)] text-[var(--text)] border border-[var(--line)] z-50 min-w-[300px] max-w-[360px] max-h-72 overflow-y-auto overflow-x-hidden p-1 select-none"
    >
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        const showGroupHeader = item.group !== currentGroup;
        if (showGroupHeader) {
          currentGroup = item.group;
        }

        return (
          <div key={`${item.title}-${index}`}>
            {showGroupHeader && currentGroup && (
              <div className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-[var(--muted)] bg-[var(--surface2)]/80 border-b border-[var(--hair)] my-1 first:mt-0 select-none">
                {currentGroup}
              </div>
            )}
            <div
              ref={isSelected ? selectedRef : undefined}
              id={`bn-suggestion-menu-item-${index}`}
              role="option"
              aria-selected={isSelected}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onItemClick?.(item)}
              className={`flex items-center gap-2.5 px-2.5 py-2 cursor-pointer transition-colors text-xs ${
                isSelected
                  ? 'bg-[var(--accent)] text-[var(--accent-ink)] font-semibold'
                  : 'text-[var(--text)] hover:bg-[var(--hi)] hover:text-[var(--text)]'
              }`}
            >
              {item.icon && (
                <div
                  className={`w-4 h-4 shrink-0 flex items-center justify-center ${
                    isSelected
                      ? 'text-[var(--accent-ink)] [&_svg]:text-[var(--accent-ink)]'
                      : 'text-[var(--muted)]'
                  }`}
                >
                  {item.icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium leading-tight">{item.title}</div>
                {item.subtext && (
                  <div
                    className={`truncate text-[11px] mt-0.5 leading-tight ${
                      isSelected ? 'text-[var(--accent-ink)]/85' : 'text-[var(--muted)]'
                    }`}
                  >
                    {item.subtext}
                  </div>
                )}
              </div>
              {item.badge && (
                <span
                  className={`text-[9px] uppercase font-bold px-1.5 py-0.5 shrink-0 border ${
                    isSelected
                      ? 'border-[var(--accent-ink)]/30 text-[var(--accent-ink)] bg-black/10'
                      : 'border-[var(--line)] text-[var(--muted)] bg-[var(--surface2)]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {items.length === 0 && (loadingState === 'loaded' || loadingState === 'loading') && (
        <div className="px-3 py-6 text-center text-xs text-[var(--muted)] select-none">
          No matching commands or references
        </div>
      )}

      {(loadingState === 'loading-initial' || loadingState === 'loading') && (
        <div className="px-3 py-3 text-center text-xs text-[var(--muted)] flex items-center justify-center gap-2">
          <div className="w-3 h-3 border-2 border-[var(--accent)] border-t-transparent animate-spin" />
          <span>Loading…</span>
        </div>
      )}
    </div>
  );
}
