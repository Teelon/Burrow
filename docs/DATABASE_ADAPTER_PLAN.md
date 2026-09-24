# Burrow — Dual-Runtime & Multi-Engine Architecture Plan

> **Status:** Groundwork Established — Phase 1 Cloudflare Focus (Active)  
> **Strategy:** Lay clean domain groundwork and interface boundaries, but build, stabilize, and harden exclusively for **Cloudflare (Workers + D1 + R2 + SQLite FTS5)** first. Other adapters (PostgreSQL, Node, Docker, MongoDB) are staged for future phases once Cloudflare is rock-solid.  
>  
> **Primary Target (Active):** Cloudflare Workers, Cloudflare D1/SQLite, Cloudflare R2  
> **Future Targets (Groundwork Ready / Staged):** Node.js runtime, PostgreSQL, MongoDB, S3/MinIO/Local storage  

---

# 1. Architecture Goals

Burrow will support two runtime hosts and three persistence engines while keeping the application and domain logic runtime-agnostic.

The architecture must satisfy five requirements:

1. **Cloudflare remains a first-class deployment target.**
2. **Node.js/Docker deployments require no Cloudflare dependency.**
3. **PostgreSQL and MongoDB are independently supported persistence engines.**
4. **No external search infrastructure is required.**
5. **The core application must not know which runtime, database, or storage provider is being used.**

The architecture should provide:

```text
                         React 19 Frontend
                                │
                                ▼
                        ┌───────────────┐
                        │   Hono Core   │
                        │ Routes + API  │
                        └───────┬───────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Domain Services │
                       │ Business Rules  │
                       └────────┬────────┘
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                  │
             ▼                  ▼                  ▼
       Repositories          Storage            Search
        Interfaces           Interface          Interface
             │                  │                  │
       ┌─────┼─────┐       ┌────┼────┐       ┌────┼────┐
       │     │     │       │    │    │       │    │    │
       ▼     ▼     ▼       ▼    ▼    ▼       ▼    ▼    ▼
      D1     PG   Mongo     R2   S3 Local    FTS  PG   Mongo
```

The goal is **capability parity**, not implementation parity.

PostgreSQL and MongoDB may use fundamentally different internal models as long as they satisfy the same domain contracts.

---

# 2. Locked Architectural Decisions

| Decision | Decision |
| :--- | :--- |
| Runtime hosts | Cloudflare Worker + Node.js |
| Cloudflare runtime | Cloudflare Workers with D1 and R2 |
| Node runtime | Node.js using `@hono/node-server` |
| Core framework | Hono |
| Frontend | React 19 |
| Database engines | D1/SQLite, PostgreSQL, MongoDB |
| Relational ORM | Drizzle ORM |
| Mongo client | Official `mongodb` driver |
| Search | Native database search |
| External search service | **Not required** |
| Cloud object storage | R2 |
| S3-compatible storage | AWS S3, MinIO, Supabase Storage, R2 S3 API |
| Offline object storage | Local filesystem |
| Auth | Better Auth with engine-specific adapter |
| Domain layer | Runtime and ORM agnostic |
| Database abstraction | Domain-oriented repositories |
| Transaction abstraction | Explicit application transaction boundaries where needed |
| Mongo modeling | Native document-oriented model; do not force relational parity |
| Search consistency | Search is a derived/read model, not authoritative application state |
| Deployment | Cloudflare, Docker, VPS, Kubernetes, local |
| Cloudflare dependency | None in the Node runtime |

---

# 3. Architectural Principle: Capability Parity, Not Database Parity

The biggest architectural rule is:

> **The core application depends on business capabilities, not database behavior.**

The application should not attempt to make PostgreSQL, D1, and MongoDB behave identically internally.

For example:

### Relational engines

D1 and PostgreSQL can naturally use:

```text
Workspace
    ├── Projects
    │     ├── Boards
    │     ├── Cards
    │     └── Notepads
    └── Members
```

with foreign keys, joins, transactions, and relational constraints.

### MongoDB

MongoDB can use:

```text
workspaces
projects
boards
cards
notepads
```

but may embed smaller related objects or denormalize read-oriented data where appropriate.

The repository interface should expose the **business operation**, not dictate the underlying storage structure.

Bad:

```ts
getAllRowsWithJoin(...)
```

Good:

```ts
getProjectWorkspaceContext(...)
```

---

# 4. Directory Structure

