/**
 * P1 responsive evidence for the discreet public catalog branch selector.
 *
 * Strict `/__e2e-api/**` declarations prove that `/catalogo` and a direct branch URL issue exactly one
 * anonymous branch read, that the closed shell exposes no branch choice and no dialog, that the
 * `Explorar sucursales` trigger opens one labelled dialog whose branch choices, current branch state
 * and polite live region are reachable, that the dialog fits 320/375/1280 without horizontal overflow,
 * and that both Escape and an outside pointer press close it while focus returns to its trigger.
 * Every step drives the real browser surface through accessible locators.
 */
import type { Locator, Page } from '@playwright/test'
import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import type { DeclaredRoute } from '../fixtures/network'

const OVERFLOW_TOLERANCE_PX = 1
/** WCAG 2.2 target size (minimum): every selector control must measure at least this square. */
const MIN_TARGET_PX = 44
const longNameBranch = {
  id: 'b-1',
  name: 'Sucursal con un nombre excepcionalmente largo para validar el ajuste responsivo',
  slug: 'centro',
  address: null,
  phone: null,
}
const addressedBranch = {
  id: 'b-2',
  name: 'Sucursal Norte',
  slug: 'norte',
  address: 'Av. Juárez 120, Centro',
  phone: null,
}
const viewports = [
  { name: 'compact', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 667 },
  { name: 'desktop', width: 1280, height: 800 },
] as const

const emptyProductPage = {
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  facets: { categories: [] },
  excludedCount: 0,
  priceContext: { priceListId: 'list-1', name: 'Lista pública', isCatalogDefault: true },
}
const routes: readonly DeclaredRoute[] = [
  {
    method: 'GET',
    path: '/public/catalog/branches',
    json: [longNameBranch, addressedBranch],
    count: 1,
  },
  { method: 'GET', path: '/public/catalog/centro/products', json: emptyProductPage, count: 1 },
]

const branchesRequest = {
  method: 'GET',
  path: '/public/catalog/branches',
  query: {},
  body: undefined,
}
const productsRequest = {
  method: 'GET',
  path: '/public/catalog/centro/products',
  query: {},
  body: undefined,
}

const CONTROL_ROLES = [
  'button',
  'link',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'combobox',
  'listbox',
  'spinbutton',
  'slider',
  'switch',
  'tab',
  'menuitem',
] as const

const branchTrigger = (page: Page): Locator =>
  page.getByRole('button', { name: 'Explorar sucursales', exact: true })

const branchDialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'Seleccionar sucursal', exact: true })

const branchChoice = (page: Page, name: string): Locator =>
  branchDialog(page).getByRole('button', { name, exact: true })

/** Every enabled control on the page, keyed by accessible role and name. */
async function enabledControls(page: Page): Promise<string[]> {
  const controls: string[] = []
  for (const role of CONTROL_ROLES) {
    const names = await page
      .getByRole(role)
      .evaluateAll((elements) =>
        elements
          .filter(
            (element) =>
              !element.matches(':disabled') && element.getAttribute('aria-disabled') !== 'true',
          )
          .map(
            (element) => element.getAttribute('aria-label') ?? (element.textContent ?? '').trim(),
          ),
      )
    for (const name of names) controls.push(`${role} ${name}`)
  }
  return controls.sort()
}

async function measurableBox(locator: Locator, label: string) {
  const box = await locator.boundingBox()
  if (box === null) throw new Error(`${label} rendered without a measurable box`)
  return box
}

/** Measures the rendered box and requires a real 44x44 pointer target, never a class name. */
async function expectTargetSize(locator: Locator, label: string) {
  const box = await measurableBox(locator, label)
  expect(box.width, `${label} must be at least ${MIN_TARGET_PX}px wide`).toBeGreaterThanOrEqual(
    MIN_TARGET_PX,
  )
  expect(box.height, `${label} must be at least ${MIN_TARGET_PX}px tall`).toBeGreaterThanOrEqual(
    MIN_TARGET_PX,
  )
  return box
}

