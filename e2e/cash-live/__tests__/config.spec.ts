/**
 * Pure tests for the cash-live Playwright config builder (`../support/config.ts`).
 *
 * The builder is the ONLY module that assembles the Playwright configuration.
 * Proving here that rejected input throws means the real config file (which
 * evaluates the builder at load time) can never reach a webServer/browser
 * startup on rejected input.
 */
import { describe, expect, it } from 'vitest'
import type { PlaywrightTestConfig } from '@playwright/test'
import { resolveConfig, type UserConfig } from 'vite'

import { CASH_LIVE_FRONTEND_PORT, CASH_LIVE_FRONTEND_ORIGIN } from '../support/env'
import { CASH_LIVE_VITE_CONFIG, buildCashLiveConfig } from '../support/config'
import {
  CASH_LIVE_VITE_ALLOWED_ENV,
  buildCashLiveViteConfig,
  sanitizeCashLiveProcessEnv,
} from '../../../vite.cash-live.config'

const BACKEND = 'http://127.0.0.1:8081/api/v1'
const validEnv = () => ({
  CASH_LIVE_ENABLED: '1',
  CASH_LIVE_BACKEND_URL: BACKEND,
  CASH_LIVE_FIXTURE_PATH: 'artifacts/cash-live/scratch/fixture.json',
})

/** The contract declares exactly one webServer (the frontend); never a backend. */
const singleWebServer = (config: PlaywrightTestConfig) => {
  const webServer = config.webServer
  if (!webServer || Array.isArray(webServer)) throw new Error('expected exactly one webServer')
  return webServer
}

describe('buildCashLiveConfig — no startup on rejected input', () => {
  it('throws before any configuration exists when the opt-in is missing', () => {
    const env = validEnv()
    delete (env as Record<string, string | undefined>).CASH_LIVE_ENABLED
    expect(() => buildCashLiveConfig(env)).toThrow(/CASH_LIVE_ENABLED/)
  })

  it('throws when the backend URL is a non-loopback host', () => {
    expect(() =>
      buildCashLiveConfig({ ...validEnv(), CASH_LIVE_BACKEND_URL: 'http://example.com:8081' }),
    ).toThrow(/loopback/)
  })

  it('throws when the backend URL uses the ambient frontend API fallback port', () => {
    expect(() =>
      buildCashLiveConfig({ ...validEnv(), CASH_LIVE_BACKEND_URL: 'http://127.0.0.1:3000' }),
    ).toThrow(/3000/)
  })

  it('throws when the fixture path escapes the reserved scratch root', () => {
    expect(() =>
      buildCashLiveConfig({
        ...validEnv(),
        CASH_LIVE_FIXTURE_PATH: 'e2e/cash-live/fixture.json',
      }),
    ).toThrow(/scratch/)
  })
})

describe('buildCashLiveConfig — accepted contract', () => {
  const config = buildCashLiveConfig(validEnv())

  it('scopes tests to the cash-live spec directory only', () => {
    expect(config.testDir).toBe('e2e/cash-live/specs')
  })

  it('runs deterministically: single worker, no retries, no only, no parallelism', () => {
    expect(config.workers).toBe(1)
    expect(config.retries).toBe(0)
    expect(config.forbidOnly).toBe(true)
    expect(config.fullyParallel).toBe(false)
  })

  it('owns the declared frontend port with strictPort and never reuses an existing server', () => {
    const webServer = singleWebServer(config)
    expect(webServer.reuseExistingServer).toBe(false)
    expect(webServer.command).toContain(`--port ${CASH_LIVE_FRONTEND_PORT}`)
    expect(webServer.command).toContain('--strictPort')
    expect(webServer.command).toContain(`--config ${CASH_LIVE_VITE_CONFIG}`)
    expect(webServer.url).toBe(`${CASH_LIVE_FRONTEND_ORIGIN}/login`)
  })

  it('serves the frontend against the declared backend URL, never the mock prefix or ambient default', () => {
    const webServer = singleWebServer(config)
    expect(webServer.env?.VITE_API_BASE_URL).toBe(BACKEND)
    expect(webServer.env?.VITE_API_BASE_URL).not.toBe('/__e2e-api')
    expect(webServer.env?.VITE_API_BASE_URL).not.toContain('localhost:3000')
  })

  it('browses the owned frontend origin as baseURL', () => {
    expect(config.use?.baseURL).toBe(CASH_LIVE_FRONTEND_ORIGIN)
  })

  it('disables every capture channel that could persist credentials', () => {
    expect(config.use?.trace).toBe('off')
    expect(config.use?.video).toBe('off')
    expect(config.use?.screenshot).toBe('off')
    expect(config.use?.contextOptions?.recordHar).toBeUndefined()
  })

  it('keeps exactly one local browser project (no production or integration jobs)', () => {
    expect(config.projects).toHaveLength(1)
    expect(config.projects?.[0]?.name).toBe('chromium')
  })

  it('keeps artifacts inside the reserved scratch root and defines no backend startup', () => {
    expect(String(config.outputDir)).toContain('artifacts/cash-live')
    expect(config.globalSetup).toBeUndefined()
    expect(config.globalTeardown).toBeUndefined()
  })
})

