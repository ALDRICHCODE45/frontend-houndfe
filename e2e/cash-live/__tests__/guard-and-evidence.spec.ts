/**
 * Pure tests for the optional outbound-network guard and the redacted evidence
 * primitives.
 *
 * The guard may only ever ABORT non-allowlisted traffic (frontend origin +
 * declared backend origin) and must never fabricate a positive HTTP response —
 * so only the pure allowlist decision is tested here. Evidence must be
 * redacted against the backend-issued fixture tokens before any record exists.
 */
import { describe, expect, it } from 'vitest'

import { isOriginAllowed, normalizeOrigin } from '../support/outbound-guard'
import { createEvidenceCollector, assertNoSecrets, redactSecrets } from '../support/evidence'

describe('outbound guard — allowlist decision (frontend + declared backend only)', () => {
  const allowed = ['http://127.0.0.1:4189', 'http://127.0.0.1:8081']

  it('allows exact origins with trailing-slash normalization', () => {
    expect(normalizeOrigin('http://127.0.0.1:4189/')).toBe('http://127.0.0.1:4189')
    expect(isOriginAllowed('http://127.0.0.1:4189', allowed)).toBe(true)
    expect(isOriginAllowed('http://127.0.0.1:4189/', allowed)).toBe(true)
    expect(isOriginAllowed('http://127.0.0.1:8081', allowed)).toBe(true)
  })

  it('rejects any other origin, including sibling ports and external hosts', () => {
    expect(isOriginAllowed('http://127.0.0.1:8082', allowed)).toBe(false)
    expect(isOriginAllowed('https://api.example.com', allowed)).toBe(false)
    expect(isOriginAllowed('http://localhost:4189', allowed)).toBe(false)
    expect(isOriginAllowed('', allowed)).toBe(false)
  })

  it('rejects everything on an empty allowlist', () => {
    expect(isOriginAllowed('http://127.0.0.1:4189', [])).toBe(false)
  })
})

describe('evidence — redaction of backend-issued tokens', () => {
  const secrets = ['access-value-actor-a', 'refresh-value-actor-b']

  it('redacts every secret occurrence', () => {
    const text = 'Bearer access-value-actor-a failed; refresh attempt used refresh-value-actor-b twice: refresh-value-actor-b'
    expect(redactSecrets(text, secrets)).not.toContain('access-value-actor-a')
    expect(redactSecrets(text, secrets)).not.toContain('refresh-value-actor-b')
    expect(redactSecrets(text, secrets)).toContain('[REDACTED]')
  })

  it('ignores empty or whitespace secrets safely', () => {
    expect(redactSecrets('unchanged', ['', '  ', 'x'])).toBe('unchanged'.replace('x', '[REDACTED]'))
  })

  it('assertNoSecrets throws when a secret survives in candidate evidence', () => {
    expect(() => assertNoSecrets('body contained access-value-actor-a here', secrets)).toThrow(/secret/)
    expect(() => assertNoSecrets('clean body', secrets)).not.toThrow()
  })

  it('the collector redacts summaries before records exist', () => {
    const collector = createEvidenceCollector('cash-live', secrets)
    collector.collect('step-1', 'http', 'pass', 'GET /api/v1/cash-registers with access-value-actor-a returned 200')
    const [record] = collector.records()
    expect(record?.summary).not.toContain('access-value-actor-a')
    expect(record?.runId).toBe('cash-live')
    expect(record?.schemaVersion).toBe(1)
  })
})