/**
 * The modal content enters through a 200ms `scale-in`, so raw boxes shrink mid-animation and would
 * misreport the settled target size. Waiting for every finite animation keeps the measurement honest;
 * infinite decorative loops (`animate-pulse`, `animate-spin`) are excluded instead of blocking.
 */
async function settleAnimations(page: Page): Promise<void> {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => Number.isFinite(animation.effect?.getTiming().iterations))
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
}

function expectInsideViewport(
  box: { x: number; y: number; width: number; height: number },
  viewport: (typeof viewports)[number],
  label: string,
): void {
  expect(box.x, `${label} must not start left of the viewport`).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width, `${label} must fit the viewport width`).toBeLessThanOrEqual(
    viewport.width + OVERFLOW_TOLERANCE_PX,
  )
  expect(box.y, `${label} must not start above the viewport`).toBeGreaterThanOrEqual(0)
  expect(box.y + box.height, `${label} must fit the viewport height`).toBeLessThanOrEqual(
    viewport.height + OVERFLOW_TOLERANCE_PX,
  )
}

const shellControls = ['button Cambiar tema', 'button Explorar sucursales']
const dialogControls = [
  'button Cerrar selección de sucursal',
  `button ${longNameBranch.name}`,
  `button ${addressedBranch.name}`,
]

for (const viewport of viewports) {
  test.describe(`public catalog branch selector at ${viewport.name}`, () => {
    test.use({ declaredRoutes: { routes } })

    test('keeps discovery behind the closed trigger and reveals one labelled dialog with every branch choice', async ({
      page,
      strictNetwork,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      await page.goto(`${RESPONSIVE_ORIGIN}/catalogo`)

      const trigger = branchTrigger(page)
      await expect(trigger).toBeVisible()
      // The closed selector entry point is the only way into discovery, so it owns the 44px target.
      await expectTargetSize(trigger, `the branch selector trigger at ${viewport.name}`)
      await expect(trigger).toHaveAttribute('aria-haspopup', 'dialog')
      await expect(trigger).toHaveAttribute('aria-expanded', 'false')
      await expect(trigger).toContainText('Elegir sucursal')

      // The closed shell carries no dialog, no branch choice and no branch copy.
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(branchChoice(page, longNameBranch.name)).toHaveCount(0)
      await expect(page.getByText('Sucursales disponibles')).toHaveCount(0)
      expect(await enabledControls(page)).toEqual(shellControls)
      for (const [role, name] of [
        ['textbox', 'Buscar en el catálogo'],
        ['button', 'Todas las categorías'],
        ['button', 'Ordenar catálogo'],
        ['button', 'Ver carrito'],
      ] as const)
        await expect(page.getByRole(role, { name })).toBeDisabled()

      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
      expect(
        await page
          .locator('header, main, footer')
          .evaluateAll((elements) => elements.map((element) => element.tagName)),
      ).toEqual(['HEADER', 'MAIN', 'FOOTER'])
      await testInfo.attach(`${viewport.name}-catalog-discovery-closed`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      })

      await trigger.click()

      const dialog = branchDialog(page)
      await expect(dialog).toBeVisible()
      await settleAnimations(page)
      // An open modal marks the background shell `aria-hidden`, so the trigger stays assertable
      // only through an explicit hidden-inclusive role query while the dialog is open.
      await expect(
        page.getByRole('button', { name: 'Explorar sucursales', exact: true, includeHidden: true }),
      ).toHaveAttribute('aria-expanded', 'true')
      expect(
        await dialog.evaluate((element) => element.contains(document.activeElement)),
        'focus must enter the opened branch dialog',
      ).toBe(true)

      await expectTargetSize(
        dialog.getByRole('button', { name: 'Cerrar selección de sucursal', exact: true }),
        'the branch selector close control',
      )

      const selected = branchChoice(page, longNameBranch.name)
      await expect(selected).toBeEnabled()
      await expectTargetSize(selected, 'the long-name branch choice')
      await expect(selected).not.toHaveAttribute('aria-current')
      await expect(dialog.getByText('Dirección no publicada')).toBeVisible()
      await expect(branchChoice(page, addressedBranch.name)).toContainText(addressedBranch.address)
      await expectTargetSize(
        branchChoice(page, addressedBranch.name),
        'the addressed branch choice',
      )
      await expect(dialog.locator('[aria-live="polite"]')).toHaveCount(1)

      // While the selector is open the shell is `aria-hidden`, so the dialog's own close control
      // and branch choices are the only controls exposed to assistive technology.
      expect(await enabledControls(page)).toEqual([...dialogControls].sort())
      expectInsideViewport(
        await measurableBox(dialog, 'the branch selector dialog'),
        viewport,
        'the branch selector dialog',
      )
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
      await testInfo.attach(`${viewport.name}-catalog-discovery-open`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })

      // Escape closes the dialog and hands focus back to its trigger.
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(trigger).toBeFocused()

      // An outside pointer press closes it the same way.
      await trigger.click()
      await expect(dialog).toBeVisible()
      await page.mouse.click(2, viewport.height - 2)
      await expect(dialog).toBeHidden()
      await expect(trigger).toBeFocused()

      expect(strictNetwork.requests()).toEqual([branchesRequest])
      expect(strictNetwork.violations()).toEqual([])
    })

    test('marks the routed branch as current inside the selector without a permanent hero', async ({
      page,
      strictNetwork,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      await page.goto(`${RESPONSIVE_ORIGIN}/catalogo/centro`)

      const trigger = branchTrigger(page)
      await expect(trigger).toContainText(longNameBranch.name)
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(
        page.getByRole('heading', { name: 'Esta sucursal todavía no tiene productos publicados' }),
      ).toBeVisible()

      await trigger.click()

      const dialog = branchDialog(page)
      await settleAnimations(page)
      await expect(branchChoice(page, longNameBranch.name)).toHaveAttribute('aria-current', 'page')
      await expect(branchChoice(page, addressedBranch.name)).not.toHaveAttribute('aria-current')
      expectInsideViewport(
        await measurableBox(dialog, 'the branch selector dialog'),
        viewport,
        'the branch selector dialog',
      )
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
      await testInfo.attach(`${viewport.name}-catalog-discovery-current`, {
        body: await page.screenshot(),
        contentType: 'image/png',
      })

      expect(strictNetwork.requests()).toEqual([branchesRequest, productsRequest])
      expect(strictNetwork.violations()).toEqual([])
    })
  })
}

