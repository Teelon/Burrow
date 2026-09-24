import * as React from 'react';
import { cn } from '../../lib/utils';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
};

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, name, src, size = 'sm', title, ...props }, ref) => (
    <div
      ref={ref}
      title={title ?? name}
      aria-label={name}
      className={cn(
        'clip-hex inline-flex shrink-0 items-center justify-center bg-[var(--hi)] font-bold text-[var(--hi-ink)]',
        SIZES[size],
        className,
      )}
      {...props}
    >
      {src ? (
        <img src={src} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <span aria-hidden="true">{initials(name)}</span>
      )}
    </div>
  ),
);
Avatar.displayName = 'Avatar';

export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  max?: number;
}

export const AvatarGroup: React.FC<AvatarGroupProps & { children: React.ReactNode }> = ({
  className,
  max = 4,
  children,
  ...props
}) => {
  const items = React.Children.toArray(children);
  const visible = max > 0 ? items.slice(0, max) : items;
  const overflow = items.length - visible.length;
  return (
    <div className={cn('flex items-center', className)} {...props}>
      {visible.map((child, i) => (
        <div key={i} className={cn(i > 0 && '-ml-2')}>
          {child}
        </div>
      ))}
      {overflow > 0 && (
        <div className="-ml-2">
          <Avatar name={`+${overflow}`} size="xs" />
        </div>
      )}
    </div>
  );
};
