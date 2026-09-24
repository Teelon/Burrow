interface NotepadPickerModalProps {
    projectId: string;
    onClose: () => void;
    onSelectNotepad: (notepadId: string) => void;
}
export declare function NotepadPickerModal({ projectId, onClose, onSelectNotepad, }: NotepadPickerModalProps): import("react").JSX.Element;
interface TaskPickerModalProps {
    projectId: string;
    onClose: () => void;
    onCardCreated: (cardId: string) => void;
}
export declare function TaskPickerModal({ projectId, onClose, onCardCreated }: TaskPickerModalProps): import("react").JSX.Element;
export {};
