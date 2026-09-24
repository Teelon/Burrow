import * as React from 'react'
import { cn } from '../../lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'min-h-[44px] w-full border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-base text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none md:min-h-0 md:text-sm',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'
