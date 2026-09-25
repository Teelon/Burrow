import * as React from 'react';
import { ModalShell } from './ModalShell';
import { Button } from './Button';
import { Input } from './Input';

export interface PromptDialogProps {
  open: boolean;
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * Basalt-native prompt dialog.
 * Replaces native `window.prompt`, which is silently ignored in sandboxed / embedded contexts.
 */
export function PromptDialog({
  open,
  title,
  message,
  defaultValue = '',
  placeholder,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy = false,
  onConfirm,
  onCancel,
}: PromptDialogProps) {
  const [value, setValue] = React.useState(defaultValue);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setValue(defaultValue);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [open, defaultValue]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy || !value.trim()) return;
    onConfirm(value.trim());
  };

  return (
    <ModalShell open={open} onClose={busy ? undefined : onCancel} title={title}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {message && (
          <p className="text-xs leading-relaxed text-[var(--muted)]">{message}</p>
        )}
        <Input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          disabled={busy}
          autoFocus
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={busy}
            className="min-h-[44px] sm:min-h-0"
          >
            {cancelLabel}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={busy || !value.trim()}
            className="min-h-[44px] sm:min-h-0"
          >
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </div>
      </form>
    </ModalShell>
  );
}
