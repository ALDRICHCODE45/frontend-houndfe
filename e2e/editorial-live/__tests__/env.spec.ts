/** Pure tests for the editorial-live env contract: fail-closed, no browser/server/HTTP. */
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  EDITORIAL_LIVE_FRONTEND_ORIGIN,
  EDITORIAL_LIVE_FRONTEND_PORT,
  EditorialLiveConfigError,
  isStrictlyInside,
  resolveEditorialLiveEnv,
  resolveFixturePath,
} from '../support/env'

const ROOT = '/repo/frontend'
const validEnv = (): Record<string, string | undefined> => ({
  EDITORIAL_LIVE_ENABLED: '1',
  EDITORIAL_LIVE_BACKEND_URL: 'http://127.0.0.1:8082/api/v1',
  EDITORIAL_LIVE_FIXTURE_PATH: 'artifacts/editorial-live/fixture.json',
})

describe('resolveEditorialLiveEnv', () => {
  it('accepts the declared local contract and derives the run directory', () => {
    const env = resolveEditorialLiveEnv(validEnv(), ROOT)
    expect(env.backendOrigin).toBe('http://127.0.0.1:8082')
    expect(env.backendBaseUrl).toBe('http://127.0.0.1:8082/api/v1')
    expect(env.frontendOrigin).toBe(EDITORIAL_LIVE_FRONTEND_ORIGIN)
    expect(env.frontendPort).toBe(4191)
    expect(env.fixturePath).toBe(path.resolve(ROOT, 'artifacts/editorial-live/fixture.json'))
    expect(env.runId).toBe('editorial-live')
    expect(env.runArtifactDir).toBe(path.resolve(ROOT, 'artifacts/editorial-live/editorial-live'))
    expect(Object.isFrozen(env)).toBe(true)
  })

  it.each([undefined, 'true', 'yes', '0', '', ' 1'])('rejects opt-in %j', value => {
    expect(() => resolveEditorialLiveEnv({ ...validEnv(), EDITORIAL_LIVE_ENABLED: value }, ROOT)).toThrow(/EDITORIAL_LIVE_ENABLED/)
  })

  it.each([
    ['missing', undefined, /is required/],
    ['https', 'https://127.0.0.1:8082', /http:/],
    ['non-loopback', 'http://10.0.0.5:8082', /loopback/],
    ['no port', 'http://127.0.0.1', /explicit port/],
    ['ambient 3000', 'http://127.0.0.1:3000', /3000/],
    ['frontend port', `http://127.0.0.1:${EDITORIAL_LIVE_FRONTEND_PORT}`, /frontend port/],
    ['credentials', 'http://user:pw@127.0.0.1:8082', /credentials/],
    ['query', 'http://127.0.0.1:8082/?a=1', /query/],
    ['hash', 'http://127.0.0.1:8082/#x', /hash/],
    ['invalid', 'not a url', /not a valid URL/],
  ])('rejects a %s backend URL', (_label, url, message) => {
    expect(() => resolveEditorialLiveEnv({ ...validEnv(), EDITORIAL_LIVE_BACKEND_URL: url }, ROOT)).toThrow(message)
  })

  it('never echoes a rejected backend URL secret', () => {
    try {
      resolveEditorialLiveEnv({ ...validEnv(), EDITORIAL_LIVE_BACKEND_URL: 'http://user:s3cr3t@127.0.0.1:8082' }, ROOT)
      expect.unreachable()
    } catch (error) {
      expect((error as Error).message).not.toContain('s3cr3t')
    }
  })

  it.each(['../x', 'a/b', '.', '..', 'a b', 'x'.repeat(65), 'run\tx'])('rejects run id %j without echoing it', runId => {
    expect(() => resolveEditorialLiveEnv({ ...validEnv(), EDITORIAL_LIVE_RUN_ID: runId }, ROOT)).toThrow(EditorialLiveConfigError)
  })

  it('accepts a safe run id', () => {
    expect(resolveEditorialLiveEnv({ ...validEnv(), EDITORIAL_LIVE_RUN_ID: 'run_2026-11-18' }, ROOT).runId).toBe('run_2026-11-18')
  })

  it('requires the fixture path', () => {
    expect(() => resolveEditorialLiveEnv({ ...validEnv(), EDITORIAL_LIVE_FIXTURE_PATH: ' ' }, ROOT)).toThrow(/is required/)
  })
})

describe('resolveFixturePath', () => {
  it.each(['/etc/passwd', '../outside.json', 'artifacts/../../x.json'])('rejects %s escaping the project', input => {
    expect(() => resolveFixturePath(input, ROOT)).toThrow(/project root/)
  })
  it.each(['fixture.json', 'artifacts/cash-live/fixture.json', 'artifacts/editorial-live', 'artifacts/editorial-live-other/f.json'])(
    'rejects %s outside the editorial-live scratch root', input => {
      expect(() => resolveFixturePath(input, ROOT)).toThrow(/artifacts\/editorial-live/)
    })
  it('accepts a nested scratch file', () => {
    expect(resolveFixturePath('artifacts/editorial-live/run/f.json', ROOT)).toBe(path.resolve(ROOT, 'artifacts/editorial-live/run/f.json'))
  })
  it('isStrictlyInside excludes the root itself', () => {
    expect(isStrictlyInside('/a', '/a')).toBe(false)
    expect(isStrictlyInside('/a', '/a/b')).toBe(true)
    expect(isStrictlyInside('/a', '/ab')).toBe(false)
  })
})
