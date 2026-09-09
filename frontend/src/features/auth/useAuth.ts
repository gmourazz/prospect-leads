import { useContext } from 'react'
import { AuthContext } from './AuthContext'
import { ApiError } from '@/lib/api-error'

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function authErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.code === 'unauthorized') return 'Email ou senha incorretos.'
  return error instanceof ApiError ? error.userMessage : 'Algo deu errado.'
}
