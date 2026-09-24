interface CardPanelProps {
    cardId: string;
    boardId: string;
    projectId: string;
    columns: Array<{
        id: string;
        name: string;
    }>;
    onClose: () => void;
}
export declare function CardPanel({ cardId, boardId, columns, onClose }: CardPanelProps): import("react").JSX.Element;
export {};
