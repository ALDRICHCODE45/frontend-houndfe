import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { z } from 'zod'
import { authApi } from '../api/auth.api'
import { authStorage } from '../services/auth-storage'
import { ability, resetAbility, updateAbilityFromPermissionCodes } from '../authorization/ability'
import { decodeJwtClaims } from '../services/jwt.utils'
import { queryClient } from '@/core/shared/api/queryClient'
import type {
  AppAction,
  AppSubject,
  AuthPhase,
  AuthLoginRequest,
  LoginOtpChallenge,
  LoginResponse,
  TenantSummary,
  AuthUser,
  UserPermissionsResponse,
} from '../interfaces/auth.types'

// Validate the consumed wire contract, not JWT authenticity (the server owns proof).
const tokenSchema = z.string().regex(/^\S+$/)
const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
})
const tenantSchema = z.object({ id: z.string(), name: z.string(), slug: z.string() })
const sessionSchema = z.object({
  accessToken: tokenSchema,
  refreshToken: tokenSchema,
  user: userSchema,
})
const loginResultSchema = z.discriminatedUnion('requiresTenantSelection', [
  sessionSchema.extend({
    requiresTenantSelection: z.literal(false),
    tenants: z.array(tenantSchema),
  }),
  z.object({
    requiresTenantSelection: z.literal(true),
    user: userSchema,
    tenants: z.array(tenantSchema),
    tempToken: tokenSchema,
    expiresIn: z.number().finite(),
  }),
])
const permissionCodesSchema = z.object({ permissionCodes: z.array(z.string()) })

