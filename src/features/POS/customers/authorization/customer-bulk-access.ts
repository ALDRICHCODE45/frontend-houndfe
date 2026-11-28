/**
 * customer-bulk-access.ts — who sees the bulk actions of the customers table (customers-bulk-actions
 * S2, handoff 33). Feature-local policy, like `products/authorization/editorial-access.ts`.
 *
 * «Exportar CSV» needs read:Customer plus the NEW explicit `export:Customer` code (or the super
 * admin's `manage:all`). It reads the permission codes instead of CASL on purpose: CASL lets
 * `manage:Customer` imply every action, but the backend does not let it export, and `export` is not
 * a CASL action of the app. Fails closed when the codes are missing.
 */
type UserCan = (action: 'read', subject: 'Customer' | 'Sale') => boolean

export const EXPORT_CUSTOMER_PERMISSION = 'export:Customer'
const MANAGE_ALL = 'manage:all'

export function canExportCustomers(access: {
  codes: readonly string[] | undefined
  isSuperAdmin?: boolean
  userCan: UserCan
}): boolean {
  const codes = access.codes ?? []
  const explicit = access.isSuperAdmin === true || codes.includes(MANAGE_ALL) || codes.includes(EXPORT_CUSTOMER_PERMISSION)
  return explicit && access.userCan('read', 'Customer')
}

/** «Estados de cuenta PDF»: read:Sale + read:Customer, as the single statement plus the list. */
export function canBulkStatements(userCan: UserCan): boolean {
  return userCan('read', 'Sale') && userCan('read', 'Customer')
}
