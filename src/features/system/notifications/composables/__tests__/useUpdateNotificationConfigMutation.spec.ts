// useUpdateNotificationConfigMutation.spec.ts — RED-first tests for the
// mutation handler logic.
//
// The composable has THREE concerns that we test PURE (no Pinia, no
// QueryClient, no toast runtime):
//   1. handleUpdateSuccess — invalidates the config query, re-hydrates the
//      response through fromConfigResponse, fires a Spanish success toast.
//   2. handleUpdateError   — routes the error through mapNotificationConfigError
//      and dispatches to either a field-level error attacher OR a toast.
//   3. The error-routing shape contract: INVALID_RECIPIENT must NEVER
//      trigger a toast, UNKNOWN_ACTION_KEY must NEVER trigger a field error.

import { describe, it, expect, vi } from 'vitest'
import type { AxiosError } from 'axios'
import {
  handleUpdateSuccess,
  handleUpdateError,
  extractErrorPayload,
  type UpdateMutationDeps,
} from '../useUpdateNotificationConfigMutation'
import { fromConfigResponse } from '../../utils/notificationConfigMappers'
import type { NotificationConfigResponse } from '../../interfaces/notification-config.types'

function makeDeps(overrides: Partial<UpdateMutationDeps> = {}): UpdateMutationDeps {
  return {
    invalidateConfig: vi.fn(),
    setForm: vi.fn(),
    addToast: vi.fn(),
    setFieldError: vi.fn(),
    clearFieldError: vi.fn(),
    ...overrides,
  }
}

describe('handleUpdateSuccess', () => {
  it('invalidates the config query, re-hydrates the form, fires Spanish success toast', () => {
    const deps = makeDeps()
    const response: NotificationConfigResponse = {
      enabled: true,
      recipients: ['u1'],
      enabledActions: ['LOW_STOCK'],
    }

    handleUpdateSuccess(response, deps)

    expect(deps.invalidateConfig).toHaveBeenCalledTimes(1)
    // Re-hydration: the form snapshot is the response after the mapper ran
    // (recipients → recipientUserIds).
    expect(deps.setForm).toHaveBeenCalledWith(fromConfigResponse(response))
    // Spanish success toast — non-empty, contains the canonical copy.
    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string; color?: string }
    expect(toastCall.color).toBe('success')
    expect(toastCall.title.length).toBeGreaterThan(0)
    expect(toastCall.title).toMatch(/guardad|guardada|configuraci/i) // spec text
  })

  it('clears any prior recipient field error on success (re-hydration is canonical)', () => {
    const deps = makeDeps()
    const response: NotificationConfigResponse = {
      enabled: true,
      recipients: ['u1'],
      enabledActions: ['LOW_STOCK'],
    }

    handleUpdateSuccess(response, deps)

    expect(deps.clearFieldError).toHaveBeenCalledWith('recipients')
  })

  it('triangulates: a different response produces a different form snapshot', () => {
    const deps = makeDeps()
    const response: NotificationConfigResponse = {
      enabled: false,
      recipients: [],
      enabledActions: [],
    }

    handleUpdateSuccess(response, deps)

    expect(deps.setForm).toHaveBeenCalledWith({
      enabled: false,
      recipientUserIds: [],
      enabledActions: [],
    })
  })
})

