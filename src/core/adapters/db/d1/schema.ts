import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

/**
 * Burrow Drizzle schema (source of truth) - copied from worker for D1 adapter.
 * Timestamps are integer Unix milliseconds. IDs are text (nanoid).
 * NOTE: `notepads_fts` is a hand-written FTS5 virtual table; it is intentionally
 * NOT defined here and is excluded from drizzle-kit via tablesFilter.
 */

// ---------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('emailVerified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (t) => [index('session_user_idx').on(t.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('accountId').notNull(),
    providerId: text('providerId').notNull(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    idToken: text('idToken'),
    accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp_ms' }),
    refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp_ms' }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('account_user_idx').on(t.userId)],
);

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expiresAt', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('createdAt', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updatedAt', { mode: 'timestamp_ms' }).notNull(),
});

// ---------------------------------------------------------------------------
// Workspace / members / invites
// ---------------------------------------------------------------------------

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const members = sqliteTable(
  'members',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull().unique(), // one workspace per user in v1
    role: text('role', { enum: ['owner', 'editor', 'viewer'] }).notNull(),
    joinedAt: integer('joined_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })],
);

export const invites = sqliteTable(
  'invites',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role', { enum: ['editor', 'viewer'] }).notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    invitedBy: text('invited_by').notNull(),
    expiresAt: integer('expires_at').notNull(),
    acceptedAt: integer('accepted_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [uniqueIndex('invites_token_hash_uq').on(t.tokenHash)],
);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon'),
    color: text('color'),
    position: text('position').notNull(),
    archivedAt: integer('archived_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('projects_ws').on(t.workspaceId, t.position)],
);

// ---------------------------------------------------------------------------
// Notepads
// ---------------------------------------------------------------------------

export const notepads = sqliteTable(
  'notepads',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    parentId: text('parent_id').references((): any => notepads.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['notepad', 'card'] })
      .notNull()
      .default('notepad'),
    title: text('title').notNull().default('Untitled'),
    icon: text('icon'),
    coverKey: text('cover_key'),
    content: text('content').notNull().default('[]'),
    version: integer('version').notNull().default(1),
    position: text('position').notNull(),
    isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
    deletedAt: integer('deleted_at'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    index('notepads_tree').on(t.projectId, t.parentId, t.position),
    index('notepads_deleted_idx').on(t.projectId, t.deletedAt),
  ],
);

// ---------------------------------------------------------------------------
// Boards, columns, cards
// ---------------------------------------------------------------------------

export const boards = sqliteTable(
  'boards',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    icon: text('icon'),
    position: text('position').notNull(),
    deletedAt: integer('deleted_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('boards_project').on(t.projectId, t.position)],
);

export const boardColumns = sqliteTable(
  'board_columns',
  {
    id: text('id').primaryKey(),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    position: text('position').notNull(),
    /** Kanban WIP constraint; null = unlimited. */
    wipLimit: integer('wip_limit'),
  },
  (t) => [index('columns_board').on(t.boardId, t.position)],
);

export const cards = sqliteTable(
  'cards',
  {
    id: text('id').primaryKey(),
    boardId: text('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    columnId: text('column_id')
      .notNull()
      .references(() => boardColumns.id, { onDelete: 'cascade' }),
    notepadId: text('notepad_id')
      .notNull()
      .unique()
      .references(() => notepads.id, { onDelete: 'cascade' }), // notepads.kind = 'card'
    position: text('position').notNull(),
    priority: text('priority', { enum: ['low', 'medium', 'high', 'urgent'] }),
    dueDate: integer('due_date'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('cards_column').on(t.columnId, t.position)],
);

export const cardAssignees = sqliteTable(
  'card_assignees',
  {
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.userId] })],
);

export const cardSubtasks = sqliteTable(
  'card_subtasks',
  {
    id: text('id').primaryKey(),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    position: text('position').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('subtasks_card').on(t.cardId, t.position)],
);

// ---------------------------------------------------------------------------
// Card comments (discussion thread)
// ---------------------------------------------------------------------------

export const cardComments = sqliteTable(
  'card_comments',
  {
    id: text('id').primaryKey(),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('comments_card').on(t.cardId, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
  },
  (t) => [uniqueIndex('tags_project_name_uq').on(t.projectId, t.name)],
);

export const notepadTags = sqliteTable(
  'notepad_tags',
  {
    notepadId: text('notepad_id')
      .notNull()
      .references(() => notepads.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.notepadId, t.tagId] })],
);

// ---------------------------------------------------------------------------
// References found inside notepad content (backlinks, notification diffing)
// ---------------------------------------------------------------------------

export const notepadLinks = sqliteTable(
  'notepad_links',
  {
    sourceId: text('source_id')
      .notNull()
      .references(() => notepads.id, { onDelete: 'cascade' }),
    targetType: text('target_type', { enum: ['user', 'notepad', 'card', 'board'] }).notNull(),
    targetId: text('target_id').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.sourceId, t.targetType, t.targetId] }),
    index('links_target').on(t.targetType, t.targetId),
  ],
);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').notNull(),
    userId: text('user_id').notNull(), // recipient
    type: text('type', { enum: ['mention', 'assigned'] }).notNull(),
    actorId: text('actor_id').notNull(),
    notepadId: text('notepad_id').references(() => notepads.id, { onDelete: 'cascade' }),
    cardId: text('card_id').references(() => cards.id, { onDelete: 'cascade' }),
    readAt: integer('read_at'),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [index('notifications_user').on(t.userId, t.readAt, t.createdAt)],
);

// ---------------------------------------------------------------------------
// Soft edit locks
// ---------------------------------------------------------------------------

export const editLocks = sqliteTable('edit_locks', {
  notepadId: text('notepad_id')
    .primaryKey()
    .references(() => notepads.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull(),
  clientId: text('client_id').notNull(), // random per editor instance (tab)
  expiresAt: integer('expires_at').notNull(),
});
