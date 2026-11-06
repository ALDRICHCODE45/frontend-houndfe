import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'

/** A 401 that survived the token refresh (inactive user, not a member): the existing logout, then the login. */
export function useSessionLogout() {
  const auth = useAuthStore()
  const router = useRouter()
  return async function logout() {
    const redirect = router.currentRoute.value.fullPath
    await auth.logout()
    await router.replace({ path: '/login', query: { redirect } })
  }
}
