/**
 * Pure tests for the cash-live env contract (`../support/env.ts`).
 *
 * These tests prove the fail-closed input validation ONLY — they never start
 * browsers, servers or HTTP. The journey must refuse to start unless:
 * explicit opt-in is present, the backend URL is an explicit loopback URL and
 * the fixture path is confined to the reserved project scratch root.
 */
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CASH_LIVE_FRONTEND_ORIGIN,
  CASH_LIVE_FRONTEND_PORT,
  CASH_LIVE_SCRATCH_ROOT,
  CashLiveConfigError,
  isLoopbackHostname,
  normalizeBaseUrl,
  resolveCashLiveEnv,
  resolveFixturePath,
} from '../support/env'

const PROJECT_ROOT = '/repo/frontend'
const FIXTURE_REL = 'artifacts/cash-live/scratch/fixture.json'

const validEnv = () => ({
  CASH_LIVE_ENABLED: '1',
  CASH_LIVE_BACKEND_URL: 'http://127.0.0.1:8081/api/v1',
  CASH_LIVE_FIXTURE_PATH: FIXTURE_REL,
})

describe('resolveCashLiveEnv — fail-closed opt-in', () => {
  it('rejects a missing opt-in', () => {
    const env = validEnv()
    delete (env as Record<string, string | undefined>).CASH_LIVE_ENABLED
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(CashLiveConfigError)
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/CASH_LIVE_ENABLED/)
  })

  it('rejects an opt-in that is not the exact value 1', () => {
    for (const value of ['true', 'yes', 'on', '0', '', ' 1']) {
      expect(() =>
        resolveCashLiveEnv({ ...validEnv(), CASH_LIVE_ENABLED: value }, PROJECT_ROOT),
      ).toThrow(/CASH_LIVE_ENABLED/)
    }
  })
})

describe('resolveCashLiveEnv — backend URL contract', () => {
  it('rejects a missing backend URL', () => {
    const env = validEnv()
    delete (env as Record<string, string | undefined>).CASH_LIVE_BACKEND_URL
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/CASH_LIVE_BACKEND_URL/)
  })

  it('rejects a non-loopback host', () => {
    const env = { ...validEnv(), CASH_LIVE_BACKEND_URL: 'http://10.0.0.5:8081/api/v1' }
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/loopback/)
  })

  it('rejects a public hostname', () => {
    const env = { ...validEnv(), CASH_LIVE_BACKEND_URL: 'http://api.example.com:8081/v1' }
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/loopback/)
  })

  it('rejects a non-http protocol', () => {
    const env = { ...validEnv(), CASH_LIVE_BACKEND_URL: 'https://127.0.0.1:8081/api/v1' }
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/http:/)
  })

  it('rejects a URL without an explicit port', () => {
    const env = { ...validEnv(), CASH_LIVE_BACKEND_URL: 'http://127.0.0.1/api/v1' }
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/explicit port/)
  })

  it('rejects the ambient localhost:3000 default port', () => {
    const env = { ...validEnv(), CASH_LIVE_BACKEND_URL: 'http://localhost:3000/api/v1' }
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/3000/)
  })

  it('rejects a backend URL on the owned frontend port', () => {
    const env = {
      ...validEnv(),
      CASH_LIVE_BACKEND_URL: `http://127.0.0.1:${CASH_LIVE_FRONTEND_PORT}/api/v1`,
    }
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/frontend port/)
  })

  it('rejects embedded credentials', () => {
    const env = { ...validEnv(), CASH_LIVE_BACKEND_URL: 'http://user:pass@127.0.0.1:8081/api/v1' }
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/credentials/)
  })

  it('rejects a URL with a query string', () => {
    const env = { ...validEnv(), CASH_LIVE_BACKEND_URL: 'http://127.0.0.1:8081/api/v1?x=1' }
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/query|hash/)
  })

  it('rejects a URL with a hash fragment', () => {
    const env = { ...validEnv(), CASH_LIVE_BACKEND_URL: 'http://127.0.0.1:8081/api/v1#frag' }
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/query|hash/)
  })
})

describe('resolveCashLiveEnv — fixture path confinement', () => {
  it('rejects a missing fixture path', () => {
    const env = validEnv()
    delete (env as Record<string, string | undefined>).CASH_LIVE_FIXTURE_PATH
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/CASH_LIVE_FIXTURE_PATH/)
  })

  it('rejects a fixture path escaping the project root', () => {
    const env = { ...validEnv(), CASH_LIVE_FIXTURE_PATH: '../backend-secrets/fixture.json' }
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/project/)
  })

  it('rejects an absolute fixture path outside the project root', () => {
    const env = { ...validEnv(), CASH_LIVE_FIXTURE_PATH: '/etc/passwd-fixture.json' }
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(/project/)
  })

  it('rejects a fixture path inside the project but outside the reserved scratch root', () => {
    const env = { ...validEnv(), CASH_LIVE_FIXTURE_PATH: 'src/fixtures/real-tokens.json' }
    expect(() => resolveCashLiveEnv(env, PROJECT_ROOT)).toThrow(new RegExp(CASH_LIVE_SCRATCH_ROOT))
  })
})

