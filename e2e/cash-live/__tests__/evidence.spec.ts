/**
 * Focused tests for the redacted evidence primitives (`../support/evidence.ts`).
 *
 * These tests prove the security contract of the collector in isolation: every
 * externally supplied string is redacted before a record exists, controlled
 * fields are validated generically (no rejected value is echoed), and a
 * returned snapshot can never mutate the collector's evidence.
 *
 * No filesystem, network, browser or service is touched. The only secrets are
 * synthetic values defined here.
 */
import { describe, expect, it } from 'vitest'

import {
  EVIDENCE_KINDS,
  EVIDENCE_VERDICTS,
  REDACTED,
  assertNoSecrets,
  createEvidenceCollector,
  redactSecrets,
  type EvidenceKind,
  type EvidenceVerdict,
} from '../support/evidence'

const SECRET_A = 'access-value-actor-a.synthetic.0001'
const SECRET_B = 'access-value-actor-b.synthetic.0002'
const SECRETS = [SECRET_A, SECRET_B]

describe('redactSecrets', () => {
  it('redacts every occurrence of every supplied secret', () => {
    const text = `Bearer ${SECRET_A} failed; retried ${SECRET_B} then ${SECRET_B}`
    const redacted = redactSecrets(text, SECRETS)
    expect(redacted).not.toContain(SECRET_A)
    expect(redacted).not.toContain(SECRET_B)
    expect(redacted).toContain(REDACTED)
  })

  it('ignores empty or whitespace secrets safely', () => {
    expect(redactSecrets('unchanged', ['', '  ', 'x'])).toBe('unchanged'.replace('x', REDACTED))
    expect(redactSecrets('unchanged', [])).toBe('unchanged')
  })

  it('leaves no fragment behind when secrets overlap', () => {
    const redacted = redactSecrets('prefix abcdef suffix', ['abcdef', 'bcde'])
    expect(redacted).not.toContain('abcdef')
    expect(redacted).not.toContain('bcde')
    expect(redacted).toBe(`prefix ${REDACTED} suffix`)
  })

  it('redacts the URL-encoded form of a secret used inside a URL', () => {
    const secret = 'tok+en/val=ue'
    const encoded = encodeURIComponent(secret)
    expect(encoded).not.toBe(secret)
    const redacted = redactSecrets(`GET /cb?token=${encoded}`, [secret])
    expect(redacted).not.toContain(encoded)
    expect(redacted).not.toContain(secret)
  })

  it('treats a secret as a literal, never as a regular expression', () => {
    const secret = 'a.*b'
    const redacted = redactSecrets('value a.*b end', [secret])
    expect(redacted).toBe(`value ${REDACTED} end`)
  })

  it('covers the union of crossing secret intervals with a single marker', () => {
    // 'abcdef' spans [0,6) and 'cdefgh' spans [2,8); their union is [0,8), so the
    // whole span must be masked by one marker rather than leaving a tail.
    expect(redactSecrets('abcdefgh', ['abcdef', 'cdefgh'])).toBe(REDACTED)
    expect(redactSecrets('abcdefgh', ['cdefgh', 'abcdef'])).toBe(REDACTED)
  })
})

describe('assertNoSecrets', () => {
  it('throws with a generic secret error that does not echo the value', () => {
    let message = ''
    expect(() => {
      try {
        assertNoSecrets(`body contained ${SECRET_A} here`, SECRETS)
      } catch (error) {
        message = (error as Error).message
        throw error
      }
    }).toThrow(/secret/)
    expect(message).not.toContain(SECRET_A)
  })

  it('does not throw on clean text', () => {
    expect(() => assertNoSecrets('clean body', SECRETS)).not.toThrow()
  })
})

