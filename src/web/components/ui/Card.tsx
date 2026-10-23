import * as React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Status color for the 4px left-edge bar (any CSS color). Omit for none. */
  statusColor?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, statusColor, style, ...props }, ref) => (
    <div
      ref={ref}
      style={{
        ...style,
        ...(statusColor ? { borderLeft: `3px solid ${statusColor}` } : undefined),
      }}
      className={cn(
        'border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] transition-colors hover:bg-[var(--hi)]/30 theme-radius-md',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-4 pt-3', className)} {...props} />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('px-4 pb-3 pt-1', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';
