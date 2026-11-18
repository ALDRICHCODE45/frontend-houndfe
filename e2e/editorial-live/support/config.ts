/**
 * Pure Playwright config builder for the editorial-live journey (modeled on cash-live).
 *
 * `playwright.editorial-live.config.ts` evaluates `buildEditorialLiveConfig(process.env)` at load
 * time; a rejected env throws before any webServer or browser starts. Only the owned frontend dev
 * server is declared (hardened `vite.editorial-live.config.ts`), pinned to the declared backend
 * through `VITE_API_BASE_URL`. Trace, video, screenshot and HAR are off.
 */
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

import {
  EDITORIAL_LIVE_FRONTEND_HOST,
  EDITORIAL_LIVE_FRONTEND_ORIGIN,
  EDITORIAL_LIVE_FRONTEND_PORT,
  EDITORIAL_LIVE_SCRATCH_ROOT,
  resolveEditorialLiveEnv,
} from './env'

export const EDITORIAL_LIVE_VITE_CONFIG = 'vite.editorial-live.config.ts'

export function buildEditorialLiveConfig(env: Record<string, string | undefined>): PlaywrightTestConfig {
  const resolved = resolveEditorialLiveEnv(env)
  return defineConfig({
    testDir: 'e2e/editorial-live/specs',
    fullyParallel: false,
    workers: 1,
    forbidOnly: true,
    retries: 0,
    outputDir: `${EDITORIAL_LIVE_SCRATCH_ROOT}/${resolved.runId}/test-results`,
    reporter: [['line']],
    use: {
      baseURL: EDITORIAL_LIVE_FRONTEND_ORIGIN,
      trace: 'off',
      video: 'off',
      screenshot: 'off',
      contextOptions: { recordHar: undefined },
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
      command: `pnpm exec vite --config ${EDITORIAL_LIVE_VITE_CONFIG} --host ${EDITORIAL_LIVE_FRONTEND_HOST} --port ${EDITORIAL_LIVE_FRONTEND_PORT} --strictPort`,
      url: `${EDITORIAL_LIVE_FRONTEND_ORIGIN}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_BASE_URL: resolved.backendBaseUrl },
    },
  })
}
