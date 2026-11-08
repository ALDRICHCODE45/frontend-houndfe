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
const SKELETON = 'data-testid="detail-loading-skeleton"'
const WORKSPACE = 'data-testid="detail-manager-workspace"'

const classOfRootWith = (source: string, marker: string) => {
  const at = source.indexOf(marker)
  const open = source.lastIndexOf('<div', at)
  const tag = source.slice(open, source.indexOf('>', at))
  return /class="([^"]*)"/.exec(tag)?.[1] ?? ''
}

// The workspace sits in DetailPageFrame (detail-page-frame S3): the frame cancels the body padding,
// so the gutter lives on the two page columns, the pinned header's and the scrolling body's.
const workspaceColumns = (source: string) => {
  const from = source.indexOf(WORKSPACE)
  return [...source.slice(from).matchAll(/<div class="(mx-auto [^"]*max-w-\[1320px\][^"]*)"/g)].slice(0, 2).map((m) => m[1]!)
}

it('route detail skeleton keeps the page gutter', () => {
  expect(classOfRootWith(read(ROUTE_DETAIL), SKELETON)).toMatch(GUTTER)
})

it('route detail header and body columns keep the page gutter', () => {
  const columns = workspaceColumns(read(ROUTE_DETAIL))
  expect(columns).toHaveLength(2)
  for (const column of columns) expect(column).toMatch(GUTTER)
})

it('route detail skeleton, header and body share one horizontal rhythm', () => {
  const source = read(ROUTE_DETAIL)
  const horizontal = (cls: string) => cls.split(/\s+/).filter((c) => /^(?:sm:|md:|lg:)?px-\d/.test(c)).sort()
  const skeleton = horizontal(classOfRootWith(source, SKELETON))
  for (const column of workspaceColumns(source)) expect(horizontal(column)).toEqual(skeleton)
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
