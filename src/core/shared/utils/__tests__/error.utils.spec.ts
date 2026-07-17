/**
 * error.utils — dual envelope normalization (S3 — hr-validation-notifications)
 *
 * The error layer MUST handle BOTH backend envelopes safely:
 *   1. Domain:        { statusCode, error (CODE), message: string, timestamp }
 *   2. Nest validator:{ statusCode: 400, message: string[], error: 'Bad Request' }
 *
 * Goals:
 *   - Expose the domain `error` code so consumers can map specific cases
 *     (e.g. 409 `TIME_OFF_INVALID_TRANSITION`).
 *   - Join Nest `string[]` messages so the UI never shows `[object Object]`
 *     or a raw array.
 *   - Never throw on null/undefined/non-object/network inputs — always
 *     return a safe fallback (default Rioplatense voseo).
 *
 * Backward compatibility:
 *   - `mapDomainError(error, fallback?)` keeps its (AxiosError→string) shape
 *     so the 5 POS files / 9 call-sites that import it from this module
 *     keep compiling and stay green.
 */
import { describe, expect, it } from 'vitest'
import type { AxiosError } from 'axios'
import { mapDomainError, normalizeApiError, type DomainApiError } from '../error.utils'

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Build an AxiosError whose `response.data` is an arbitrary shape. Using
 * `Record<string, unknown>` (rather than the narrow `DomainApiError`
 * type) lets us simulate the Nest `string[]` payload and other
 * malformed envelopes that the public type doesn't express.
 */
function makeAxiosError(
  status: number,
  data: Record<string, unknown>,
): AxiosError<DomainApiError> {
  const err = new Error('Request failed') as AxiosError<DomainApiError>
  err.isAxiosError = true
  err.response = {
    status,
    data: data as DomainApiError,
    statusText: 'Error',
    headers: {},
    config: {} as never,
  }
  return err
}

const DEFAULT_FALLBACK = 'No pudimos completar la operación. Reintentá.'

// ── normalizeApiError — DOMAIN envelope ───────────────────────────────────────

describe('normalizeApiError — domain envelope', () => {
  it('returns the string message from a domain envelope', () => {
    const err = makeAxiosError(409, {
      error: 'TIME_OFF_INVALID_TRANSITION',
      message: 'No podés cambiar el estado de una solicitud ya aprobada.',
      timestamp: '2026-07-17T10:00:00.000Z',
    })

    const result = normalizeApiError(err)

    expect(result.message).toBe('No podés cambiar el estado de una solicitud ya aprobada.')
  })

  it('exposes the domain `error` code so consumers can map specific cases', () => {
    const err = makeAxiosError(409, {
      error: 'TIME_OFF_INVALID_TRANSITION',
      message: 'No podés cambiar el estado de una solicitud ya aprobada.',
      timestamp: '2026-07-17T10:00:00.000Z',
    })

    const result = normalizeApiError(err)

    expect(result.code).toBe('TIME_OFF_INVALID_TRANSITION')
  })

  it('exposes TIME_OFF_INVALID_DATE_RANGE from a 400 domain envelope', () => {
    const err = makeAxiosError(400, {
      error: 'TIME_OFF_INVALID_DATE_RANGE',
      message: 'El rango de fechas no es válido.',
      timestamp: '2026-07-17T10:00:00.000Z',
    })

    const result = normalizeApiError(err)

    expect(result.code).toBe('TIME_OFF_INVALID_DATE_RANGE')
    expect(result.message).toBe('El rango de fechas no es válido.')
  })

  it('omits the code key when the envelope has no error code', () => {
    const err = makeAxiosError(500, {
      message: 'Fallo interno del servidor.',
    })

    const result = normalizeApiError(err)

    expect(result.message).toBe('Fallo interno del servidor.')
    expect(result.code).toBeUndefined()
    expect('code' in result).toBe(false)
  })
})

// ── normalizeApiError — NEST class-validator envelope ────────────────────────

describe('normalizeApiError — Nest class-validator envelope', () => {
  it('joins a string[] message into a single voseo string', () => {
    const err = makeAxiosError(400, {
      error: 'Bad Request',
      message: ['El nombre es obligatorio.', 'El email debe ser válido.'],
    })

    const result = normalizeApiError(err)

    expect(result.message).toBe('El nombre es obligatorio. El email debe ser válido.')
  })

  it('joins a single-element string[] message', () => {
    const err = makeAxiosError(400, {
      error: 'Bad Request',
      message: ['El nombre es obligatorio.'],
    })

    const result = normalizeApiError(err)

    expect(result.message).toBe('El nombre es obligatorio.')
  })

  it('exposes the Bad Request code from a Nest envelope', () => {
    const err = makeAxiosError(400, {
      error: 'Bad Request',
      message: ['El nombre es obligatorio.'],
    })

    const result = normalizeApiError(err)

    expect(result.code).toBe('Bad Request')
  })

  it('falls back when the string[] message is empty', () => {
    const err = makeAxiosError(400, {
      error: 'Bad Request',
      message: [],
    })

    const result = normalizeApiError(err)

    expect(result.message).toBe(DEFAULT_FALLBACK)
  })

  it('filters out non-string entries when joining a string[]', () => {
    const err = makeAxiosError(400, {
      error: 'Bad Request',
      // intentionally malformed — only strings should be joined
      message: ['Valido.', null, undefined, 42, 'Otro válido.'] as unknown as string[],
    })

    const result = normalizeApiError(err)

    expect(result.message).toBe('Valido. Otro válido.')
  })
})

