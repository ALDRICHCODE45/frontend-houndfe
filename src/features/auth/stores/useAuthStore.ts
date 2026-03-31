import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '../api/auth.api'
import { authStorage } from '../services/auth-storage'
import type { AuthLoginRequest, AuthUser } from '../interfaces/auth.types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)

  const isAuthenticated = computed(() => Boolean(accessToken.value))

  function hydrateFromStorage() {
    accessToken.value = authStorage.getAccessToken()
    refreshToken.value = authStorage.getRefreshToken()
    user.value = authStorage.getUser()
  }

  function setSession(payload: { accessToken: string; refreshToken: string; user: AuthUser }) {
    accessToken.value = payload.accessToken
    refreshToken.value = payload.refreshToken
    user.value = payload.user

    authStorage.setTokens({ accessToken: payload.accessToken, refreshToken: payload.refreshToken })
    authStorage.setUser(payload.user)
  }

  function clearSession() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    authStorage.clear()
  }

  async function login(payload: AuthLoginRequest) {
    const response = await authApi.login(payload)
    setSession(response)
    return response
  }

  async function fetchMe() {
    if (!accessToken.value) return null

    const me = await authApi.me()
    user.value = me
    authStorage.setUser(me)
    return me
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
    isAuthenticated,
    hydrateFromStorage,
    setSession,
    clearSession,
    login,
    fetchMe,
    logout,
  }
})
