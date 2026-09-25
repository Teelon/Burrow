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
export declare function ConfirmDialog({ open, title, message, confirmLabel, cancelLabel, danger, busy, onConfirm, onCancel, }: ConfirmDialogProps): import("react").JSX.Element;
