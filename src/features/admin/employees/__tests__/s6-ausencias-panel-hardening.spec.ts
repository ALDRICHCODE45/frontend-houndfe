/**
 * S6 — Per-employee AusenciasPanel hardening (hr-validation-notifications)
 *
 * Acceptance source: `sdd/hr-validation-notifications/spec` (obs 3175) +
 * `sdd/hr-validation-notifications/design` (obs 3176).
 *
 * Coverage (pure-function tests — ZERO mocks):
 *
 *   1. `firstZodIssueMessage(error)` — extracts the first issue's voseo
 *      message from a failed `CreateTimeOffDtoSchema.safeParse` so the
 *      panel can show the SPECIFIC voseo error (e.g. "La fecha de fin
 *      debe ser igual o posterior a la fecha de inicio") instead of the
 *      prior generic "Verificá los datos del formulario."
 *
 *   2. `resolveCancelErrorMessage(err, fallback?)` — composes S3's
 *      `normalizeApiError` + S5's `resolveDomainErrorMessage` so the
 *      `useCancelTimeOff.onError` path surfaces the real 409
 *      `TIME_OFF_INVALID_TRANSITION` voseo message instead of the prior
 *      hardcoded "Solo se pueden cancelar solicitudes pendientes o
 *      aprobadas con fecha futura."
 *
 *   3. `resolveCreateErrorMessage(err, fallback?)` — same pattern, used
 *      in `AusenciasPanel.submitRequest` to surface the real 400
 *      `TIME_OFF_INVALID_DATE_RANGE` voseo message OR a joined Nest
 *      class-validator array string.
 *
 * Reused helpers (NOT re-implemented):
 *   - `CreateTimeOffDtoSchema` + `isValidTimeOffRange` (S4)
 *   - `normalizeApiError` (S3, core/shared/utils/error.utils.ts)
 *   - `resolveDomainErrorMessage` (S5, useAusencias.ts)
 *
 * No component mount, no axios mock, no Pinia — these are all pure
 * data-transformation helpers extracted via the Extract-Before-Mock rule.
 */

import { describe, it, expect } from 'vitest'

// ─── Pure helpers under test ──────────────────────────────────────────────────
import {
  firstZodIssueMessage,
  resolveCancelErrorMessage,
  resolveCreateErrorMessage,
} from '../composables/useAusencias'

// ─── Schemas under test ───────────────────────────────────────────────────────
import { CreateTimeOffDtoSchema } from '../interfaces/employee.types'

// ─────────────────────────────────────────────────────────────────────────────
// 1. firstZodIssueMessage — Zod parse error → first voseo message
// ─────────────────────────────────────────────────────────────────────────────