```text
burrow/
├── src/
│   ├── web/
│   │   └── ...
│   │
│   ├── shared/
│   │   ├── types/
│   │   ├── validation/
│   │   └── extractors/
│   │
│   ├── core/
│   │   ├── app.ts
│   │   │
│   │   ├── entities/
│   │   │   ├── workspace.ts
│   │   │   ├── project.ts
│   │   │   ├── board.ts
│   │   │   ├── card.ts
│   │   │   ├── notepad.ts
│   │   │   ├── tag.ts
│   │   │   └── notification.ts
│   │   │
│   │   ├── repositories/
│   │   │   ├── workspace.ts
│   │   │   ├── project.ts
│   │   │   ├── board.ts
│   │   │   ├── card.ts
│   │   │   ├── notepad.ts
│   │   │   ├── tag.ts
│   │   │   └── notification.ts
│   │   │
│   │   ├── services/
│   │   │   ├── workspaces.ts
│   │   │   ├── projects.ts
│   │   │   ├── boards.ts
│   │   │   ├── cards.ts
│   │   │   ├── notepads.ts
│   │   │   └── notifications.ts
│   │   │
│   │   ├── adapters/
│   │   │   ├── storage/
│   │   │   │   ├── types.ts
│   │   │   │   ├── r2.ts
│   │   │   │   ├── s3.ts
│   │   │   │   └── local.ts
│   │   │   │
│   │   │   ├── search/
│   │   │   │   ├── types.ts
│   │   │   │   ├── sqlite-fts.ts
│   │   │   │   ├── postgres-fts.ts
│   │   │   │   └── mongo-fts.ts
│   │   │   │
│   │   │   ├── lock/
│   │   │   │   ├── types.ts
│   │   │   │   ├── sql-lock.ts
│   │   │   │   └── mongo-lock.ts
│   │   │   │
│   │   │   └── db/
│   │   │       ├── d1/
│   │   │       ├── postgres/
│   │   │       └── mongodb/
│   │   │
│   │   ├── infrastructure/
│   │   │   ├── types.ts
│   │   │   ├── cloudflare.ts
│   │   │   └── node.ts
│   │   │
│   │   └── events/
│   │       ├── types.ts
│   │       └── outbox.ts
│   │
│   ├── worker/
│   │   ├── index.ts
│   │   └── env.ts
│   │
│   └── server/
│       ├── index.ts
│       └── config.ts
│
├── docker/
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── docker-compose.prod.yml
│
├── scripts/
│   └── migrate-engine.mjs
│
└── package.json
```

---

# 5. Runtime Architecture

## 5.1 Cloudflare Worker

Entry point:

```text
src/worker/index.ts
```

Responsibilities:

* Read Cloudflare bindings.
* Construct Cloudflare infrastructure.
* Construct the shared Hono application.
* Export the Worker `fetch` handler.

Conceptually:

```ts
const infrastructure = createCloudflareInfrastructure(env)

const app = createCoreApp({
  repositories: infrastructure.repositories,
  storage: infrastructure.storage,
  search: infrastructure.search,
  locks: infrastructure.locks,
  auth: infrastructure.auth,
})
```

The Worker should contain minimal business logic.

---

# 6. Node.js Runtime

Entry point:

```text
src/server/index.ts
```

Responsibilities:

* Validate environment variables.
* Construct Node infrastructure.
* Initialize database clients.
* Initialize storage.
* Initialize search.
* Initialize Better Auth.
* Create the shared Hono application.
* Start `@hono/node-server`.

Conceptually:

```ts
const config = loadConfig()

const infrastructure = await createNodeInfrastructure(config)

const app = createCoreApp({
  repositories: infrastructure.repositories,
  storage: infrastructure.storage,
  search: infrastructure.search,
  locks: infrastructure.locks,
  auth: infrastructure.auth,
})

serve({
  fetch: app.fetch,
  port: config.PORT,
})
```

The Node runtime must not import Cloudflare-specific modules.

---

# 7. Core Application Factory

The central application factory lives at:

```text
src/core/app.ts
```

It is responsible for:

* Hono initialization.
* Middleware.
* Authentication middleware.
* Request context.
* Route registration.
* Dependency injection.

It should not know whether the application is running on:

* Workers
* Node
* Docker
* Kubernetes
* a VPS

It should only receive infrastructure dependencies.

---

# 8. Infrastructure Composition

Infrastructure composition is the mechanism that connects the core application to a particular deployment.

## 8.1 Cloudflare

```text
createCloudflareInfrastructure(env)
```

Produces:

```text
D1 repositories
R2 storage
SQLite FTS5 search
SQL locks
Better Auth D1 adapter
```

## 8.2 Node + PostgreSQL

```text
createNodeInfrastructure({
  database: "postgres",
  ...
})
```

Produces:

```text
Postgres repositories
S3/MinIO/local storage
Postgres FTS
Postgres locks
Better Auth Postgres adapter
```

## 8.3 Node + MongoDB

```text
createNodeInfrastructure({
  database: "mongodb",
  ...
})
```

Produces:

```text
Mongo repositories
S3/MinIO/local storage
Mongo search
Mongo locks
Better Auth Mongo adapter
```

---

# 9. Domain Entities

Entities must be independent of:

* Drizzle
* MongoDB
* PostgreSQL
* D1
* Hono
* Cloudflare

Example:

```ts
export interface Project {
  id: string
  workspaceId: string
  name: string
  description: string | null
  createdAt: Date
  updatedAt: Date
}
```

Do not expose:

```ts
PgTable
Document
ObjectId
D1Result
MongoClient
```

from the domain entity layer.

---

# 10. Repository Interfaces

Repositories represent domain capabilities.

Example:

