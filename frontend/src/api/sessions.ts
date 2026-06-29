import { apiClient } from './client'
import type { Session } from './types'

export interface SessionResponse {
  id: string
  projectId: number
  ownerId: number
  active: boolean
  createdAt: string
}

export async function listActiveSessions(projectId: number): Promise<SessionResponse[]> {
  const { data } = await apiClient.get<SessionResponse[]>(`/api/projects/${projectId}/sessions`)
  return data
}

export async function startSession(projectId: number): Promise<SessionResponse> {
  const { data } = await apiClient.post<SessionResponse>(`/api/projects/${projectId}/sessions`)
  return data
}

export async function closeSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/api/sessions/${sessionId}`)
}
