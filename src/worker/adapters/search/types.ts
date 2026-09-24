export interface SearchHit {
  id: string
  title: string
  icon?: string | null
  kind: 'notepad' | 'card'
  projectId: string
  projectName: string
  snippet: string
}

export interface SearchIndexDoc {
  id: string
  workspaceId: string
  projectId: string
  kind: 'notepad' | 'card'
  title: string
  body: string
}

export interface SearchQuery {
  workspaceId: string
  projectId?: string
  text: string
  limit?: number
}

export interface ISearchAdapter {
  indexDocument(doc: SearchIndexDoc): Promise<void>
  deleteDocument(id: string): Promise<void>
  deleteByProject(projectId: string): Promise<void>
  search(q: SearchQuery): Promise<SearchHit[]>
}