```ts
export interface IProjectRepository {
  getById(
    workspaceId: string,
    projectId: string
  ): Promise<Project | null>

  list(
    workspaceId: string
  ): Promise<Project[]>

  create(
    input: CreateProjectInput
  ): Promise<Project>

  update(
    projectId: string,
    input: UpdateProjectInput
  ): Promise<Project>

  delete(
    projectId: string
  ): Promise<void>
}
```

The interface must not dictate whether the underlying implementation uses:

* joins
* aggregation pipelines
* recursive CTEs
* multiple queries
* embedded documents
* denormalized projections

That is an implementation concern.

---

# 11. Transactions

Do not force all three engines into an artificial universal transaction abstraction.

Transactions should be used where the business operation genuinely requires atomicity.

For example:

```text
create card
    ↓
update related notepad
    ↓
update metadata
```

If these operations must be atomic, the infrastructure implementation can use its native mechanism.

### D1

Use the existing batch mechanism where appropriate.

### PostgreSQL

Use:

```ts
db.transaction(async tx => {
  ...
})
```

### MongoDB

Use:

```ts
session.withTransaction(async () => {
  ...
})
```

The service should define the required business operation.

The adapter determines how that operation is made atomic.

---

# 12. Unit of Work

`IUnitOfWork` should **not** become a universal database simulator.

If a unit-of-work abstraction is required, it should represent an application transaction boundary rather than exposing database-specific behavior.

Possible shape:

```ts
export interface ITransactionContext {
  repositories: {
    workspaces: IWorkspaceRepository
    projects: IProjectRepository
    boards: IBoardRepository
    cards: ICardRepository
    notepads: INotepadRepository
  }
}
```

But avoid requiring every operation to run through a transaction.

Use transactions deliberately.

---

# 13. Storage Architecture

## 13.1 Storage Interface

```ts
export interface StorageObject {
  body: ReadableStream | ArrayBuffer
  contentType?: string
  contentLength?: number
  etag?: string
  lastModified?: Date
}

export interface IStorageAdapter {
  put(
    key: string,
    data: ArrayBuffer | Uint8Array,
    contentType?: string
  ): Promise<void>

  get(
    key: string
  ): Promise<StorageObject | null>

  delete(
    key: string
  ): Promise<void>

  deletePrefix(
    prefix: string
  ): Promise<void>
}
```

---

# 14. Storage Implementations

## 14.1 R2

```text
R2StorageAdapter
```

Uses:

```ts
env.FILES.put()
env.FILES.get()
```

Only the adapter knows about R2.

---

## 14.2 S3

```text
S3StorageAdapter
```

Uses:

```text
@aws-sdk/client-s3
```

Supported providers include:

* AWS S3
* MinIO
* Supabase S3-compatible endpoints
* Cloudflare R2 S3 API

Configuration should be endpoint-driven.

---

## 14.3 Local Filesystem

```text
LocalStorageAdapter
```

Default location:

```text
./data/uploads
```

Production Docker deployments should mount this path as a persistent volume.

---

# 15. Search Architecture

Search is a **derived read model**.

The database remains the source of truth.

The search index exists to provide efficient search and snippets.

The application must therefore tolerate:

```text
database write succeeds
search update temporarily fails
```

The system should eventually reconcile the search index.

---

# 16. Search Interface

```ts
export interface SearchHit {
  id: string
  title: string
  icon?: string | null
  kind: 'notepad' | 'card'
  projectId: string
  projectName: string
  snippet: string
}

export interface ISearchAdapter {
  indexDocument(doc: {
    id: string
    workspaceId: string
    projectId: string
    kind: 'notepad' | 'card'
    title: string
    body: string
  }): Promise<void>

  deleteDocument(id: string): Promise<void>

  deleteByProject(projectId: string): Promise<void>

  search(query: {
    workspaceId: string
    projectId?: string
    text: string
    limit?: number
  }): Promise<SearchHit[]>
}
```

---

# 17. Search Implementations

## 17.1 D1

Use:

```text
SQLite FTS5
```

Existing functionality:

```text
notepads_fts
MATCH
snippet()
```

Implement:

```text
SqliteFts5SearchAdapter
```

---

## 17.2 PostgreSQL

Use:

```text
tsvector
GIN index
websearch_to_tsquery()
ts_rank_cd()
ts_headline()
```

Recommended model:

```text
title
plain_text
search_vector
```

with:

```text
GIN(search_vector)
```

The search vector should be derived from title and body/plain text.

---

## 17.3 MongoDB

Use:

```text
$text
$meta: "textScore"
```

Index:

```js
{
  title: "text",
  plainText: "text"
}
```

Optional future enhancement:

```text
MongoDB Atlas Search
```

Atlas Search must remain optional and must not become a core architectural dependency.

---

# 18. Search Consistency

The first implementation may update search synchronously.

However, the architecture should support an event-driven model:

```text
Domain operation
      │
      ▼
Database transaction
      │
      ▼
Outbox / domain event
      │
      ▼
Search projection
      │
      ▼
FTS / PostgreSQL / Mongo index
```

Potential events:

```text
NotepadCreated
NotepadUpdated
NotepadDeleted

CardCreated
CardUpdated
CardDeleted

ProjectDeleted
```