function validateLoginPayload(schema: z.ZodType, payload: unknown) {
  if (!schema.safeParse(payload).success) {
    // Local reauthentication signal for the existing selection error handler.
    // Never expose validation details, payloads or tokens through this error.
    throw Object.assign(
      new Error('No se pudo completar el inicio de sesión. Vuelve a intentarlo.'),
      {
        response: { status: 401 },
      },
    )
  }
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const permissionCodes = ref<string[]>([])
  const permissionsLoaded = ref(false)
  const authPhase = ref<AuthPhase>('idle')
  const authError = ref<string | null>(null)
  const currentTenant = ref<TenantSummary | null>(null)
  const memberships = ref<TenantSummary[]>([])
  const isSuperAdmin = ref(false)
  const tempToken = ref<string | null>(null)
  const otpChallenge = ref<(LoginOtpChallenge & { expiresAt: number; resendAt: number }) | null>(
    null,
  )
  const otpError = ref<string | null>(null)
  const otpRestartRequired = ref(false)
  const otpRetryAt = ref(0)
  const loginBusy = ref(false)
  let loginGeneration = 0
  let activeLoginOperation: symbol | null = null

  function cancelLogin() {
    loginGeneration++
    activeLoginOperation = null
    loginBusy.value = false
    otpChallenge.value = null
    otpError.value = null
    otpRestartRequired.value = false
    otpRetryAt.value = 0
    authError.value = null
    if (authPhase.value === 'authenticating' || authPhase.value === 'selecting-tenant') {
      authPhase.value = accessToken.value ? 'authenticated' : 'idle'
    }
  }

  function beginLoginOperation() {
    const generation = loginGeneration
    const identity = Symbol('login operation')
    activeLoginOperation = identity
    loginBusy.value = true
    return {
      isCurrent: () => generation === loginGeneration && identity === activeLoginOperation,
      finish() {
        if (generation === loginGeneration && identity === activeLoginOperation) {
          activeLoginOperation = null
          loginBusy.value = false
        }
      },
    }
  }

  function replaceChallenge(value: LoginOtpChallenge) {
    // Reject old direct-session responses and mixed envelopes before any session effect.
    if (
      !value ||
      value.requiresOtp !== true ||
      typeof value.challengeId !== 'string' ||
      !value.challengeId ||
      !Number.isFinite(value.expiresIn) ||
      value.expiresIn <= 0 ||
      !Number.isFinite(value.resendAfter) ||
      value.resendAfter < 0 ||
      ['accessToken', 'refreshToken', 'tempToken', 'user', 'tenants'].some((key) => key in value)
    ) {
      throw new Error('Invalid login challenge')
    }
    const now = Date.now()
    otpChallenge.value = {
      requiresOtp: true,
      challengeId: value.challengeId,
      expiresIn: value.expiresIn,
      resendAfter: value.resendAfter,
      expiresAt: now + value.expiresIn * 1000,
      resendAt: now + value.resendAfter * 1000,
    }
    otpRetryAt.value = 0
    otpRestartRequired.value = false
  }

  function handleOtpError(error: unknown, operation: 'verify' | 'resend', proofConsumed = false) {
    const response = (
      error as {
        response?: {
          status?: number
          data?: { retryAfter?: number }
          headers?: Record<string, unknown>
        }
      }
    )?.response
    if (!proofConsumed && response?.status === 429) {
      const seconds = Number(response.data?.retryAfter ?? response.headers?.['retry-after'])
      otpRetryAt.value =
        Date.now() + (Number.isFinite(seconds) && seconds >= 0 ? seconds : 60) * 1000
      if (operation === 'resend' && otpChallenge.value) {
        otpChallenge.value = { ...otpChallenge.value, resendAt: otpRetryAt.value }
      }
      otpError.value = 'Demasiados intentos. Espera antes de volver a intentar.'
      return
    }
    if (
      !proofConsumed &&
      (response?.status === 400 || (operation === 'verify' && response?.status === 401))
    ) {
      otpError.value =
        response.status === 400
          ? 'Revisa el código e intenta de nuevo.'
          : 'No se pudo verificar el código. Intenta de nuevo o vuelve a iniciar sesión.'
      return
    }
    otpChallenge.value = null
    otpRestartRequired.value = true
    otpError.value = 'No se pudo completar la verificación. Vuelve a iniciar sesión.'
  }

  const isAuthenticated = computed(() => Boolean(accessToken.value))
  const currentTenantId = computed(() => currentTenant.value?.id ?? '')

  function setPermissionCodes(nextCodes: string[]) {
    const uniqueCodes = Array.from(new Set(nextCodes))
    permissionCodes.value = uniqueCodes
    permissionsLoaded.value = true
    authStorage.setPermissionCodes(uniqueCodes)
    updateAbilityFromPermissionCodes(uniqueCodes)
  }

  function clearPermissions(options?: { persist?: boolean }) {
    permissionCodes.value = []
    permissionsLoaded.value = false
    resetAbility()

    if (options?.persist !== false) {
      authStorage.clearPermissionCodes()
    }
  }

  function hydrateFromStorage() {
    accessToken.value = authStorage.getAccessToken()
    refreshToken.value = authStorage.getRefreshToken()
    user.value = authStorage.getUser()
    hydrateTenantFromStorage()

    if (!accessToken.value) {
      authPhase.value = tempToken.value ? 'needs-tenant-selection' : 'idle'
      clearPermissions()
      return
    }

    authPhase.value = 'authenticated'

    const storedPermissionCodes = authStorage.getPermissionCodes()

    if (storedPermissionCodes !== null) {
      setPermissionCodes(storedPermissionCodes)
      return
    }

    clearPermissions()
  }

  function hydrateTenantFromStorage() {
    currentTenant.value = authStorage.getCurrentTenant()
    memberships.value = authStorage.getMemberships() ?? []
    isSuperAdmin.value = authStorage.getIsSuperAdmin() ?? false
    tempToken.value = authStorage.getTempToken()
  }

  function setSession(payload: { accessToken: string; refreshToken: string; user: AuthUser }) {
    setSessionFromTokens(payload.accessToken, payload.refreshToken)
    user.value = payload.user
    authStorage.setUser(payload.user)
    clearPermissions()
  }

  function setSessionFromTokens(nextAccessToken: string, nextRefreshToken: string) {
    cancelLogin()
    applySessionTokens(nextAccessToken, nextRefreshToken)
  }

  function applySessionTokens(nextAccessToken: string, nextRefreshToken: string) {
    accessToken.value = nextAccessToken
    refreshToken.value = nextRefreshToken
    authStorage.setTokens({ accessToken: nextAccessToken, refreshToken: nextRefreshToken })

    const claims = decodeJwtClaims(nextAccessToken)
    isSuperAdmin.value = claims.isSuperAdmin
    authStorage.setIsSuperAdmin(claims.isSuperAdmin)

    if (!claims.tenantId) {
      currentTenant.value = null
      authStorage.setCurrentTenant(null)
      return
    }

    const resolvedTenant = {
      id: claims.tenantId,
      name: memberships.value.find((tenant) => tenant.id === claims.tenantId)?.name ?? '',
      slug: claims.tenantSlug ?? '',
    }

    currentTenant.value = resolvedTenant
    authStorage.setCurrentTenant(resolvedTenant)
  }

  function clearSession() {
    cancelLogin()
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    authPhase.value = 'idle'
    currentTenant.value = null
    memberships.value = []
    isSuperAdmin.value = false
    tempToken.value = null
    clearPermissions({ persist: false })
    authStorage.clear()
  }

  async function login(payload: AuthLoginRequest) {
    if (loginBusy.value) return null
    cancelLogin()
    const operation = beginLoginOperation()
    authPhase.value = 'authenticating'
    try {
      const response = await authApi.login(payload)
      if (!operation.isCurrent()) return null
      replaceChallenge(response)
      authPhase.value = accessToken.value ? 'authenticated' : 'idle'
      return response
    } catch (error: unknown) {
      if (!operation.isCurrent()) return null
      authPhase.value = accessToken.value ? 'authenticated' : 'idle'
      const axiosError = error as { response?: { status?: number; data?: { message?: string } } }
      if (
        axiosError?.response?.status === 403 &&
        axiosError.response.data?.message === 'User does not belong to an active tenant'
      ) {
        authError.value = 'No tienes acceso a ninguna sucursal. Contacta al administrador.'
      }
      throw error
    } finally {
      operation.finish()
    }
  }

  async function resendLoginOtp() {
    if (
      loginBusy.value ||
      !otpChallenge.value ||
      Date.now() < Math.max(otpChallenge.value.resendAt, otpRetryAt.value)
    )
      return null
    const challengeId = otpChallenge.value.challengeId
    const operation = beginLoginOperation()
    otpError.value = null
    try {
      const response = await authApi.resendLoginOtp({ challengeId })
      if (!operation.isCurrent()) return null
      replaceChallenge(response)
      return response
    } catch (error) {
      if (!operation.isCurrent()) return null
      handleOtpError(error, 'resend')
      throw error
    } finally {
      operation.finish()
    }
  }

  async function verifyLoginOtp(rawCode: string) {
    if (loginBusy.value || !otpChallenge.value || Date.now() < otpRetryAt.value) return null
    const code = rawCode.trim()
    if (!/^[0-9]{6}$/.test(code)) {
      otpError.value = 'Ingresa los 6 dígitos del código.'
      throw new Error('Invalid code format')
    }
    const challengeId = otpChallenge.value.challengeId
    const operation = beginLoginOperation()
    otpError.value = null
    let proofConsumed = false
    try {
      const response = await authApi.verifyLoginOtp({ challengeId, code })
      if (!operation.isCurrent()) return null
      proofConsumed = true
      const result = await completeVerifiedLogin(response, operation.isCurrent)
      if (!operation.isCurrent()) return null
      otpChallenge.value = null
      return result
    } catch (error) {
      if (!operation.isCurrent()) return null
      handleOtpError(error, 'verify', proofConsumed)
      throw error
    } finally {
      operation.finish()
    }
  }

  async function completeVerifiedLogin(response: LoginResponse, isCurrent: () => boolean) {
    validateLoginPayload(loginResultSchema, response)
    if (response.requiresTenantSelection) {
      tempToken.value = response.tempToken
      memberships.value = response.tenants
      user.value = response.user
      authStorage.setTempToken(response.tempToken)
      authStorage.setMemberships(response.tenants)
      authPhase.value = 'needs-tenant-selection'
      return response
    }

    const claims = decodeJwtClaims(response.accessToken)
    const requiresSuperAdminTenantSelection = claims.isSuperAdmin && !claims.tenantId
    const permissions = requiresSuperAdminTenantSelection
      ? null
      : await authApi.mePermissions(response.accessToken)
    if (!isCurrent()) return null
    if (!requiresSuperAdminTenantSelection) validateLoginPayload(permissionCodesSchema, permissions)

    memberships.value = response.tenants
    authStorage.setMemberships(response.tenants)
    applySessionTokens(response.accessToken, response.refreshToken)
    user.value = response.user
    authStorage.setUser(response.user)
    tempToken.value = null
    authStorage.setTempToken(null)
    clearPermissions()

    if (requiresSuperAdminTenantSelection) {
      authPhase.value = 'needs-tenant-selection'
      return response
    }

    if (permissions) setPermissionCodes(permissions.permissionCodes)
    authPhase.value = 'authenticated'
    return response
  }

  async function selectTenant(tenantId: string) {
    if (loginBusy.value || !tempToken.value) {
      throw new Error('Tenant selection unavailable')
    }
    const selectionToken = tempToken.value
    const operation = beginLoginOperation()
    authPhase.value = 'selecting-tenant'
    try {
      const response = await authApi.selectTenant({ tempToken: selectionToken, tenantId })
      if (!operation.isCurrent()) throw new Error('Login operation cancelled')
      validateLoginPayload(sessionSchema, response)
      const permissions = await authApi.mePermissions(response.accessToken)
      if (!operation.isCurrent()) throw new Error('Login operation cancelled')
      validateLoginPayload(permissionCodesSchema, permissions)
      applySessionTokens(response.accessToken, response.refreshToken)
      user.value = response.user
      authStorage.setUser(response.user)
      tempToken.value = null
      authStorage.setTempToken(null)
      setPermissionCodes(permissions.permissionCodes)
      authPhase.value = 'authenticated'
    } catch (error) {
      // Do not let a stale rejection redirect the selection composable to login.
      if (!operation.isCurrent()) throw new Error('Login operation cancelled')
      tempToken.value = null
      authStorage.setTempToken(null)
      if (!accessToken.value) {
        memberships.value = []
        user.value = null
        authStorage.setMemberships([])
      }
      authPhase.value = accessToken.value ? 'authenticated' : 'idle'
      throw error
    } finally {
      operation.finish()
    }
  }

  async function switchTenant(tenantId: string | null) {
    authPhase.value = 'selecting-tenant'

    try {
      const response = await authApi.switchTenant({ tenantId })
      setSessionFromTokens(response.accessToken, response.refreshToken)
      clearPermissions()
      queryClient.clear()
      await fetchPermissions()
      authPhase.value = 'authenticated'
    } catch (error) {
      // Distinguish recoverable errors from unrecoverable ones
      const axiosError = error as { response?: { status?: number; data?: { code?: string } } }
      const errorCode = axiosError?.response?.data?.code
      const isRecoverableError =
        axiosError?.response?.status === 403 &&
        (errorCode === 'SUPER_ADMIN_REQUIRED' ||
          errorCode === 'TENANT_INACTIVE' ||
          errorCode === 'TENANT_ACCESS_DENIED')

      if (isRecoverableError) {
        // Keep session intact — user stays logged in with the current tenant
        authPhase.value = 'authenticated'
      } else {
        // Only clear session for unrecoverable errors (network, 500, unknown)
        clearSession()
      }

      throw error
    }
  }

  async function fetchMe() {
    if (!accessToken.value) return null

    const me = await authApi.me()
    // /me enriches the JWT tenant; it cannot select a different session context.
    // Return null (not an error) so the router does not clear the session on mismatch.
    if (
      !accessToken.value ||
      (me.tenant?.id ?? null) !== decodeJwtClaims(accessToken.value).tenantId
    ) {
      return null
    }

    user.value = {
      id: me.id,
      email: me.email,
      name: me.name,
      isActive: me.isActive,
      createdAt: me.createdAt,
    }
    currentTenant.value = me.tenant
    memberships.value = me.memberships

    authStorage.setUser(user.value)
    authStorage.setCurrentTenant(me.tenant)
    authStorage.setMemberships(me.memberships)

    return me
  }

  async function fetchPermissions(): Promise<UserPermissionsResponse | null> {
    if (!accessToken.value) return null

    const response = await authApi.mePermissions()
    setPermissionCodes(response.permissionCodes)
    return response
  }

  function userCan(action: AppAction, subject: AppSubject) {
    // Keep Vue reactivity linked to permission updates in templates/computed
    const currentPermissionCodes = permissionCodes.value
    void currentPermissionCodes

    return ability.can(action, subject)
  }

  async function logout() {
    try {
      if (accessToken.value) {
        await authApi.logout()
      }
    } finally {
      clearSession()
    }
  }

  return {
    user,
    accessToken,
    refreshToken,
    permissionCodes,
    permissionsLoaded,
    authPhase,
    authError,
    currentTenant,
    memberships,
    isSuperAdmin,
    currentTenantId,
    tempToken,
    isAuthenticated,
    hydrateFromStorage,
    hydrateTenantFromStorage,
    setSession,
    setSessionFromTokens,
    setPermissionCodes,
    clearPermissions,
    clearSession,
    login,
    otpChallenge,
    otpError,
    otpRestartRequired,
    otpRetryAt,
    loginBusy,
    cancelLogin,
    verifyLoginOtp,
    resendLoginOtp,
    selectTenant,
    switchTenant,
    fetchMe,
    fetchPermissions,
    userCan,
    logout,
  }
})
