export interface AuthUser {
  id: string
  email: string
  name: string
  isActive: boolean
  createdAt: string
}

export interface AuthMeResponse extends AuthUser {
  tenant: TenantSummary | null
  memberships: TenantSummary[]
}

export interface TenantSummary {
  id: string
  name: string
  slug: string
  // Optional fields surfaced on the tenant selection surface (TenantSelectionView).
  // All optional so the type stays compatible with the current backend payload —
  // when the API starts exposing address/status/staff, the UI renders them via
  // v-if without a type or store change. The selection contract does not depend
  // on these fields; they are pure presentation enrichment.
  address?: string | null
  /** 'open' = currently operating, 'closed' = not operating. Free-form to allow
   *  future states (e.g. 'maintenance') without a type bump. */
  status?: 'open' | 'closed' | string | null
  /** Number of staff currently on shift at this branch. Rendered as "N en turno". */
  onShiftCount?: number | null
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

export type AppAction = 'create' | 'read' | 'update' | 'delete' | 'batch_delete' | 'manage'
export type AppSubject =
  | 'Product'
  | 'Order'
  | 'User'
  | 'Role'
  | 'Promotion'
  | 'Customer'
  | 'Sale'
  | 'Quotation'
  | 'TenantMembership'
  | 'Employee'
  | 'EmployeeSalary'
  | 'EmployeeDocument'
  | 'EmployeeTimeOff'
  | 'EmployeeTimeOffMedical'
  | 'EmployeeEmergencyContact'
  | 'NotificationConfig'
  // sdd payment-details-admin S1 — REQ-AUTH-001: 'PaymentDetail' joins the
  // AppSubject union before 'all'. Registering the subject in the union is
  // the single act that unlocks permission parsing + route guards + menu/button
  // gating for the Datos bancarios admin.
  | 'PaymentDetail'
  // sdd custom-payment-methods S1 — REQ-PM-006: 'PaymentMethod' joins the
  // AppSubject union before 'all'. Mirror of the PaymentDetail registration
  // (same silent-drop risk if dropped: parsePermissionCode returns null and
  // the ability never updates, the sidebar/route stays hidden). The pin-tests
  // in ability.test.ts (sdd custom-payment-methods S1) assert all four CRUD
  // codes grant the action and a malformed sibling does not revoke the
  // well-formed grant.
  | 'PaymentMethod'
  | 'all'

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