The search adapter should therefore be treated as a projection rather than authoritative state.

---

# 19. Concurrency & Soft Locks

## 19.1 Interface

```ts
export interface ILockAdapter {
  acquire(
    resourceId: string,
    userId: string,
    clientId: string,
    ttlMs: number
  ): Promise<{
    acquired: boolean
    holderUserId?: string
    expiresAt?: number
  }>

  heartbeat(
    resourceId: string,
    clientId: string,
    ttlMs: number
  ): Promise<boolean>

  release(
    resourceId: string,
    clientId: string
  ): Promise<void>
}
```

---

# 20. SQL Lock Implementation

Used by:

* D1
* PostgreSQL

Table:

```text
edit_locks
```

Required behavior:

* Atomic acquisition.
* TTL expiration.
* Heartbeat.
* Release.
* Ownership validation.

The implementation must avoid race conditions when two clients attempt acquisition simultaneously.

---

# 21. Mongo Lock Implementation

Use atomic:

```text
findOneAndUpdate
```

with:

* resource ID
* expiration check
* client ID
* user ID

Mongo should also have an appropriate TTL index.

The TTL index should be treated as cleanup assistance rather than the sole mechanism for deciding whether a lock is expired.

The application must explicitly check expiration when acquiring or renewing locks.

---

# 22. D1 Architecture

D1 is the reference implementation because it is the existing production architecture.

Directory:

```text
src/core/adapters/db/d1/
```

Implement:

```text
D1UnitOfWork
D1WorkspaceRepository
D1ProjectRepository
D1BoardRepository
D1CardRepository
D1NotepadRepository
D1TagRepository
D1NotificationRepository
```

Existing behavior must be preserved:

* Card/notepad atomic synchronization.
* Version checking.
* Tree reconstruction.
* Existing cascade behavior.
* Existing search behavior.
* Existing workspace isolation.

---

# 23. PostgreSQL Architecture

Directory:

```text
src/core/adapters/db/postgres/
```

Implement:

```text
schema.ts

PostgresWorkspaceRepository
PostgresProjectRepository
PostgresBoardRepository
PostgresCardRepository
PostgresNotepadRepository
PostgresTagRepository
PostgresNotificationRepository
```

Use:

```text
drizzle-orm/pg-core
```

and a PostgreSQL driver such as:

```text
postgres
```

or:

```text
pg
```

---

# 24. PostgreSQL Schema

PostgreSQL should remain relational.

Use:

```text
Foreign keys
ON DELETE CASCADE
Unique constraints
Check constraints
Indexes
```

Tenant-scoped tables should consistently include the necessary workspace/project identifiers required for efficient authorization and lookup.

Do not rely exclusively on application-level filtering for tenant isolation.

---

# 25. PostgreSQL Hierarchies

Notepad hierarchy should use relational relationships.

Possible structure:

```text
notepad
    id
    parent_id
```

Tree retrieval can use:

```sql
WITH RECURSIVE
```

The repository can reconstruct the domain tree.

This keeps hierarchical storage normalized while allowing efficient subtree queries.

---

# 26. PostgreSQL Search

Create a generated or maintained search vector containing:

```text
title
plain_text
```

Example conceptual structure:

```text
search_vector tsvector
```

with:

```text
GIN(search_vector)
```

Queries should support:

```text
websearch_to_tsquery()
ts_rank_cd()
ts_headline()
```

The resulting `SearchHit` must match the shared search contract.

---

# 27. PostgreSQL Authentication

Use Better Auth:

```ts
drizzleAdapter(pgDb, {
  provider: 'pg',
  schema,
})
```

Authentication-specific tables should live in the PostgreSQL schema and be managed independently from domain repositories where appropriate.

---

# 28. MongoDB Architecture

MongoDB is **not** a relational database replacement implemented collection-for-table.

The Mongo implementation should use Mongo's strengths where useful.

Directory:

```text
src/core/adapters/db/mongodb/
```

Collections may include:

```text
workspaces
projects
boards
cards
notepads
tags
notifications
```

But individual collections may use embedding or denormalization where the access pattern justifies it.

---

# 29. MongoDB Tenant Indexing

At minimum, establish appropriate indexes around:

```text
workspaceId
projectId
boardId
parentId
```

depending on the document model.

Indexes must be designed around actual repository access patterns rather than mechanically duplicating PostgreSQL indexes.

---

# 30. MongoDB Cascade Behavior

MongoDB does not provide relational foreign-key cascades.

Implement:

```text
MongoCascadeService
```

for explicit permanent deletion.

Example:

```text
Delete workspace
    ↓
Delete projects
    ↓
Delete boards
    ↓
Delete cards
    ↓
Delete notepads
    ↓
Delete tags / notifications / related records
    ↓
Delete workspace
```

Where possible, these operations should execute inside a MongoDB transaction.

For large datasets, consider bulk operations rather than document-by-document deletion.

---

# 31. MongoDB Hierarchy

Use a materialized path where appropriate:

```ts
path: string[]
```

Example:

```text
Root
  path: []

Child
  path: [rootId]

Grandchild
  path: [rootId, childId]
```

