/**
 * PCA-5 — full sale cancellation through the real `/pos/ventas/:id`.
 *
 * Plain Playwright checks (no responsive inventory/evidence surface IDs). The
 * CONFIRMED sale renders a mobile-safe header action dropdown; activating
 * `Cancelar venta` opens the destructive confirmation, and confirming by
 * keyboard POSTs the exact `CUSTOMER_REQUEST` body and surfaces the
 * authoritative refund plus the summed restocked quantities.
 */
import type { Page } from '@playwright/test'
import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import { seedAuthSession } from '../fixtures/auth'
import type { DeclaredRoute } from '../fixtures/network'
import { assertBoxesWithinOwner, assertDocumentNoHorizontalOverflow } from '../assertions/geometry'
import { assertKeyboardAction } from '../assertions/accessibility'
import { assertReadableContrast } from '../assertions/readability'
import {
  PROMOTION_CAPACITY_OWNER,
  PROMOTION_CAPACITY_VIEWPORTS,
  SALE_CANCEL_PERMISSIONS,
  formatCents,
} from '../fixtures/promotion-capacity-alerts'

const SALE_ID = 'sale-1'
const SALE_ROUTE = `/pos/ventas/${SALE_ID}`
const SALE_API_PATH = `/sales/${SALE_ID}`
const CANCEL_PATH = `${SALE_API_PATH}/cancel`
const CANCEL_REASON = 'CUSTOMER_REQUEST'
const CONFIRM_COPY =
  'Esta acción cancela la venta completa: se restauran el stock de los productos y el cupo consumido de las promociones. No es un reembolso parcial y no se puede deshacer.'

/** Minimally complete CONFIRMED sale: identity, totals, and an empty body. */
const SALE_DETAIL = {
  id: SALE_ID,
  folio: 'A-202605-000012',
  status: 'CONFIRMED',
  channel: 'POS',
  register: 'Principal',
  confirmedAt: '2026-05-06T14:43:00.000Z',
  dueDate: null,
  subtotalCents: 127000,
  discountCents: 0,
  totalCents: 127000,
  paidCents: 127000,
  debtCents: 0,
  changeDueCents: 0,
  paymentStatus: 'PAID',
  deliveryStatus: 'DELIVERED',
  customer: null,
  cashier: { id: 'e2e-user-0001', name: 'Cajero E2E' },
  seller: null,
  items: [],
  payments: [],
  timeline: [],
  globalPriceListId: null,
}

const CANCEL_RESPONSE = {
  saleId: SALE_ID,
  status: 'CANCELED',
  refundedCents: 127000,
  restockedItems: [
    { productId: 'p-1', variantId: null, quantity: 2 },
    { productId: 'p-2', variantId: 'v-1', quantity: 1 },
  ],
  canceledAt: '2026-05-06T15:00:00.000Z',
}

/** Authoritative refund + the SUM of restocked line quantities (3, not 2 rows). */
const RESTORED_UNITS = 3
const TOAST_TITLE = 'Venta cancelada'
const TOAST_DESCRIPTION = `${formatCents(CANCEL_RESPONSE.refundedCents)} reembolsados · ${RESTORED_UNITS} unidades restauradas`

const ROUTES: readonly DeclaredRoute[] = [
  // The detail is re-read after the successful cancellation invalidation.
  { method: 'GET', path: SALE_API_PATH, json: SALE_DETAIL },
  { method: 'GET', path: '/sales/payment-methods', json: [] },
  { method: 'GET', path: '/price-lists', json: [] },
  {
    method: 'POST',
    path: CANCEL_PATH,
    body: { reason: CANCEL_REASON },
    json: CANCEL_RESPONSE,
    count: 1,
  },
]

async function openSaleDetail(page: Page): Promise<void> {
  await page.goto(`${RESPONSIVE_ORIGIN}${SALE_ROUTE}`)
  await page.getByTestId('sale-detail-header').waitFor()
}

for (const viewport of PROMOTION_CAPACITY_VIEWPORTS) {
  test.describe(`${viewport.key} full sale cancellation`, () => {
    test.use({ declaredRoutes: { routes: ROUTES } })

    test.afterEach(async ({ strictNetwork }) => {
      expect(strictNetwork.violations(), 'strict network must stay clean').toEqual([])
    })

    test('confirms a full-sale cancellation by keyboard and reports the authoritative restoration', async ({
      page,
      strictNetwork,
    }) => {
      await page.setViewportSize(viewport)
      await seedAuthSession(page, { permissions: SALE_CANCEL_PERMISSIONS })
      await openSaleDetail(page)

      const owner = page.locator(PROMOTION_CAPACITY_OWNER)
      const trigger = page.getByRole('button', { name: 'Acciones de venta' })
      await expect(trigger).toBeVisible()

      // Mobile-safe geometry: the trigger stays inside its owner and the viewport.
      const geometry = await assertBoxesWithinOwner(owner, { trigger })
      expect(geometry.status, geometry.failure?.message).toBe('pass')
      const triggerBox = await trigger.boundingBox()
      const viewportSize = page.viewportSize()
      expect(viewportSize).not.toBeNull()
      const viewportWidth = viewportSize?.width ?? viewport.width
      expect(triggerBox?.width ?? 0).toBeGreaterThan(0)
      expect((triggerBox?.x ?? 0) + (triggerBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth + 1)

      const overflow = await assertDocumentNoHorizontalOverflow(page)
      expect(overflow.status, overflow.failure?.message).toBe('pass')

      await assertReadableContrast(page.getByTestId('header-folio'), 'light', {
        label: 'sale folio',
      })
      await assertReadableContrast(page.getByTestId('header-folio'), 'dark', {
        label: 'sale folio',
      })

      await trigger.click()
      const cancelItem = page.getByRole('menuitem', { name: 'Cancelar venta' })
      await expect(cancelItem).toBeVisible()
      await cancelItem.click()

      // Full-sale / restoration / no-partial confirmation copy.
      const description = page.getByTestId('confirm-description')
      await expect(description).toHaveText(CONFIRM_COPY)
      await expect(description).toContainText('cancela la venta completa')
      await expect(description).toContainText('se restauran el stock')
      await expect(description).toContainText('cupo consumido')
      await expect(description).toContainText('No es un reembolso parcial')

      const dialogBox = await page.getByRole('dialog').boundingBox()
      expect(dialogBox?.x ?? -1).toBeGreaterThanOrEqual(-1)
      expect((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0)).toBeLessThanOrEqual(viewportWidth + 1)

      const confirm = page.getByRole('button', { name: 'Cancelar venta', exact: true })
      const keyboard = await assertKeyboardAction(confirm, {
        key: 'Enter',
        verify: async () => !(await description.isVisible()),
      })
      expect(keyboard.status, keyboard.failure?.message).toBe('pass')

      await expect(page.getByText(TOAST_TITLE, { exact: true })).toBeVisible()
      await expect(page.getByText(TOAST_DESCRIPTION, { exact: true })).toBeVisible()

      const posts = strictNetwork
        .requests()
        .filter((request) => request.method === 'POST' && request.path === CANCEL_PATH)
      expect(posts).toHaveLength(1)
      expect(posts[0]?.body).toEqual({ reason: CANCEL_REASON })

      expect(strictNetwork.violations()).toEqual([])
    })
  })
}
