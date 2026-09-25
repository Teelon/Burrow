import { ModalShell } from './ModalShell';
import { Button } from './Button';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Basalt-native destructive-action confirmation.
 * Replaces native `window.confirm`, which is silently ignored in sandboxed
 * / embedded contexts and clashes with the angular dialog language.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <ModalShell open={open} onClose={busy ? undefined : onCancel} title={title}>
      <p className="text-xs leading-relaxed text-[var(--muted)]">{message}</p>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={busy}
          className="min-h-[44px] sm:min-h-0"
        >
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={onConfirm}
          disabled={busy}
          className="min-h-[44px] sm:min-h-0"
        >
          {busy ? 'Working…' : confirmLabel}
        </Button>
      </div>
    </ModalShell>
  );
}