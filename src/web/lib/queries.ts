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
