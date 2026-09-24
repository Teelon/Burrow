/**
 * Notepad entity and input types
 * Pure TypeScript — zero runtime dependencies
 */

export type NotepadKind = 'notepad' | 'card';

export interface Notepad {
  id: string;
  workspaceId: string;
  projectId: string;
  parentId: string | null;
  kind: NotepadKind;
  title: string;
  icon: string | null;
  coverKey: string | null;
  content: string; // JSON string (TipTap/ProseMirror doc)
  version: number;
  position: string;
  favorite: boolean;
  deletedAt: Date | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotepadInput {
  workspaceId: string;
  projectId: string;
  parentId?: string | null;
  title?: string;
  createdBy: string;
  position?: string;
  kind?: NotepadKind;
}

export interface CreatedNotepad {
  id: string;
  position: string;
  version: number;
}

export interface MoveNotepadInput {
  parentId?: string | null;
  afterId?: string | null;
}

export interface SoftDeleteNotepadInput {
  workspaceId: string;
  notepadId: string;
}

export interface RestoreNotepadInput {
  workspaceId: string;
  notepadId: string;
}

export interface PermanentDeleteNotepadInput {
  workspaceId: string;
  notepadId: string;
}

export interface SaveContentInput {
  notepadId: string;
  content: string;
  baseVersion: number;
  actorId: string;
  clientId?: string;
}

export interface SaveContentResult {
  version: number;
}

export interface ClaimLockInput {
  notepadId: string;
  userId: string;
  clientId: string;
  takeover?: boolean;
}

export interface ClaimLockResult {
  expiresAt: Date;
}

export interface ReleaseLockInput {
  notepadId: string;
  userId: string;
  clientId: string;
}