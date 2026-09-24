/**
 * PCA-5 — focused responsive coverage for the promotion-capacity create UI.
 *
 * Plain Playwright checks (no responsive inventory/evidence surface IDs): the
 * real `/pos/promociones/crear/ORDER_DISCOUNT` route is exercised at the three
 * required matrix widths. The capacity tri-state control must start
 * unlimited/OFF, stay keyboard-operable, reveal the numeric limit only when it
 * is enabled, expose accessible names plus a real target, and never fabricate
 * the server-owned consumed/remaining counters (they only exist in edit mode).
 */
import type { Page } from '@playwright/test'
import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import { seedAuthSession } from '../fixtures/auth'
import type { DeclaredRoute } from '../fixtures/network'
import { assertBoxesWithinOwner, assertDocumentNoHorizontalOverflow } from '../assertions/geometry'
import {
  assertKeyboardActivation,
  assertMinimumTargets,
  assertNamedControls,
} from '../assertions/accessibility'
import { assertReadableContrast } from '../assertions/readability'
import {
  PROMOTION_CAPACITY_OWNER,
  PROMOTION_CAPACITY_VIEWPORTS,
  PROMOTION_CREATE_PERMISSIONS,
} from '../fixtures/promotion-capacity-alerts'

const CREATE_ROUTE = '/pos/promociones/crear/ORDER_DISCOUNT'
const SWITCH_NAME = 'Limitar la cantidad de unidades de la promoción'
const INPUT_NAME = 'Límite de unidades'
const LABEL_TEXT = 'Limitar la cantidad de unidades'
/** Project touch-target floor: the numeric field must measure at least 44px on both axes. */
const MIN_TARGET_PX = 44
/** The create view issues no API call; any request would be an undeclared route. */
const ROUTES: readonly DeclaredRoute[] = []

async function openCreatePage(page: Page): Promise<void> {
  await page.goto(`${RESPONSIVE_ORIGIN}${CREATE_ROUTE}`)
  await page.getByTestId('capacity-switch').waitFor()
}

for (const viewport of PROMOTION_CAPACITY_VIEWPORTS) {
  test.describe(`${viewport.key} promotion capacity create`, () => {
    test.use({ declaredRoutes: { routes: ROUTES } })

    test.afterEach(async ({ strictNetwork }) => {
      expect(strictNetwork.violations(), 'strict network must stay clean').toEqual([])
    })

    test('starts unlimited, toggles by keyboard, and never fabricates counters', async ({
      page,
      strictNetwork,
    }) => {
      await page.setViewportSize(viewport)
      await seedAuthSession(page, { permissions: PROMOTION_CREATE_PERMISSIONS })
      await openCreatePage(page)

      const owner = page.locator(PROMOTION_CAPACITY_OWNER)
      const capacitySwitch = page.getByTestId('capacity-switch')
      const input = page.getByTestId('capacity-input')

      // Unlimited/OFF by default and the numeric limit does not exist yet.
      await expect(page.getByRole('switch', { name: SWITCH_NAME })).toHaveAttribute(
        'data-state',
        'unchecked',
      )
      await expect(input).toHaveCount(0)

      // Create mode is not edit mode: no server-owned counters may be fabricated.
      await expect(page.getByTestId('promotion-capacity-status')).toHaveCount(0)
      await expect(page.getByTestId('capacity-consumed-context')).toHaveCount(0)
      await expect(page.getByText(/Consumidas|Restantes|Consumo actual/)).toHaveCount(0)

      // Accessible name and a real target for the tri-state control.
      const semantics = await assertNamedControls([
        { id: 'capacity-switch', locator: capacitySwitch, role: 'switch', name: SWITCH_NAME },
      ])
      expect(semantics.status, semantics.failure?.message).toBe('pass')

      const switchRow = page.locator('div.min-h-11').filter({ has: capacitySwitch })
      const target = await assertMinimumTargets([
        { id: 'capacity-switch', locator: capacitySwitch, hitArea: switchRow },
      ])
      expect(target.status, target.failure?.message).toBe('pass')

      // Keyboard activation reveals the numeric input.
      const activation = await assertKeyboardActivation(capacitySwitch, {
        key: 'Enter',
        verify: async () => (await input.count()) === 1,
      })
      expect(activation.status, activation.failure?.message).toBe('pass')

      await expect(page.getByRole('switch', { name: SWITCH_NAME })).toHaveAttribute(
        'data-state',
        'checked',
      )
      await expect(input).toBeVisible()
      await expect(input).toHaveAccessibleName(INPUT_NAME)

      // Type the limit with the keyboard and prove the value round-trips.
      await input.focus()
      await page.keyboard.type('250')
      await expect(input).toHaveValue('250')

      // Enabling the cap still fabricates nothing: no derived consumed/remaining.
      await expect(page.getByTestId('promotion-capacity-status')).toHaveCount(0)
      await expect(page.getByTestId('capacity-consumed-context')).toHaveCount(0)
      await expect(page.getByTestId('capacity-limit-error')).toHaveCount(0)

      const inputBox = await input.boundingBox()
      expect(inputBox?.width ?? 0).toBeGreaterThanOrEqual(MIN_TARGET_PX)
      expect(inputBox?.height ?? 0).toBeGreaterThanOrEqual(MIN_TARGET_PX)

      const overflow = await assertDocumentNoHorizontalOverflow(page)
      expect(overflow.status, overflow.failure?.message).toBe('pass')
      const containment = await assertBoxesWithinOwner(owner, {
        surface: capacitySwitch,
        input,
      })
      expect(containment.status, containment.failure?.message).toBe('pass')

      const label = page.getByText(LABEL_TEXT, { exact: true })
      await assertReadableContrast(label, 'light', { label: 'capacity switch label' })
      await assertReadableContrast(label, 'dark', { label: 'capacity switch label' })

      expect(strictNetwork.violations()).toEqual([])
    })
  })
}