test.describe('public catalog branch selector recovery', () => {
  test.use({
    declaredRoutes: {
      routes: [
        {
          method: 'GET',
          path: '/public/catalog/branches',
          status: 500,
          json: { message: 'branch discovery failed (e2e)' },
          count: 2,
        },
      ],
    },
  })

  test('keeps the retry reachable inside the open dialog and reissues only the anonymous branch read', async ({
    page,
    strictNetwork,
  }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${RESPONSIVE_ORIGIN}/catalogo`)

    await branchTrigger(page).click()

    const dialog = branchDialog(page)
    await expect(dialog.getByText('No pudimos cargar las sucursales.')).toBeVisible()
    await settleAnimations(page)

    const retry = dialog.getByRole('button', { name: 'Reintentar sucursales', exact: true })
    await expect(retry).toBeVisible()
    await expect(retry).toBeEnabled()
    await retry.focus()
    await expect(retry).toBeFocused()
    expectInsideViewport(
      await expectTargetSize(retry, 'the branch selector retry control'),
      { name: 'mobile', width: 375, height: 667 },
      'the branch selector retry control',
    )
    // The open dialog hides the shell, so the retry dialog owns every reachable control.
    expect(await enabledControls(page)).toEqual(
      ['button Cerrar selección de sucursal', 'button Reintentar sucursales'].sort(),
    )
    await testInfo.attach('mobile-catalog-discovery-server-error', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })

    await retry.click()
    await expect
      .poll(() => strictNetwork.requests().length, { message: 'the retry must reissue the read' })
      .toBe(2)
    await expect(dialog.getByText('No pudimos cargar las sucursales.')).toBeVisible()

    expect(strictNetwork.requests()).toEqual([branchesRequest, branchesRequest])
    expect(strictNetwork.violations()).toEqual([])
  })
})
