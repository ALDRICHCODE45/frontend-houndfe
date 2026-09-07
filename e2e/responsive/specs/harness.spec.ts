import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import responsiveConfig, {
  DEFAULT_RUN_ID,
  RUN_ID_ENV_VAR,
  resolveRunId,
} from '../../../playwright.responsive.config'
import { expect, test } from '../fixtures/test'
import type { Page } from '@playwright/test'
import {
  findViewportCase,
  isMatrixWidth,
  parseResponsiveTarget,
  RESPONSIVE_VIEWPORTS,
  SURFACE_STATES,
  type ResponsiveTarget,
} from '../targets/types'
import {
  EVIDENCE_AUTHORITIES,
  MEASUREMENT_TOLERANCE_PX,
  SCHEMA_VERSION,
  validateEvidenceRecord,
  validateEvidenceSession,
} from '../evidence/schema'
import {
  assertBoxesWithinOwner,
  assertDocumentNoHorizontalOverflow,
  assertEssentialReachabilityAtExtremes,
  assertExactViewport,
  assertLongDataContract,
  assertOverflowContract,
  assertStickyAndPinnedAlignment,
  measureScrollExtreme,
} from '../assertions/geometry'
import {
  assertCollectionSemantics,
  assertFocusNotObscured,
  assertKeyboardActivation,
  assertKeyboardSequence,
  assertMinimumTargets,
  assertNamedControls,
  assertNativeTableSemantics,
  assertOverlayLifecycle,
  type KeyboardStep,
  type TargetSizeInput,
} from '../assertions/accessibility'
import { assertSurfaceState } from '../assertions/states'

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

const baseTarget: ResponsiveTarget = {
  surfaceId: 'DT-01', archetype: 'DT', route: '/pos/products', containerOwner: 'dashboard-panel',
  strategy: 'contained-table-scroll', essentialFields: ['name', 'sku', 'price', 'status'],
  supportedStates: ['loading', 'success', 'empty', 'no-match', 'error'],
  preferenceKeys: ['products-view-mode', 'table-preferences-pos-products'],
  risks: ['R1', 'R2', 'R3'], exclusions: [],
}

const baseRecord = {
  schemaVersion: 1, runId: 'wu1b-run', authority: 'browser-geometry', surfaceId: 'DT-01', archetype: 'DT',
  route: '/pos/products', fixtureId: 'products-stress', stateId: 'success', effectiveMode: 'table',
  viewport: { key: 'phone-320', width: 320, height: 568 },
  strategy: 'contained-table-scroll', containerOwner: 'dashboard-panel', assertionId: 'document-overflow',
  riskIds: ['R1'], status: 'pass',
}

function invalid(result: { ok: boolean; errors?: readonly string[] }, fragment: string): void {
  expect(result.ok).toBe(false)
  expect(result.errors?.join(' ')).toContain(fragment)
}

test.describe('@responsive-harness typed policy contracts', () => {
  const bad = (patch: object, fragment: string) => invalid(parseResponsiveTarget({ ...baseTarget, ...patch }), fragment)

  test('accepts exactly the 320/375/768/1024 matrix and rejects approximate widths', () => {
    expect(RESPONSIVE_VIEWPORTS.map((viewport) => viewport.width)).toEqual([320, 375, 768, 1024])
    expect(RESPONSIVE_VIEWPORTS.map((viewport) => viewport.height)).toEqual([568, 667, 1024, 768])
    expect(parseResponsiveTarget(baseTarget).ok).toBe(true)
    for (const width of [360, 412, 419, 320.5]) {
      expect(isMatrixWidth(width)).toBe(false)
      expect(findViewportCase(width)).toBeUndefined()
    }
  })

  test('rejects unsupported strategies and archetype drift', () => {
    bad({ strategy: 'free-scroll' }, 'strategy')
    bad({ archetype: 'NT' }, 'archetype')
  })

  test('rejects missing surface, route, and state identity', () => {
    bad({ surfaceId: 'DT-99' }, 'inventory')
    bad({ route: ' ' }, 'route')
    bad({ supportedStates: [] }, 'supportedStates')
    bad({ risks: ['R9'] }, 'R1-R8')
  })

  test('rejects incomplete exclusions', () => {
    bad({ exclusions: [{ assertionId: 'scroll-extremes', reason: 'cards never scroll' }] }, 'followUp')
    bad({ exclusions: [{ assertionId: 'scroll-extremes', reason: '', followUp: 'HY-04' }] }, 'reason')
  })
})