Subtree queries can then use the path structure.

However:

> Moving a node requires updating descendant paths.

The implementation must therefore explicitly handle subtree moves and ensure consistency.

Do not describe the approach as universally O(1). Query performance depends on the index and subtree size.

---

# 32. MongoDB Transactions

Use:

```ts
session.withTransaction(...)
```

when an operation requires atomic multi-document changes.

Do not wrap every MongoDB operation in a transaction.

Mongo-specific repository implementations should determine the appropriate transaction scope.

---

# 33. MongoDB Search

Implement:

```text
MongoSearchAdapter
```

using:

```text
$text
$meta: "textScore"
```

with a text index on:

```text
title
plainText
```

The adapter must return the shared:

```ts
SearchHit[]
```

contract.

---

# 34. MongoDB Authentication

Use:

```text
@better-auth/mongo-adapter
```

Authentication storage should remain isolated from application domain repositories.

---

# 35. Better Auth Architecture

Authentication is infrastructure.

The core application should receive an auth abstraction rather than directly importing:

```text
D1
Postgres
MongoDB
```

The runtime selects the appropriate Better Auth adapter.

```text
Cloudflare
    ↓
Better Auth + D1

Node + PostgreSQL
    ↓
Better Auth + Drizzle PostgreSQL

Node + MongoDB
    ↓
Better Auth + Mongo adapter
```

---

# 36. Dependency Injection

The core application should receive an infrastructure object similar to:

```ts
interface Infrastructure {
  repositories: RepositoryContainer
  storage: IStorageAdapter
  search: ISearchAdapter
  locks: ILockAdapter
  auth: AuthProvider
}
```

This becomes the primary composition boundary.

The core application should not instantiate infrastructure itself.

---

# 37. Phase 0 — Decouple Auxiliary Systems

Before database refactoring, isolate:

* Storage
* Search
* Locks

## Storage

* [ ] Create `IStorageAdapter`.
* [ ] Create `R2StorageAdapter`.
* [ ] Create `S3StorageAdapter`.
* [ ] Create `LocalStorageAdapter`.
* [ ] Refactor file routes.
* [ ] Refactor project deletion to use `deletePrefix()`.

## Search

* [ ] Create `ISearchAdapter`.
* [ ] Create `SearchHit`.
* [ ] Wrap existing FTS5 implementation.
* [ ] Refactor search routes.
* [ ] Remove raw FTS SQL from domain services.

## Locks

* [ ] Create `ILockAdapter`.
* [ ] Create SQL lock adapter.
* [ ] Refactor notepad locking routes.
* [ ] Verify concurrent acquisition behavior.
* [ ] Verify heartbeat expiration.
* [ ] Verify release ownership.

### Completion criteria

Existing Cloudflare behavior is unchanged.

---

# 38. Phase 1 — Core Domain Contracts

Create:

```text
src/core/entities/
src/core/repositories/
src/core/services/
```

## Entities

* [ ] Workspace
* [ ] Member
* [ ] Invite
* [ ] Project
* [ ] Board
* [ ] BoardColumn
* [ ] Card
* [ ] CardAssignee
* [ ] CardSubtask
* [ ] CardComment
* [ ] Notepad
* [ ] NotepadLink
* [ ] NotepadTag
* [ ] Notification

## Repository interfaces

* [ ] Workspace
* [ ] Project
* [ ] Board
* [ ] Card
* [ ] Notepad
* [ ] Tag
* [ ] Notification

## Application

* [ ] Extract shared Hono app.
* [ ] Move routes to `src/core`.
* [ ] Introduce dependency injection.
* [ ] Remove runtime-specific imports from core services.

### Completion criteria

The core application can be instantiated without Cloudflare-specific infrastructure.

---

# 39. Phase 2 — D1 Reference Implementation

Implement:

```text
D1WorkspaceRepository
D1ProjectRepository
D1BoardRepository
D1CardRepository
D1NotepadRepository
D1TagRepository
D1NotificationRepository
```

Tasks:

* [ ] Preserve current schema.
* [ ] Preserve current behavior.
* [ ] Preserve version checks.
* [ ] Preserve tree reconstruction.
* [ ] Preserve card/notepad synchronization.
* [ ] Preserve tenant isolation.
* [ ] Wire D1 repositories into infrastructure.
* [ ] Wire R2.
* [ ] Wire SQLite FTS5.
* [ ] Wire SQL locks.
* [ ] Wire Better Auth.

Validation:

```bash
pnpm test
pnpm check
```

### Completion criteria

Cloudflare deployment works with no functional regression.

---

# 40. Phase 3 — PostgreSQL

## Runtime

* [ ] Create `src/server/index.ts`.
* [ ] Install `@hono/node-server`.
* [ ] Create runtime config.
* [ ] Validate configuration using Zod.
* [ ] Add health endpoint.

## Database

* [ ] Create PostgreSQL schema.
* [ ] Configure Drizzle.
* [ ] Create migrations.
* [ ] Add foreign keys.
* [ ] Add cascade rules.
* [ ] Add indexes.
* [ ] Add constraints.

## Repositories

