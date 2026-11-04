import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// At 1440 every manager page sits on the same 40px gutter (inside the shell's own 24px body
// padding), so the page title and the surface start at the same x in routes, products and
// suppliers. The gutter lives on the page root only: no inner wrapper and no feature CSS adds a
// second inset. The list roots themselves are pinned by responsive-table-owner-spacing.spec.ts.
const FEATURES = resolve(process.cwd(), 'src/features')
const read = (file: string) => readFileSync(resolve(FEATURES, file), 'utf8')
const GUTTER = /(?:^|\s)md:px-10(?:\s|$)/

const ROUTE_DETAIL = 'delivery-routes/views/DeliveryRouteDetailView.vue'
const MANAGER_DETAIL_ROOTS = ['data-testid="detail-loading-skeleton"', 'data-testid="detail-manager-workspace"']

const classOfRootWith = (source: string, marker: string) => {
  const at = source.indexOf(marker)
  const open = source.lastIndexOf('<div', at)
  const tag = source.slice(open, source.indexOf('>', at))
  return /class="([^"]*)"/.exec(tag)?.[1] ?? ''
}

it.each(MANAGER_DETAIL_ROOTS)('route detail %s keeps the page gutter', (marker) => {
  expect(classOfRootWith(read(ROUTE_DETAIL), marker)).toMatch(GUTTER)
})

it('route detail skeleton and workspace share one horizontal rhythm', () => {
  const source = read(ROUTE_DETAIL)
  const horizontal = (cls: string) => cls.split(/\s+/).filter((c) => /^(?:sm:|md:|lg:)?px-\d/.test(c)).sort()
  const [skeleton, workspace] = MANAGER_DETAIL_ROOTS.map((m) => horizontal(classOfRootWith(source, m)))
  expect(skeleton).toEqual(workspace)
})

it.each([
  ['procurement/suppliers/views/SupplierView.vue', /<main\b[^>]*class="([^"]*)"/],
  ['procurement/purchase-orders/views/PurchaseOrderView.vue', /<main\b[^>]*class="([^"]*)"/],
])('procurement list root %s uses the shared gutter', (file, root) => {
  expect(root.exec(read(file))?.[1]).toMatch(GUTTER)
})

it('the delivery routes stylesheet adds no padding of its own to the page', () => {
  const css = read('delivery-routes/styles/delivery-routes-visual.css')
  expect(css).not.toMatch(/\.delivery-routes-visual[^{]*\{[^}]*padding/)
})
