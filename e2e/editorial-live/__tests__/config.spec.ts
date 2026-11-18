/** Pure tests for the editorial-live Playwright config builder: fail-closed before any server. */
import { describe, expect, it } from 'vitest'

import { buildEditorialLiveConfig, EDITORIAL_LIVE_VITE_CONFIG } from '../support/config'

const validEnv = () => ({
  EDITORIAL_LIVE_ENABLED: '1',
  EDITORIAL_LIVE_BACKEND_URL: 'http://127.0.0.1:8082/api/v1',
  EDITORIAL_LIVE_FIXTURE_PATH: 'artifacts/editorial-live/fixture.json',
})

describe('buildEditorialLiveConfig', () => {
  it('throws before returning a config when the opt-in is missing', () => {
    expect(() => buildEditorialLiveConfig({ ...validEnv(), EDITORIAL_LIVE_ENABLED: undefined })).toThrow(/EDITORIAL_LIVE_ENABLED/)
  })

  it('declares only the owned hardened frontend server, pinned to the declared backend', () => {
    const config = buildEditorialLiveConfig(validEnv())
    const server = config.webServer as { command: string; env: Record<string, string>; reuseExistingServer: boolean; url: string }
    expect(server.command).toContain(`--config ${EDITORIAL_LIVE_VITE_CONFIG}`)
    expect(server.command).toContain('--port 4191 --strictPort')
    expect(server.env).toEqual({ VITE_API_BASE_URL: 'http://127.0.0.1:8082/api/v1' })
    expect(server.reuseExistingServer).toBe(false)
    expect(server.url).toBe('http://127.0.0.1:4191/login')
  })

  it('runs serially with no capture channel that could persist a token', () => {
    const config = buildEditorialLiveConfig(validEnv())
    expect(config).toMatchObject({ testDir: 'e2e/editorial-live/specs', workers: 1, fullyParallel: false, retries: 0, forbidOnly: true })
    expect(config.use).toMatchObject({ baseURL: 'http://127.0.0.1:4191', trace: 'off', video: 'off', screenshot: 'off' })
    expect(config.use?.contextOptions?.recordHar).toBeUndefined()
    expect(config.outputDir).toBe('artifacts/editorial-live/editorial-live/test-results')
  })
})
