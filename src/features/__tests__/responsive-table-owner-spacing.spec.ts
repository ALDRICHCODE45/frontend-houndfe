import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Responsive table owner spacing contract (static, source-level).
// - Root owner: no horizontal gutters below `md`; desktop padding starts at `md:px-*`.
// - Immediate AppDataTable body: `w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4`
//   (existing `space-y-4` preserved). Canonical references must keep the contract.

const FEATURES = resolve(process.cwd(), 'src/features')
const BODY_TOKENS = ['w-full', 'min-w-0', 'px-3 py-3', 'sm:px-4 sm:py-4']
const BELOW_MD_GUTTER = /(?:^|\s)(?:px-\d|sm:px-\d)/
const AT_MD_GUTTER = /(?:^|\s)md:px-\d/
const HAS_PADDING = /\b(?:px|py)-\d/

const CANONICAL = [
  'POS/products/views/ProductsView.vue',
  'POS/customers/views/CustomersView.vue',
  'admin/employees/views/EmployeesListView.vue',
]
const ROOT_AND_BODY = [
  'POS/sales/views/SalesListView.vue',
  'POS/promotions/views/PromotionsView.vue',
  'POS/quotations/views/QuotationsListView.vue',
  'admin/users/views/AdminUsersView.vue',
  'admin/employees/views/PendingApprovalsView.vue',
  'admin/employees/views/ExpiringDocumentsView.vue',
  'admin/payment-details/views/AdminPaymentDetailsView.vue',
  'admin/payment-methods/views/AdminPaymentMethodsView.vue',
  'admin/roles/views/AdminRolesView.vue',
  'admin/tenants/views/AdminTenantsView.vue',
  'admin/tenants/memberships/views/AdminTenantMembersView.vue',
]
const DELIVERY_ROUTES = {
  file: 'delivery-routes/views/DeliveryRoutesListView.vue',
  managerRootMarker: 'v-else-if="isManager"',
  driverRootMarker: 'v-if="isDriver"',
  driverRootClass: 'flex flex-col gap-4 px-4 py-6 sm:px-6 lg:px-10',
}

const templateOf = (file: string) => {
  const src = readFileSync(resolve(FEATURES, file), 'utf8')
  return src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>'))
}
const divClasses = (t: string) =>
  [...t.matchAll(/<div\b[^>]*?class="([^"]*)"/g)].map((m) => ({ cls: m[1] ?? '', idx: m.index! }))

/** Class of the template root div, or of the div whose tag contains `marker`. */
function rootClass(t: string, marker?: string): string {
  const divs = divClasses(t)
  if (!marker) return divs[0]!.cls
  const at = t.indexOf(marker)
  return divs.find((d, i) => d.idx < at && (divs[i + 1]?.idx ?? Infinity) > at)!.cls
}

/** Innermost div wrapping the table that declares padding — the gutter body. */
function tableBodyClass(t: string): string {
  const table = t.indexOf('<AppDataTable')
  const divs = divClasses(t).filter((d) => d.idx < table)
  for (let i = divs.length - 1; i >= 0; i--) {
    const d = divs[i]!
    const seg = t.slice(d.idx, table)
    const depth = (seg.match(/<div\b/g) ?? []).length - (seg.match(/<\/div>/g) ?? []).length
    if (depth > 0 && HAS_PADDING.test(d.cls)) return d.cls
  }
  return ''
}

const expectRootContract = (cls: string) => {
  expect(cls).toMatch(AT_MD_GUTTER)
  expect(cls).not.toMatch(BELOW_MD_GUTTER)
}
const expectBodyContract = (cls: string) => {
  for (const token of BODY_TOKENS) expect(cls).toContain(token)
  expect(cls).not.toMatch(/\b(?:px-6|py-5)\b/)
}

it.each(CANONICAL)('canonical owner keeps the contract: %s', (file) => {
  const t = templateOf(file)
  expectRootContract(rootClass(t))
  expectBodyContract(tableBodyClass(t))
})

it.each(ROOT_AND_BODY)('owner normalizes root and table body: %s', (file) => {
  const t = templateOf(file)
  expectRootContract(rootClass(t))
  const body = tableBodyClass(t)
  expectBodyContract(body)
  if (file.includes('sales') || file.includes('quotations')) expect(body).toContain('space-y-4')
})

it('DeliveryRoutesListView normalizes only its manager root', () => {
  const t = templateOf(DELIVERY_ROUTES.file)
  const managerRoot = rootClass(t, DELIVERY_ROUTES.managerRootMarker)
  expectRootContract(managerRoot)
  // No body wrapper invented: the padded ancestor of AppDataTable is the root.
  expect(tableBodyClass(t)).toBe(managerRoot)
  // Driver branch stays untouched.
  expect(rootClass(t, DELIVERY_ROUTES.driverRootMarker)).toBe(DELIVERY_ROUTES.driverRootClass)
})