// ── normalizeApiError — defensive / degraded inputs ───────────────────────────

describe('normalizeApiError — defensive fallback (must NEVER throw)', () => {
  it('returns the fallback when err is null', () => {
    const result = normalizeApiError(null)

    expect(result.message).toBe(DEFAULT_FALLBACK)
    expect(result.code).toBeUndefined()
  })

  it('returns the fallback when err is undefined', () => {
    const result = normalizeApiError(undefined)

    expect(result.message).toBe(DEFAULT_FALLBACK)
  })

  it('returns the fallback for a primitive string error', () => {
    const result = normalizeApiError('algo se rompió')

    expect(result.message).toBe(DEFAULT_FALLBACK)
  })

  it('returns the fallback for a primitive number error', () => {
    const result = normalizeApiError(42)

    expect(result.message).toBe(DEFAULT_FALLBACK)
  })

  it('returns the fallback for a plain Error object (non-Axios shape)', () => {
    const err = new Error('Network Error')

    const result = normalizeApiError(err)

    // Per spec: non-Axios errors get the safe fallback — we never
    // surface a raw `Error.message` like 'Network Error' or
    // 'Request failed' to end users.
    expect(result.message).toBe(DEFAULT_FALLBACK)
  })

  it('returns the fallback for an AxiosError with no response (network failure)', () => {
    const err = new Error('Network Error') as AxiosError<DomainApiError>
    err.isAxiosError = true
    // intentionally no `response` → simulates offline / CORS / timeout

    const result = normalizeApiError(err)

    expect(result.message).toBe(DEFAULT_FALLBACK)
  })

  it('returns the fallback when response.data is missing fields', () => {
    const err = makeAxiosError(500, {})

    const result = normalizeApiError(err)

    expect(result.message).toBe(DEFAULT_FALLBACK)
  })

  it('returns the fallback when message is neither string nor string[]', () => {
    const err = makeAxiosError(400, {
      error: 'Bad Request',
      message: 12345 as unknown as string,
    })

    const result = normalizeApiError(err)

    expect(result.message).toBe(DEFAULT_FALLBACK)
    // The code from the envelope is still preserved even when message is unusable.
    expect(result.code).toBe('Bad Request')
  })

  it('returns the fallback for empty/whitespace-only string message', () => {
    const err = makeAxiosError(400, {
      error: 'BAD_CODE',
      message: '   ',
    })

    const result = normalizeApiError(err)

    expect(result.message).toBe(DEFAULT_FALLBACK)
    expect(result.code).toBe('BAD_CODE')
  })

  it('ignores a non-string `error` code (only strings are exposed)', () => {
    const err = makeAxiosError(400, {
      error: 12345 as unknown as string,
      message: 'Valido.',
    })

    const result = normalizeApiError(err)

    expect(result.message).toBe('Valido.')
    expect(result.code).toBeUndefined()
  })
})

// ── normalizeApiError — fallback override ────────────────────────────────────

describe('normalizeApiError — fallback override', () => {
  it('honours a custom fallback on a null err', () => {
    const result = normalizeApiError(null, 'Algo salió mal. Probá de nuevo.')

    expect(result.message).toBe('Algo salió mal. Probá de nuevo.')
  })

  it('honours a custom fallback when envelope has no usable message', () => {
    const err = makeAxiosError(500, {})

    const result = normalizeApiError(err, 'Servidor ocupado. Esperá unos segundos.')

    expect(result.message).toBe('Servidor ocupado. Esperá unos segundos.')
  })

  it('falls back to the default when the custom fallback is an empty string', () => {
    const result = normalizeApiError(null, '   ')

    expect(result.message).toBe(DEFAULT_FALLBACK)
  })
})

// ── mapDomainError — back-compat wrapper ─────────────────────────────────────

describe('mapDomainError — back-compat wrapper (POS callers stay green)', () => {
  it('returns the message string from a domain envelope', () => {
    const err = makeAxiosError(409, {
      error: 'TIME_OFF_INVALID_TRANSITION',
      message: 'No podés cambiar el estado de una solicitud ya aprobada.',
    })

    const result = mapDomainError(err)

    expect(result).toBe('No podés cambiar el estado de una solicitud ya aprobada.')
  })

  it('joins a Nest string[] message into a single string (no raw array leaks)', () => {
    const err = makeAxiosError(400, {
      error: 'Bad Request',
      message: ['El nombre es obligatorio.', 'El email debe ser válido.'],
    })

    const result = mapDomainError(err)

    expect(result).toBe('El nombre es obligatorio. El email debe ser válido.')
  })

  it('returns the default fallback when err.response is missing', () => {
    const err = new Error('Network Error') as AxiosError<DomainApiError>
    err.isAxiosError = true

    const result = mapDomainError(err)

    expect(result).toBe(DEFAULT_FALLBACK)
  })

  it('honours a custom fallback string', () => {
    const err = new Error('boom') as AxiosError<DomainApiError>
    err.isAxiosError = true

    const result = mapDomainError(err, 'No pudimos guardar la variante.')

    expect(result).toBe('No pudimos guardar la variante.')
  })

  it('returns a string (never throws) for a malformed AxiosError', () => {
    const result = mapDomainError({} as AxiosError<DomainApiError>)

    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})