test.describe('@responsive-harness evidence schema contracts', () => {
  const bad = (patch: object, fragment: string) => invalid(validateEvidenceRecord({ ...baseRecord, ...patch }), fragment)

  test('accepts a schema-versioned record at every exact width and rejects schema drift', () => {
    expect(SCHEMA_VERSION).toBe(1)
    expect(MEASUREMENT_TOLERANCE_PX).toBe(1)
    for (const viewport of RESPONSIVE_VIEWPORTS) {
      const result = validateEvidenceRecord({
        ...baseRecord,
        viewport: { key: viewport.key, width: viewport.width, height: viewport.height },
      })
      expect(result.ok).toBe(true)
      expect(result.ok && result.record.schemaVersion).toBe(1)
    }
    bad({ schemaVersion: 2 }, 'schemaVersion')
  })

  test('rejects non-exact viewport widths and mismatched viewport keys', () => {
    bad({ viewport: { key: 'phone-320', width: 360, height: 568 } }, 'exact matrix width')
    bad({ viewport: { key: 'phone-375', width: 320, height: 568 } }, 'viewport.key')
  })

  test('rejects invalid authority, status, and malformed records', () => {
    expect(EVIDENCE_AUTHORITIES).toEqual(['browser-geometry', 'browser-interaction'])
    bad({ authority: 'jsdom' }, 'authority')
    bad({ status: 'warn' }, 'status')
    bad({ fixtureId: '' }, 'fixtureId')
    bad({ stateId: '' }, 'stateId')
    bad({ surfaceId: 'DT-99' }, 'inventory')
    bad({ status: 'fail' }, 'failure')
    bad({ status: 'fail', failure: { taxonomy: 'unknown', message: 'broken' } }, 'taxonomy')
  })

  test('requires complete exclusion records and rejects a passing failure', () => {
    bad({ status: 'excluded' }, 'exclusion')
    bad({ status: 'excluded', exclusion: { reason: ' ', followUp: 'Batch C native targets' } }, 'reason')
    bad({ failure: { taxonomy: 'document-overflow', message: 'should not exist on pass' } }, 'pass')
  })

  test('rejects duplicate evidence identity and separates representative authorities', () => {
    invalid(validateEvidenceSession([baseRecord, { ...baseRecord }]), 'duplicate')
    expect(validateEvidenceRecord({ ...baseRecord, authority: 'browser-interaction', assertionId: 'minimum-targets' }).ok).toBe(true)
    expect(
      validateEvidenceSession([
        baseRecord,
        {
          ...baseRecord,
          authority: 'browser-interaction',
          assertionId: 'minimum-targets',
          status: 'fail',
          failure: { taxonomy: 'target-size', message: '28px row menu' },
        },
      ]).ok,
    ).toBe(true)
  })
})

const PAGE_WRAP = (body: string) => `<!doctype html><html><body style="margin:0">${body}</body></html>`

const CLEAN_PAGE = PAGE_WRAP('<div data-testid="owner" style="width:375px"><div data-testid="stacked-region" style="padding:8px"><div style="height:20px">row one</div><div style="height:20px">row two</div></div></div>')

