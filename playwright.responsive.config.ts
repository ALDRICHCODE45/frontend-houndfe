import { defineConfig, devices } from '@playwright/test'

export const DEFAULT_RESPONSIVE_WEB_SERVER_PORT = 4173

export function resolveWebServerPort(env: Record<string, string | undefined>): number {
  const candidate = env.RESPONSIVE_WEB_SERVER_PORT
  if (candidate === undefined || candidate.trim() === '') return DEFAULT_RESPONSIVE_WEB_SERVER_PORT
  if (!/^[0-9]+$/.test(candidate)) {
    throw new Error('RESPONSIVE_WEB_SERVER_PORT must be an integer from 1 to 65535')
  }
  const port = Number(candidate)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('RESPONSIVE_WEB_SERVER_PORT must be an integer from 1 to 65535')
  }
  return port
}

export const RESPONSIVE_WEB_SERVER_PORT = resolveWebServerPort(process.env)
export const RESPONSIVE_WEB_SERVER_URL = `http://127.0.0.1:${RESPONSIVE_WEB_SERVER_PORT}/login`
export const RUN_ID_ENV_VAR = 'RESPONSIVE_RUN_ID'
export const DEFAULT_RUN_ID = 'local-run'

export function resolveRunId(env: Record<string, string | undefined>): string {
  const candidate = env[RUN_ID_ENV_VAR]?.trim()
  return candidate || DEFAULT_RUN_ID
}

const runArtifactRoot = `artifacts/responsive/${resolveRunId(process.env)}`
const humanDecisionsLiveMode = process.env.RESPONSIVE_HUMAN_DECISIONS_MODE === 'live'

export default defineConfig({
  testDir: 'e2e/responsive/specs',
  fullyParallel: false,
  workers: 1,
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  outputDir: `${runArtifactRoot}/test-results`,
  reporter: [
    ['line'],
    ['html', { outputFolder: `${runArtifactRoot}/html`, open: 'never' }],
    [
      './e2e/responsive/evidence/reporter.ts',
      { runId: resolveRunId(process.env), outputRoot: `${runArtifactRoot}/evidence` },
    ],
  ],
  use: {
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${RESPONSIVE_WEB_SERVER_PORT} --strictPort`,
    url: RESPONSIVE_WEB_SERVER_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      VITE_API_BASE_URL: '/__e2e-api',
      VITE_HUMAN_DECISIONS_OFFLINE_DEMO: humanDecisionsLiveMode ? 'false' : 'true',
      RESPONSIVE_DISABLE_HMR: humanDecisionsLiveMode ? 'true' : 'false',
    },
  },
})
