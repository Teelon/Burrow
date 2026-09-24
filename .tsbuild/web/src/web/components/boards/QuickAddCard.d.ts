interface QuickAddCardProps {
    boardId: string;
    columnId: string;
    projectId: string;
    onClose?: () => void;
}
export declare function QuickAddCard({ boardId, columnId, projectId, onClose, }: QuickAddCardProps): import("react").JSX.Element;
export {};
