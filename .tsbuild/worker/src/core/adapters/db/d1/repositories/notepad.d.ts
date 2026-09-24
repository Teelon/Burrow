import type { DB } from '../client';
import type { INotepadRepository } from '../../../../infrastructure/types';
export declare const MAX_NOTEPAD_DEPTH = 8;
export declare const MAX_CONTENT_BYTES = 1500000;
export declare function createNotepadRepository(db: DB): INotepadRepository;
