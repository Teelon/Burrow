import { type CardItem } from './types';
/** Space-bar quick peek: read-only snapshot of the focused card. */
export declare function QuickPeekModal({ card, columnName, onClose, }: {
    card: CardItem;
    columnName?: string;
    onClose: () => void;
}): import("react").JSX.Element;
/** P-key quick priority picker for the focused card. */
export declare function PriorityPickerModal({ card, boardId, onClose, }: {
    card: CardItem;
    boardId: string;
    onClose: () => void;
}): import("react").JSX.Element;
/** M-key member assign picker for the focused card (toggles assigneeIds). */
export declare function AssignPickerModal({ card, boardId, onClose, }: {
    card: CardItem;
    boardId: string;
    onClose: () => void;
}): import("react").JSX.Element;
