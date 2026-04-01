import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '../api/auth.api'
import { authStorage } from '../services/auth-storage'
import { ability, resetAbility, updateAbilityFromPermissionCodes } from '../authorization/ability'
import type {
  AppAction,
  AppSubject,
  AuthLoginRequest,
  AuthUser,
  UserPermissionsResponse,
} from '../interfaces/auth.types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const permissionCodes = ref<string[]>([])
  const permissionsLoaded = ref(false)

  const isAuthenticated = computed(() => Boolean(accessToken.value))

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

    if (!accessToken.value) {
      clearPermissions()
      return
    }

    const storedPermissionCodes = authStorage.getPermissionCodes()

    if (storedPermissionCodes !== null) {
      setPermissionCodes(storedPermissionCodes)
      return
    }

    clearPermissions()
  }

  function setSession(payload: { accessToken: string; refreshToken: string; user: AuthUser }) {
    accessToken.value = payload.accessToken
    refreshToken.value = payload.refreshToken
    user.value = payload.user

    authStorage.setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken })
    authStorage.setUser(payload.user)
    clearPermissions()
  }

  function clearSession() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    clearPermissions({ persist: false })
    authStorage.clear()
  }

  async function login(payload: AuthLoginRequest) {
    const response = await authApi.login(payload)
    setSession(response)

    try {
      await fetchPermissions()
    } catch (error) {
      clearSession()
      throw error
    }

    return response
  }

  async function fetchMe() {
    if (!accessToken.value) return null

    const me = await authApi.me()
    user.value = me
    authStorage.setUser(me)
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
    isAuthenticated,
    hydrateFromStorage,
    setSession,
    setPermissionCodes,
    clearPermissions,
    clearSession,
    login,
    fetchMe,
    fetchPermissions,
    userCan,
    logout,
  }
})
