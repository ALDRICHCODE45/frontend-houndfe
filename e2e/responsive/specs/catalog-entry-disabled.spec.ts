import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import type { DeclaredRoute } from '../fixtures/network'

const branch = { id: 'b-1', name: 'Sucursal Centro', slug: 'centro', address: null, phone: null }
const viewports = [
  { name: 'compact', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 667 },
  { name: 'desktop', width: 1280, height: 800 },
] as const
const routes: readonly DeclaredRoute[] = [
  { method: 'GET', path: '/public/catalog/branches', json: [branch], count: 1 },
]

for (const viewport of viewports) {
  test.describe(`catalog entry guardrails at ${viewport.name}`, () => {
    test.use({ declaredRoutes: routes })

    test('keeps commerce and deferred controls disabled while branch discovery remains explicit', async ({
      page,
      strictNetwork,
    }) => {
      await page.setViewportSize(viewport)
      await page.goto(`${RESPONSIVE_ORIGIN}/catalogo`)

      await expect(page.getByRole('button', { name: branch.name })).toBeEnabled()
      for (const [role, name] of [
        ['textbox', 'Buscar en el catálogo'],
        ['button', 'Todas las categorías'],
        ['button', 'Ordenar catálogo'],
        ['button', 'Ver carrito'],
      ] as const)
        await expect(page.getByRole(role, { name })).toBeDisabled()
      await expect(
        page.locator(
          '[role="dialog"], a[href^="tel:"], a[href*="whatsapp"], button:text-is("Ver")',
        ),
      ).toHaveCount(0)
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
      expect(
        await page
          .locator('header, main, footer')
          .evaluateAll((elements) => elements.map((element) => element.tagName)),
      ).toEqual(['HEADER', 'MAIN', 'FOOTER'])

      expect(strictNetwork.requests()).toEqual([
        { method: 'GET', path: '/public/catalog/branches', query: {}, body: undefined },
      ])
      expect(strictNetwork.violations()).toEqual([])
    })
  })
}
