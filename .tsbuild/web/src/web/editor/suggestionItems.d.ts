import type { DefaultReactSuggestionItem } from '@blocknote/react';
import type { BlockNoteEditor } from '@blocknote/core';
import type { SlashContext } from '../../shared/slash';
export interface SuggestionDialogState {
    type: 'notepad' | 'task' | 'template' | null;
    blockToReplace?: any;
}
export declare function getCustomSlashItems(editor: BlockNoteEditor<any, any, any>, context: SlashContext, projectId: string, onOpenDialog: (state: SuggestionDialogState) => void): DefaultReactSuggestionItem[];
/**
 * Suggestions for `@` menu: People, Notepads, Cards, Dates.
 */
export declare function getAtMenuSuggestions(query: string, projectId: string, editor: BlockNoteEditor<any, any, any>): Promise<DefaultReactSuggestionItem[]>;
/**
 * Suggestions for `#` menu: Project Tags.
 */
export declare function getHashMenuSuggestions(query: string, projectId: string, _notepadId: string, editor: BlockNoteEditor<any, any, any>, onAttachTag?: (tagId: string) => void): Promise<DefaultReactSuggestionItem[]>;
