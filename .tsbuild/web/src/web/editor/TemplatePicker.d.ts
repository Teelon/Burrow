import type { BlockNoteEditor } from '@blocknote/core';
interface TemplatePickerModalProps {
    editor: BlockNoteEditor<any, any, any>;
    onClose: () => void;
}
/** Modal listing all starter templates; applying replaces the document. */
export declare function TemplatePickerModal({ editor, onClose }: TemplatePickerModalProps): import("react").JSX.Element;
export {};
