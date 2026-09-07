import { defineConfig, devices } from '@playwright/test'

export const RESPONSIVE_WEB_SERVER_PORT = 4173
export const RESPONSIVE_WEB_SERVER_URL = `http://127.0.0.1:${RESPONSIVE_WEB_SERVER_PORT}/login`
export const RUN_ID_ENV_VAR = 'RESPONSIVE_RUN_ID'
export const DEFAULT_RUN_ID = 'local-run'

export function resolveRunId(env: Record<string, string | undefined>): string {
  const candidate = env[RUN_ID_ENV_VAR]?.trim()
  return candidate || DEFAULT_RUN_ID
}

const runArtifactRoot = `artifacts/responsive/${resolveRunId(process.env)}`

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
    ['./e2e/responsive/evidence/reporter.ts', { runId: resolveRunId(process.env), outputRoot: `${runArtifactRoot}/evidence` }],
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
    env: { VITE_API_BASE_URL: '/__e2e-api' },
  },
})
