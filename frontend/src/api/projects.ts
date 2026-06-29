import { apiClient } from './client'
import type { Project } from './types'

export async function listProjects(): Promise<Project[]> {
  const { data } = await apiClient.get<Project[]>('/api/projects')
  return data
}

export async function getProject(id: number): Promise<Project> {
  const { data } = await apiClient.get<Project>(`/api/projects/${id}`)
  return data
}

export async function createProject(name: string, description?: string, language?: string): Promise<Project> {
  const { data } = await apiClient.post<Project>('/api/projects', { name, description, language })
  return data
}

export async function updateProject(id: number, name: string, description?: string, language?: string): Promise<Project> {
  const { data } = await apiClient.put<Project>(`/api/projects/${id}`, { name, description, language })
  return data
}

export async function deleteProject(id: number): Promise<void> {
  await apiClient.delete(`/api/projects/${id}`)
}
