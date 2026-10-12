import { test, expect } from '@playwright/test'
import { seedAuthSession } from '../fixtures/auth'
import { EXPECTED_BLOCKED_STARTUP_EXTERNALS, installStrictNetwork } from '../fixtures/network'
import { RESPONSIVE_WEB_SERVER_PORT } from '../../../playwright.responsive.config'

const origin = `http://127.0.0.1:${RESPONSIVE_WEB_SERVER_PORT}`
const sessionId = 'offline-cash-session'
const session = {
  id: sessionId,
  tenantId: 'e2e-tenant-0001',
  registerId: 'offline-cash-register',
  cashierUserId: 'e2e-user-0001',
  status: 'COUNTING',
  openingCents: 50000,
  frozenAt: '2026-10-10T15:00:00.000Z',
  drawerReleasedAt: null,
  blind: true,
}

// Supplementary browser proof after the unit-test RED/GREEN cycles. All API
// traffic is mocked and external traffic is blocked; no real cash is touched.
for (const viewport of [
  { width: 1280, height: 900 },
  { width: 375, height: 812 },
]) {
  test(`Caja workspace offline at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await seedAuthSession(page, {
      permissions: [
        'read:CashRegister',
        'read:CashSession',
        'create:CashCount',
        'read:CashHandover',
        'update:CashHandover',
      ],
    })
    const network = await installStrictNetwork(
      page,
      origin,
      [
        {
          method: 'GET',
          path: '/cash-registers',
          json: {
            items: [{ id: session.registerId, name: 'Caja principal', isActive: true }],
          },
        },
        {
          method: 'GET',
          path: '/cash-sessions',
          json: { items: [session], page: 1, limit: 25, total: 1 },
        },
        {
          method: 'GET',
          path: `/cash-sessions/${sessionId}`,
          json: {
            session,
            register: { id: session.registerId, name: 'Caja principal', isActive: true },
            movements: [],
            counts: [],
            handovers: [],
            closing: null,
            requiredChannels: [
              { channelKey: 'CASH', channelLabel: 'Efectivo', method: 'CASH' },
              { channelKey: 'PM:offline-card', channelLabel: 'Tarjeta', method: 'CARD_DEBIT' },
            ],
          },
        },
        {
          method: 'GET',
          path: '/cash-handovers/custody',
          json: { pendingHandovers: [], eligibleFloat: [] },
        },
      ],
      EXPECTED_BLOCKED_STARTUP_EXTERNALS,
    )

    await page.goto(`${origin}/pos/caja`)
    await expect(page.getByTestId('cash-workspace')).toBeVisible()
    await expect(page.getByTestId('cash-workspace-task-conteo')).toHaveCount(0)
    await page.getByTestId('cash-workspace-task-historial').click()
    await page.getByTestId(`cash-session-open-${sessionId}`).click()
    await page.getByTestId('cash-workspace-task-conteo').click()
    await expect(page.getByTestId('cash-count-input-CASH')).toBeVisible()
    await expect(page.getByTestId('cash-count-input-PM:offline-card')).toBeVisible()
    await page.getByTestId('cash-count-input-CASH').fill('350.50')
    await page.getByTestId('cash-workspace-task-historial').click()
    await page.getByTestId('cash-workspace-task-conteo').click()
    await expect(page.getByTestId('cash-count-input-CASH')).toHaveValue('350.50')
    await expect(page.getByTestId('cash-workspace-operation')).not.toContainText('Esperado')
    await expect(page.getByTestId('cash-workspace')).not.toContainText(/Ingresá|Contá|podés|tenés/)

    const geometry = await page.evaluate(() => ({
      width: window.innerWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }))
    expect(geometry.width).toBe(viewport.width)
    expect(geometry.overflow).toBeLessThanOrEqual(1)
    expect(network.requests().every((request) => request.method === 'GET')).toBe(true)
    expect(network.violations()).toEqual([])
    await page.screenshot({ path: testInfo.outputPath('cash-count.png'), fullPage: true })
  })
}