* [ ] Workspace.
* [ ] Project.
* [ ] Board.
* [ ] Card.
* [ ] Notepad.
* [ ] Tag.
* [ ] Notification.

## Search

* [ ] PostgreSQL search vector.
* [ ] GIN index.
* [ ] `websearch_to_tsquery()`.
* [ ] Ranking.
* [ ] Highlighting.
* [ ] Search contract tests.

## Authentication

* [ ] Better Auth PostgreSQL adapter.

### Completion criteria

The complete application can run using only:

```text
Node.js
PostgreSQL
S3/MinIO/local storage
```

with no Cloudflare dependency.

---

# 41. Phase 4 — Node Runtime Hardening

Before MongoDB, fully stabilize the Node runtime.

* [ ] Configuration validation.
* [ ] Graceful shutdown.
* [ ] Database connection lifecycle.
* [ ] Storage initialization.
* [ ] Health checks.
* [ ] Readiness checks.
* [ ] Logging.
* [ ] Error handling.
* [ ] Production build.
* [ ] Environment documentation.
* [ ] Docker compatibility.

### Completion criteria

PostgreSQL deployment works independently from Cloudflare.

---

# 42. Phase 5 — Docker Packaging

Create:

```text
docker/Dockerfile
docker/docker-compose.yml
docker/docker-compose.prod.yml
```

## Dockerfile

Use a multi-stage build:

```text
dependencies
    ↓
build
    ↓
production
```

The final image should contain only what is required to run the application.

---

# 43. Local PostgreSQL Stack

Compose profile:

```text
postgres
```

Services:

```text
burrow
postgres:16
minio
```

Optional:

```text
local filesystem
```

if MinIO is disabled.

---

# 44. Local MongoDB Stack

Compose profile:

```text
mongo
```

Services:

```text
burrow
mongo:7
minio
```

The same application image should work with either database.

---

# 45. Development Commands

Add:

```json
{
  "dev:cf": "...",
  "dev:pg": "...",
  "dev:mongo": "..."
}
```

Expected behavior:

```text
pnpm dev:cf
    → Cloudflare local runtime + D1

pnpm dev:pg
    → Node + PostgreSQL

pnpm dev:mongo
    → Node + MongoDB
```

---

# 46. Phase 6 — MongoDB

Only begin MongoDB after:

* [ ] Core repository contracts are stable.
* [ ] Node runtime is stable.
* [ ] PostgreSQL implementation is stable.
* [ ] Storage abstraction is stable.
* [ ] Search abstraction is stable.
* [ ] Lock abstraction is stable.

Then implement:

* [ ] Mongo collections.
* [ ] Mongo indexes.
* [ ] Mongo repositories.
* [ ] Mongo transactions.
* [ ] Cascade service.
* [ ] Materialized path hierarchy.
* [ ] Mongo search.
* [ ] Mongo locks.
* [ ] Better Auth Mongo adapter.

---

# 47. MongoDB Modeling Rule

Do **not** require:

```text
1 PostgreSQL table = 1 Mongo collection
```

Instead, model around access patterns.

For example, if a small object is always retrieved with its parent and has no independent lifecycle, embedding may be preferable.

If an entity:

* has independent lifecycle,
* is queried independently,
* grows significantly,
* or requires independent authorization,

keep it as its own collection.

---

# 48. Phase 7 — Search Projection Reliability

Once all engines work:

* [ ] Define domain events.
* [ ] Define search projection events.
* [ ] Add retry behavior.
* [ ] Add reconciliation tooling.
* [ ] Add search rebuild command.
* [ ] Add consistency tests.

Potential command:

```bash
pnpm search:rebuild
```

This should be able to rebuild the search projection from authoritative database records.

---

# 49. Phase 8 — Cross-Engine Migration CLI

Only build migration tooling after all schemas and domain behavior are stable.

Create:

```text
scripts/migrate-engine.mjs
```

Supported directions:

```text
D1 → PostgreSQL
D1 → MongoDB
PostgreSQL → MongoDB
MongoDB → PostgreSQL
```

Potential future support:

```text
PostgreSQL → D1
MongoDB → D1
```

---

# 50. Migration Architecture

Do not perform migrations by directly translating SQL into Mongo operations.

Instead:

```text
Source database
      ↓
Canonical domain export
      ↓
Validation
      ↓
Target repository
      ↓
Target database
      ↓
Search rebuild
```

The canonical representation should be domain-oriented.

Example:

```json
{
  "workspace": {},
  "members": [],
  "projects": [],
  "boards": [],
  "cards": [],
  "notepads": [],
  "tags": [],
  "notifications": []
}
```

---

# 51. Migration Requirements

The migration CLI must provide:

* [ ] Dry-run mode.
* [ ] Validation.
* [ ] Entity counts.
* [ ] Error reporting.
* [ ] Idempotency where possible.
* [ ] Transactional batches where supported.
* [ ] Progress reporting.
* [ ] Search rebuild.
* [ ] Referential integrity validation.
* [ ] Workspace-level migration support.

Example:

```bash
pnpm migrate-engine \
  --from=d1 \
  --to=postgres \
  --workspace=<id> \
  --dry-run
```