describe('resolveCashLiveEnv — accepted contract', () => {
  it('accepts a fully declared loopback env and resolves the owned frontend origin', () => {
    const env = resolveCashLiveEnv(validEnv(), PROJECT_ROOT)
    expect(env.frontendPort).toBe(CASH_LIVE_FRONTEND_PORT)
    expect(env.frontendOrigin).toBe(CASH_LIVE_FRONTEND_ORIGIN)
    expect(env.backendUrl.toString()).toBe('http://127.0.0.1:8081/api/v1')
    expect(env.backendOrigin).toBe('http://127.0.0.1:8081')
    expect(env.backendBaseUrl).toBe('http://127.0.0.1:8081/api/v1')
    expect(env.fixturePath).toBe(`${PROJECT_ROOT}/${FIXTURE_REL}`)
  })

  it('accepts the localhost loopback hostname with a non-ambient port', () => {
    const env = resolveCashLiveEnv(
      { ...validEnv(), CASH_LIVE_BACKEND_URL: 'http://localhost:8081' },
      PROJECT_ROOT,
    )
    expect(env.backendBaseUrl).toBe('http://localhost:8081')
  })

  it('defaults the run id and honours a declared one', () => {
    expect(resolveCashLiveEnv(validEnv(), PROJECT_ROOT).runId).toBe('cash-live')
    expect(
      resolveCashLiveEnv({ ...validEnv(), CASH_LIVE_RUN_ID: 'joint-01' }, PROJECT_ROOT).runId,
    ).toBe('joint-01')
  })
})

describe('resolveCashLiveEnv — run id filename segment contract', () => {
  const withRunId = (value: string) => ({ ...validEnv(), CASH_LIVE_RUN_ID: value })
  const rejected = (value: string) => () => resolveCashLiveEnv(withRunId(value), PROJECT_ROOT)

  it('falls back to the default run id when the value is absent or blank', () => {
    const env = validEnv()
    delete (env as Record<string, string | undefined>).CASH_LIVE_RUN_ID
    expect(resolveCashLiveEnv(env, PROJECT_ROOT).runId).toBe('cash-live')
    for (const value of ['', '   ', '\t', '\n']) {
      expect(resolveCashLiveEnv(withRunId(value), PROJECT_ROOT).runId).toBe('cash-live')
    }
  })

  it('accepts safe ASCII filename segments as before', () => {
    for (const value of ['joint-01', 'cash-live', 'Run_2024', 'a', '9', 'a'.repeat(64)]) {
      expect(resolveCashLiveEnv(withRunId(value), PROJECT_ROOT).runId).toBe(value)
    }
  })

  it('rejects a run id that traverses out of the run artifact directory', () => {
    for (const value of ['..', '../..', '../../outside', 'a/../b', '..\\..\\outside']) {
      expect(rejected(value)).toThrow(CashLiveConfigError)
      expect(rejected(value)).toThrow(/CASH_LIVE_RUN_ID/)
    }
  })

  it('rejects run ids carrying slashes, backslashes or dot segments', () => {
    for (const value of ['a/b', 'a\\b', '.', './a', '...', 'a/..', '/etc']) {
      expect(rejected(value)).toThrow(/CASH_LIVE_RUN_ID/)
    }
  })

  it('rejects run ids carrying control characters, spaces or other non-segment characters', () => {
    const values = [
      'a\u0000b',
      'a\u0001b',
      'a b',
      'a\tb',
      'a\nb',
      'caf\u00e9',
      'a:b',
      'a*b',
      'a?b',
      '-abc',
      '_abc',
      'a'.repeat(65),
    ]
    for (const value of values) {
      expect(rejected(value)).toThrow(CashLiveConfigError)
      expect(rejected(value)).toThrow(/CASH_LIVE_RUN_ID/)
    }
  })

  it('never echoes the rejected raw run id in the error message', () => {
    const raw = '../../leaky-run-id-secret'
    let message = ''
    try {
      resolveCashLiveEnv(withRunId(raw), PROJECT_ROOT)
    } catch (error) {
      message = String((error as Error).message)
    }
    expect(message).not.toBe('')
    expect(message).not.toContain('leaky-run-id-secret')
    expect(message).not.toContain(raw)
  })

  it('keeps the interpolated run artifact root inside the reserved scratch root', () => {
    const scratch = path.resolve(PROJECT_ROOT, CASH_LIVE_SCRATCH_ROOT)
    for (const value of ['cash-live', 'joint-01']) {
      const { runId } = resolveCashLiveEnv(withRunId(value), PROJECT_ROOT)
      const runArtifactRoot = path.resolve(PROJECT_ROOT, CASH_LIVE_SCRATCH_ROOT, runId)
      expect(path.dirname(runArtifactRoot)).toBe(scratch)
    }
  })
})

describe('resolveFixturePath — pure confinement helpers', () => {
  it('resolves a relative path inside the scratch root', () => {
    expect(resolveFixturePath(FIXTURE_REL, PROJECT_ROOT)).toBe(`${PROJECT_ROOT}/${FIXTURE_REL}`)
  })

  it('rejects a sibling-directory traversal that stays lexical', () => {
    expect(() =>
      resolveFixturePath('artifacts/cash-live/../../secrets.json', PROJECT_ROOT),
    ).toThrow(/project/)
  })

  it('isLoopbackHostname accepts only loopback hosts', () => {
    expect(isLoopbackHostname('127.0.0.1')).toBe(true)
    expect(isLoopbackHostname('localhost')).toBe(true)
    expect(isLoopbackHostname('::1')).toBe(true)
    expect(isLoopbackHostname('[::1]')).toBe(true)
    expect(isLoopbackHostname('10.0.0.5')).toBe(false)
    expect(isLoopbackHostname('api.example.com')).toBe(false)
    expect(isLoopbackHostname('0.0.0.0')).toBe(false)
  })

  it('normalizeBaseUrl strips a single trailing slash consistently', () => {
    expect(normalizeBaseUrl('http://127.0.0.1:8081/api/v1/')).toBe('http://127.0.0.1:8081/api/v1')
    expect(normalizeBaseUrl('http://127.0.0.1:8081')).toBe('http://127.0.0.1:8081')
  })
})
