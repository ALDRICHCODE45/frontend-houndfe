import { describe, expect, it, vi } from 'vitest'
import {
  prepareExpirationDecisionResolutionAttempt,
  type ExpirationDecisionResolutionAttempt,
  type ExpirationDecisionResolutionInput,
} from '../expirationResolutionAttempt'

/**
 * EXPIRATION WU2 — pure resolution-attempt identity. The result is either a
 * value-free failure from WU1 `validateExpirationText` or a clean attempt rebuilt
 * from an explicit payload whitelist. Positive text is validated BEFORE any UUID
 * generation; a retry reuses the previous UUID only when
 * decisionId/action/expectedVersion/normalized text still match.
 */
const prepare = prepareExpirationDecisionResolutionAttempt
const PROVIDE = 'PROVIDE_EXPIRATION_TEXT' as const
const REPORT = 'REPORT_EXPIRATION_UNAVAILABLE' as const
const NEW_UUID = '89c0c4de-6e6d-4e7a-8e17-8dcdca83b197'
const PREVIOUS_UUID = '7d4101dd-c50e-43e6-8ff8-9b4229b912f0'
const DECISION = 'decision-1'
const PAYLOAD_KEYS = ['action', 'expectedVersion', 'resolutionRequestId']
const POSITIVE_KEYS = [...PAYLOAD_KEYS, 'expirationText'].sort()

type ProvideInput = Extract<ExpirationDecisionResolutionInput, { action: typeof PROVIDE }>
type ReportInput = Extract<ExpirationDecisionResolutionInput, { action: typeof REPORT }>
type ExtendedProvide = ProvideInput & { actor: string; text: string; resolutionRequestId: string }

/** Test-only constructors; `unknown` lets the specs probe runtime robustness. */
const positive = (expirationText: unknown, expectedVersion = 1): ProvideInput =>
  ({ action: PROVIDE, expirationText, expectedVersion }) as ProvideInput

const negative = (expectedVersion = 1): ReportInput => ({ action: REPORT, expectedVersion })

const previousProvide = (
  expirationText = 'Vence en marzo',
  expectedVersion = 1,
): ExpirationDecisionResolutionAttempt => ({
  decisionId: DECISION,
  payload: { action: PROVIDE, expirationText, expectedVersion, resolutionRequestId: PREVIOUS_UUID },
})

const previousReport = (expectedVersion = 1): ExpirationDecisionResolutionAttempt => ({
  decisionId: DECISION,
  payload: { action: REPORT, expectedVersion, resolutionRequestId: PREVIOUS_UUID },
})

const keysOf = (value: object): string[] => Object.keys(value).sort()

const attemptOf = (result: ReturnType<typeof prepare>): ExpirationDecisionResolutionAttempt => {
  if (!result.ok) throw new Error(`expected a successful attempt, got ${result.reason}`)
  return result.attempt
}

