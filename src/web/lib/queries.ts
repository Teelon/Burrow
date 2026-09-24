import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api'

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.api.health.$get()
      if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
      return res.json()
    },
    staleTime: 30_000,
  })
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await api.api.me.$get()
      if (res.status === 401) return null
      if (!res.ok) throw new Error(`Failed to load profile: ${res.status}`)
      return res.json()
    },
    staleTime: 60_000,
  })
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await api.api.projects.$get()
      if (!res.ok) throw new Error(`Failed to load projects: ${res.status}`)
      return res.json()
    },
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; icon?: string | null; color?: string | null }) => {
      const res = await api.api.projects.$post({ json: data })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to create project')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      name?: string
      icon?: string | null
      color?: string | null
      archived?: boolean
    }) => {
      const res = await api.api.projects[':id'].$patch({
        param: { id },
        json: data,
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to update project')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, confirmName }: { id: string; confirmName: string }) => {
      const res = await api.api.projects[':id'].$delete({
        param: { id },
        query: { confirm: confirmName },
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to delete project')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}

export function useMembers() {
  return useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const res = await api.api.members.$get()
      if (!res.ok) throw new Error(`Failed to load members: ${res.status}`)
      return res.json()
    },
  })
}

export function useInvites() {
  return useQuery({
    queryKey: ['invites'],
    queryFn: async () => {
      const res = await api.api.invites.$get()
      if (!res.ok) throw new Error(`Failed to load invites: ${res.status}`)
      return res.json()
    },
  })
}

export function useCreateInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { email: string; role: 'editor' | 'viewer' }) => {
      const res = await api.api.invites.$post({ json: data })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to create invite')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] })
    },
  })
}

export function useRevokeInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.api.invites[':id'].$delete({ param: { id } })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to revoke invite')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] })
    },
  })
}

// ---------------------------------------------------------------------------
// Boards, Columns, Cards
// ---------------------------------------------------------------------------

export function useBoards(projectId: string | undefined) {
  return useQuery({
    queryKey: ['boards', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const res = await api.api.projects[':pid'].boards.$get({
        param: { pid: projectId },
      })
      if (!res.ok) throw new Error(`Failed to load boards: ${res.status}`)
      return res.json()
    },
    enabled: !!projectId,
  })
}

export function useBoard(boardId: string | undefined) {
  return useQuery({
    queryKey: ['board', boardId],
    queryFn: async () => {
      if (!boardId) return null
      const res = await api.api.boards[':id'].$get({
        param: { id: boardId },
      })
      if (!res.ok) throw new Error(`Failed to load board: ${res.status}`)
      return res.json()
    },
    enabled: !!boardId,
  })
}

export function useCreateBoard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      projectId,
      name,
      icon,
    }: {
      projectId: string
      name: string
      icon?: string | null
    }) => {
      const res = await api.api.projects[':pid'].boards.$post({
        param: { pid: projectId },
        json: { name, icon },
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to create board')
      }
      return res.json()
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['boards', vars.projectId] })
    },
  })
}

export function useUpdateBoard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      boardId,
      name,
      icon,
    }: {
      boardId: string
      name?: string
      icon?: string | null
    }) => {
      const res = await api.api.boards[':id'].$patch({
        param: { id: boardId },
        json: { name, icon },
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to update board')
      }
      return res.json()
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['board', vars.boardId] })
      queryClient.invalidateQueries({ queryKey: ['boards'] })
    },
  })
}

export function useDeleteBoard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (boardId: string) => {
      const res = await api.api.boards[':id'].$delete({
        param: { id: boardId },
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to delete board')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boards'] })
    },
  })
}

export function useCreateColumn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      boardId,
      name,
      color,
    }: {
      boardId: string
      name: string
      color?: string | null
    }) => {
      const res = await api.api.boards[':id'].columns.$post({
        param: { id: boardId },
        json: { name, color },
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to create column')
      }
      return res.json()
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['board', vars.boardId] })
    },
  })
}

