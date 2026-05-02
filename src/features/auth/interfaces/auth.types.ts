export interface AuthUser {
  id: string
  email: string
  name: string
  isActive: boolean
  createdAt: string
}

export interface TenantSummary {
  id: string
  name: string
  slug: string
}

export interface AuthJwtClaims {
  sub: string
  email: string
  tenantId: string | null
  tenantSlug: string | null
  isSuperAdmin: boolean
  iat: number
  exp: number
}

export type AuthPhase =
  | 'idle'
  | 'authenticating'
  | 'needs-tenant-selection'
  | 'selecting-tenant'
  | 'authenticated'

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

export interface LoginSuccessResponse extends AuthTokens {
  requiresTenantSelection: false
  user: AuthUser
  tenants: TenantSummary[]
}

export interface LoginTenantSelectionResponse {
  requiresTenantSelection: true
  user: AuthUser
  tenants: TenantSummary[]
  tempToken: string
  expiresIn: number
}

export type LoginResponse = LoginSuccessResponse | LoginTenantSelectionResponse

export interface AuthResponse extends AuthTokens {
  user: AuthUser
}

export interface SelectTenantRequest {
  tempToken: string
  tenantId: string
}

export interface SelectTenantResponse {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

export interface SwitchTenantRequest {
  tenantId: string | null
}

export interface SwitchTenantResponse {
  accessToken: string
  refreshToken: string
}
