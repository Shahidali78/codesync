import { apiClient } from './client'
import type { CodeFile } from './types'

export async function listFiles(projectId: number): Promise<CodeFile[]> {
  const { data } = await apiClient.get<CodeFile[]>(`/api/projects/${projectId}/files`)
  return data
}

export async function getFile(projectId: number, fileId: number): Promise<CodeFile> {
  const { data } = await apiClient.get<CodeFile>(`/api/projects/${projectId}/files/${fileId}`)
  return data
}

export async function createFile(projectId: number, name: string, content?: string): Promise<CodeFile> {
  const { data } = await apiClient.post<CodeFile>(`/api/projects/${projectId}/files`, { name, content })
  return data
}

export async function updateFile(projectId: number, fileId: number, name: string, content?: string): Promise<CodeFile> {
  const { data } = await apiClient.put<CodeFile>(`/api/projects/${projectId}/files/${fileId}`, { name, content })
  return data
}

export async function deleteFile(projectId: number, fileId: number): Promise<void> {
  await apiClient.delete(`/api/projects/${projectId}/files/${fileId}`)
}