describe('handleUpdateError (routes through mapNotificationConfigError)', () => {
  it('INVALID_RECIPIENT → attaches to recipients field, NO toast, NO clear of others', () => {
    const deps = makeDeps()
    const error = { code: 'INVALID_RECIPIENT' }

    handleUpdateError(error, deps)

    expect(deps.setFieldError).toHaveBeenCalledWith('recipients', expect.any(String))
    // Spanish copy non-empty
    const fieldCall = vi.mocked(deps.setFieldError).mock.calls[0]!
    expect((fieldCall[1] as string).length).toBeGreaterThan(0)
    // No toast for field-level errors.
    expect(deps.addToast).not.toHaveBeenCalled()
  })

  it('UNKNOWN_ACTION_KEY → fires toast, NO field error', () => {
    const deps = makeDeps()
    const error = { code: 'UNKNOWN_ACTION_KEY' }

    handleUpdateError(error, deps)

    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(deps.setFieldError).not.toHaveBeenCalled()
  })

  it('401 status → Spanish toast, NO field error', () => {
    const deps = makeDeps()
    const error = { status: 401 }

    handleUpdateError(error, deps)

    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(deps.setFieldError).not.toHaveBeenCalled()
  })

  it('403 status → Spanish toast, NO field error', () => {
    const deps = makeDeps()
    const error = { status: 403 }

    handleUpdateError(error, deps)

    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(deps.setFieldError).not.toHaveBeenCalled()
  })

  it('class-validator 400 → Spanish toast, NO field error', () => {
    const deps = makeDeps()
    const error = { status: 400, code: 'class-validator-failed' }

    handleUpdateError(error, deps)

    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(deps.setFieldError).not.toHaveBeenCalled()
  })

  it('unknown error → Spanish fallback toast, NO field error (never returns empty shape)', () => {
    const deps = makeDeps()
    const error = { code: 'WEIRD_NEW_CODE' }

    handleUpdateError(error, deps)

    expect(deps.addToast).toHaveBeenCalledTimes(1)
    const toastCall = vi.mocked(deps.addToast).mock.calls[0]?.[0] as { title: string; color?: string }
    expect(toastCall.title.length).toBeGreaterThan(0)
    expect(toastCall.color).toBe('error')
    expect(deps.setFieldError).not.toHaveBeenCalled()
  })

  it('null/undefined error → fallback Spanish toast, never throws', () => {
    const deps = makeDeps()

    expect(() => handleUpdateError(null, deps)).not.toThrow()
    expect(() => handleUpdateError(undefined, deps)).not.toThrow()
    expect(deps.addToast).toHaveBeenCalledTimes(2)
  })

  it('plain string error code is accepted (string overload of mapNotificationConfigError)', () => {
    const deps = makeDeps()

    handleUpdateError('INVALID_RECIPIENT', deps)

    expect(deps.setFieldError).toHaveBeenCalledWith('recipients', expect.any(String))
    expect(deps.addToast).not.toHaveBeenCalled()
  })
})

describe('extractErrorPayload (reads the REAL backend error field)', () => {
  // The real backend returns error bodies as `{ error: "CODE", message: "..." }`,
  // NOT `{ code: "CODE" }`. These cases lock in that the axios-boundary
  // extraction reads `error` (with `code` as a resilience fallback) so the
  // domain code is actually routed, not silently dropped.

  function makeAxiosError(data: unknown, status = 400): AxiosError {
    return {
      response: { data, status },
    } as unknown as AxiosError
  }

  it('reads the domain code from response.data.error (real backend shape)', () => {
    const payload = extractErrorPayload(
      makeAxiosError({ error: 'INVALID_RECIPIENT', message: 'bad recipient' }),
    )

    expect(payload.code).toBe('INVALID_RECIPIENT')
    expect(payload.status).toBe(400)
    expect(payload.message).toBe('bad recipient')
  })

  it('INVALID_RECIPIENT from real backend routes to recipients field, NO toast', () => {
    const deps = makeDeps()
    const axiosError = makeAxiosError({
      error: 'INVALID_RECIPIENT',
      message: 'recipient not in tenant',
    })

    handleUpdateError(extractErrorPayload(axiosError), deps)

    expect(deps.setFieldError).toHaveBeenCalledWith('recipients', expect.any(String))
    expect(deps.addToast).not.toHaveBeenCalled()
  })

  it('UNKNOWN_ACTION_KEY from real backend routes to toast, NO field error', () => {
    const deps = makeDeps()
    const axiosError = makeAxiosError({ error: 'UNKNOWN_ACTION_KEY' })

    handleUpdateError(extractErrorPayload(axiosError), deps)

    expect(deps.addToast).toHaveBeenCalledTimes(1)
    expect(deps.setFieldError).not.toHaveBeenCalled()
  })

  it('falls back to response.data.code for resilience (legacy shape)', () => {
    const payload = extractErrorPayload(
      makeAxiosError({ code: 'INVALID_RECIPIENT' }),
    )

    expect(payload.code).toBe('INVALID_RECIPIENT')
  })

  it('prefers `error` over `code` when both are present', () => {
    const payload = extractErrorPayload(
      makeAxiosError({ error: 'INVALID_RECIPIENT', code: 'UNKNOWN_ACTION_KEY' }),
    )

    expect(payload.code).toBe('INVALID_RECIPIENT')
  })

  it('ignores non-string discriminators and keeps status for the fallback path', () => {
    const payload = extractErrorPayload(
      makeAxiosError({ error: 42, code: {} }, 500),
    )

    expect(payload.code).toBeUndefined()
    expect(payload.status).toBe(500)
  })
})
