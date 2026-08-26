// @ts-nocheck — composable binding tests use refs/computed freely.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed, type Ref } from 'vue'
import type { ServerTableParams } from '@/core/shared/types/table.types'
import type { PaymentDetailResponse, PaymentDetailTableRow } from '../../interfaces/payment-detail.types'
import { adminPaymentDetailQueryKeys } from '@/core/shared/constants/query-keys'

// Mock the shared useServerTable composable (used as-is; we do NOT modify it).
// We capture the `queryFn` so we can drive the wrapper's payload / pagination
// for the locked single-source / full-list invariant tests.

let capturedQueryKeyFn: ((...args: unknown[]) => readonly unknown[]) | undefined
let capturedQueryFn: ((params: ServerTableParams) => unknown) | undefined
let capturedDefaultSorting: Array<{ id: string; desc: boolean }> | undefined
let capturedDefaultPinning: { left?: string[]; right?: string[] } | undefined
let capturedPersistKey: string | undefined

const mockStateRefs = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }) as Ref<{ pageIndex: number; pageSize: number }>,
  sorting: ref<Array<{ id: string; desc: boolean }>>([]) as Ref<Array<{ id: string; desc: boolean }>>,
  globalFilter: ref<string>('') as Ref<string>,
  rowSelection: ref({}) as Ref<Record<string, boolean>>,
  columnPinning: ref<{ left: string[]; right: string[] }>({ left: [], right: [] }) as Ref<{ left: string[]; right: string[] }>,
  columnVisibility: ref<Record<string, boolean>>({}) as Ref<Record<string, boolean>>,
  data: ref<PaymentDetailTableRow[]>([]) as Ref<PaymentDetailTableRow[]>,
  totalCount: ref(0) as Ref<number>,
  pageCount: ref(0) as Ref<number>,
  isLoading: ref(false) as Ref<boolean>,
  isFetching: ref(false) as Ref<boolean>,
  isError: ref(false) as Ref<boolean>,
  error: ref<unknown>(null) as Ref<unknown>,
  pageSizeOptions: ref<number[]>([10, 20, 50]) as unknown as Ref<number[]>,
  showingFrom: ref(0) as Ref<number>,
  showingTo: ref(0) as Ref<number>,
}

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: vi.fn((config: {
    queryKey: (...args: unknown[]) => readonly unknown[]
    queryFn: (params: ServerTableParams) => unknown
    defaultSorting?: Array<{ id: string; desc: boolean }>
    defaultPinning?: { left?: string[]; right?: string[] }
    persistKey?: string
  }) => {
    capturedQueryKeyFn = config.queryKey
    capturedQueryFn = config.queryFn
    capturedDefaultSorting = config.defaultSorting
    capturedDefaultPinning = config.defaultPinning
    capturedPersistKey = config.persistKey
    return {
      pagination: mockStateRefs.pagination,
      sorting: mockStateRefs.sorting,
      globalFilter: mockStateRefs.globalFilter,
      rowSelection: mockStateRefs.rowSelection,
      columnPinning: mockStateRefs.columnPinning,
      columnVisibility: mockStateRefs.columnVisibility,
      data: computed(() => mockStateRefs.data.value),
      totalCount: computed(() => mockStateRefs.totalCount.value),
      pageCount: computed(() => mockStateRefs.pageCount.value),
      isLoading: computed(() => mockStateRefs.isLoading.value),
      isFetching: computed(() => mockStateRefs.isFetching.value),
      isError: computed(() => mockStateRefs.isError.value),
      error: computed(() => mockStateRefs.error.value),
      refresh: vi.fn(),
      pageSizeOptions: mockStateRefs.pageSizeOptions,
      showingFrom: computed(() => mockStateRefs.showingFrom.value),
      showingTo: computed(() => mockStateRefs.showingTo.value),
    }
  }),
}))

const authMock = {
  currentTenantId: 'tenant-1',
}

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => authMock,
}))

// Mock the feature API module but KEEP the real `paginatePaymentDetails` helper
// (the queryFn uses it to wrap the flat array into a PaginatedResponse). Only
// `paymentDetailsApi.list` is stubbed so the queryFn does not hit `http.get`.
vi.mock('@/features/admin/payment-details/api/payment-details.api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../api/payment-details.api')>()
  return {
    ...actual,
    paymentDetailsApi: {
      ...actual.paymentDetailsApi,
      list: vi.fn(),
    },
  }
})

import { usePaymentDetailsTable } from '../usePaymentDetailsTable'
import { paymentDetailsApi } from '@/features/admin/payment-details/api/payment-details.api'

function makeRow(overrides: Partial<PaymentDetailResponse> = {}): PaymentDetailResponse {
  return {
    id: 'pd-1',
    tenantId: 'tenant-1',
    bankName: 'BBVA',
    beneficiary: 'Acme SA',
    clabe: '012180001234567890',
    accountNumber: '1234567890',
    isActive: true,
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: '2024-05-15T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockStateRefs.pagination.value = { pageIndex: 0, pageSize: 10 }
  mockStateRefs.sorting.value = []
  mockStateRefs.globalFilter.value = ''
  mockStateRefs.data.value = []
  mockStateRefs.totalCount.value = 0
  mockStateRefs.pageCount.value = 0
  mockStateRefs.isLoading.value = false
  mockStateRefs.isFetching.value = false
  mockStateRefs.isError.value = false
  mockStateRefs.error.value = null
  capturedQueryFn = undefined
  capturedQueryKeyFn = undefined
  vi.clearAllMocks()
})

