/**
 * PCA-5 — capacity-safe charge re-quote through the real `/pos/ventas/nueva`.
 *
 * Plain Playwright checks (no responsive inventory/evidence surface IDs). The
 * charge returns a flat `PROMO_CAPACITY_RE_QUOTE` 409; the draft is re-read and
 * the dedicated re-quote modal shows the authoritative server totals. Accepting
 * it only mints a fresh idempotency key — it never charges — so the POST count
 * must stay exactly one and the payment modal must stay open.
 */
import type { Page } from '@playwright/test'
import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import { seedAuthSession } from '../fixtures/auth'
import type { DeclaredRoute } from '../fixtures/network'
import { assertDocumentNoHorizontalOverflow } from '../assertions/geometry'
import { assertKeyboardAction } from '../assertions/accessibility'
import { assertReadableContrast } from '../assertions/readability'
import {
  PROMOTION_CAPACITY_VIEWPORTS,
  SALE_CHARGE_PERMISSIONS,
  formatCents,
} from '../fixtures/promotion-capacity-alerts'

const VIEW_ROUTE = '/pos/ventas/nueva'
const DRAFT_ID = 'draft-1'
const PRODUCT_ID = 'prod-1'
const PROMOTION_ID = 'promo-1'
const EXCLUDED_LABEL = 'Cupo agotado E2E'
const CHARGE_PATH = `/sales/drafts/${DRAFT_ID}/charge`

/** One draft, one item, one customer: PaymentModal can submit with no payment entry. */
const DRAFT = {
  id: DRAFT_ID,
  userId: 'e2e-user-0001',
  status: 'DRAFT',
  createdAt: '2026-05-06T14:00:00.000Z',
  updatedAt: '2026-05-06T14:00:00.000Z',
  customer: { id: 'cust-1', firstName: 'Cliente', lastName: 'E2E' },
  items: [
    {
      id: 'item-1',
      productId: PRODUCT_ID,
      variantId: null,
      productName: 'Producto E2E',
      variantName: null,
      quantity: 2,
      unitPriceCents: 12500,
      unitPriceCurrency: 'MXN',
      subtotalCents: 25000,
    },
  ],
  subtotalCents: 25000,
  discountCents: 5000,
  totalCents: 20000,
  appliedOrderPromotion: null,
  globalPriceListId: null,
}

const POS_CATALOG = { items: [], total: 0, limit: 36, offset: 0 }

const PRODUCT_DETAIL = {
  id: PRODUCT_ID,
  name: 'Producto E2E',
  description: null,
  sku: null,
  barcode: null,
  unit: null,
  hasVariants: false,
  useStock: false,
  enabledForPos: true,
  category: null,
  brand: null,
  mainImage: null,
  images: [],
  price: null,
  stock: null,
  variants: [],
}

const APPLICABLE_PROMOTIONS = {
  saleId: DRAFT_ID,
  promotions: [
    {
      id: PROMOTION_ID,
      title: EXCLUDED_LABEL,
      type: 'ORDER_DISCOUNT',
      method: 'MANUAL',
    },
  ],
}

/** Flat backend capacity envelope — the charge did NOT happen. */
const RE_QUOTE_ENVELOPE = {
  statusCode: 409,
  error: 'PROMO_CAPACITY_RE_QUOTE',
  message: 'La capacidad de una promoción cambió (e2e)',
  timestamp: '2026-05-06T14:43:00.000Z',
  appliedPromotionIds: [PROMOTION_ID],
  excludedPromotionIds: [PROMOTION_ID],
}

const ROUTES: readonly DeclaredRoute[] = [
  // Initial load and the post-409 refetch both read the same draft list.
  { method: 'GET', path: '/sales/drafts', json: [DRAFT] },
  // Both startup catalog queries share the path; the strict matcher ignores the query.
  { method: 'GET', path: '/sales/pos-catalog', json: POS_CATALOG },
  { method: 'GET', path: `/sales/pos-catalog/${PRODUCT_ID}`, json: PRODUCT_DETAIL },
  {
    method: 'GET',
    path: `/sales/drafts/${DRAFT_ID}/applicable-promotions`,
    json: APPLICABLE_PROMOTIONS,
  },
  { method: 'GET', path: '/sales/payment-methods', json: [] },
  { method: 'GET', path: '/price-lists', json: [] },
  // The modal submits one empty-payment charge (customer-backed debt), once.
  {
    method: 'POST',
    path: CHARGE_PATH,
    body: { payments: [] },
    status: 409,
    json: RE_QUOTE_ENVELOPE,
    count: 1,
  },
]

