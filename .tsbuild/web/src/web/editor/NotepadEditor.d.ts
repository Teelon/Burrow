import '@blocknote/shadcn/style.css';
export interface NotepadEditorProps {
    notepadId: string;
    hideTitle?: boolean;
    hideFavorite?: boolean;
}
export declare function NotepadEditor({ notepadId, hideTitle, hideFavorite, }: NotepadEditorProps): import("react").JSX.Element;
export default NotepadEditor;
