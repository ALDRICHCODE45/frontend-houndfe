import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const slideovers = {
  users: 'src/features/admin/users/components/UserUpsertSlideover.vue',
  roles: 'src/features/admin/roles/components/RoleUpsertSlideover.vue',
  tenants: 'src/features/admin/tenants/components/TenantUpsertSlideover.vue',
  members: 'src/features/admin/tenants/memberships/components/MembershipUpsertSlideover.vue',
  paymentMethods: 'src/features/admin/payment-methods/components/PaymentMethodUpsertSlideover.vue',
  paymentDetails: 'src/features/admin/payment-details/components/PaymentDetailUpsertSlideover.vue',
}

// Source contracts for the Text diet on the admin form overlays: the title says
// what the overlay is, so no permanent help paragraph rides under it.
describe('admin form overlays — text diet', () => {
  for (const [name, path] of Object.entries(slideovers)) {
    const source = readFileSync(path, 'utf8')

    it(`${name}: no permanent description under the title`, () => {
      expect(source).not.toContain(':description="description"')
      expect(source).not.toMatch(/Completa los datos|Actualiza (el|los) /)
    })

    it(`${name}: one primary submit and no legacy palette`, () => {
      expect(source.match(/type="submit"/g)).toHaveLength(1)
      expect(source).not.toMatch(/text-red-|bg-red-|coco-|font-bold|#[0-9a-fA-F]{3,8}\b/)
    })
  }

  it('paymentMethods: the field help stays one short sentence next to what it explains', () => {
    const source = readFileSync(slideovers.paymentMethods, 'utf8')
    const helps = [...source.matchAll(/help="([^"]+)"/g)].map((match) => match[1]!)
    expect(helps).toEqual(['Aparece bajo el nombre al cobrar.', 'Un método inactivo no aparece al cobrar.'])
  })
})
