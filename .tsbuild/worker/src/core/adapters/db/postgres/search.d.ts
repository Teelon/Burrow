import type { ISearchAdapter, SearchHit, SearchQuery, SearchIndexDoc } from '../../../adapters/search';
import type { PostgresDb } from './index';
export declare class PostgresSearchAdapter implements ISearchAdapter {
    private db;
    constructor(db: PostgresDb);
    indexDocument(doc: SearchIndexDoc): Promise<void>;
    deleteDocument(_id: string): Promise<void>;
    deleteByProject(_projectId: string): Promise<void>;
    search(q: SearchQuery): Promise<SearchHit[]>;
}
