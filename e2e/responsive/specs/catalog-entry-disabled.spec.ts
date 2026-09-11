import { expect, test } from '@playwright/test'
const catalogUrl = 'http://127.0.0.1:4173/catalogo'
const viewports = [{ name: 'mobile', width: 375, height: 667 }, { name: 'desktop', width: 1280, height: 800 }] as const

for (const viewport of viewports) {
  test(`${viewport.name} catalog entry keeps the P0 shell inert`, async ({ page }, testInfo) => {
    const catalogApiRequests: string[] = []
    await page.setViewportSize(viewport)
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/__e2e-api/')) catalogApiRequests.push(request.url())
    })
    await page.goto(catalogUrl)
    await expect(page.getByRole('heading', { name: 'La selección de sucursal todavía no está disponible' })).toBeVisible()
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
    await testInfo.attach(`${viewport.name}-catalog-entry-disabled`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

    const theme = page.getByRole('button', { name: 'Cambiar tema' })
    await theme.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    for (const [role, name] of [
      ['button', 'Seleccionar sucursal'], ['textbox', 'Buscar en el catálogo'], ['button', 'Todas las categorías'],
      ['button', 'Ordenar catálogo'], ['button', 'Ver carrito'],
    ] as const) await expect(page.getByRole(role, { name })).toBeDisabled()

    await expect(page.locator('[role="dialog"], a[href^="tel:"], a[href*="whatsapp"]')).toHaveCount(0)
    await expect(page.getByText(/Coco|WhatsApp|Adult Medium Breed|precio|contacto/i)).toHaveCount(0)
    expect(catalogApiRequests).toEqual([])
  })
}