const WIDE_PAGE = PAGE_WRAP('<div data-testid="owner" style="width:375px"><div data-testid="region" style="overflow-x:auto"><div data-testid="content" style="width:650px;height:40px;white-space:nowrap">'
  + '<span data-testid="cell-a" style="display:inline-block;width:190px;height:32px">identity</span><span data-testid="cell-b" style="display:inline-block;width:190px;height:32px">value</span><span data-testid="cell-c" style="display:inline-block;width:190px;height:32px">status</span><span data-testid="pin-action" style="display:inline-block;width:80px;height:32px;position:sticky;right:0">action</span></div></div><p data-testid="cue">Scroll sideways to reach every column</p></div>')

const UNOWNED_PAGE = PAGE_WRAP('<div data-testid="owner" style="width:375px"><div data-testid="region" style="width:600px;height:40px">wide content</div></div>')

const CLIPPED_PAGE = PAGE_WRAP('<div data-testid="owner" style="width:375px;overflow-x:hidden"><div data-testid="region" style="width:600px;height:40px">clipped content</div></div>')

const LONG_TOKEN = 'PRODUCT-SKU-0000000000000000000000000099'

const longPage = (overflow: string) => PAGE_WRAP(`<div data-testid="token" style="width:300px;white-space:nowrap;overflow:${overflow};font-size:20px">${LONG_TOKEN}</div>`)

const tablePage = (headerSticky: boolean, bodyPinSticky: boolean) => {
  const stickyTop = headerSticky ? 'position:sticky;top:0;' : ''
  const bodyRow = bodyPinSticky
    ? '<span style="display:inline-block;width:260px;height:28px">A</span><span style="display:inline-block;width:240px;height:28px">filler</span><span data-testid="body-pin" style="display:inline-block;width:100px;height:28px;position:sticky;right:0">Pin</span>'
    : '<span style="display:inline-block;width:260px;height:28px">A</span><span data-testid="body-pin" style="display:inline-block;width:100px;height:28px">Pin</span><span style="display:inline-block;width:240px;height:28px">filler</span>'
  return PAGE_WRAP(`<div data-testid="region" style="width:375px;height:90px;overflow:auto"><div style="width:600px">
    <div style="height:28px;white-space:nowrap;${stickyTop}"><span data-testid="head-a" style="display:inline-block;width:500px;height:28px">A</span><span data-testid="head-pin" style="display:inline-block;width:100px;height:28px;position:sticky;right:0">Pin</span></div>
    <div style="height:28px;white-space:nowrap">${bodyRow}</div>
    <div style="height:28px"><span style="display:inline-block;width:500px">A</span></div>
    <div style="height:28px"><span style="display:inline-block;width:500px">A</span></div>
  </div></div>`)
}

