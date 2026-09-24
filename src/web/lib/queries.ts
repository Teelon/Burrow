import { useQuery } from '@tanstack/react-query'
import { api } from './api'

async function fetchHealth() {
  const res = await api.api.health.$get()
  if (!res.ok) throw new Error(`health check failed: ${res.status}`)
  return res.json()
}

export function useHealth() {
  return useQuery({ queryKey: ['health'], queryFn: fetchHealth, staleTime: 30_000 })
}
