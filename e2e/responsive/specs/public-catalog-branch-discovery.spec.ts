import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import type { DeclaredRoute } from '../fixtures/network'

const branch = {
  id: 'b-1',
  name: 'Sucursal con un nombre excepcionalmente largo para validar el ajuste responsivo',
  slug: 'centro',
  address: null,
  phone: null,
}
const viewports = [
  { name: 'compact', width: 320, height: 568 },
  { name: 'mobile', width: 375, height: 667 },
  { name: 'desktop', width: 1280, height: 800 },
] as const
const routes: readonly DeclaredRoute[] = [
  { method: 'GET', path: '/public/catalog/branches', json: [branch], count: 1 },
]

for (const viewport of viewports) {
  test.describe(`public catalog discovery at ${viewport.name}`, () => {
    test.use({ declaredRoutes: routes })

    test('keeps /catalogo discovery-only until an explicit reachable branch choice', async ({
      page,
      strictNetwork,
    }, testInfo) => {
      await page.setViewportSize(viewport)
      await page.goto(`${RESPONSIVE_ORIGIN}/catalogo`)

      const branchChoice = page.getByRole('button', { name: branch.name })
      await expect(page.getByText('Sucursales disponibles')).toBeVisible()
      await expect(branchChoice).toBeEnabled()
      await branchChoice.focus()
      await expect(branchChoice).toBeFocused()
      await expect(branchChoice).not.toHaveAttribute('aria-current')
      await expect(
        page.getByRole('heading', { name: 'Elige una sucursal para explorar el catálogo' }),
      ).toBeVisible()
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
      await testInfo.attach(`${viewport.name}-catalog-discovery`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      })

      expect(strictNetwork.requests()).toEqual([
        { method: 'GET', path: '/public/catalog/branches', query: {}, body: undefined },
      ])
      expect(strictNetwork.violations()).toEqual([])
    })
  })
}