test.describe('@responsive-harness geometry assertions', () => {
  test('measures exact viewport and document geometry with structured failures', async ({ page }) => {
    await page.setContent(CLEAN_PAGE)
    expect(await assertExactViewport(page, findViewportCase(375)!)).toMatchObject({ status: 'pass', measurements: { innerWidth: 375, innerHeight: 667 } })
    expect((await assertDocumentNoHorizontalOverflow(page)).status).toBe('pass')
    await page.setViewportSize({ width: 360, height: 600 })
    expect((await assertExactViewport(page, findViewportCase(375)!)).failure).toMatchObject({ taxonomy: 'harness-or-fixture' })
    await page.setViewportSize({ width: 375, height: 667 })
    await page.setContent(PAGE_WRAP('<div style="width:500px;height:20px"></div>'))
    expect(await assertDocumentNoHorizontalOverflow(page)).toMatchObject({ status: 'fail', failure: { taxonomy: 'document-overflow' }, measurements: { html: { scrollWidth: 500, clientWidth: 375 } } })
  })

  test('requires owner containment, honors the 1px tolerance, and never lets ancestor clipping fake a pass', async ({ page }) => {
    expect(validateEvidenceRecord({ ...baseRecord, assertionId: 'scroll-extremes', status: 'excluded', exclusion: { reason: 'cards never scroll horizontally', followUp: 'HY-04 stacked rows' } }).ok).toBe(true)
    await page.setContent(WIDE_PAGE)
    expect((await assertBoxesWithinOwner(page.getByTestId('owner'), { region: page.getByTestId('region') })).status).toBe('pass')
    for (const [width, expected] of [[376, 'pass'], [377, 'fail']] as const) {
      await page.setContent(PAGE_WRAP(`<div data-testid="owner" style="width:375px"><div data-testid="edge" style="width:${width}px;height:10px"></div></div>`))
      expect((await assertBoxesWithinOwner(page.getByTestId('owner'), { edge: page.getByTestId('edge') })).status).toBe(expected)
    }
    await page.setContent(CLIPPED_PAGE)
    expect((await assertDocumentNoHorizontalOverflow(page)).status).toBe('pass')
    expect(await assertBoxesWithinOwner(page.getByTestId('owner'), { region: page.getByTestId('region') }))
      .toMatchObject({ status: 'fail', failure: { taxonomy: 'surface-outside-owner', actual: { right: 600 } } })
  })

  test('permits exactly one owned local scroll with discoverability', async ({ page }) => {
    await page.setContent(WIDE_PAGE)
    const owner = page.getByTestId('owner')
    const region = page.getByTestId('region')
    expect(await assertOverflowContract({ policy: 'local-scroll', owner, scrollRegion: region, cue: page.getByTestId('cue') })).toMatchObject({ status: 'pass', measurements: { region: { overflowAmount: 275, overflowX: 'auto' } } })
    expect((await assertOverflowContract({ policy: 'local-scroll', owner, scrollRegion: region })).failure).toMatchObject({ taxonomy: 'missing-scroll-discoverability' })
    await page.setContent(UNOWNED_PAGE)
    expect((await assertOverflowContract({ policy: 'local-scroll', owner, scrollRegion: page.getByTestId('region') })).failure).toMatchObject({ taxonomy: 'uncontained-local-overflow' })
    await page.setContent(CLEAN_PAGE)
    expect((await assertOverflowContract({ policy: 'no-horizontal-scroll', owner, recordRegions: [page.getByTestId('stacked-region')] })).status).toBe('pass')
    await page.setContent(CLIPPED_PAGE)
    const clipped = await assertOverflowContract({ policy: 'no-horizontal-scroll', owner, recordRegions: [page.getByTestId('region')] })
    expect(clipped.failure).toMatchObject({ taxonomy: 'unexpected-local-overflow' })
    expect(clipped.failure?.actual).toBe(600)
  })

  test('keeps long identifiers reachable and fails clipped critical tokens', async ({ page }) => {
    await page.setContent(longPage('auto'))
    expect(await assertLongDataContract([{ label: 'sku', locator: page.getByTestId('token') }])).toMatchObject({ status: 'pass', measurements: { tokens: { sku: { clipped: true, reachable: true } } } })
    await page.setContent(longPage('hidden'))
    expect(await assertLongDataContract([{ label: 'sku', locator: page.getByTestId('token'), critical: true }]))
      .toMatchObject({ status: 'fail', failure: { taxonomy: 'long-data-clipping', actual: { scrollWidth: expect.any(Number), text: LONG_TOKEN } } })
  })

  test('reaches both scroll extremes and verifies essential reachability', async ({ page }) => {
    await page.setContent(WIDE_PAGE)
    const region = page.getByTestId('region')
    const extremes = { left: await measureScrollExtreme(region, 'left'), right: await measureScrollExtreme(region, 'right') }
    expect(extremes.left).toMatchObject({ requested: 0, actual: 0 })
    expect(extremes.right.actual).toBe(extremes.right.max)
    expect(extremes.right.max).toBeGreaterThan(0)
    const essentials = {
      identity: { locator: page.getByTestId('cell-a'), expectedExtreme: 'left' as const },
      action: { locator: page.getByTestId('pin-action'), expectedExtreme: 'both' as const },
    }
    expect((await assertEssentialReachabilityAtExtremes(region, essentials)).status).toBe('pass')
    expect((await assertEssentialReachabilityAtExtremes(region, { status: { locator: page.getByTestId('cell-a'), expectedExtreme: 'right' } })).failure)
      .toMatchObject({ taxonomy: 'essential-content-loss' })
    await page.setContent(CLEAN_PAGE)
    expect(await measureScrollExtreme(page.getByTestId('stacked-region'), 'right')).toMatchObject({ requested: 0, actual: 0, max: 0 })
  })

  test('validates conditional sticky and pinned alignment', async ({ page }) => {
    const pinned = [{ side: 'right' as const, header: page.getByTestId('head-pin'), body: page.getByTestId('body-pin') }]
    const check = () => assertStickyAndPinnedAlignment(page.getByTestId('region'), { pinned, stickyHeader: page.getByTestId('head-a') })
    await page.setContent(tablePage(true, true))
    expect((await check()).status).toBe('pass')
    await page.setContent(tablePage(false, true))
    expect((await check()).failure).toMatchObject({ taxonomy: 'sticky-header-misalignment' })
    await page.setContent(tablePage(true, false))
    expect(await check()).toMatchObject({ status: 'fail', failure: { taxonomy: 'pinned-column-misalignment' }, measurements: { alignments: expect.any(Array) } })
  })
})
const SEMANTIC_PAGE = PAGE_WRAP('<style>button{box-sizing:border-box;margin:0}button:focus-visible{outline:2px solid #fff}</style><div style="padding:8px;display:flex;flex-direction:column;gap:4px"><button data-testid="k1" aria-label="Primero">Primero</button><button data-testid="k2">Segundo</button><button data-testid="k3">Tercero</button><button data-testid="icon-only" style="width:28px;height:28px"><svg width="12" height="12"></svg></button></div>')
const TABLE_OK = PAGE_WRAP('<table data-testid="native-table" aria-label="Productos"><thead><tr><th>Nombre</th><th>SKU</th></tr></thead><tbody><tr><td>Café</td><td>SKU-1</td></tr><tr><td>Té</td><td>SKU-2</td></tr></tbody></table>')
const TABLE_NO_NAME = PAGE_WRAP('<table data-testid="native-table"><thead><tr><th>Nombre</th></tr></thead><tbody><tr><td>Café</td></tr></tbody></table>')
const CARDS_PAGE = PAGE_WRAP('<script>window.addEventListener("click", () => { window.acted = true })</script><ul data-testid="cards"><li data-testid="card-a">Café<button data-testid="card-action" aria-label="Ver café" style="box-sizing:border-box">Ver</button></li></ul>')
const BAD_CARDS_PAGE = PAGE_WRAP('<div data-testid="cards"><div>Café<button data-testid="card-action"></button></div></div>')
const TARGETS_PAGE = PAGE_WRAP('<style>button{box-sizing:border-box;margin:0;padding:0}button:focus-visible{outline:2px solid #fff}</style><div style="padding:4px"><button data-testid="t44" style="width:44px;height:44px">A</button><button data-testid="t43" style="width:43px;height:43px">B</button><button data-testid="t-wide" style="width:44px;height:20px">C</button><button data-testid="t-dis" disabled style="width:28px;height:28px">D</button><button data-testid="t-hit" style="width:44px;height:44px"><svg width="12" height="12"></svg></button></div>')
const ACTIVATION_PAGE = PAGE_WRAP('<style>button,a{box-sizing:border-box;margin:0}button:focus-visible,a:focus-visible{outline:2px solid #fff}</style><div style="padding:8px;display:flex;flex-direction:column;gap:4px"><button data-testid="act-btn" onclick="window.activated = true" style="width:88px;height:44px">Activar</button><a data-testid="act-link" href="#" onclick="event.preventDefault(); window.linkActivated = true" style="min-height:44px;display:inline-block">Enlace</a></div>')
const PLAIN_FOCUS_PAGE = PAGE_WRAP('<button data-testid="plain" style="outline:none;box-shadow:none">Sin indicador</button>')
const OBSCURED_PAGE = PAGE_WRAP('<div data-testid="sticky-footer" style="position:fixed;bottom:0;height:60px;background:#111">pie fijo</div><button data-testid="obscured-btn" style="position:fixed;bottom:20px;left:8px;box-sizing:border-box">Acción tapada</button>')
const OVERLAY_BODY = '<button data-testid="trigger" style="box-sizing:border-box;width:120px;height:44px">Abrir filtros</button><div data-testid="overlay" role="dialog" aria-label="Filtros de productos" hidden style="padding:8px"><input data-testid="ov-input" aria-label="Buscar producto" style="height:24px"><button data-testid="ov-close" style="box-sizing:border-box;width:44px;height:44px">Cerrar</button></div>'
const OVERLAY_JS = (restore: boolean, remove = false) => `<script>(() => {
  const overlay = document.querySelector('[data-testid="overlay"]')
  const trigger = document.querySelector('[data-testid="trigger"]')
  const closeOverlay = () => { overlay.hidden = true; if (${remove}) trigger.remove(); else if (${restore}) trigger.focus() }
  document.querySelector('[data-testid="ov-close"]').addEventListener('click', closeOverlay)
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeOverlay() })
  trigger.addEventListener('click', () => { overlay.hidden = false; document.querySelector('[data-testid="ov-input"]').focus() })
})()</script>`
const overlayPage = (restore: boolean, remove = false) => PAGE_WRAP(`<style>button{box-sizing:border-box;margin:0}button:focus-visible{outline:2px solid #fff}</style>${OVERLAY_BODY}${OVERLAY_JS(restore, remove)}`)
const statePage = (text: string, extra = '') => PAGE_WRAP(`<div data-testid="feedback" style="padding:8px">${text}</div>${extra}<button data-testid="page-next" style="box-sizing:border-box;width:44px;height:44px">Siguiente página</button>`)
const windowFlag = (flag: string) => (page: Page) => page.evaluate((name) => Boolean((window as unknown as Record<string, unknown>)[name]), flag)

