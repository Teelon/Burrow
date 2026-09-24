export const MENTION_INLINE = 'mention';
export const NOTEPAD_LINK_BLOCK = 'notepadLink';
export const CARD_LINK_BLOCK = 'cardLink';
export const BOARD_LINK_BLOCK = 'boardLink';

export type MentionKind = 'user' | 'notepad' | 'card' | 'date';

export type LinkTargetType = 'user' | 'notepad' | 'card' | 'board';

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

export interface BoardLinkProps {
  boardId: string;
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
