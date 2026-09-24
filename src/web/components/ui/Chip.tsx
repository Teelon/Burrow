import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

/** Angular filter chip — touch-friendly, horizontally scrollable on mobile. */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active = false, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={active}
      className={cn(
        'chamfer-sm inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap border px-4 text-[13px] font-semibold transition-colors focus-visible:[clip-path:none] md:min-h-0 md:px-3 md:py-1.5 md:text-xs',
        active
          ? 'border-transparent bg-[var(--accent)] text-[var(--accent-ink)]'
          : 'border-[var(--line)] bg-[var(--surface2)] text-[var(--text)] hover:bg-[var(--hi)] hover:text-[var(--hi-ink)]',
        className,
      )}
      {...props}
    />
  ),
)
Chip.displayName = 'Chip'