---

# 52. Tenant Isolation

Tenant isolation is a core invariant across every engine.

Every repository operation must enforce workspace scope.

Avoid APIs such as:

```ts
getCard(cardId)
```

when the caller context already knows the workspace.

Prefer:

```ts
getCard(workspaceId, cardId)
```

This makes accidental cross-tenant access harder.

The same principle must apply to:

* Search.
* Storage keys.
* Locks.
* Notifications.
* Migration tooling.
* Background jobs.

---

# 53. Storage Key Strategy

Object keys should be tenant-scoped.

Recommended conceptual structure:

```text
workspaces/{workspaceId}/projects/{projectId}/...
```

This prevents accidental collisions and simplifies:

```text
deletePrefix()
```

operations.

The storage adapter should never infer authorization from a storage key alone. Authorization belongs to the application/domain layer.

---

# 54. Testing Strategy

The repository contract should have a shared behavioral test suite.

For example:

```text
Repository Contract Tests
        │
        ├── D1
        ├── PostgreSQL
        └── MongoDB
```

Each implementation runs against the same business-level test cases.

Tests should verify:

* [ ] Create.
* [ ] Read.
* [ ] Update.
* [ ] Delete.
* [ ] Tenant isolation.
* [ ] Authorization boundaries.
* [ ] Hierarchy behavior.
* [ ] Concurrent updates.
* [ ] Lock behavior.
* [ ] Search behavior.
* [ ] Cascade behavior.

The tests should verify **behavior**, not identical SQL/query implementations.

---

# 55. Search Contract Tests

Each search implementation should verify:

* [ ] Exact terms.
* [ ] Multiple terms.
* [ ] Ranking.
* [ ] Workspace isolation.
* [ ] Project filtering.
* [ ] Result limits.
* [ ] Snippets.
* [ ] Deletion.
* [ ] Project deletion.
* [ ] Re-indexing.

Search ranking does not need to be numerically identical between engines.

The contract is:

> Relevant results are returned with useful ranking and snippets.

---

# 56. Lock Contract Tests

All lock implementations should verify:

```text
Client A acquires
Client B rejected
Client A heartbeat succeeds
Client B still rejected
Client A releases
Client B acquires
Expired lock becomes acquirable
Wrong client cannot release
```

---

# 57. Runtime Contract Tests

The same API-level tests should run against:

```text
Cloudflare/D1
Node/Postgres
Node/Mongo
```

This verifies that the runtime abstraction is real rather than theoretical.

---

# 58. Configuration

Node configuration should be validated using Zod.

Core configuration:

```text
PORT
DATABASE_ENGINE
DATABASE_URL
STORAGE_BACKEND
```

PostgreSQL:

```text
DATABASE_URL
```

MongoDB:

```text
MONGODB_URI
MONGODB_DATABASE
```

S3:

```text
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY
S3_SECRET_KEY
S3_FORCE_PATH_STYLE
```

Local:

```text
LOCAL_STORAGE_PATH
```

Authentication configuration should be environment-specific but remain outside domain logic.

---

# 59. Configuration Matrix

| Runtime | Database | Storage | Search |
| :--- | :--- | :--- | :--- |
| Cloudflare | D1 | R2 | SQLite FTS5 |
| Node | PostgreSQL | S3 | PostgreSQL FTS |
| Node | PostgreSQL | MinIO | PostgreSQL FTS |
| Node | PostgreSQL | Local | PostgreSQL FTS |
| Node | MongoDB | S3 | Mongo `$text` |
| Node | MongoDB | MinIO | Mongo `$text` |
| Node | MongoDB | Local | Mongo `$text` |

---

# 60. Deployment Targets

The architecture should support:

## Cloudflare

```text
Workers
D1
R2
```

## Single VPS

```text
Docker
PostgreSQL
MinIO
```

or:

```text
Docker
MongoDB
MinIO
```

## Kubernetes

```text
Burrow deployment
PostgreSQL/MongoDB service
S3-compatible storage
```

## Local

```text
Node
PostgreSQL/Mongo
Local filesystem
```

No Cloudflare account should be required for the Node deployment.

---

# 61. What Must Never Leak Into Core

The following must never appear in:

```text
src/core/entities
src/core/services
src/core/repositories
```

Cloudflare-specific:

```text
R2Bucket
D1Database
ExecutionContext
Env bindings
```

PostgreSQL-specific:

```text
PgTable
SQL fragments
Postgres connection objects
```

Mongo-specific:

```text
ObjectId
MongoClient
Document
Collection
AggregationPipeline
```

Storage-specific:

```text
S3Client
R2Bucket
fs/promises
```

The core should deal only with domain types and interfaces.

---

# 62. What Is Allowed in Adapters

Database-specific behavior belongs in:

```text
src/core/adapters/db/
```

Examples:

```text
Recursive CTE
PostgreSQL-specific indexes
Mongo aggregation
Mongo materialized paths
D1 batch operations
SQLite FTS5 syntax
Postgres tsvector
Mongo $text
```

This is not duplication to eliminate.

