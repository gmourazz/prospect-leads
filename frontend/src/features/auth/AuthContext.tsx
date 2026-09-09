import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { authApi, type AuthUser } from './api/auth.api'
import { clearToken, getToken, onSessionExpired, setToken } from '@/lib/http'

export interface AuthContextValue {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

// Exported so useAuth.ts (a separate file) can read it. Keeping this file to
// ONLY a component export is what keeps Vite's Fast Refresh boundary stable —
// a file mixing a component with plain function exports (the hook, a helper)
// is the classic trigger for "useX must be used within Provider" errors
// appearing spuriously after an edit-triggered hot reload.
export const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Session state is genuine client-only global state — not server data a
 * query would own — so it lives in Context, per the one exception the
 * architecture reserves for it. Everything else in this app goes through
 * TanStack Query.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    clearToken()
    setUser(null)
  }, [])

  useEffect(() => {
    onSessionExpired(logout)
  }, [logout])

  useEffect(() => {
    const token = getToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => clearToken())
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await authApi.login(email, password)
    setToken(token)
    setUser(user)
  }, [])

  const value = useMemo(() => ({ user, isLoading, login, logout }), [user, isLoading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
