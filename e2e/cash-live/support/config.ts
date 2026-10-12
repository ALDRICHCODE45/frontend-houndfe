/**
 * Pure Playwright config builder for the isolated cash-live journey.
 *
 * `playwright.cash-live.config.ts` evaluates `buildCashLiveConfig(process.env)`
 * at load time. The builder resolves the fail-closed env contract first, so a
 * rejected opt-in/backend/fixture throws before Playwright can start any
 * webServer or browser. It performs no filesystem, network or process-env
 * access of its own (the caller supplies `env`).
 *
 * Only the owned frontend dev server is declared; the backend is never started
 * here. The frontend is pinned to the explicitly declared loopback backend URL
 * through `VITE_API_BASE_URL`, never the responsive harness mock prefix
 * `/__e2e-api` and never the ambient `localhost:3000` fallback.
 *
 * Every capture channel that could persist auth tokens is disabled: trace,
 * video and screenshot are `off`, and no HAR recording is configured.
 *
 * The frontend dev server is launched with the dedicated hardened Vite config
 * (`vite.cash-live.config.ts`) that disables env-file loading and sanitizes
 * inherited `VITE_*` process variables.
 */
import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test'

import {
  CASH_LIVE_FRONTEND_HOST,
  CASH_LIVE_FRONTEND_ORIGIN,
  CASH_LIVE_FRONTEND_PORT,
  CASH_LIVE_SCRATCH_ROOT,
  resolveCashLiveEnv,
} from './env'

/**
 * Dedicated root Vite config for the cash-live dev server. It reuses the app
 * config read-only and disables ambient `.env*` loading and Vue DevTools.
 */
export const CASH_LIVE_VITE_CONFIG = 'vite.cash-live.config.ts'

/**
 * Assembles the Playwright configuration from the validated env contract.
 * Throws `CashLiveConfigError` (via `resolveCashLiveEnv`) for rejected input,
 * before returning a config Playwright could act on.
 */
export function buildCashLiveConfig(env: Record<string, string | undefined>): PlaywrightTestConfig {
  const resolved = resolveCashLiveEnv(env)
  const runArtifactRoot = `${CASH_LIVE_SCRATCH_ROOT}/${resolved.runId}`

  return defineConfig({
    testDir: 'e2e/cash-live/specs',
    fullyParallel: false,
    workers: 1,
    forbidOnly: true,
    retries: 0,
    outputDir: `${runArtifactRoot}/test-results`,
    reporter: [['line']],
    use: {
      baseURL: CASH_LIVE_FRONTEND_ORIGIN,
      trace: 'off',
      video: 'off',
      screenshot: 'off',
      // Explicitly keep HAR off: an HAR would persist Authorization headers.
      contextOptions: { recordHar: undefined },
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
      command: `pnpm exec vite --config ${CASH_LIVE_VITE_CONFIG} --host ${CASH_LIVE_FRONTEND_HOST} --port ${CASH_LIVE_FRONTEND_PORT} --strictPort`,
      url: `${CASH_LIVE_FRONTEND_ORIGIN}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_API_BASE_URL: resolved.backendBaseUrl,
      },
    },
  })
}
