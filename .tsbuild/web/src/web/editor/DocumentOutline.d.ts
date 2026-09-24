import type { BlockNoteEditor } from '@blocknote/core';
interface DocumentOutlineProps {
    editor: BlockNoteEditor<any, any, any>;
    /** Scroll container that owns the editor DOM (used for data-id lookups). */
    containerRef: React.RefObject<HTMLDivElement | null>;
}
/**
 * Floating table of contents: extracts heading blocks, smooth-scrolls to them
 * on click, and highlights the section currently in view.
 */
export declare function DocumentOutline({ editor, containerRef }: DocumentOutlineProps): import("react").JSX.Element;
export {};
