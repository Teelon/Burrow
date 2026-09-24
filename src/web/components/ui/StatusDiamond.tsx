import * as React from 'react';
import { cn } from '../../lib/utils';

export interface StatusDiamondProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Any CSS color (typically a Basalt token var). */
  color?: string;
  size?: number;
}

/** Rotated-square status marker. Visual footprint is small; wrapper keeps layout. */
export const StatusDiamond: React.FC<StatusDiamondProps> = ({
  className,
  color = 'var(--c1)',
  size = 9,
  title,
  ...props
}) => (
  <span
    className={cn('inline-flex shrink-0 items-center justify-center', className)}
    title={title}
    {...props}
  >
    <span
      aria-hidden="true"
      className="shape-diamond"
      style={{ width: size, height: size, backgroundColor: color }}
    />
  </span>
);
