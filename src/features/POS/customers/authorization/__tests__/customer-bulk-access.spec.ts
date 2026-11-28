/**
 * customers-bulk-actions T1 (S2, handoff 33 §1-§2): who sees each bulk action.
 * - «Exportar CSV»: read:Customer + the NEW explicit export:Customer (or the super admin's manage:all).
 *   manage:Customer does NOT reach it, so CASL (where manage implies every action) is not used.
 * - «Estados de cuenta PDF»: read:Sale + read:Customer.
 */
import { describe, expect, it } from 'vitest'
import { canBulkStatements, canExportCustomers } from '../customer-bulk-access'

const can = (...grants: string[]) => (action: string, subject: string) =>
  grants.includes(`${action}:${subject}`) || grants.includes('manage:all')

describe('canExportCustomers', () => {
  it('needs the explicit export:Customer code plus read:Customer', () => {
    const codes = ['read:Customer', 'export:Customer']
    expect(canExportCustomers({ codes, userCan: can(...codes) })).toBe(true)
  })

  it('is closed without export:Customer, even with manage:Customer', () => {
    const codes = ['read:Customer', 'manage:Customer']
    expect(canExportCustomers({ codes, userCan: can('read:Customer', 'manage:Customer') })).toBe(false)
    expect(canExportCustomers({ codes: ['read:Customer'], userCan: can('read:Customer') })).toBe(false)
  })

  it('is closed with export:Customer but without read:Customer', () => {
    expect(canExportCustomers({ codes: ['export:Customer'], userCan: can() })).toBe(false)
  })

  it('is open for manage:all and the super admin claim', () => {
    expect(canExportCustomers({ codes: ['manage:all'], userCan: can('manage:all') })).toBe(true)
    expect(canExportCustomers({ codes: [], isSuperAdmin: true, userCan: can('read:Customer') })).toBe(true)
  })

  it('tolerates missing codes (fails closed)', () => {
    expect(canExportCustomers({ codes: undefined, userCan: can('read:Customer') })).toBe(false)
  })
})

describe('canBulkStatements', () => {
  it('needs read:Sale and read:Customer', () => {
    expect(canBulkStatements(can('read:Sale', 'read:Customer'))).toBe(true)
    expect(canBulkStatements(can('read:Customer'))).toBe(false)
    expect(canBulkStatements(can('read:Sale'))).toBe(false)
  })
})
