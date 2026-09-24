import * as React from 'react';
export interface ModalShellProps extends React.HTMLAttributes<HTMLDivElement> {
    open: boolean;
    onClose?: () => void;
    title?: string;
}
/** Angular dialog wrapper — flat Basalt surface, no floating shadow. */
export declare const ModalShell: React.FC<ModalShellProps>;