test.describe('@responsive-harness semantic and interaction assertions', () => {
  test('requires named controls and native-table versus collection semantics', async ({ page }) => {
    await page.setContent(SEMANTIC_PAGE)
    expect(await assertNamedControls([{ id: 'k2', locator: page.getByTestId('k2'), role: 'button', name: 'Segundo' }])).toMatchObject({ status: 'pass' })
    expect((await assertNamedControls([{ id: 'icon-only', locator: page.getByTestId('icon-only'), role: 'button', name: 'Cerrar' }])).failure).toMatchObject({ taxonomy: 'semantic-or-name' })
    await page.setContent(TABLE_OK)
    expect(await assertNativeTableSemantics(page.getByTestId('native-table'), { name: 'Productos', columns: ['Nombre', 'SKU'], minRows: 2 })).toMatchObject({ status: 'pass' })
    expect((await assertNativeTableSemantics(page.getByTestId('native-table'), { name: 'Productos', columns: ['Precio'], minRows: 2 })).failure).toMatchObject({ taxonomy: 'semantic-or-name' })
    await page.setContent(TABLE_NO_NAME)
    expect((await assertNativeTableSemantics(page.getByTestId('native-table'), { name: 'Productos', columns: ['Nombre'], minRows: 1 })).failure).toMatchObject({ taxonomy: 'semantic-or-name' })
    await page.setContent(CARDS_PAGE)
    expect(await assertCollectionSemantics({ list: page.getByTestId('cards'), items: [{ identity: 'Café', item: page.getByTestId('card-a'), action: { locator: page.getByTestId('card-action'), name: 'Ver café', verify: windowFlag('acted') } }] })).toMatchObject({ status: 'pass' })
    await page.setContent(BAD_CARDS_PAGE)
    expect((await assertCollectionSemantics({ list: page.getByTestId('cards'), items: [{ identity: 'Café', item: page.getByTestId('card-a') }] })).failure).toMatchObject({ taxonomy: 'semantic-or-name' })
  })
  test('enforces the exact 44x44 hit-area floor with disabled and applicability exclusions', async ({ page }) => {
    await page.setContent(TARGETS_PAGE)
    const target = (id: string, extra?: Partial<TargetSizeInput>): TargetSizeInput => ({ id, locator: page.getByTestId(id), ...extra })
    expect(await assertMinimumTargets([target('t44'), target('t-hit')])).toMatchObject({ status: 'pass', measurements: { t44: { width: 44, height: 44 } } })
    for (const id of ['t43', 't-wide']) expect((await assertMinimumTargets([target(id)])).failure).toMatchObject({ taxonomy: 'target-size' })
    expect(await assertMinimumTargets([target('t-dis', { disabled: true })])).toMatchObject({ status: 'pass', measurements: { 't-dis': { enforcement: 'record-only-disabled' } } })
    expect(validateEvidenceRecord({ ...baseRecord, authority: 'browser-interaction', assertionId: 'minimum-targets', status: 'excluded', exclusion: { reason: 'purely unavailable action for the current role', followUp: 'Batch B row actions' } }).ok).toBe(true)
  })
})

