import { computed } from 'vue'
import { useViewMode } from '@/core/shared/composables/useViewMode'

export type DeliveryRouteViewMode = 'table' | 'card'

export const DELIVERY_ROUTE_VIEW_MODE_STORAGE_KEY = 'delivery-routes-view-mode'

const VALID_MODES = ['table', 'card'] as const

/** Persisted table/card choice for the manager route list. */
export function useDeliveryRouteViewMode() {
  const { viewMode, setMode } = useViewMode(
    DELIVERY_ROUTE_VIEW_MODE_STORAGE_KEY,
    VALID_MODES,
    'table',
  )

  /** AppDataTable expects the plural `cards` form. */
  const displayMode = computed<'table' | 'cards'>(() =>
    viewMode.value === 'card' ? 'cards' : 'table',
  )

  function setViewMode(value: string): void {
    if ((VALID_MODES as readonly string[]).includes(value)) setMode(value as DeliveryRouteViewMode)
  }

  return { viewMode, displayMode, setViewMode }
}
