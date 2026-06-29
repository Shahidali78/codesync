export interface AuthResponse {
  token: string
  username: string
  email: string
  role: string
}

export interface Project {
  id: number
  name: string
  description?: string
  language?: string
  ownerId: number
  ownerUsername: string
  createdAt: string
  updatedAt: string
}

export interface CodeFile {
  id: number
  name: string
  content?: string
  projectId: number
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  projectId: number
  ownerId: number
  active: boolean
  createdAt: string
}

export interface ExecutionResult {
  stdout: string
  stderr: string
  exitCode: number
  durationMs: number
}

export interface ApiError {
  error: string
  fields?: Record<string, string>
}
