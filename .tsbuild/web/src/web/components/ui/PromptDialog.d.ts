import * as React from 'react';
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
export declare function PromptDialog({ open, title, message, defaultValue, placeholder, confirmLabel, cancelLabel, busy, onConfirm, onCancel, }: PromptDialogProps): React.JSX.Element;
