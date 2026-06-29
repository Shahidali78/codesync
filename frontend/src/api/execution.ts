import { apiClient } from './client'
import type { ExecutionResult } from './types'

export async function runCode(language: string, code: string, sessionId?: string): Promise<ExecutionResult> {
  const { data } = await apiClient.post<ExecutionResult>('/api/execute', { language, code, sessionId })
  return data
}
