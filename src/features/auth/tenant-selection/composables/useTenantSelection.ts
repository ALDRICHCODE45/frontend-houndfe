import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'

const INVALID_AUTH_STATE_MESSAGE = 'Estado de autenticación inválido para seleccionar sucursal'

type TenantSelectionAction = 'select-tenant' | 'switch-tenant' | 'invalid'

type HttpErrorPayload = {
  response?: {
    status?: number
    data?: {
      message?: string
    }
  }
}

function resolveTenantSelectionAction(params: {
  tempToken: string | null
  isSuperAdmin: boolean
  hasCurrentTenant: boolean
}): TenantSelectionAction {
  if (params.tempToken) {
    return 'select-tenant'
  }

  if (params.isSuperAdmin && !params.hasCurrentTenant) {
    return 'switch-tenant'
  }

  return 'invalid'
}

function isHttpErrorPayload(error: unknown): error is HttpErrorPayload {
  return typeof error === 'object' && error !== null && 'response' in error
}

export function useTenantSelection() {
  const authStore = useAuthStore()
  const router = useRouter()

  const tenants = computed(() => authStore.memberships)
  const isSubmitting = ref(false)
  const error = ref<string | null>(null)

  async function submit(tenantId: string) {
    isSubmitting.value = true
    error.value = null

    try {
      const action = resolveTenantSelectionAction({
        tempToken: authStore.tempToken,
        isSuperAdmin: authStore.isSuperAdmin,
        hasCurrentTenant: authStore.currentTenant !== null,
      })

      if (action === 'select-tenant') {
        await authStore.selectTenant(tenantId)
      } else if (action === 'switch-tenant') {
        await authStore.switchTenant(tenantId)
      } else {
        error.value = INVALID_AUTH_STATE_MESSAGE
        return
      }

      await router.push('/')
    } catch (e: unknown) {
      if (isHttpErrorPayload(e) && e.response?.status === 401) {
        await router.push({ path: '/login', query: { expired: 'tenant' } })
      } else {
        if (isHttpErrorPayload(e) && e.response?.data?.message) {
          error.value = e.response.data.message
        } else {
          error.value = 'Error al seleccionar sucursal'
        }
      }
    } finally {
      isSubmitting.value = false
    }
  }

  function cancel() {
    authStore.clearSession()
    router.push('/login')
  }

  return {
    tenants,
    isSubmitting,
    error,
    submit,
    cancel,
  }
}
