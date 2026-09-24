import * as React from 'react'
import { cn } from '../../lib/utils'

export interface SegmentOption {
  value: string
  label: React.ReactNode
}

export interface SegmentedControlProps {
  value: string
  onValueChange: (value: string) => void
  options: SegmentOption[]
  size?: 'sm' | 'md'
  fullWidth?: boolean
  className?: string
  ariaLabel?: string
}

/** Angular segmented control — selected tab gets sulfur-yellow accent. */
export function SegmentedControl({
  value,
  onValueChange,
  options,
  size = 'md',
  fullWidth = false,
  className,
  ariaLabel,
}: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-0.5 border border-[var(--line)] bg-[var(--surface2)] p-0.5',
        fullWidth && 'flex w-full',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onValueChange(opt.value)}
            className={cn(
              'inline-flex min-h-[44px] items-center justify-center gap-1.5 px-4 text-[12px] font-bold uppercase tracking-[0.05em] transition-colors md:min-h-0 md:px-3 md:py-1.5',
              size === 'sm' && 'px-2.5 text-[11px]',
              fullWidth && 'flex-1',
              active
                ? 'bg-[var(--accent)] text-[var(--accent-ink)]'
                : 'bg-transparent text-[var(--muted)] hover:bg-[var(--hi)] hover:text-[var(--hi-ink)]',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