async function openCharge(page: Page, viewportWidth: number): Promise<void> {
  await page.goto(`${RESPONSIVE_ORIGIN}${VIEW_ROUTE}`)
  if (viewportWidth < 1024) {
    // Mobile hides the cart panel; open the real cart drawer first. Keyboard
    // activation avoids the dev-only Vue DevTools overlay that paints above the
    // fixed cart CTA (pointer clicks are intercepted there).
    const cartFab = page.getByTestId('mobile-cart-fab')
    await cartFab.waitFor()
    await cartFab.focus()
    await page.keyboard.press('Enter')
    const drawer = page.getByTestId('mobile-cart-drawer')
    const drawerCharge = drawer.getByRole('button', { name: 'Cobrar' })
    await drawerCharge.waitFor()
    await drawerCharge.focus()
    await page.keyboard.press('Enter')
  } else {
    const panelCharge = page.getByRole('button', { name: 'Cobrar' })
    await panelCharge.waitFor()
    await panelCharge.click()
  }
  await page.getByTestId('confirm-charge').waitFor()
}

for (const viewport of PROMOTION_CAPACITY_VIEWPORTS) {
  test.describe(`${viewport.key} capacity-safe charge re-quote`, () => {
    test.use({ declaredRoutes: { routes: ROUTES } })

    test.afterEach(async ({ strictNetwork }) => {
      expect(strictNetwork.violations(), 'strict network must stay clean').toEqual([])
    })

    test('shows the authoritative re-quote and accepts by keyboard without charging', async ({
      page,
      strictNetwork,
    }) => {
      await page.setViewportSize(viewport)
      await seedAuthSession(page, { permissions: SALE_CHARGE_PERMISSIONS })
      await openCharge(page, viewport.width)

      const confirmCharge = page.getByTestId('confirm-charge')
      await expect(confirmCharge).toBeVisible()
      await confirmCharge.click()

      const requote = page.getByTestId('requote-modal')
      await expect(requote).toBeVisible()

      // Authoritative server totals, never a client recomputation.
      await expect(page.getByTestId('requote-subtotal')).toHaveText(
        formatCents(DRAFT.subtotalCents),
      )
      await expect(page.getByTestId('requote-discount')).toHaveText(
        formatCents(DRAFT.discountCents),
      )
      await expect(page.getByTestId('requote-total')).toHaveText(formatCents(DRAFT.totalCents))

      // The excluded promotion is named from the pre-refetch promotion snapshot.
      await expect(page.getByTestId('requote-excluded-label')).toHaveText(EXCLUDED_LABEL)
      await expect(page.getByTestId('requote-excluded-status')).toHaveText('Ya no aplicable')

      // Non-dismissible: no close control, Escape and backdrop clicks are inert.
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('button', { name: /cerrar|close/i })).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(requote).toBeVisible()
      await expect(confirmCharge).toBeVisible()
      await page.mouse.click(4, 4)
      await expect(requote).toBeVisible()

      const overflow = await assertDocumentNoHorizontalOverflow(page)
      expect(overflow.status, overflow.failure?.message).toBe('pass')

      await assertReadableContrast(page.getByTestId('requote-total'), 'light', {
        label: 're-quote total',
      })
      await assertReadableContrast(page.getByTestId('requote-total'), 'dark', {
        label: 're-quote total',
      })

      // Acceptance only mints a fresh key — it never charges.
      const accept = page.getByTestId('requote-accept')
      const keyboard = await assertKeyboardAction(accept, {
        key: 'Enter',
        verify: async () => !(await requote.isVisible()),
      })
      expect(keyboard.status, keyboard.failure?.message).toBe('pass')

      await expect(requote).toBeHidden()
      await expect(confirmCharge).toBeVisible()
      const chargePosts = strictNetwork
        .requests()
        .filter((request) => request.method === 'POST' && request.path === CHARGE_PATH)
      expect(chargePosts).toHaveLength(1)
      expect(chargePosts[0]?.body).toEqual({ payments: [] })

      expect(strictNetwork.violations()).toEqual([])
    })
  })
}