test.describe('@responsive-harness keyboard and focus assertions', () => {
  const step = (id: string, name: string): KeyboardStep => ({ id, role: 'button', name })
  test('proves keyboard order, Enter versus Space activation, and visible unobscured focus', async ({ page }) => {
    await page.setContent(SEMANTIC_PAGE)
    const forward = [step('k2', 'Segundo'), step('k3', 'Tercero')]
    expect(await assertKeyboardSequence(page, page.getByTestId('k1'), forward)).toMatchObject({ status: 'pass' })
    expect(await assertKeyboardSequence(page, page.getByTestId('k3'), [step('k1', 'Primero'), step('k2', 'Segundo')], 'reverse')).toMatchObject({ status: 'pass' })
    expect((await assertKeyboardSequence(page, page.getByTestId('k1'), [forward[1], forward[0]])).failure).toMatchObject({ taxonomy: 'focus-order' })
    await page.setContent(ACTIVATION_PAGE)
    expect(await assertKeyboardActivation(page.getByTestId('act-btn'), { key: 'Enter', verify: windowFlag('activated') })).toMatchObject({ status: 'pass', measurements: { key: 'Enter' } })
    await page.evaluate(() => { delete (window as unknown as Record<string, unknown>).activated })
    expect(await assertKeyboardActivation(page.getByTestId('act-btn'), { key: 'Space', verify: windowFlag('activated') })).toMatchObject({ status: 'pass' })
    expect((await assertKeyboardActivation(page.getByTestId('act-btn'), { key: 'Enter', verify: async () => false })).failure).toMatchObject({ taxonomy: 'keyboard-activation' })
    expect(await assertKeyboardActivation(page.getByTestId('act-link'), { key: 'Enter', verify: windowFlag('linkActivated') })).toMatchObject({ status: 'pass' })
    await page.evaluate(() => { delete (window as unknown as Record<string, unknown>).linkActivated })
    expect((await assertKeyboardActivation(page.getByTestId('act-link'), { key: 'Space', verify: windowFlag('linkActivated') })).failure).toMatchObject({ taxonomy: 'keyboard-activation' })
    await page.setContent(PLAIN_FOCUS_PAGE); expect((await assertKeyboardActivation(page.getByTestId('plain'), { key: 'Enter', verify: async () => true })).failure).toMatchObject({ taxonomy: 'focus-obscured' })
    await page.setContent(OBSCURED_PAGE); expect((await assertFocusNotObscured(page.getByTestId('obscured-btn'), [page.getByTestId('sticky-footer')])).failure).toMatchObject({ taxonomy: 'focus-obscured' })
    await page.setContent(SEMANTIC_PAGE); await page.getByTestId('k1').focus()
    expect((await assertFocusNotObscured(page.getByTestId('k1'), [])).status).toBe('pass')
  })
})