describe('prepareExpirationDecisionResolutionAttempt', () => {
  it('builds the exact positive payload and generates exactly one UUID', () => {
    const generateId = vi.fn(() => NEW_UUID)
    const result = prepare(
      DECISION,
      positive('  Cafe\u0301 \u00a0\u2028 vence  '),
      null,
      generateId,
    )

    expect(generateId).toHaveBeenCalledTimes(1)
    expect(generateId).toHaveBeenCalledWith()
    expect(result).toEqual({
      ok: true,
      attempt: {
        decisionId: DECISION,
        payload: {
          action: PROVIDE,
          expirationText: 'Café vence',
          expectedVersion: 1,
          resolutionRequestId: NEW_UUID,
        },
      },
    })
    expect(keysOf(attemptOf(result).payload)).toEqual(POSITIVE_KEYS)
  })

  it('builds the exact negative payload without expirationText', () => {
    const generateId = vi.fn(() => NEW_UUID)
    const result = prepare(DECISION, negative(4), null, generateId)

    expect(generateId).toHaveBeenCalledTimes(1)
    expect(result).toEqual({
      ok: true,
      attempt: {
        decisionId: DECISION,
        payload: { action: REPORT, expectedVersion: 4, resolutionRequestId: NEW_UUID },
      },
    })
    expect(keysOf(attemptOf(result).payload)).toEqual(PAYLOAD_KEYS)
    expect(attemptOf(result).payload).not.toHaveProperty('expirationText')
  })

  it('returns the validator reason for invalid positive text with zero UUID calls', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['', 'EMPTY'],
      ['   \u00a0\u2028 ', 'EMPTY'],
      ['a\tb', 'CONTROL_CHARACTER'],
      ['a\u007fb', 'CONTROL_CHARACTER'],
      ['a\u0085b', 'CONTROL_CHARACTER'],
      ['a'.repeat(501), 'TOO_LONG'],
    ]

    for (const [text, reason] of cases) {
      const generateId = vi.fn(() => NEW_UUID)
      expect(prepare(DECISION, positive(text), previousProvide(), generateId)).toEqual({
        ok: false,
        reason,
      })
      expect(generateId).not.toHaveBeenCalled()
    }
  })

  it('rejects non-string positive text without coercion or UUID generation', () => {
    for (const invalid of [undefined, null, 42, true, {}, [], Symbol('x')]) {
      const generateId = vi.fn(() => NEW_UUID)
      expect(prepare(DECISION, positive(invalid), previousProvide(), generateId)).toEqual({
        ok: false,
        reason: 'NOT_A_STRING',
      })
      expect(generateId).not.toHaveBeenCalled()
    }
  })

  it('is value-free: a failure never echoes the rejected text', () => {
    const result = prepare(DECISION, positive(`SENSITIVE-${'x'.repeat(501)}`))
    expect(result.ok).toBe(false)
    expect(keysOf(result)).toEqual(['ok', 'reason'])
    expect(JSON.stringify(result)).not.toContain('SENSITIVE')
  })

  it('never leaks structurally extended input extras into a new payload', () => {
    const input: ExtendedProvide = {
      ...positive('Vence en marzo'),
      actor: 'actor-secret',
      text: 'text-secret',
      resolutionRequestId: 'request-secret',
    }

    const result = prepare(DECISION, input, null, () => NEW_UUID)
    expect(keysOf(attemptOf(result).payload)).toEqual(POSITIVE_KEYS)
    expect(attemptOf(result).payload.resolutionRequestId).toBe(NEW_UUID)
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('never leaks extras from a structurally extended previous attempt on reuse', () => {
    const previous: ExpirationDecisionResolutionAttempt & { actor: string } = {
      ...previousProvide(),
      actor: 'actor-secret',
    }
    const generateId = vi.fn(() => NEW_UUID)

    const result = prepare(DECISION, positive('Vence en marzo'), previous, generateId)
    expect(generateId).not.toHaveBeenCalled()
    expect(attemptOf(result).payload).toEqual(previous.payload)
    expect(keysOf(attemptOf(result).payload)).toEqual(POSITIVE_KEYS)
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  const extProvide = { ...previousProvide().payload, actor: 'actor-secret' }
  const extReport = {
    ...previousReport().payload,
    expirationText: '',
    actor: 'actor-secret',
  }

  it.each<[ExpirationDecisionResolutionInput, ExpirationDecisionResolutionAttempt, string[]]>([
    [positive('Vence en marzo'), { decisionId: DECISION, payload: extProvide }, POSITIVE_KEYS],
    [negative(1), { decisionId: DECISION, payload: extReport }, PAYLOAD_KEYS],
  ])('rebuilds whitelist and retains UUID from extended previous', (input, previous, keys) => {
    const snapshot = JSON.stringify(previous)
    const generateId = vi.fn(() => NEW_UUID)
    const result = prepare(DECISION, input, previous, generateId)

    expect(generateId).not.toHaveBeenCalled()
    expect(attemptOf(result).payload).toEqual({ ...input, resolutionRequestId: PREVIOUS_UUID })
    expect(keysOf(attemptOf(result).payload)).toEqual(keys)
    expect(JSON.stringify(previous)).toBe(snapshot)
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it.each([
    ['  Cafe\u0301 \u00a0 vence  ', 'Café vence'],
    ['   Vence   hoy  ', 'Vence hoy'],
  ])('reuses the previous UUID for a canonically equivalent retry (%#)', (raw, canonical) => {
    const generateId = vi.fn(() => NEW_UUID)
    const result = prepare(DECISION, positive(raw), previousProvide(canonical), generateId)

    expect(generateId).not.toHaveBeenCalled()
    expect(attemptOf(result).payload).toEqual({
      action: PROVIDE,
      expirationText: canonical,
      expectedVersion: 1,
      resolutionRequestId: PREVIOUS_UUID,
    })
  })

  it('regenerates the UUID when decisionId, action, version or text changes', () => {
    const generateId = vi.fn(() => NEW_UUID)
    const regenerated = [
      prepare('decision-2', positive('Vence en marzo'), previousProvide(), generateId),
      prepare(DECISION, negative(1), previousProvide(), generateId),
      prepare(DECISION, positive('Vence en marzo', 2), previousProvide(), generateId),
      prepare(DECISION, positive('Vence en abril'), previousProvide(), generateId),
      prepare(DECISION, positive('Vence en marzo'), previousReport(), generateId),
    ]

    expect(generateId).toHaveBeenCalledTimes(regenerated.length)
    for (const result of regenerated) {
      expect(attemptOf(result).payload.resolutionRequestId).toBe(NEW_UUID)
    }
  })

  it('reuses the previous negative UUID and ignores extra input text', () => {
    const input: ReportInput & { expirationText: string; actor: string } = {
      ...negative(1),
      expirationText: '',
      actor: 'actor-secret',
    }
    const generateId = vi.fn(() => NEW_UUID)

    const result = prepare(DECISION, input, previousReport(), generateId)
    expect(generateId).not.toHaveBeenCalled()
    expect(attemptOf(result).payload).toEqual({
      action: REPORT,
      expectedVersion: 1,
      resolutionRequestId: PREVIOUS_UUID,
    })
    expect(keysOf(attemptOf(result).payload)).toEqual(PAYLOAD_KEYS)
    expect(JSON.stringify(result)).not.toContain('secret')
  })

  it('regenerates the negative UUID when the version changes', () => {
    const generateId = vi.fn(() => NEW_UUID)
    const result = prepare(DECISION, negative(2), previousReport(1), generateId)

    expect(generateId).toHaveBeenCalledTimes(1)
    expect(attemptOf(result).payload.resolutionRequestId).toBe(NEW_UUID)
  })

  it('is pure: neither the input nor the previous attempt is mutated', () => {
    const input = Object.freeze(positive('  Vence  '))
    const previous = Object.freeze(previousProvide())
    const inputSnapshot = { ...input }
    const previousSnapshot = JSON.stringify(previous)

    expect(prepare(DECISION, input, previous, () => NEW_UUID).ok).toBe(true)
    expect({ ...input }).toEqual(inputSnapshot)
    expect(JSON.stringify(previous)).toBe(previousSnapshot)
  })
})
