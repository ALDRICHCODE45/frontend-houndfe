import { expect, test, RESPONSIVE_ORIGIN } from '../fixtures/test'
import type { DeclaredRoute } from '../fixtures/network'

const branch = { id: 'b-1', name: 'Sucursal con un nombre excepcionalmente largo para validar el ajuste', slug: 'centro', address: null, phone: null }
const branchRoutes = (route: Omit<DeclaredRoute, 'method' | 'path'>): DeclaredRoute[] => [{ method: 'GET', path: '/public/catalog/branches', ...route }]
const viewports = [{ name: 'narrow', width: 375, height: 812 }, { name: 'wide', width: 1440, height: 900 }] as const
const expectOnlyBranchRequests = (strictNetwork: { requests(): readonly { path: string }[]; violations(): readonly string[] }) => {
  expect(strictNetwork.requests().every((request) => request.path === '/public/catalog/branches')).toBe(true)
  expect(strictNetwork.violations()).toEqual([])
}

for (const viewport of viewports) {
  test.describe(`${viewport.name} populated`, () => {
    test.use({ declaredRoutes: branchRoutes({ json: [branch] }) })
    test('shows one explicit unselected branch without commerce requests or overflow', async ({ page, strictNetwork }, testInfo) => {
      await page.setViewportSize(viewport)
      await page.goto(`${RESPONSIVE_ORIGIN}/catalogo`)

      await expect(page.getByText('Sucursales disponibles')).toBeVisible()
      await expect(page.getByRole('button', { name: branch.name })).toBeDisabled()
      await expect(page.getByRole('heading', { name: 'La selección de sucursal todavía no está disponible' })).toBeVisible()
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', viewport.width)
      await testInfo.attach(`${viewport.name}-branch-discovery`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
      expect(strictNetwork.requests()).toEqual([{ method: 'GET', path: '/public/catalog/branches', query: {}, body: undefined }])
      expect(strictNetwork.violations()).toEqual([])
    })
  })

  test.describe(`${viewport.name} loading`, () => {
    test.use({ declaredRoutes: branchRoutes({ deferred: true }) })
    test('renders the loading state while the branches request is held', async ({ page, strictNetwork }) => {
      await page.setViewportSize(viewport)
      await page.goto(`${RESPONSIVE_ORIGIN}/catalogo`)

      await expect(page.getByText('Cargando sucursales…')).toBeVisible()
      expect(strictNetwork.requests().filter((request) => request.path === '/public/catalog/branches')).toHaveLength(1)
      expectOnlyBranchRequests(strictNetwork)
    })
  })

  test.describe(`${viewport.name} empty retry`, () => {
    test.use({ declaredRoutes: branchRoutes({ json: [] }) })
    test('renders the empty state and reissues the isolated request on manual retry', async ({ page, strictNetwork }) => {
      await page.setViewportSize(viewport)
      await page.goto(`${RESPONSIVE_ORIGIN}/catalogo`)

      await expect(page.getByText('No hay sucursales publicadas')).toBeVisible()
      await page.getByRole('button', { name: 'Reintentar' }).click()
      await expect.poll(() => strictNetwork.requests().filter((request) => request.path === '/public/catalog/branches').length, { timeout: 5_000 }).toBe(2)
      expect(page.url()).toBe(`${RESPONSIVE_ORIGIN}/catalogo`)
      expectOnlyBranchRequests(strictNetwork)
    })
  })

      test.describe(`${viewport.name} rate-limit retry`, () => {
        test.use({ declaredRoutes: branchRoutes({ status: 429, json: { message: 'rate limited (e2e)' } }) })
        test('renders the distinct rate-limit copy and reissues the request on manual retry', async ({ page, strictNetwork }, testInfo) => {
          await page.setViewportSize(viewport)
          await page.goto(`${RESPONSIVE_ORIGIN}/catalogo`)

          await expect(page.getByText('Demasiadas solicitudes. Intenta de nuevo más tarde.')).toBeVisible()
          await page.getByRole('button', { name: 'Reintentar' }).click()
          await expect.poll(() => strictNetwork.requests().filter((request) => request.path === '/public/catalog/branches').length, { timeout: 5_000 }).toBe(2)
          await expect(page.getByText('Demasiadas solicitudes. Intenta de nuevo más tarde.')).toBeVisible()
          await testInfo.attach(`${viewport.name}-branch-discovery-rate-limit`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
          expect(page.url()).toBe(`${RESPONSIVE_ORIGIN}/catalogo`)
          expectOnlyBranchRequests(strictNetwork)
        })
      })

      test.describe(`${viewport.name} error retry`, () => {
    test.use({ declaredRoutes: branchRoutes({ status: 500, json: { message: 'Servicio no disponible (e2e)' } }) })
    test('renders the generic recoverable error and reissues the request on manual retry', async ({ page, strictNetwork }, testInfo) => {
      await page.setViewportSize(viewport)
      await page.goto(`${RESPONSIVE_ORIGIN}/catalogo`)

      await expect(page.getByText('No pudimos cargar las sucursales.')).toBeVisible()
      await page.getByRole('button', { name: 'Reintentar' }).click()
      await expect.poll(() => strictNetwork.requests().filter((request) => request.path === '/public/catalog/branches').length, { timeout: 5_000 }).toBe(2)
      await expect(page.getByText('No pudimos cargar las sucursales.')).toBeVisible()
      await testInfo.attach(`${viewport.name}-branch-discovery-error`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
      expect(page.url()).toBe(`${RESPONSIVE_ORIGIN}/catalogo`)
      expectOnlyBranchRequests(strictNetwork)
    })
  })
}
