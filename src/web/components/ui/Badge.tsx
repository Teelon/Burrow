import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'danger' | 'c1' | 'c2' | 'c3' | 'c4';
}

const TONES: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-[var(--surface2)] text-[var(--text)] border-[var(--line)]',
  accent: 'bg-[var(--accent)] text-[var(--accent-ink)] border-transparent',
  danger: 'bg-transparent text-[var(--danger)] border-[var(--danger)]',
  c1: 'bg-transparent text-[var(--c1)] border-[var(--c1)]',
  c2: 'bg-transparent text-[var(--c2)] border-[var(--c2)]',
  c3: 'bg-transparent text-[var(--c3)] border-[var(--c3)]',
  c4: 'bg-transparent text-[var(--c4)] border-[var(--c4)]',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone = 'neutral', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'chamfer-sm inline-flex items-center gap-1 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] md:text-[11px]',
        TONES[tone],
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = 'Badge';
