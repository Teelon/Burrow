import * as React from 'react'
import { cn } from '../../lib/utils'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'min-h-[44px] w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--text)] focus:border-[var(--accent)] focus:outline-none md:min-h-0 md:text-sm',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
)
Select.displayName = 'Select'
