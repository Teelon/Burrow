import type { MentionKind } from './blocks';
export interface ExtractedMention {
    kind: MentionKind;
    id: string | null;
    label: string;
    isoDate: string | null;
}
export interface ExtractedLink {
    targetType: 'notepad' | 'board';
    targetId: string;
}
export interface ExtractResult {
    text: string;
    mentions: ExtractedMention[];
    links: ExtractedLink[];
}