/** Flattened plugin names of a built config (the builder flattens plugin arrays). */
const pluginNames = (config: UserConfig): (string | undefined)[] =>
  (config.plugins ?? []).map((plugin) =>
    plugin && typeof plugin === 'object' ? (plugin as { name?: string }).name : undefined,
  )

describe('buildCashLiveViteConfig — dedicated hardened Vite config', () => {
  const fakeBase = {
    server: { port: 5199 },
    plugins: [
      { name: 'vite-plugin-vue' },
      [false, { name: 'vite-plugin-inspect' }, { name: 'vite-plugin-vue-inspector' }],
      { name: 'vite-plugin-vue-inspector:post' },
      { name: 'vite-plugin-vue-devtools' },
      { name: 'vite-plugin-tailwindcss' },
    ],
  } as UserConfig

  it('disables env-file loading explicitly with envDir: false', () => {
    const built = buildCashLiveViteConfig(fakeBase, {})
    expect(built.envDir).toBe(false)
  })

  it('disables HMR without dropping the rest of the server config', () => {
    const built = buildCashLiveViteConfig(fakeBase, {})
    expect(built.server?.hmr).toBe(false)
    expect(built.server?.port).toBe(5199)
  })

  it('removes the Vue DevTools/Inspector plugins and keeps app plugins', () => {
    const names = pluginNames(buildCashLiveViteConfig(fakeBase, {}))
    expect(names).toContain('vite-plugin-vue')
    expect(names).toContain('vite-plugin-tailwindcss')
    expect(names).not.toContain('vite-plugin-vue-devtools')
    expect(names).not.toContain('vite-plugin-vue-inspector')
    expect(names).not.toContain('vite-plugin-vue-inspector:post')
    expect(names).not.toContain('vite-plugin-inspect')
  })
})

describe('sanitizeCashLiveProcessEnv — bounded VITE_ allowlist', () => {
  it('removes every non-allowlisted VITE_ variable and leaves the rest alone', () => {
    const env: Record<string, string | undefined> = {
      VITE_API_BASE_URL: 'http://127.0.0.1:8081/api/v1',
      VITE_SECRET_TOKEN: 'leak',
      VITE_OTHER: 'leak',
      PATH: '/usr/bin',
    }
    const removed = sanitizeCashLiveProcessEnv(env)
    expect(env.VITE_API_BASE_URL).toBe('http://127.0.0.1:8081/api/v1')
    expect(env.VITE_SECRET_TOKEN).toBeUndefined()
    expect(env.VITE_OTHER).toBeUndefined()
    expect(env.PATH).toBe('/usr/bin')
    expect(removed.sort()).toEqual(['VITE_OTHER', 'VITE_SECRET_TOKEN'])
  })

  it('keeps the allowlist minimal (envDir does not stop process env inheritance)', () => {
    expect(CASH_LIVE_VITE_ALLOWED_ENV).toEqual(['VITE_API_BASE_URL'])
  })
})

describe('vite.cash-live.config default export', () => {
  it('reuses the real app config with env files off and no devtools plugins', async () => {
    const { default: cashLiveViteConfig } = await import('../../../vite.cash-live.config')
    const resolved = await (cashLiveViteConfig as () => Promise<UserConfig>)()
    expect(resolved.envDir).toBe(false)
    expect(resolved.server?.hmr).toBe(false)
    const names = pluginNames(resolved)
    expect(names.length).toBeGreaterThan(0)
    expect(names).not.toContain('vite-plugin-vue-devtools')
    expect(names).not.toContain('vite-plugin-vue-inspector')
    expect(names).not.toContain('vite-plugin-inspect')
  })

  it('resolves through Vite with env files disabled and inherited VITE_* removed', async () => {
    process.env.VITE_CASH_LIVE_LEAK = 'ambient'
    const resolved = await resolveConfig({ configFile: 'vite.cash-live.config.ts' }, 'serve')
    expect(resolved.envDir).toBe(false)
    expect(resolved.env.VITE_CASH_LIVE_LEAK).toBeUndefined()
    expect(process.env.VITE_CASH_LIVE_LEAK).toBeUndefined()
  })
})
