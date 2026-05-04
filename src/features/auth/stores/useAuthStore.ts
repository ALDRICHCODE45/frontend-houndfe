import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
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
  TenantSummary,
  AuthUser,
  UserPermissionsResponse,
} from '../interfaces/auth.types'

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
    authPhase.value = 'authenticating'
    authError.value = null

    let response
    try {
      response = await authApi.login(payload)
    } catch (error: unknown) {
      authPhase.value = 'idle'
      const axiosError = error as { response?: { status?: number; data?: { message?: string } } }
      if (
        axiosError?.response?.status === 403 &&
        axiosError?.response?.data?.message === 'User does not belong to an active tenant'
      ) {
        authError.value = 'No tienes acceso a ninguna sucursal. Contacta al administrador.'
      }
      throw error
    }

    if (response.requiresTenantSelection) {
      tempToken.value = response.tempToken
      memberships.value = response.tenants
      user.value = response.user
      authStorage.setTempToken(response.tempToken)
      authStorage.setMemberships(response.tenants)
      authPhase.value = 'needs-tenant-selection'
      return response
    }

    memberships.value = response.tenants
    authStorage.setMemberships(response.tenants)
    setSessionFromTokens(response.accessToken, response.refreshToken)
    user.value = response.user
    authStorage.setUser(response.user)
    tempToken.value = null
    authStorage.setTempToken(null)
    clearPermissions()

    const requiresSuperAdminTenantSelection = isSuperAdmin.value && currentTenant.value === null
    if (requiresSuperAdminTenantSelection) {
      authPhase.value = 'needs-tenant-selection'
      return response
    }

    authPhase.value = 'authenticated'

    try {
      await fetchPermissions()
    } catch (error) {
      clearSession()
      throw error
    }

    return response
  }

  async function selectTenant(tenantId: string) {
    if (!tempToken.value) {
      throw new Error('Tenant selection token missing')
    }

    authPhase.value = 'selecting-tenant'

    let response
    try {
      response = await authApi.selectTenant({ tempToken: tempToken.value, tenantId })
    } catch (error) {
      // Clear temp state on any failure (covers INVALID_TEMP_TOKEN and other errors)
      tempToken.value = null
      authStorage.setTempToken(null)
      authPhase.value = 'idle'
      throw error
    }

    setSessionFromTokens(response.accessToken, response.refreshToken)
    user.value = response.user
    authStorage.setUser(response.user)
    tempToken.value = null
    authStorage.setTempToken(null)

    await fetchPermissions()
    authPhase.value = 'authenticated'
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
        (errorCode === 'SUPER_ADMIN_REQUIRED' || errorCode === 'TENANT_INACTIVE' || errorCode === 'TENANT_ACCESS_DENIED')

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
    selectTenant,
    switchTenant,
    fetchMe,
    fetchPermissions,
    userCan,
    logout,
  }
})
