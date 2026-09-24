/**
 * PCA-5 — promotion alert preferences through the real
 * `/sistema/configuracion/notificaciones`.
 *
 * Plain Playwright checks (no responsive inventory/evidence surface IDs). The
 * data-driven Promociones accordion must expose both promotion alerts with
 * their committed copy while keeping the saved subset intact: enabling
 * `PROMOTION_NEAR_CAPACITY` must not touch `TIME_OFF_REQUESTED` or
 * `DELIVERY_NEXT_STOP`, and every action keeps sharing the tenant recipients.
 */
import type { Page } from '@playwright/test'
import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import { seedAuthSession } from '../fixtures/auth'
import type { DeclaredRoute } from '../fixtures/network'
import { assertBoxesWithinOwner, assertDocumentNoHorizontalOverflow } from '../assertions/geometry'
import { assertKeyboardAction } from '../assertions/accessibility'
import { assertReadableContrast } from '../assertions/readability'
import {
  NOTIFICATION_CONFIG_PERMISSIONS,
  PROMOTION_CAPACITY_OWNER,
  PROMOTION_CAPACITY_VIEWPORTS,
} from '../fixtures/promotion-capacity-alerts'

const VIEW_ROUTE = '/sistema/configuracion/notificaciones'
const CONFIG_PATH = '/notification-config'
const SAVED_TOAST = 'Configuración de notificaciones guardada'

/** Enabled subset on read: LOW_STOCK + PROMOTION_EXPIRING only. */
const CONFIG = {
  enabled: true,
  recipients: ['e2e-user-1'],
  enabledActions: ['LOW_STOCK', 'PROMOTION_EXPIRING'],
}

const ASSIGNABLE_USERS = [{ id: 'e2e-user-1', name: 'Usuario E2E' }]

/** Exact 3-field PUT after keyboard-enabling PROMOTION_NEAR_CAPACITY. */
const PUT_BODY = {
  enabled: true,
  recipientUserIds: ['e2e-user-1'],
  enabledActions: ['LOW_STOCK', 'PROMOTION_EXPIRING', 'PROMOTION_NEAR_CAPACITY'],
}

const CONFIG_AFTER_SAVE = {
  enabled: true,
  recipients: ['e2e-user-1'],
  enabledActions: ['LOW_STOCK', 'PROMOTION_EXPIRING', 'PROMOTION_NEAR_CAPACITY'],
}

const ROUTES: readonly DeclaredRoute[] = [
  // The mutation invalidates the config, so the read may repeat after the PUT.
  { method: 'GET', path: CONFIG_PATH, json: CONFIG },
  { method: 'GET', path: '/users/assignable', json: ASSIGNABLE_USERS },
  { method: 'PUT', path: CONFIG_PATH, body: PUT_BODY, json: CONFIG_AFTER_SAVE, count: 1 },
]

async function openNotifications(page: Page): Promise<void> {
  await page.goto(`${RESPONSIVE_ORIGIN}${VIEW_ROUTE}`)
  await page.getByTestId('actions-accordion').waitFor()
}

for (const viewport of PROMOTION_CAPACITY_VIEWPORTS) {
  test.describe(`${viewport.key} promotion alert preferences`, () => {
    test.use({ declaredRoutes: { routes: ROUTES } })

    test.afterEach(async ({ strictNetwork }) => {
      expect(strictNetwork.violations(), 'strict network must stay clean').toEqual([])
    })

    test('opens the Promociones accordion by keyboard and saves only the near-capacity alert', async ({
      page,
      strictNetwork,
    }) => {
      await page.setViewportSize(viewport)
      await seedAuthSession(page, { permissions: NOTIFICATION_CONFIG_PERMISSIONS })
      await openNotifications(page)

      const owner = page.locator(PROMOTION_CAPACITY_OWNER)
      const promotionsTrigger = page.getByRole('button', { name: /Promociones/ })
      await expect(promotionsTrigger).toHaveAttribute('aria-expanded', 'false')
      const opened = await assertKeyboardAction(promotionsTrigger, {
        key: 'Enter',
        verify: async () => (await promotionsTrigger.getAttribute('aria-expanded')) === 'true',
      })
      expect(opened.status, opened.failure?.message).toBe('pass')

      const expiringRow = page.getByTestId('action-row-promotion-expiring')
      const nearRow = page.getByTestId('action-row-promotion-near-capacity')
      await expect(expiringRow).toBeVisible()
      await expect(nearRow).toBeVisible()

      // Independent initial states straight from the enabled subset.
      await expect(expiringRow).toHaveAttribute('data-checked', 'true')
      await expect(nearRow).toHaveAttribute('data-checked', 'false')

      // Committed copy: 7-day expiry, upward 80% threshold, unlimited exclusion,
      // and an asynchronous email delivery note on both promotion alerts.
      const expiringDescription = expiringRow.getByTestId('action-description')
      const nearDescription = nearRow.getByTestId('action-description')
      await expect(expiringDescription).toContainText('próximos 7 días')
      await expect(expiringDescription).toContainText('entrega es asíncrona')
      await expect(nearDescription).toContainText('menos del 80%')
      await expect(nearDescription).toContainText('alcanzar o superar')
      await expect(nearDescription).toContainText('promociones sin límite no generan esta alerta')
      await expect(nearDescription).toContainText('entrega es asíncrona')

      // Both alerts keep sharing the single tenant recipient list.
      await expect(page.getByTestId('recipient-chips')).toContainText('Usuario E2E')

      const nearSwitch = nearRow.getByRole('switch')
      await expect(nearSwitch).toHaveAttribute('aria-checked', 'false')
      const enabled = await assertKeyboardAction(nearSwitch, {
        key: 'Enter',
        verify: async () => (await nearRow.getAttribute('data-checked')) === 'true',
      })
      expect(enabled.status, enabled.failure?.message).toBe('pass')
      await expect(expiringRow).toHaveAttribute('data-checked', 'true')

      const overflow = await assertDocumentNoHorizontalOverflow(page)
      expect(overflow.status, overflow.failure?.message).toBe('pass')
      const containment = await assertBoxesWithinOwner(owner, { expiringRow, nearRow })
      expect(containment.status, containment.failure?.message).toBe('pass')

      await assertReadableContrast(page.locator('#action-label-promotion-near-capacity'), 'light', {
        label: 'near-capacity alert label',
      })
      await assertReadableContrast(page.locator('#action-label-promotion-near-capacity'), 'dark', {
        label: 'near-capacity alert label',
      })

      await page.getByTestId('save-button').click()
      await expect(page.getByText(SAVED_TOAST, { exact: true })).toBeVisible()

      const puts = strictNetwork.requests().filter((request) => request.method === 'PUT')
      expect(puts).toHaveLength(1)
      expect(puts[0]?.body).toEqual(PUT_BODY)
      const enabledActions = (puts[0]?.body as { enabledActions: string[] }).enabledActions
      expect(enabledActions).toEqual(['LOW_STOCK', 'PROMOTION_EXPIRING', 'PROMOTION_NEAR_CAPACITY'])
      expect(enabledActions).not.toContain('TIME_OFF_REQUESTED')
      expect(enabledActions).not.toContain('DELIVERY_NEXT_STOP')
      expect(puts[0]?.body).toMatchObject({ recipientUserIds: ['e2e-user-1'] })

      expect(strictNetwork.violations()).toEqual([])
    })
  })
}
