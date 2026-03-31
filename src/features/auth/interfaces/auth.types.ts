export interface AuthUser {
  id: string
  email: string
  name: string
  isActive: boolean
  createdAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthLoginRequest {
  email: string
  password: string
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser
}
