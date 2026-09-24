import { nanoid } from 'nanoid'
import type {
  IProjectRepository,
  INotepadRepository,
  IBoardRepository,
  ITagRepository,
  Project,
  UpdateProjectData,
} from '../infrastructure/types'
import { notFound, badRequest } from './errors'
import { positionAfterLast, positionBetween } from './utils/ordering'

export interface CreateProjectArgs {
  workspaceId: string
  name: string
  icon?: string | null
  color?: string | null
}

export interface UpdateProjectArgs {
  workspaceId: string
  projectId: string
  name?: string
  icon?: string | null
  color?: string | null
  archived?: boolean
}

export interface MoveProjectArgs {
  workspaceId: string
  projectId: string
  afterId?: string | null
}

export interface PermanentDeleteProjectArgs {
  workspaceId: string
  projectId: string
  confirmName: string
}

export class ProjectService {
  constructor(
    private readonly repos: {
      projects: IProjectRepository
      notepads: INotepadRepository
      boards: IBoardRepository
      tags: ITagRepository
    },
  ) {}

  async listProjects(workspaceId: string): Promise<Project[]> {
    return this.repos.projects.listByWorkspace(workspaceId)
  }

  async createProject(args: CreateProjectArgs): Promise<{ id: string; position: string }> {
    const last = await this.repos.projects.listByWorkspace(args.workspaceId)
    const position = positionAfterLast(last[last.length - 1]?.position ?? null)
    const id = nanoid()
    const now = Date.now()

    await this.repos.projects.create({
      id,
      workspaceId: args.workspaceId,
      name: args.name.trim() || 'Untitled Project',
      icon: args.icon ?? null,
      color: args.color ?? null,
      position,
      createdAt: now,
      updatedAt: now,
    })

    return { id, position }
  }

  async updateProject(args: UpdateProjectArgs): Promise<void> {
    const project = await this.repos.projects.findByIdAndWorkspace(args.projectId, args.workspaceId)
    if (!project) throw notFound('not_found', 'Project not found')

    const updates: UpdateProjectData = { updatedAt: Date.now() }
    if (args.name !== undefined) updates.name = args.name.trim() || 'Untitled Project'
    if (args.icon !== undefined) updates.icon = args.icon
    if (args.color !== undefined) updates.color = args.color
    if (args.archived !== undefined) {
      updates.archivedAt = args.archived ? Date.now() : null
    }

    await this.repos.projects.update(args.projectId, updates)
  }

  async moveProject(args: MoveProjectArgs): Promise<{ position: string }> {
    const project = await this.repos.projects.findByIdAndWorkspace(args.projectId, args.workspaceId)
    if (!project) throw notFound('not_found', 'Project not found')

    const allProjects = await this.repos.projects.listByWorkspace(args.workspaceId)
    const others = allProjects.filter((p) => p.id !== args.projectId)

    let newPosition: string
    if (!args.afterId) {
      const next = others[0]?.position ?? null
      newPosition = positionBetween(null, next)
    } else {
      const afterIndex = others.findIndex((p) => p.id === args.afterId)
      if (afterIndex === -1) throw badRequest('invalid_after_id', 'afterId not found')
      const prev = others[afterIndex]!.position
      const next = others[afterIndex + 1]?.position ?? null
      newPosition = positionBetween(prev, next)
    }

    await this.repos.projects.updatePosition(args.projectId, newPosition)
    return { position: newPosition }
  }

  async permanentDeleteProject(args: PermanentDeleteProjectArgs): Promise<void> {
    const project = await this.repos.projects.findByIdAndWorkspace(args.projectId, args.workspaceId)
    if (!project) throw notFound('not_found', 'Project not found')

    if (project.name !== args.confirmName) {
      throw badRequest('name_mismatch', 'Project confirmation name does not match')
    }

    const projectId = args.projectId

    // 1. Hard delete all notepads in the project (cascades to FTS, links, tags via repository)
    const notepads = await this.repos.notepads.listByProject(projectId)
    for (const np of notepads) {
      if (np.deletedAt !== null) {
        await this.repos.notepads.hardDelete(np.id)
      }
    }

    // 2. Hard delete all boards in the project
    const boards = await this.repos.boards.listByProject(projectId)
    for (const board of boards) {
      if (board.deletedAt !== null) {
        await this.repos.boards.hardDelete(board.id)
      }
    }

    // 3. Delete all tags in the project
    const tags = await this.repos.tags.listByProject(projectId)
    for (const tag of tags) {
      await this.repos.tags.delete(tag.id)
    }

    // 4. Hard delete the project itself
    await this.repos.projects.hardDelete(projectId)
  }
}