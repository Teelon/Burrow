import { type LinkTargetType, type MentionKind } from './blocks';
export interface ExtractedMention {
    kind: MentionKind;
    id: string | null;
    label: string;
    isoDate: string | null;
}
export interface ExtractedLink {
    targetType: LinkTargetType;
    targetId: string;
}
export interface ExtractResult {
    /** Plain text of all blocks (used for the FTS index). */
    text: string;
    /** Mention chips in document order, deduplicated by kind + id/date/label. */
    mentions: ExtractedMention[];
    /** Deduplicated reference targets found in mentions and link blocks. */
    links: ExtractedLink[];
}
/** Extract plain text, mentions and reference links from BlockNote JSON. */
export declare function extractFromContent(content: string): ExtractResult;
/** Plain text of the document, used to (re)build the FTS index row. */
export declare function extractPlainText(content: string): string;
