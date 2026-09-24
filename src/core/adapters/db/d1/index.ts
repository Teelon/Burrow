import { createStorageFromEnv } from './adapters/storage/factory'
import { SqliteFtsSearchAdapter } from './adapters/search/sqlite-fts'
import { SqlLockAdapter } from './adapters/lock/sql-lock'
import { createAuthProviderWithDB } from './auth'
import { createWorkspaceRepository } from './repositories/workspace'
import { createProjectRepository } from './repositories/project'
import { createBoardRepository } from './repositories/board'
import { createCardRepository } from './repositories/card'
import { createNotepadRepository } from './repositories/notepad'
import { createTagRepository } from './repositories/tag'
import { createNotificationRepository } from './repositories/notification'
import { createMemberRepository } from './repositories/member'
import { createInviteRepository } from './repositories/invite'
import type { Infrastructure } from '../../../infrastructure/types'
import type { DB } from './client'

interface EnvBindings {
  FILES?: any
  LOCAL_STORAGE_PATH?: string
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  BOOTSTRAP_TOKEN: string
}

/**
 * Create the full D1 infrastructure bundle for the core app.
 * This factory wires the existing D1/Drizzle implementation behind
 * the Phase 1 repository interfaces.
 */
export function createD1Infrastructure(db: DB, env: EnvBindings): Infrastructure {
  // Create adapters (stateless, can be shared)
  const search = new SqliteFtsSearchAdapter(db)
  const locks = new SqlLockAdapter(db)
  const storage = createStorageFromEnv(env)
  const auth = createAuthProviderWithDB(db, env)

  // Create repositories (stateless, can be shared)
  const repositories = {
    workspaces: createWorkspaceRepository(db),
    projects: createProjectRepository(db),
    boards: createBoardRepository(db),
    cards: createCardRepository(db),
    notepads: createNotepadRepository(db),
    tags: createTagRepository(db),
    notifications: createNotificationRepository(db),
    members: createMemberRepository(db),
    invites: createInviteRepository(db),
  }

  return {
    repositories,
    storage,
    search,
    locks,
    auth,
    bootstrapToken: env.BOOTSTRAP_TOKEN,
  }
}

// Re-export constants for services that need them
export { MAX_NOTEPAD_DEPTH, MAX_CONTENT_BYTES, LOCK_TTL_MS } from './lib/constants'