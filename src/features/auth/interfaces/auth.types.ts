export interface AuthUser {
  id: string
  email: string
  name: string
  isActive: boolean
  createdAt: string
}

export type AppAction = 'create' | 'read' | 'update' | 'delete' | 'manage'
export type AppSubject = 'Product' | 'Order' | 'User' | 'Role' | 'Promotion' | 'Customer' | 'Sale' | 'all'

export interface EffectivePermission {
  subject: AppSubject
  action: AppAction
}

export interface UserPermissionsResponse {
  permissions: EffectivePermission[]
  permissionCodes: string[]
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
