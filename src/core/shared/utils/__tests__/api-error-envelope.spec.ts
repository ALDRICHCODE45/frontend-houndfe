/**
 * api-error-envelope — the four backend error bodies of the shipping handoff
 * (../houndfe-backend/docs/frontend-handoff/10-shipping-settings-screens.md §0).
 * The examples below are the exact bodies seen on the backend.
 */
import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import { readApiErrorEnvelope } from '../api-error-envelope'

function axiosErrorWith(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() }
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, {}, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  })
}

describe('readApiErrorEnvelope', () => {
  it('reads envelope A (domain, code in `error`)', () => {
    const err = axiosErrorWith(403, {
      statusCode: 403,
      error: 'INSUFFICIENT_PERMISSIONS',
      message: 'Insufficient permissions',
      timestamp: '2026-11-06T04:32:24.654Z',
    })
    expect(readApiErrorEnvelope(err)).toEqual({
      status: 403,
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'Insufficient permissions',
      fieldErrors: {},
    })
  })

  it('reads envelope B (delivery-zone filter, code in `code`)', () => {
    const err = axiosErrorWith(409, {
      statusCode: 409,
      code: 'DELIVERY_ZONE_VALIDATION_PENDING',
      message: 'A validation is pending for this postal code',
    })
    expect(readApiErrorEnvelope(err)).toEqual({
      status: 409,
      code: 'DELIVERY_ZONE_VALIDATION_PENDING',
      message: 'A validation is pending for this postal code',
      fieldErrors: {},
    })
  })

  it('reads envelope C (validation pipe) into field errors by property', () => {
    const err = axiosErrorWith(400, {
      message: [
        { property: 'limit', children: [], constraints: { min: 'limit must not be less than 1' } },
      ],
      error: 'Bad Request',
      statusCode: 400,
    })
    expect(readApiErrorEnvelope(err)).toEqual({
      status: 400,
      code: null,
      message: 'limit must not be less than 1',
      fieldErrors: { limit: ['limit must not be less than 1'] },
    })
  })

  it('flattens nested children of envelope C as parent.child paths', () => {
    const err = axiosErrorWith(400, {
      statusCode: 400,
      error: 'Bad Request',
      message: [
        {
          property: 'days',
          children: [
            {
              property: '0',
              children: [
                {
                  property: 'opensAt',
                  children: [],
                  constraints: { matches: 'opensAt must be HH:mm', isString: 'opensAt must be a string' },
                },
              ],
            },
          ],
        },
        { property: 'name', constraints: { isNotEmpty: 'name should not be empty' } },
      ],
    })
    const result = readApiErrorEnvelope(err)
    expect(result.fieldErrors).toEqual({
      'days.0.opensAt': ['opensAt must be HH:mm', 'opensAt must be a string'],
      name: ['name should not be empty'],
    })
    expect(result.code).toBeNull()
  })

  it('reads envelope D (Nest HTTP) without turning the generic name into a code', () => {
    const err = axiosErrorWith(400, {
      message: 'Validation failed (uuid is expected)',
      error: 'Bad Request',
      statusCode: 400,
    })
    expect(readApiErrorEnvelope(err)).toEqual({
      status: 400,
      code: null,
      message: 'Validation failed (uuid is expected)',
      fieldErrors: {},
    })
  })

  it.each(['Not Found', 'Forbidden', 'Unauthorized'])('treats the Nest name %s as no code', (name) => {
    const err = axiosErrorWith(403, { statusCode: 403, error: name, message: 'Tenant context required' })
    expect(readApiErrorEnvelope(err)).toMatchObject({ code: null, message: 'Tenant context required' })
  })

  it('returns only nulls for a network error without a response', () => {
    const err = new AxiosError('Network Error', 'ERR_NETWORK')
    expect(readApiErrorEnvelope(err)).toEqual({ status: null, code: null, message: null, fieldErrors: {} })
  })

  it('returns only nulls for non-axios input and never throws', () => {
    const empty = { status: null, code: null, message: null, fieldErrors: {} }
    expect(readApiErrorEnvelope(new Error('boom'))).toEqual(empty)
    expect(readApiErrorEnvelope(null)).toEqual(empty)
    expect(readApiErrorEnvelope('oops')).toEqual(empty)
    expect(readApiErrorEnvelope({ response: { data: 'text body' } })).toEqual(empty)
  })

  it('keeps the HTTP status when the body is not an envelope', () => {
    expect(readApiErrorEnvelope(axiosErrorWith(502, '<html>'))).toEqual({
      status: 502,
      code: null,
      message: null,
      fieldErrors: {},
    })
  })
})
