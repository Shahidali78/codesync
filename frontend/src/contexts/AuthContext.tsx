import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface AuthState {
  token: string | null
  username: string | null
  email: string | null
}

interface AuthContextValue extends AuthState {
  setAuth: (token: string, username: string, email: string) => void
  logout: () => void
  isLoggedIn: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    token:    localStorage.getItem('token'),
    username: localStorage.getItem('username'),
    email:    localStorage.getItem('email'),
  }))

  const setAuth = useCallback((token: string, username: string, email: string) => {
    localStorage.setItem('token',    token)
    localStorage.setItem('username', username)
    localStorage.setItem('email',    email)
    setState({ token, username, email })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('email')
    setState({ token: null, username: null, email: null })
  }, [])

  return (
    <AuthContext.Provider value={{ ...state, setAuth, logout, isLoggedIn: !!state.token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
