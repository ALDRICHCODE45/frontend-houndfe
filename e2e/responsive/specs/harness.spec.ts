import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import responsiveConfig, {
  DEFAULT_RUN_ID,
  RUN_ID_ENV_VAR,
  resolveRunId,
} from '../../../playwright.responsive.config'
import { expect, test } from '../fixtures/test'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const ARTIFACT_ROOT_PATTERN = /^artifacts\/responsive\/.+/

test.use({ viewport: { width: 375, height: 667 } })

test.describe('@responsive-harness runner bootstrap', () => {
  test('proves the Chromium runner is the browser geometry authority', async ({ page }) => {
    await page.setContent(
      '<!doctype html><html><body style="margin:0"><main data-testid="bootstrap-root">harness bootstrap</main></body></html>',
    )

    const measured = await page.evaluate(() => ({
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))

    expect(measured.innerWidth).toBe(375)
    expect(measured.innerHeight).toBe(667)
    expect(measured.documentOverflow).toBeLessThanOrEqual(1)
  })
})

test.describe('@responsive-harness runner wiring', () => {
  test('declares a single Chromium-only project', () => {
    expect(responsiveConfig.projects).toHaveLength(1)
    expect(responsiveConfig.projects?.[0]?.name).toBe('chromium')
  })

  test('hosts the real Vite app on a strict dedicated webServer', () => {
    const webServer = Array.isArray(responsiveConfig.webServer)
      ? responsiveConfig.webServer[0]
      : responsiveConfig.webServer
    expect(webServer).toMatchObject({
      url: 'http://127.0.0.1:4173/login',
      reuseExistingServer: false,
      timeout: 120_000,
      env: { VITE_API_BASE_URL: '/__e2e-api' },
    })
    expect(webServer?.command).toContain('--strictPort')
    expect(webServer?.command).toContain('--port 4173')
  })

  test('roots diagnostic output under artifacts/responsive/<runId>', () => {
    expect(responsiveConfig.outputDir).toMatch(ARTIFACT_ROOT_PATTERN)

    const reporters = Array.isArray(responsiveConfig.reporter) ? responsiveConfig.reporter : []
    const htmlReporter = reporters.find(
      (entry) => Array.isArray(entry) && entry[0] === 'html',
    ) as [string, { outputFolder?: string }] | undefined
    expect(htmlReporter?.[1]?.outputFolder).toMatch(ARTIFACT_ROOT_PATTERN)
  })

  test('exposes the exact harness and responsive type-check commands', () => {
    const packageJson = JSON.parse(readFileSync(`${repoRoot}package.json`, 'utf8'))

    expect(packageJson.scripts['test:responsive:harness']).toContain('playwright.responsive.config.ts')
    expect(packageJson.scripts['test:responsive:harness']).toContain('--grep @responsive-harness')
    expect(packageJson.scripts['type-check:responsive']).toBe('tsc --noEmit -p tsconfig.responsive.json')
    expect(packageJson.devDependencies['@playwright/test']).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

test.describe('@responsive-harness bootstrap environment', () => {
  test('falls back to the deterministic run id when the environment is missing or invalid', () => {
    expect(resolveRunId({})).toBe(DEFAULT_RUN_ID)
    expect(resolveRunId({ [RUN_ID_ENV_VAR]: '   ' })).toBe(DEFAULT_RUN_ID)
    expect(resolveRunId({ [RUN_ID_ENV_VAR]: '  wu1a-run-42 ' })).toBe('wu1a-run-42')
  })

  test('keeps local runs strict and deterministic', () => {
    expect(responsiveConfig.forbidOnly).toBe(true)
    expect(responsiveConfig.retries).toBe(0)
    expect(responsiveConfig.fullyParallel).toBe(false)
    expect(responsiveConfig.workers).toBe(1)
  })
})

test.describe('@responsive-harness deterministic browser context', () => {
  test('pins locale, timezone, color scheme, and reduced motion in the runner contract', () => {
    expect(responsiveConfig.use).toMatchObject({
      locale: 'es-MX',
      timezoneId: 'America/Mexico_City',
      colorScheme: 'dark',
      reducedMotion: 'reduce',
    })
  })

  test('applies the fixed locale and timezone inside Chromium', async ({ page }) => {
    await page.setContent('<!doctype html><html><body></body></html>')

    const context = await page.evaluate(() => ({
      locale: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }))

    expect(context.locale).toBe('es-MX')
    expect(context.timezone).toBe('America/Mexico_City')
  })
})
