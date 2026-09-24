import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TreeItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  depth?: number;
  diamondColor?: string;
}

/** Sidebar tree row — angular, 44px touch target, 4px accent bar when active. */
export const TreeItem = React.forwardRef<HTMLButtonElement, TreeItemProps>(
  (
    { className, active = false, depth = 0, diamondColor, type = 'button', children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      aria-current={active ? 'true' : undefined}
      style={{ paddingLeft: `calc(0.75rem + ${depth} * 1rem)` }}
      className={cn(
        'relative flex min-h-[44px] w-full items-center gap-2 px-3 py-1 text-left text-sm transition-colors md:min-h-[36px]',
        active
          ? 'bg-[var(--hi)] text-[var(--hi-ink)]'
          : 'text-[var(--side-text)] hover:bg-[var(--hi)]/50',
        className,
      )}
      {...props}
    >
      {active && (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]" />
      )}
      {diamondColor && (
        <span
          aria-hidden="true"
          className="shape-diamond h-2 w-2 shrink-0"
          style={{ backgroundColor: diamondColor }}
        />
      )}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  ),
);
TreeItem.displayName = 'TreeItem';
