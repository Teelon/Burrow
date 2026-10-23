import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: 'neutral' | 'accent' | 'danger' | 'c1' | 'c2' | 'c3' | 'c4';
}

const TONES: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-[var(--surface2)] text-[var(--text)] border-[var(--line)]',
  accent: 'bg-[var(--accent)] text-[var(--accent-ink)] border-transparent',
  danger: 'bg-[var(--danger)]/15 text-[var(--danger)] border-[var(--danger)]/35',
  c1: 'bg-[var(--c1)]/15 text-[var(--c1)] border-[var(--c1)]/35',
  c2: 'bg-[var(--c2)]/15 text-[var(--c2)] border-[var(--c2)]/35',
  c3: 'bg-[var(--c3)]/15 text-[var(--c3)] border-[var(--c3)]/35',
  c4: 'bg-[var(--c4)]/15 text-[var(--c4)] border-[var(--c4)]/35',
};

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, tone = 'neutral', ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'theme-radius-xs inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] md:text-[11px]',
        TONES[tone],
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = 'Badge';