describe('usePaymentDetailsTable — LOCKED single-source wrapper (design.md §8.2)', () => {
  it('uses adminPaymentDetailQueryKeys.list(tenantId) as the cache key prefix', () => {
    usePaymentDetailsTable()
    expect(capturedQueryKeyFn).toBeDefined()
    const key = capturedQueryKeyFn!()
    expect(key).toEqual(adminPaymentDetailQueryKeys.list('tenant-1'))
  })

  it('configures useServerTable with defaultSorting updatedAt desc (canonical backend order)', () => {
    usePaymentDetailsTable()
    expect(capturedDefaultSorting).toEqual([{ id: 'updatedAt', desc: true }])
  })

  it('pins the actions column to the right and does not pin the left', () => {
    usePaymentDetailsTable()
    expect(capturedDefaultPinning).toEqual({ left: [], right: ['actions'] })
  })

  it('uses persistKey "admin-payment-details" for localStorage / URL sync', () => {
    usePaymentDetailsTable()
    expect(capturedPersistKey).toBe('admin-payment-details')
  })

  it('queryFn: ONE fetch populates fullList AND returns the page slice (LOCKED)', async () => {
    const wrapper = usePaymentDetailsTable()

    const allRows: PaymentDetailResponse[] = [
      makeRow({ id: 'a', bankName: 'BBVA', isActive: true, updatedAt: '2024-05-01T00:00:00.000Z' }),
      makeRow({ id: 'b', bankName: 'Banorte', isActive: false, updatedAt: '2024-04-01T00:00:00.000Z' }),
      makeRow({ id: 'c', bankName: 'Santander', isActive: true, updatedAt: '2024-03-01T00:00:00.000Z' }),
    ]
        vi.mocked(paymentDetailsApi.list).mockResolvedValue(allRows)

    // Drive the captured queryFn directly.
    const params: ServerTableParams = { pageIndex: 0, pageSize: 2, sorting: [{ id: 'updatedAt', desc: true }] }
    const result = (await capturedQueryFn!(params)) as {
      data: PaymentDetailTableRow[]
      pagination: { totalCount: number; pageCount: number; pageIndex: number; pageSize: number }
    }

    // 1) fullList ref was populated with the FULL flat array (no filter, no slice).
    expect(wrapper.fullList.value).toEqual(allRows)
    expect(wrapper.fullList.value).toHaveLength(3)

    // 2) The queryFn returned the page slice (pageSize=2 → first two rows in canonical order).
    expect(result.data).toHaveLength(2)
    expect(result.data.map((r) => r.id)).toEqual(['a', 'b'])
    expect(result.pagination.totalCount).toBe(3)
    expect(result.pagination.pageCount).toBe(2)
  })

  it('hasActiveAccount derives from fullList, NOT from the page slice (REQ-PD-006)', async () => {
    const wrapper = usePaymentDetailsTable()

    const allRows: PaymentDetailResponse[] = [
      makeRow({ id: 'a', bankName: 'BBVA', isActive: true, updatedAt: '2024-05-01T00:00:00.000Z' }),
      makeRow({ id: 'b', bankName: 'Banorte', isActive: false, updatedAt: '2024-04-01T00:00:00.000Z' }),
      makeRow({ id: 'c', bankName: 'Santander', isActive: false, updatedAt: '2024-03-01T00:00:00.000Z' }),
    ]
        vi.mocked(paymentDetailsApi.list).mockResolvedValue(allRows)

    // Simulate pagination: pageIndex=1 with pageSize=2 shows the INACTIVE row (id=c) on page 2.
    mockStateRefs.pagination.value = { pageIndex: 1, pageSize: 2 }
    mockStateRefs.data.value = [
      { ...allRows[2]! },
    ]

    // Wrapper fetches once, populates fullList, then the view "renders" the page slice (id=c).
    const params: ServerTableParams = { pageIndex: 1, pageSize: 2, sorting: [{ id: 'updatedAt', desc: true }] }
    await capturedQueryFn!(params)

    // fullList is the WHOLE list (3 rows, 1 active, 2 inactive).
    expect(wrapper.fullList.value).toHaveLength(3)
    // hasActiveAccount is TRUE because the full list has an active row, even
    // though the page slice is the inactive row.
    expect(wrapper.hasActiveAccount.value).toBe(true)
  })

  it('hasActiveAccount is FALSE when no row in fullList is active', async () => {
    const wrapper = usePaymentDetailsTable()

    const allRows: PaymentDetailResponse[] = [
      makeRow({ id: 'a', isActive: false }),
      makeRow({ id: 'b', isActive: false }),
    ]
        vi.mocked(paymentDetailsApi.list).mockResolvedValue(allRows)

    await capturedQueryFn!({ pageIndex: 0, pageSize: 10 })

    // Drive fullList manually to simulate the post-fetch state.
    wrapper.fullList.value = allRows
    expect(wrapper.hasActiveAccount.value).toBe(false)
  })

  it('hasActiveAccount is FALSE when fullList is empty (post-fetch or before any fetch)', () => {
    const wrapper = usePaymentDetailsTable()
    expect(wrapper.fullList.value).toEqual([])
    expect(wrapper.hasActiveAccount.value).toBe(false)
  })

  it('returns the useServerTable state contracts (pagination, data, totalCount, …)', () => {
    const wrapper = usePaymentDetailsTable()

    // Spread returns every useServerTable contract PLUS the two derived refs.
    const keys = Object.keys(wrapper).sort()
    expect(keys).toContain('pagination')
    expect(keys).toContain('data')
    expect(keys).toContain('totalCount')
    expect(keys).toContain('pageCount')
    expect(keys).toContain('isLoading')
    expect(keys).toContain('isFetching')
    expect(keys).toContain('isError')
    expect(keys).toContain('error')
    expect(keys).toContain('refresh')
    expect(keys).toContain('fullList')
    expect(keys).toContain('hasActiveAccount')
  })
})
