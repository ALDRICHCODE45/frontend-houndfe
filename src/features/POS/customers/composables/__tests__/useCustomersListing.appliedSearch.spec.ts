/**
 * customers-bulk-actions T1b (L5): `appliedSearch` is the search the listing request carries (the
 * table's debounced one), so the bulk «filter» selection and the listing's N describe the same rows.
 */
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('../../api/customer.api', () => ({ customerApi: { listCustomersListing: vi.fn() } }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => ({ currentTenantId: 'tenant-1' }) }))

const globalFilter = ref('')
const debouncedGlobalFilter = ref('')
vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: () => ({ response: ref(undefined), globalFilter, debouncedGlobalFilter }),
}))

const { useCustomersListing } = await import('../useCustomersListing')

describe('useCustomersListing — appliedSearch', () => {
  it('follows the debounced search, not the raw input', () => {
    const listing = useCustomersListing({ filters: {}, canReadSales: true })
    globalFilter.value = 'ana'
    expect(listing.appliedSearch.value).toBe('')
    debouncedGlobalFilter.value = 'ana'
    expect(listing.appliedSearch.value).toBe('ana')
  })
})