describe('createEvidenceCollector', () => {
  it('redacts step and summary before the record exists and uses schemaVersion 1', () => {
    const collector = createEvidenceCollector('cash-live', SECRETS)
    collector.collect(
      `step with ${SECRET_A}`,
      'http',
      'pass',
      `GET /api/v1/cash-registers with ${SECRET_A} returned 200`,
    )
    const [record] = collector.records()
    expect(record?.schemaVersion).toBe(1)
    expect(record?.runId).toBe('cash-live')
    expect(record?.kind).toBe('http')
    expect(record?.verdict).toBe('pass')
    expect(record?.step).not.toContain(SECRET_A)
    expect(record?.summary).not.toContain(SECRET_A)
    expect(record?.summary).toContain(REDACTED)
  })

  it('exposes exactly the controlled kinds and verdicts', () => {
    expect(EVIDENCE_KINDS).toEqual(['http', 'ui'])
    expect(EVIDENCE_VERDICTS).toEqual(['pass', 'fail', 'skip'])
  })

  it('rejects an invalid runId without echoing the rejected value', () => {
    let message = ''
    expect(() => {
      try {
        createEvidenceCollector('run-LEAK/../escape', SECRETS)
      } catch (error) {
        message = (error as Error).message
        throw error
      }
    }).toThrow(/runId/)
    expect(message).not.toContain('LEAK')
    expect(message).not.toContain('../escape')
  })

  it('rejects an invalid kind without echoing the rejected value', () => {
    const collector = createEvidenceCollector('cash-live', SECRETS)
    expect(() => collector.collect('step', 'network' as EvidenceKind, 'pass', 'summary')).toThrow(
      /kind/,
    )
    try {
      collector.collect('step', 'network' as EvidenceKind, 'pass', 'summary')
    } catch (error) {
      expect((error as Error).message).not.toContain('network')
    }
  })

  it('rejects an invalid verdict without echoing the rejected value', () => {
    const collector = createEvidenceCollector('cash-live', SECRETS)
    expect(() => collector.collect('step', 'ui', 'maybe' as EvidenceVerdict, 'summary')).toThrow(
      /verdict/,
    )
    try {
      collector.collect('step', 'ui', 'maybe' as EvidenceVerdict, 'summary')
    } catch (error) {
      expect((error as Error).message).not.toContain('maybe')
    }
  })

  it('rejects a non-string summary or step instead of storing anything', () => {
    const collector = createEvidenceCollector('cash-live', SECRETS)
    expect(() => collector.collect('step', 'http', 'pass', 42 as unknown as string)).toThrow(
      /summary/,
    )
    expect(() => collector.collect(42 as unknown as string, 'http', 'pass', 'summary')).toThrow(
      /step/,
    )
    expect(collector.records()).toHaveLength(0)
  })

  it('returns a frozen snapshot that cannot mutate the collector evidence', () => {
    const collector = createEvidenceCollector('cash-live', SECRETS)
    collector.collect('step-1', 'http', 'pass', 'first')
    const snapshot = collector.records()

    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot[0])).toBe(true)
    expect(() => {
      ;(snapshot as unknown as EvidenceRecordMutator[]).push({
        summary: 'injected',
      } as EvidenceRecordMutator)
    }).toThrow()
    expect(() => {
      ;(snapshot[0] as { summary: string }).summary = 'tampered'
    }).toThrow()

    collector.collect('step-2', 'ui', 'fail', 'second')
    expect(snapshot).toHaveLength(1)
    expect(collector.records()).toHaveLength(2)
    expect(snapshot[0]?.summary).toBe('first')
  })

  it('never persists a supplied secret, even across many collects', () => {
    const collector = createEvidenceCollector('cash-live', SECRETS)
    collector.collect('step', 'http', 'skip', `contains ${SECRET_B} and ${SECRET_A}`)
    const serialized = JSON.stringify(collector.records())
    expect(serialized).not.toContain(SECRET_A)
    expect(serialized).not.toContain(SECRET_B)
    expect(() => assertNoSecrets(serialized, SECRETS)).not.toThrow()
  })

  it('rejects a runId that collides with a supplied secret and appends nothing', () => {
    const token = 'synthetic-access-token'
    const collector = createEvidenceCollector(token, [token])
    let message = ''
    expect(() => {
      try {
        collector.collect('clean-step', 'http', 'pass', 'clean summary')
      } catch (error) {
        message = (error as Error).message
        throw error
      }
    }).toThrow(/secret/)
    expect(message).not.toContain(token)
    expect(collector.records()).toHaveLength(0)
  })

  it('rejects a controlled kind that collides with a supplied secret and keeps prior records', () => {
    const collector = createEvidenceCollector('cash-live', ['http'])
    collector.collect('clean-step', 'ui', 'pass', 'clean summary')
    let message = ''
    expect(() => {
      try {
        collector.collect('clean-step', 'http', 'pass', 'clean summary')
      } catch (error) {
        message = (error as Error).message
        throw error
      }
    }).toThrow(/secret/)
    expect(message).not.toContain('http')
    expect(collector.records()).toHaveLength(1)
  })

  it('rejects a controlled verdict that collides with a supplied secret and appends nothing', () => {
    const collector = createEvidenceCollector('cash-live', ['pass'])
    let message = ''
    expect(() => {
      try {
        collector.collect('clean-step', 'ui', 'pass', 'clean summary')
      } catch (error) {
        message = (error as Error).message
        throw error
      }
    }).toThrow(/secret/)
    expect(message).not.toContain('pass')
    expect(collector.records()).toHaveLength(0)
  })
})

type EvidenceRecordMutator = { summary: string }
