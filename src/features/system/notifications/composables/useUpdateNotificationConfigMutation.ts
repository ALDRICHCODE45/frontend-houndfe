// useUpdateNotificationConfigMutation.ts — PUT /notification-config.
//
// Structure mirrors `useUpdateEmployee` (TanStack mutation + toast +
// invalidate), but PUT is full-overwrite, not PATCH. The error routing
// passes the response through `mapNotificationConfigError` and dispatches
// the `{field?,toast?}` shape to either an inline field error or a toast.
//
// The dispatch logic is split into two PURE helpers — `handleUpdateSuccess`
// and `handleUpdateError` — that accept their side-effect collaborators via
// a `deps` object. This is the extract-before-mock pattern: every
// observable behaviour of the mutation (invalidate, re-hydrate, toast,
// field error) is asserted against a mock dep, with no Pinia, no
// QueryClient, no toast runtime in the test.

import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { notificationConfigQueryKeys } from '@/core/shared/constants/query-keys'
import { notificationConfigApi } from '../api/notificationConfig.api'
import {
  fromConfigResponse,
  mapNotificationConfigError,
  type NotificationConfigErrorInput,
  type NotificationConfigErrorShape,
} from '../utils/notificationConfigMappers'
import type {
  NotificationConfigForm,
  NotificationConfigPutBody,
  NotificationConfigResponse,
} from '../interfaces/notification-config.types'
import { NOTIFICATION_CONFIG_COPY } from '../copy'

// useToast is auto-imported by @nuxt/ui/vite plugin (unplugin-auto-import).
// In tests, stub via vi.stubGlobal('useToast', () => ({ add: mockFn })).
declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

/**
 * Side-effect collaborators the mutation delegates to. Pure handlers
 * accept these so they can be unit-tested with `vi.fn()` mocks — no
 * Pinia, no QueryClient, no toast runtime in the unit tests.
 */
export interface UpdateMutationDeps {
  /** Invalidate the per-tenant config query so the next read is fresh. */
  invalidateConfig: () => void
  /** Replace the local form snapshot with the canonical server state. */
  setForm: (form: NotificationConfigForm) => void
  /** Fire a Spanish toast (success or error). */
  addToast: (toast: { title: string; color: 'success' | 'error' }) => void
  /** Attach a Spanish message to an inline field (RecipientSelect). */
  setFieldError: (field: 'recipients', message: string) => void
  /** Clear a previously-attached inline field error on success. */
  clearFieldError: (field: 'recipients') => void
}

/**
 * Spanish copy that lives in the same module as the handlers so the
 * strings never drift between tests and the production runtime.
 */
const SPANISH = {
  recipientFieldInvalid: 'Uno de los usuarios seleccionados no pertenece a esta cuenta',
  success: 'Configuración de notificaciones guardada',
} as const

/**
 * PURE success handler — invalidates, re-hydrates, fires Spanish toast.
 * Exported for direct unit testing (no mocks needed beyond deps).
 */
export function handleUpdateSuccess(
  response: NotificationConfigResponse,
  deps: UpdateMutationDeps,
): void {
  deps.invalidateConfig()
  // Re-hydration: the response IS the canonical state. Run it through the
  // mapper so the form shape stays consistent (recipients → recipientUserIds).
  deps.setForm(fromConfigResponse(response))
  // Clear any prior field error — the new server state is authoritative.
  deps.clearFieldError('recipients')
  deps.addToast({ title: SPANISH.success, color: 'success' })
}

/**
 * PURE error router — passes the error through `mapNotificationConfigError`
 * and dispatches to either an inline field error or a Spanish toast.
 * Accepts the same `deps` shape as `handleUpdateSuccess` so the composable
 * can wire them up once and pass them both to the mutation callbacks.
 */
export function handleUpdateError(
  error: NotificationConfigErrorInput | string | null | undefined,
  deps: UpdateMutationDeps,
): void {
  const shape: NotificationConfigErrorShape = mapNotificationConfigError(error)

  if (shape.field === 'recipients') {
    // Field-level error — NEVER also fire a toast (spec REQ-8).
    deps.setFieldError('recipients', SPANISH.recipientFieldInvalid)
    return
  }

  if (shape.toast) {
    deps.addToast({ title: shape.toast, color: 'error' })
  }
}

/**
 * useUpdateNotificationConfigMutation — composable wrapper.
 *
 * Returns the same shape as `useUpdateEmployee`:
 *   - mutateAsync(body)  — call to trigger the update
 *   - isPending          — true while the request is in-flight
 *   - error              — the last error, or null
 *
 * The composable does NOT own the form snapshot — that lives in the form
 * composable. To wire re-hydration, pass `setForm` and the field-error
 * setters in via `deps`. The default `deps` are wired to queryClient +
 * toast + a closure that pokes the form (the caller passes them in).
 */
export function useUpdateNotificationConfigMutation(deps: {
  setForm: (form: NotificationConfigForm) => void
  setFieldError: (field: 'recipients', message: string) => void
  clearFieldError: (field: 'recipients') => void
}) {
  const queryClient = useQueryClient()
  const authStore = useAuthStore()
  const toast = useToast()

  const tenantId = authStore.currentTenantId

  const mutation = useMutation<
    NotificationConfigResponse,
    AxiosError,
    NotificationConfigPutBody
  >({
    mutationFn: (body) => notificationConfigApi.update(body),

    onSuccess: (response) => {
      handleUpdateSuccess(response, {
        invalidateConfig: () => {
          void queryClient.invalidateQueries({
            queryKey: notificationConfigQueryKeys.config(tenantId),
          })
        },
        setForm: deps.setForm,
        addToast: (t) => toast.add(t),
        setFieldError: deps.setFieldError,
        clearFieldError: deps.clearFieldError,
      })
    },

    onError: (error: AxiosError) => {
      handleUpdateError(extractErrorPayload(error), {
        invalidateConfig: () => undefined,
        setForm: () => undefined,
        addToast: (t) => toast.add(t),
        setFieldError: deps.setFieldError,
        clearFieldError: deps.clearFieldError,
      })
    },
  })

  return {
    /** Call to trigger the update. Throws on error — wrap with try/catch if needed. */
    mutateAsync: mutation.mutateAsync,
    /** True while the request is in-flight */
    isPending: mutation.isPending,
    /** The last error, or null */
    error: mutation.error,
  }
}

/**
 * Best-effort extraction of the backend error payload from an Axios error.
 * The backend returns `{ code, message }` on the response body, so we
 * prefer that. Falls back to status-only for transport-level errors.
 */
function extractErrorPayload(error: AxiosError): NotificationConfigErrorInput {
  const data = error.response?.data as { code?: unknown; message?: unknown } | undefined
  const code = typeof data?.code === 'string' ? data.code : undefined
  return {
    status: error.response?.status,
    code,
  }
}

// Re-export the success copy so WU-8 and the view can import the same string.
export { NOTIFICATION_CONFIG_COPY }
