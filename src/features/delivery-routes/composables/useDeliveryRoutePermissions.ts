/**
 * useDeliveryRoutePermissions — S6a REFACTOR (sdd delivery-routes, design.md §6.4, §9.3).
 *
 * Thin re-export wrapper over `useDeliveryRouteRole` that exposes ONLY the
 * per-action permission booleans the views consume as gating signals. The
 * role discriminator (`isManager` / `isDriver`) stays in `useDeliveryRouteRole`
 * because the views branch on it; this composable is for the surfaces that
 * just need `canUpdate` / `canDelete` / `canCreate` / `canRead` without
 * touching the role boolean.
 *
 * Why a separate composable:
 *   - The role boolean is a DERIVED signal (create OR delete ⇒ manager); the
 *     individual permission booleans are the SOURCE. Splitting them clarifies
 *     intent at the call site: a view that consumes `canUpdate` is making a
 *     "can this user edit" assertion, not a "is this user a manager" assertion.
 *   - REFACTOR target of S6a (design §14 / tasks.md S6a REFACTOR bullet):
 *     "Extract `useDeliveryRoutePermissions()` and have the detail view consume
 *     it; discriminator reads via a single `useDeliveryRouteRole` call."
 *
 * Contract:
 *   - No new query (reads `authStore.permissionCodes`, already loaded).
 *   - All values are reactive `computed<boolean>` refs.
 *   - Returns `{ canCreate, canDelete, canUpdate, canRead }`.
 */
import { useDeliveryRouteRole } from './useDeliveryRouteRole'

export function useDeliveryRoutePermissions() {
  const { canCreate, canDelete, canUpdate, canRead } = useDeliveryRouteRole()
  return {
    canCreate,
    canDelete,
    canUpdate,
    canRead,
  }
}
