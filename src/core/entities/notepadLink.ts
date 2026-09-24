/**
 * NotepadLink entity
 * Pure TypeScript — zero runtime dependencies
 */

export type NotepadLinkTargetType = 'user' | 'notepad' | 'card' | 'board';

export interface NotepadLink {
  sourceId: string;
  targetType: NotepadLinkTargetType;
  targetId: string;
}