It is the correct place for engine-specific optimization.

---

# 63. Architecture Validation Checklist

Before declaring the architecture complete:

## Runtime

* [ ] Cloudflare Worker works.
* [ ] Node runtime works.
* [ ] Core app is shared.
* [ ] Node build contains no Cloudflare dependency.

## Database

* [ ] D1 works.
* [ ] PostgreSQL works.
* [ ] MongoDB works.
* [ ] Repository contract tests pass.

## Storage

* [ ] R2 works.
* [ ] S3 works.
* [ ] MinIO works.
* [ ] Local filesystem works.

## Search

* [ ] D1 FTS5 works.
* [ ] PostgreSQL FTS works.
* [ ] Mongo `$text` works.
* [ ] Search projection can be rebuilt.

## Locks

* [ ] D1 locks work.
* [ ] PostgreSQL locks work.
* [ ] Mongo locks work.
* [ ] Expiration is tested.

## Authentication

* [ ] D1 Better Auth works.
* [ ] PostgreSQL Better Auth works.
* [ ] Mongo Better Auth works.

## Docker

* [ ] PostgreSQL Compose stack works.
* [ ] Mongo Compose stack works.
* [ ] Persistent volumes work.
* [ ] Production image works.

## Migration

* [ ] D1 → PostgreSQL.
* [ ] D1 → MongoDB.
* [ ] PostgreSQL → MongoDB.
* [ ] Migration validation works.
* [ ] Search rebuild works.

---

# 64. Final Architecture

The finished Burrow architecture should look like this:

```text
                              ┌─────────────────┐
                              │   React 19 SPA  │
                              └────────┬────────┘
                                       │
                         ┌─────────────┴─────────────┐
                         │                           │
                         ▼                           ▼
               ┌─────────────────┐         ┌─────────────────┐
               │ Cloudflare      │         │ Node.js Server  │
               │ Worker          │         │ @hono/node      │
               └────────┬────────┘         └────────┬────────┘
                        │                           │
                        └─────────────┬─────────────┘
                                      ▼
                              ┌───────────────┐
                              │   Hono Core   │
                              │   App/Routes  │
                              └───────┬───────┘
                                      ▼
                              ┌───────────────┐
                              │ Domain Layer  │
                              │ Services      │
                              └───────┬───────┘
                                      │
             ┌────────────────────────┼────────────────────────┐
             │                        │                        │
             ▼                        ▼                        ▼
       Repositories               Storage                  Search
       Interfaces                Interface                Interface
             │                        │                        │
       ┌─────┼─────┐           ┌──────┼──────┐         ┌─────┼─────┐
       │     │     │           │      │      │         │     │     │
       ▼     ▼     ▼           ▼      ▼      ▼         ▼     ▼     ▼
      D1     PG   Mongo        R2     S3    Local      FTS   PG   Mongo
       │     │     │
       │     │     │
       ▼     ▼     ▼
    SQLite PostgreSQL MongoDB
```

The critical architectural property is:

```text
                         CORE
                           │
             ┌─────────────┼─────────────┐
             │             │             │
        PostgreSQL       MongoDB        D1
        implementation   implementation implementation
```

not:

```text
                    "Universal Database"
                           │
              ┌────────────┼────────────┐
              │            │            │
             D1           PG          Mongo
```

The first model preserves database-specific strengths while keeping the application portable.

---

# 65. Final Implementation Order

The implementation sequence is structured in two major stages:

### Stage 1: Groundwork & Production Cloudflare Focus (Active)
```text
1. Decouple Auxiliary Systems (Storage, Search, Locks)     [DONE]
        ↓
2. Extract Core Domain Entities & Repository Contracts      [DONE]
        ↓
3. Extract Shared Hono Core App & Dependency Injection      [DONE]
        ↓
4. Wire D1 Reference Implementation & R2 Storage Adapters   [DONE]
        ↓
5. Harden & Stabilize Cloudflare Workers Deployment         [IN PROGRESS]
   - Type safety across all domain models and D1 repos (0 errors)
   - Ensure D1 migrations and SQLite FTS5 are seamless
   - Polish web frontend + Workers RPC contract
   - Verify zero regressions in core workflows
```

### Stage 2: Multi-Engine & Multi-Runtime Expansion (Deferred)
```text
6. Complete PostgreSQL Repositories & Migrations
        ↓
7. Harden Node Runtime & Docker Packaging
        ↓
8. Build MongoDB Adapter & Projection Reconciler
        ↓
9. Build Cross-Engine Migration CLI
        ↓
10. Run Full Matrix Contract Tests
```

This ensures we do not prematurely optimize or destabilize the project across multiple databases before Cloudflare Workers + D1 is rock-solid.

The end state is a single Burrow application with interchangeable infrastructure compositions:

```text
Cloudflare:
Worker + D1 + R2 + FTS5

Self-hosted relational:
Node + PostgreSQL + S3/MinIO/Local + PostgreSQL FTS

Self-hosted document:
Node + MongoDB + S3/MinIO/Local + Mongo text search
```

with the **domain, API routes, business services, frontend, validation, and application behavior shared across all deployments.**
