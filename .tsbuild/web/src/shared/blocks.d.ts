/**
 * Block and inline content schema names + TypeScript types shared by the
 * worker (extraction, link sync) and the web editor (custom BlockNote blocks).
 *
 * A notepad's content is one JSON document: BlockNote's block array stored as
 * text. Content is the source of truth; `notepad_links` is a derived index.
 */
export declare const MENTION_INLINE = "mention";
export declare const NOTEPAD_LINK_BLOCK = "notepadLink";
export declare const CARD_LINK_BLOCK = "cardLink";
export type MentionKind = 'user' | 'notepad' | 'card' | 'date';
export interface MentionProps {
    kind: MentionKind;
    /** Absent for date mentions. */
    id?: string;
    label: string;
    /** ISO date string when kind === 'date'. */
    isoDate?: string;
}
export interface NotepadLinkProps {
    notepadId: string;
}
export interface CardLinkProps {
    cardId: string;
}
/** The raw shapes we expect inside BlockNote JSON before validation. */
export interface RawBlock {
    id?: string;
    type?: string;
    props?: Record<string, unknown>;
    content?: unknown;
    children?: RawBlock[];
    [key: string]: unknown;
}
export type RawDoc = RawBlock[];
