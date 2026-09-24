import * as React from 'react'
import { cn } from '../../lib/utils'

export interface ModalShellProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean
  onClose?: () => void
  title?: string
}

/** Angular dialog wrapper — flat Basalt surface, no floating shadow. */
export const ModalShell: React.FC<ModalShellProps> = ({
  open,
  onClose,
  title,
  className,
  children,
  ...props
}) => {
  React.useEffect(() => {
    if (!open || !onClose) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'chamfer-lg max-h-[100dvh] w-full border border-[var(--line)] bg-[var(--surface)] text-[var(--text)] sm:max-w-lg',
          className,
        )}
        {...props}
      >
        {title && (
          <div className="font-display border-b border-[var(--hair)] px-4 py-3 text-sm font-extrabold uppercase tracking-[0.04em]">
            {title}
          </div>
        )}
        <div className="px-4 py-3">{children}</div>
      </div>
    </div>
  )
}
