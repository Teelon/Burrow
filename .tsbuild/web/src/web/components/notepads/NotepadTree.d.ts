export interface NotepadNode {
    id: string;
    parentId: string | null;
    title: string;
    icon?: string | null;
    position: string;
    isFavorite: boolean;
}
export declare function NotepadTree({ projectId }: {
    projectId: string;
}): import("react").JSX.Element;
