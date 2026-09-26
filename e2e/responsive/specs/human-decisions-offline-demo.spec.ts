import { assertMinimumTargets } from '../assertions/accessibility'
import { assertDocumentNoHorizontalOverflow } from '../assertions/geometry'
import { seedAuthSession } from '../fixtures/auth'
import { expect, RESPONSIVE_ORIGIN, test } from '../fixtures/test'

const VIEWPORTS = [
  { label: 'desktop-1024', width: 1024, height: 768 },
  { label: 'phone-375', width: 375, height: 812 },
  { label: 'phone-320', width: 320, height: 720 },
] as const

test('RESTOCK offline demo denies update-only access', async ({ page, strictNetwork }) => {
  await seedAuthSession(page, { permissions: ['update:HumanDecision'] })
  await page.goto(`${RESPONSIVE_ORIGIN}/pos/decisiones-pendientes`)

  await expect(page).toHaveURL(`${RESPONSIVE_ORIGIN}/403`)
  await expect(page.getByTestId('offline-demo-label')).toHaveCount(0)
  expect(strictNetwork.requests()).toEqual([])
  expect(strictNetwork.violations()).toEqual([])
})

test('RESTOCK offline demo is read-only without update permission', async ({
  page,
  strictNetwork,
}) => {
  await seedAuthSession(page, { permissions: ['read:HumanDecision'] })
  await page.goto(`${RESPONSIVE_ORIGIN}/pos/decisiones-pendientes`)
  await page.getByRole('button', { name: 'Abrir detalle: Solicitud de reposición' }).click()

  await expect(page.getByTestId('human-decision-detail')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sin fecha estimada por ahora' })).toHaveCount(0)
  expect(strictNetwork.requests()).toEqual([])
  expect(strictNetwork.violations()).toEqual([])
})

for (const viewport of VIEWPORTS) {
  test(`RESTOCK offline demo [${viewport.label}]`, async ({ page, strictNetwork }, testInfo) => {
    await page.setViewportSize(viewport)
    await seedAuthSession(page, {
      permissions: ['read:HumanDecision', 'update:HumanDecision'],
    })
    await page.goto(`${RESPONSIVE_ORIGIN}/pos/decisiones-pendientes`)

    await expect(page.getByTestId('offline-demo-label')).toHaveText(
      'SIMULACIÓN · datos sintéticos · sin HTTP',
    )
    await expect(page.getByText('Alimento seco 15 kg')).toBeVisible()
    await expect(page.getByText('ALIM-15KG-DEMO')).toBeVisible()
    await expect(page.getByText('No contiene una conversación del cliente')).toBeVisible()
    const statusFilter = page.getByRole('combobox', { name: 'Estado' })
    await expect(statusFilter).toHaveText('Todas')
    await statusFilter.click()
    await page.getByRole('option', { name: 'Respondidas recientemente', exact: true }).click()
    await expect(statusFilter).toHaveText('Respondidas recientemente')
    await expect(page.getByText('No hay solicitudes para este filtro.')).toBeVisible()
    const resolvedOverflow = await assertDocumentNoHorizontalOverflow(page)
    expect(resolvedOverflow.status, JSON.stringify(resolvedOverflow)).toBe('pass')
    await statusFilter.click()
    await page.getByRole('option', { name: 'Todas', exact: true }).click()
    await expect(statusFilter).toHaveText('Todas')

    const viewToggle = page.getByRole('tablist', { name: 'Seleccionar vista' })
    const toolbarTargets = await assertMinimumTargets([
      { id: 'status-filter', locator: statusFilter },
      { id: 'table-view', locator: viewToggle.getByRole('tab', { name: 'Tabla', exact: true }) },
      { id: 'card-view', locator: viewToggle.getByRole('tab', { name: 'Tarjetas', exact: true }) },
    ])
    expect(toolbarTargets.status, JSON.stringify(toolbarTargets)).toBe('pass')
    await expect
      .poll(() =>
        viewToggle.evaluate((element) => {
          const lastTab = element.querySelector('[role="tab"]:last-child')
          if (!lastTab) return Infinity
          const style = getComputedStyle(element)
          const expectedGap = parseFloat(style.paddingRight) + parseFloat(style.borderRightWidth)
          const actualGap =
            element.getBoundingClientRect().right - lastTab.getBoundingClientRect().right
          return Math.abs(actualGap - expectedGap)
        }),
      )
      .toBeLessThanOrEqual(1)

    const initialOverflow = await assertDocumentNoHorizontalOverflow(page)
    expect(initialOverflow.status, JSON.stringify(initialOverflow)).toBe('pass')

    const listScreenshot = await page.screenshot()
    await testInfo.attach(`restock-offline-list-${viewport.label}`, {
      body: listScreenshot,
      contentType: 'image/png',
    })

    const openDetail = page.getByRole('button', {
      name: 'Abrir detalle: Solicitud de reposición',
    })
    const openTarget = await assertMinimumTargets([{ id: 'open-detail', locator: openDetail }])
    expect(openTarget.status, JSON.stringify(openTarget)).toBe('pass')
    await openDetail.focus()
    await expect(openDetail).toBeFocused()

    if (process.env.HUMAN_DECISIONS_DEMO_PAUSE === 'true' && viewport.label === 'desktop-1024') {
      await page.pause()
    }

    await openDetail.press('Enter')
    const detail = page.getByTestId('human-decision-detail')
    await expect(detail).toBeVisible()
    await expect
      .poll(() =>
        detail.evaluate((element) => {
          const rect = element.getBoundingClientRect()
          return rect.left >= -1 && rect.right <= window.innerWidth + 1
        }),
      )
      .toBe(true)
    await expect(detail.getByText('Stock observado')).toBeVisible()
    await expect(detail.getByText('0 unidades')).toBeVisible()
    await expect(detail.getByText('Sin variante')).toBeVisible()

    const screenshot = await page.screenshot()
    await testInfo.attach(`restock-offline-detail-${viewport.label}`, {
      body: screenshot,
      contentType: 'image/png',
    })

    const unavailable = page.getByRole('button', { name: 'Sin fecha estimada por ahora' })
    const actionTarget = await assertMinimumTargets([
      { id: 'report-unavailable', locator: unavailable },
    ])
    expect(actionTarget.status, JSON.stringify(actionTarget)).toBe('pass')
    await unavailable.click()

    const confirmation = page.getByRole('dialog', { name: 'Confirmar respuesta' })
    await expect(confirmation).toContainText(
      'Por ahora no tenemos una fecha estimada de reposición.',
    )
    await confirmation.getByRole('button', { name: 'Registrar respuesta' }).click()

    await expect(page.getByText('Respuesta registrada solo en esta simulación')).toBeVisible()
    await expect(detail.getByText('Respondida', { exact: true })).toBeVisible()
    await expect(page.getByText('No hay solicitudes para este filtro.')).toHaveCount(0)
    await expect(page.getByText('cliente notificado')).toHaveCount(0)

    const finalOverflow = await assertDocumentNoHorizontalOverflow(page)
    expect(finalOverflow.status, JSON.stringify(finalOverflow)).toBe('pass')
    expect(strictNetwork.requests()).toEqual([])
    expect(strictNetwork.violations()).toEqual([])
  })
}
