import { http } from '@/lib/http'

export interface AuthUser {
  id: string
  email: string
  name: string
}

export interface LoginResponse {
  token: string
  user: AuthUser
}

export const authApi = {
  login: (email: string, password: string) =>
    http.post<LoginResponse>('/auth/login', { email, password }),
  me: () => http.get<AuthUser>('/auth/me'),
}
