import type { DB } from '../../db/client';
import type { ISearchAdapter, SearchHit, SearchIndexDoc, SearchQuery } from './types';
export declare class SqliteFtsSearchAdapter implements ISearchAdapter {
    private db;
    constructor(db: DB);
    indexDocument(doc: SearchIndexDoc): Promise<void>;
    deleteDocument(id: string): Promise<void>;
    deleteByProject(projectId: string): Promise<void>;
    search(q: SearchQuery): Promise<SearchHit[]>;
}