export function useUpdateColumn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      boardId: _boardId,
      columnId,
      name,
      color,
    }: {
      boardId: string
      columnId: string
      name?: string
      color?: string | null
    }) => {
      const res = await api.api.columns[':id'].$patch({
        param: { id: columnId },
        json: { name, color },
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to update column')
      }
      return res.json()
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['board', vars.boardId] })
    },
  })
}

export function useDeleteColumn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      boardId: _boardId,
      columnId,
      moveTo,
    }: {
      boardId: string
      columnId: string
      moveTo?: string | null
    }) => {
      const res = await api.api.columns[':id'].$delete({
        param: { id: columnId },
        query: { moveTo: moveTo || undefined },
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to delete column')
      }
      return res.json()
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['board', vars.boardId] })
    },
  })
}

export function useMoveColumn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      boardId: _boardId,
      columnId,
      afterId,
    }: {
      boardId: string
      columnId: string
      afterId?: string | null
    }) => {
      const res = await api.api.columns[':id'].move.$post({
        param: { id: columnId },
        json: { afterId },
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to move column')
      }
      return res.json()
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['board', vars.boardId] })
    },
  })
}

export function useCreateCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      boardId: _boardId,
      columnId,
      title,
      priority,
      dueDate,
      assigneeIds,
      tagIds,
      notepad,
    }: {
      boardId: string
      columnId: string
      title: string
      priority?: 'low' | 'medium' | 'high' | 'urgent' | null
      dueDate?: number | null
      assigneeIds?: string[]
      tagIds?: string[]
      notepad?: { mode: 'new' } | { mode: 'existing'; id: string }
    }) => {
      const res = await api.api.columns[':id'].cards.$post({
        param: { id: columnId },
        json: {
          title,
          priority: priority ?? undefined,
          dueDate: dueDate ?? undefined,
          assigneeIds,
          tagIds,
          notepad,
        },
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to create card')
      }
      return res.json()
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['board', vars.boardId] })
    },
  })
}

export function useCard(cardId: string | undefined) {
  return useQuery({
    queryKey: ['card', cardId],
    queryFn: async () => {
      if (!cardId) return null
      const res = await api.api.cards[':id'].$get({
        param: { id: cardId },
      })
      if (!res.ok) throw new Error(`Failed to load card: ${res.status}`)
      return res.json()
    },
    enabled: !!cardId,
  })
}

export function useUpdateCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cardId,
      boardId: _boardId,
      ...data
    }: {
      cardId: string
      boardId?: string
      title?: string
      priority?: 'low' | 'medium' | 'high' | 'urgent' | null
      dueDate?: number | null
      assigneeIds?: string[]
      tagIds?: string[]
    }) => {
      const res = await api.api.cards[':id'].$patch({
        param: { id: cardId },
        json: data,
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to update card')
      }
      return res.json()
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['card', vars.cardId] })
      if (vars.boardId) {
        queryClient.invalidateQueries({ queryKey: ['board', vars.boardId] })
      }
    },
  })
}

export function useMoveCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cardId,
      boardId: _boardId,
      columnId,
      afterId,
    }: {
      cardId: string
      boardId: string
      columnId: string
      afterId?: string | null
    }) => {
      const res = await api.api.cards[':id'].move.$post({
        param: { id: cardId },
        json: { columnId, afterId },
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to move card')
      }
      return res.json()
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['board', vars.boardId] })
    },
  })
}

export function useDeleteCard() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      cardId,
      boardId: _boardId,
    }: {
      cardId: string
      boardId: string
    }) => {
      const res = await api.api.cards[':id'].$delete({
        param: { id: cardId },
      })
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } }
        throw new Error(err.error?.message || 'Failed to delete card')
      }
      return res.json()
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['board', vars.boardId] })
    },
  })
}

