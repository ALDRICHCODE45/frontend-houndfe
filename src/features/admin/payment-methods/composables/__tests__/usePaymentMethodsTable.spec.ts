// @ts-nocheck — composable binding tests use refs/computed freely.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref, computed, type Ref } from 'vue'
import type { ServerTableParams } from '@/core/shared/types/table.types'
import type { PaymentMethodResponse, PaymentMethodTableRow } from '../../interfaces/payment-method.types'
import { adminPaymentMethodQueryKeys } from '@/core/shared/constants/query-keys'

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
  data: ref<PaymentMethodTableRow[]>([]) as Ref<PaymentMethodTableRow[]>,
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

vi.mock('@/features/admin/payment-methods/api/payment-methods.api', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../api/payment-methods.api')>()
  return {
    ...actual,
    paymentMethodsApi: {
      ...actual.paymentMethodsApi,
      list: vi.fn(),
    },
  }
})

import { usePaymentMethodsTable } from '../usePaymentMethodsTable'
import { paymentMethodsApi } from '@/features/admin/payment-methods/api/payment-methods.api'

function makeRow(overrides: Partial<PaymentMethodResponse> = {}): PaymentMethodResponse {
  return {
    id: 'pm-1',
    tenantId: 'tenant-1',
    name: 'Mercado Pago',
    category: 'transfer',
    subtitle: 'Link',
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

describe('usePaymentMethodsTable — single-source wrapper (sdd custom-payment-methods S2A, REQ-PM-001)', () => {
  it('uses adminPaymentMethodQueryKeys.list(tenantId) as the cache key prefix', () => {
    usePaymentMethodsTable()
    expect(capturedQueryKeyFn).toBeDefined()
    const key = capturedQueryKeyFn!()
    expect(key).toEqual(adminPaymentMethodQueryKeys.list('tenant-1'))
  })

  it('configures useServerTable with defaultSorting updatedAt desc (canonical backend order)', () => {
    usePaymentMethodsTable()
    expect(capturedDefaultSorting).toEqual([{ id: 'updatedAt', desc: true }])
  })

  it('pins the actions column to the right and does not pin the left', () => {
    usePaymentMethodsTable()
    expect(capturedDefaultPinning).toEqual({ left: [], right: ['actions'] })
  })

  it('uses persistKey "admin-payment-methods" for localStorage / URL sync', () => {
    usePaymentMethodsTable()
    expect(capturedPersistKey).toBe('admin-payment-methods')
  })

  it('queryFn: ONE fetch populates fullList AND returns the page slice', async () => {
    const wrapper = usePaymentMethodsTable()

    const allRows: PaymentMethodResponse[] = [
      makeRow({ id: 'a', name: 'Mercado Pago', isActive: true, updatedAt: '2024-05-01T00:00:00.000Z' }),
      makeRow({ id: 'b', name: 'SPEI', isActive: false, updatedAt: '2024-04-01T00:00:00.000Z' }),
      makeRow({ id: 'c', name: 'Visa', isActive: true, updatedAt: '2024-03-01T00:00:00.000Z' }),
    ]
    vi.mocked(paymentMethodsApi.list).mockResolvedValue(allRows)

    const params: ServerTableParams = { pageIndex: 0, pageSize: 2, sorting: [{ id: 'updatedAt', desc: true }] }
    const result = (await capturedQueryFn!(params)) as {
      data: PaymentMethodTableRow[]
      pagination: { totalCount: number; pageCount: number; pageIndex: number; pageSize: number }
    }

    expect(wrapper.fullList.value).toEqual(allRows)
    expect(wrapper.fullList.value).toHaveLength(3)

    expect(result.data).toHaveLength(2)
    expect(result.data.map((r) => r.id)).toEqual(['a', 'b'])
    expect(result.pagination.totalCount).toBe(3)
    expect(result.pagination.pageCount).toBe(2)
  })

  it('returns the useServerTable state contracts (pagination, data, totalCount, …)', () => {
    const wrapper = usePaymentMethodsTable()

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
  })
})