describe('firstZodIssueMessage — Zod parse error → first voseo message (S6)', () => {
  it('returns the voseo endDate message when endDate < startDate', () => {
    const result = CreateTimeOffDtoSchema.safeParse({
      type: 'VACATION',
      startDate: '2026-08-10',
      endDate: '2026-08-01',
    })
    expect(result.success).toBe(false)
    if (result.success) return
    // The CreateTimeOffDtoSchema.superRefine attaches the voseo message
    // "La fecha de fin debe ser igual o posterior a la fecha de inicio"
    // to the endDate path — that's the one the panel must surface.
    expect(firstZodIssueMessage(result.error)).toBe(
      'La fecha de fin debe ser igual o posterior a la fecha de inicio',
    )
  })

  it('returns the first issue message even when multiple issues are present', () => {
    // Both `type` AND `endDate` are invalid — but the function returns
    // the FIRST issue in Zod's iteration order so the user sees one
    // actionable error at a time (avoids "fix five things at once").
    const result = CreateTimeOffDtoSchema.safeParse({
      type: 'INVALID',
      startDate: '2026-08-10',
      endDate: '2026-08-01',
      reason: 'x'.repeat(501),
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const message = firstZodIssueMessage(result.error)
    expect(message).toBeTypeOf('string')
    expect(message).not.toBe('')
    // The first issue for an invalid `type` is the enum failure — what
    // matters is that we return a NON-EMPTY string.
    expect(message!.length).toBeGreaterThan(0)
  })

  it('returns the message attached to the type issue when only the type is invalid', () => {
    const result = CreateTimeOffDtoSchema.safeParse({
      type: 'MATERNITY',
      startDate: '2026-08-01',
      endDate: '2026-08-10',
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const message = firstZodIssueMessage(result.error)
    expect(message).toBeTypeOf('string')
    expect(message!.toLowerCase()).toContain('vacation') // enum list per Zod
  })

  it('returns the reason-length message when reason is too long', () => {
    const result = CreateTimeOffDtoSchema.safeParse({
      type: 'PERSONAL',
      startDate: '2026-08-01',
      endDate: '2026-08-10',
      reason: 'a'.repeat(501),
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const message = firstZodIssueMessage(result.error)
    expect(message).toBeTypeOf('string')
    expect(message!.toLowerCase()).toMatch(/(500|caracteres|maximum)/)
  })

  it('returns a non-empty string for the missing endDate case', () => {
    const result = CreateTimeOffDtoSchema.safeParse({
      type: 'VACATION',
      startDate: '2026-08-01',
    })
    expect(result.success).toBe(false)
    if (result.success) return
    const message = firstZodIssueMessage(result.error)
    expect(message).toBeTypeOf('string')
    expect(message!.length).toBeGreaterThan(0)
  })

  it('returns null when the ZodError has no issues (defensive)', () => {
    // Construct a synthetic empty-issues ZodError. SafeParse normally
    // never produces this, but the helper must be defensive — if it ever
    // gets an empty `issues` array it MUST NOT crash the panel.
    const emptyError = Object.create(null)
    Object.defineProperty(emptyError, 'issues', {
      value: [],
      enumerable: true,
    })
    expect(firstZodIssueMessage(emptyError)).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. resolveCancelErrorMessage — surfaces real 409 TIME_OFF_INVALID_TRANSITION
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveCancelErrorMessage — 409 TIME_OFF_INVALID_TRANSITION surfacing (S6)', () => {
  it('surfaces the EMPLOYEE_ERROR_MAP message for TIME_OFF_INVALID_TRANSITION', () => {
    const axiosLikeError = {
      response: {
        data: {
          statusCode: 409,
          error: 'TIME_OFF_INVALID_TRANSITION',
          message: 'La solicitud no permite esa transición.',
        },
      },
    }
    expect(resolveCancelErrorMessage(axiosLikeError)).toBe(
      'La solicitud de ausencia no permite esa transición de estado.',
    )
  })

  it('surfaces the EMPLOYEE_ERROR_MAP message for TIME_OFF_NOT_FOUND', () => {
    const axiosLikeError = {
      response: {
        data: {
          statusCode: 404,
          error: 'TIME_OFF_NOT_FOUND',
          message: 'No se encontró la solicitud.',
        },
      },
    }
    expect(resolveCancelErrorMessage(axiosLikeError)).toBe(
      'No se encontró la solicitud de ausencia.',
    )
  })

  it('falls back to the default cancel fallback when no envelope is present', () => {
    // Plain Error / network failure / non-Axios → safe fallback.
    expect(resolveCancelErrorMessage(new Error('Network Error'))).toBe(
      'No se pudo cancelar la ausencia.',
    )
  })

  it('uses the explicit fallback override when provided and the envelope has no message', () => {
    // Composition contract: normalizeApiError uses the caller's fallback
    // ONLY when the envelope has no usable message. Here the envelope
    // carries a code but no message — so the caller's fallback ("Error
    // puntual al cancelar.") becomes the message passed to
    // resolveDomainErrorMessage, which returns it (code is unknown).
    const envelopeWithoutMessage = {
      response: {
        data: {
          statusCode: 500,
          error: 'Internal Server Error', // NOT a known EmployeeDomainErrorCode
          // no message field → caller fallback wins
        },
      },
    }
    expect(
      resolveCancelErrorMessage(envelopeWithoutMessage, 'Error puntual al cancelar.'),
    ).toBe('Error puntual al cancelar.')
  })

  it('uses the map message (NOT the fallback) when both are available', () => {
    // Map-wins-over-fallback contract: a known code MUST use the map,
    // never the caller's fallback. This guarantees the user sees the
    // 409 voseo explanation rather than a generic toast description.
    const axiosLikeError = {
      response: {
        data: {
          statusCode: 409,
          error: 'TIME_OFF_INVALID_TRANSITION',
          message: 'irrelevant backend message',
        },
      },
    }
    const fallback = 'FALLBACK_SHOULD_NOT_BE_USED'
    expect(resolveCancelErrorMessage(axiosLikeError, fallback)).not.toBe(fallback)
    expect(resolveCancelErrorMessage(axiosLikeError, fallback)).toBe(
      'La solicitud de ausencia no permite esa transición de estado.',
    )
  })

  it('uses the DEFAULT_CANCEL_FALLBACK when no caller fallback is passed and the envelope has no message', () => {
    // Composition contract: when the envelope has no usable message,
    // normalizeApiError uses the caller's fallback (here the helper's
    // own DEFAULT_CANCEL_FALLBACK). resolveDomainErrorMessage then
    // receives that fallback as its fallback and returns it (code
    // is unknown). The S3 `DEFAULT_FALLBACK` ('No pudimos completar la
    // operación. Reintentá.') is the deeper safety net that ONLY fires
    // when the caller passes an empty/non-string fallback.
    const envelopeWithoutMessage = {
      response: {
        data: {
          statusCode: 500,
          error: 'TOTALLY_UNKNOWN_CODE',
          // no message field → helper's DEFAULT_CANCEL_FALLBACK wins
        },
      },
    }
    expect(resolveCancelErrorMessage(envelopeWithoutMessage)).toBe(
      'No se pudo cancelar la ausencia.',
    )
  })

  it('surfaces Nest class-validator string[] via the fallback chain (joined)', () => {
    // The Nest validation envelope `{ message: string[] }` exposes NO
    // `error` code in the domain sense (it carries 'Bad Request').
    // The composed helper should join the array via normalizeApiError
    // and then pass it as the fallback into resolveDomainErrorMessage.
    const axiosLikeError = {
      response: {
        data: {
          statusCode: 400,
          error: 'Bad Request',
          message: ['La fecha de fin debe ser válida', 'La fecha de inicio debe ser válida'],
        },
      },
    }
    const result = resolveCancelErrorMessage(axiosLikeError)
    // 'Bad Request' is NOT in EMPLOYEE_ERROR_MAP → resolveDomainErrorMessage
    // receives code=undefined, then uses the message as the fallback.
    // The array is joined with a single space inside normalizeApiError.
    expect(result).toBe(
      'La fecha de fin debe ser válida La fecha de inicio debe ser válida',
    )
  })

  it('returns the default fallback for a null error input', () => {
    expect(resolveCancelErrorMessage(null)).toBe(
      'No se pudo cancelar la ausencia.',
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. resolveCreateErrorMessage — surfaces real 400 TIME_OFF_INVALID_DATE_RANGE
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveCreateErrorMessage — 400 TIME_OFF_INVALID_DATE_RANGE surfacing (S6)', () => {
  it('surfaces the EMPLOYEE_ERROR_MAP message for TIME_OFF_INVALID_DATE_RANGE', () => {
    const axiosLikeError = {
      response: {
        data: {
          statusCode: 400,
          error: 'TIME_OFF_INVALID_DATE_RANGE',
          message: 'Invalid date range',
        },
      },
    }
    expect(resolveCreateErrorMessage(axiosLikeError)).toBe(
      'El rango de fechas no es válido. La fecha de fin debe ser posterior o igual a la de inicio.',
    )
  })

  it('joins a Nest class-validator string[] into one voseo message', () => {
    const axiosLikeError = {
      response: {
        data: {
          statusCode: 400,
          error: 'Bad Request',
          message: [
            'startDate must be a valid ISO date',
            'endDate must be a valid ISO date',
          ],
        },
      },
    }
    // 'Bad Request' is NOT in EMPLOYEE_ERROR_MAP → use the joined
    // array message as the fallback. No double-period artifacts.
    expect(resolveCreateErrorMessage(axiosLikeError)).toBe(
      'startDate must be a valid ISO date endDate must be a valid ISO date',
    )
  })

  it('falls back to the default create fallback when no envelope is present', () => {
    expect(resolveCreateErrorMessage(new Error('Network Error'))).toBe(
      'No se pudo registrar la ausencia.',
    )
  })

  it('uses the explicit fallback override when the envelope has no message', () => {
    // Same composition contract as the cancel helper: the caller's
    // fallback wins ONLY when normalizeApiError cannot extract a usable
    // message from the envelope.
    const envelopeWithoutMessage = {
      response: {
        data: {
          statusCode: 500,
          error: 'UNKNOWN_BACKEND_CODE',
          // no message field → caller fallback wins
        },
      },
    }
    expect(
      resolveCreateErrorMessage(envelopeWithoutMessage, 'Error puntual al crear.'),
    ).toBe('Error puntual al crear.')
  })

  it('uses the map message (NOT the fallback) when a known code is present', () => {
    const axiosLikeError = {
      response: {
        data: {
          statusCode: 400,
          error: 'TIME_OFF_INVALID_DATE_RANGE',
          message: 'irrelevant',
        },
      },
    }
    const fallback = 'FALLBACK_SHOULD_NOT_BE_USED'
    expect(resolveCreateErrorMessage(axiosLikeError, fallback)).not.toBe(fallback)
    expect(resolveCreateErrorMessage(axiosLikeError, fallback)).toBe(
      'El rango de fechas no es válido. La fecha de fin debe ser posterior o igual a la de inicio.',
    )
  })

  it('returns the default fallback for a null error input', () => {
    expect(resolveCreateErrorMessage(null)).toBe(
      'No se pudo registrar la ausencia.',
    )
  })

  it('returns the default fallback for an undefined error input', () => {
    expect(resolveCreateErrorMessage(undefined)).toBe(
      'No se pudo registrar la ausencia.',
    )
  })
})