test.describe('@responsive-harness overlay and state assertions', () => {
  const overlayContract = (page: Page, extra: Record<string, unknown> = {}) => ({ trigger: page.getByTestId('trigger'), overlay: page.getByTestId('overlay'), role: 'dialog', name: 'Filtros de productos', controls: [{ id: 'close', role: 'button', name: 'Cerrar' }], ...extra })
  test('proves overlay lifecycle, restoration, and surviving-invoker removal', async ({ page }) => {
    await page.setContent(overlayPage(true))
    expect(await assertOverlayLifecycle(page, overlayContract(page, { escape: true, restoreFocusTo: page.getByTestId('trigger') }))).toMatchObject({ status: 'pass', measurements: { focusRestored: true } })
    await page.setContent(overlayPage(false))
    expect((await assertOverlayLifecycle(page, overlayContract(page, { close: page.getByTestId('ov-close'), restoreFocusTo: page.getByTestId('trigger') }))).failure).toMatchObject({ taxonomy: 'focus-restoration' })
    await page.setContent(overlayPage(false, true))
    expect(await assertOverlayLifecycle(page, overlayContract(page, { close: page.getByTestId('ov-close'), invokerRemoved: true }))).toMatchObject({ status: 'pass', measurements: { invokerRemoved: true } })
  })
  test('distinguishes loading, fetching, empty, no-match, and error state usability', async ({ page }) => {
    expect(SURFACE_STATES).toEqual(expect.arrayContaining(['loading', 'fetching', 'empty', 'no-match', 'error']))
    const contract = (state: 'loading' | 'fetching' | 'empty' | 'no-match' | 'error', text: string, extra: Record<string, unknown> = {}) => ({ state, feedback: page.getByTestId('feedback'), feedbackText: text, ...extra })
    await page.setContent(statePage('Cargando productos…')); expect(await assertSurfaceState(contract('loading', 'Cargando productos…', { usableControls: [{ id: 'page-next', locator: page.getByTestId('page-next') }] }))).toMatchObject({ status: 'pass' })
    await page.setContent(statePage('Actualizando…'))
    expect(await assertSurfaceState(contract('fetching', 'Actualizando…'))).toMatchObject({ status: 'pass' })
    await page.setContent(statePage('Sin resultados para "café xyz"'))
    expect(await assertSurfaceState(contract('no-match', 'Sin resultados para "café xyz"'))).toMatchObject({ status: 'pass' })
    await page.setContent(statePage('Sin productos', '<div data-testid="success-row" style="height:20px">Café SKU-1</div>'))
    expect((await assertSurfaceState(contract('empty', 'Sin productos', { prohibited: [page.getByTestId('success-row')] }))).failure).toMatchObject({ taxonomy: 'state-usability' })
    expect((await assertSurfaceState(contract('loading', 'Éxito'))).failure).toMatchObject({ taxonomy: 'state-usability' })
    await page.setContent(statePage('No se pudo cargar', '<button data-testid="retry" style="box-sizing:border-box;width:44px;height:44px" onclick="window.retried = true">Reintentar</button>'))
    expect(await assertSurfaceState(contract('error', 'No se pudo cargar', { recovery: { locator: page.getByTestId('retry'), name: 'Reintentar', verify: windowFlag('retried') } }))).toMatchObject({ status: 'pass' })
    expect(validateEvidenceRecord({ ...baseRecord, authority: 'browser-interaction', assertionId: 'surface-state', stateId: 'selection-bulk', status: 'excluded', exclusion: { reason: 'DT-01 has empty bulkActions and row selection disabled', followUp: 'Batch B bulk actions' } }).ok).toBe(true)
  })
})
