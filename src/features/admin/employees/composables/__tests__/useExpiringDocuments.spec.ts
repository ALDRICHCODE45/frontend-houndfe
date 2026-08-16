/**
 * WU-A — useExpiringDocuments + expiring-documents adapter specs (REQ-1, REQ-2,
 * REQ-6, REQ-7, REQ-8)
 *
 * RED stubs written before the WU-A production change (tasks 1.1/1.3).
 *
 * Pinned contracts:
 *  - `getExpiringDocumentsPaginated(ServerTableParams, daysUntilExpiry)` builds
 *    `{ daysUntilExpiry, page = pageIndex + 1, limit = min(pageSize, 100),
 *      search? (≥2 chars), sortBy?, sortOrder? }` — NEVER tenantId (REQ-6)
 *  - `EXPIRING_DOCUMENTS_SORT_MAP` whitelist: vencimiento/restante → expiresAt,
 *    categoria → category, colaborador → employeeName; `documento` never maps;
 *    empty `sorting` omits sortBy/sortOrder (REQ-2)
 *  - `mapExpiringDocumentsPaginated` reads `{ data, meta: { total, page, limit,
 *    totalPages } }` → `PaginatedResponse` (REQ-6)
 *  - `useExpiringDocuments` composes `useServerTable` with defaultSorting
 *    vencimiento asc, defaultPageSize 10, pageSizeOptions [10,20,50],
 *    persistKey 'admin-expiring-documents', urlSync false; `selectedThreshold`
 *    closes queryKey/queryFn; threshold watch resets pageIndex to 0 (REQ-1/7)
 *  - `documents` mapper adds fullName/employeeNumber to each row (REQ-8)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { http } from '@/core/shared/api/http'
import { employeeDocumentQueryKeys } from '@/core/shared/constants/query-keys'
import {
  employeesApi,
  EXPIRING_DOCUMENTS_SORT_MAP,
  mapExpiringDocumentsPaginated,
} from '@/features/admin/employees/api/employees.api'
import type { ExpiringDocumentItem } from '@/features/admin/employees/api/employees.api'

function makeExpiringItem(overrides: Partial<ExpiringDocumentItem> = {}): ExpiringDocumentItem {
  return {
    id: 'doc-1',
    employeeId: 'emp-1',
    fileId: 'file-1',
    category: 'CONTRACT',
    notes: 'Contrato temporal',
    expiresAt: '2026-06-15',
    createdAt: '2026-01-01T00:00:00Z',
    fullName: 'Ana López',
    employeeNumber: 'EMP-001',
    ...overrides,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── EXPIRING_DOCUMENTS_SORT_MAP — whitelist (REQ-2) ─────────────────────────

describe('EXPIRING_DOCUMENTS_SORT_MAP — Spanish column id → backend sortBy (REQ-2)', () => {
  it('whitelists vencimiento and restante → expiresAt, categoria → category, colaborador → employeeName', () => {
    expect(EXPIRING_DOCUMENTS_SORT_MAP).toEqual({
      vencimiento: 'expiresAt',
      restante: 'expiresAt',
      categoria: 'category',
      colaborador: 'employeeName',
    })
  })

  it('does NOT contain a mapping for documento (never sortable)', () => {
    expect('documento' in EXPIRING_DOCUMENTS_SORT_MAP).toBe(false)
  })
})

// ─── getExpiringDocumentsPaginated — outbound params (REQ-6) ─────────────────

describe('getExpiringDocumentsPaginated — outbound request contract (REQ-6)', () => {
  const okResponse = {
    data: { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } },
  }

  it('maps 0-based pageIndex to 1-based page, clamps limit at 100, and sends daysUntilExpiry', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await employeesApi.getExpiringDocumentsPaginated({ pageIndex: 2, pageSize: 250 }, 30)
    const params = getSpy.mock.calls[0]![1]?.params ?? {}
    expect(params.page).toBe(3)
    expect(params.limit).toBe(100)
    expect(params.daysUntilExpiry).toBe(30)
  })

  it('passes pageSize through when under the 100 cap', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await employeesApi.getExpiringDocumentsPaginated({ pageIndex: 0, pageSize: 20 }, 60)
    const params = getSpy.mock.calls[0]![1]?.params ?? {}
    expect(params.limit).toBe(20)
  })

  it('omits search when globalFilter is empty or shorter than 2 chars (REQ-3)', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await employeesApi.getExpiringDocumentsPaginated({ pageIndex: 0, pageSize: 10, globalFilter: '' }, 30)
    await employeesApi.getExpiringDocumentsPaginated({ pageIndex: 0, pageSize: 10, globalFilter: 'a' }, 30)
    const calls = getSpy.mock.calls
    for (const call of calls) {
      expect('search' in (call[1]?.params ?? {})).toBe(false)
    }
  })

  it('passes search through when globalFilter is 2+ chars', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await employeesApi.getExpiringDocumentsPaginated({ pageIndex: 0, pageSize: 10, globalFilter: 'jo' }, 30)
    const params = getSpy.mock.calls[0]![1]?.params ?? {}
    expect(params.search).toBe('jo')
  })

  it('maps vencimiento asc → sortBy expiresAt / sortOrder asc', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await employeesApi.getExpiringDocumentsPaginated(
      { pageIndex: 0, pageSize: 10, sorting: [{ id: 'vencimiento', desc: false }] },
      30,
    )
    const params = getSpy.mock.calls[0]![1]?.params ?? {}
    expect(params.sortBy).toBe('expiresAt')
    expect(params.sortOrder).toBe('asc')
  })

  it('maps restante desc → sortBy expiresAt / sortOrder desc', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await employeesApi.getExpiringDocumentsPaginated(
      { pageIndex: 0, pageSize: 10, sorting: [{ id: 'restante', desc: true }] },
      30,
    )
    const params = getSpy.mock.calls[0]![1]?.params ?? {}
    expect(params.sortBy).toBe('expiresAt')
    expect(params.sortOrder).toBe('desc')
  })

  it('maps categoria → category and colaborador → employeeName', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await employeesApi.getExpiringDocumentsPaginated(
      { pageIndex: 0, pageSize: 10, sorting: [{ id: 'categoria', desc: false }] },
      30,
    )
    await employeesApi.getExpiringDocumentsPaginated(
      { pageIndex: 0, pageSize: 10, sorting: [{ id: 'colaborador', desc: true }] },
      30,
    )
    const first = getSpy.mock.calls[0]![1]?.params ?? {}
    const second = getSpy.mock.calls[1]![1]?.params ?? {}
    expect(first.sortBy).toBe('category')
    expect(second.sortBy).toBe('employeeName')
    expect(second.sortOrder).toBe('desc')
  })

  it('omits sortBy/sortOrder when sorting is empty (REQ-2)', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await employeesApi.getExpiringDocumentsPaginated({ pageIndex: 0, pageSize: 10 }, 30)
    const params = getSpy.mock.calls[0]![1]?.params ?? {}
    expect('sortBy' in params).toBe(false)
    expect('sortOrder' in params).toBe(false)
  })

  it('omits sortBy/sortOrder when the sort id is not whitelisted (documento never maps)', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await employeesApi.getExpiringDocumentsPaginated(
      { pageIndex: 0, pageSize: 10, sorting: [{ id: 'documento', desc: true }] },
      30,
    )
    const params = getSpy.mock.calls[0]![1]?.params ?? {}
    expect('sortBy' in params).toBe(false)
    expect('sortOrder' in params).toBe(false)
  })

  it('NEVER sends tenantId in params (regression guard)', async () => {
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await employeesApi.getExpiringDocumentsPaginated({ pageIndex: 0, pageSize: 10 }, 30)
    const params = getSpy.mock.calls[0]![1]?.params ?? {}
    expect('tenantId' in params).toBe(false)
  })

  it('returns a PaginatedResponse via mapExpiringDocumentsPaginated', async () => {
    vi.spyOn(http, 'get').mockResolvedValue({
      data: {
        data: [makeExpiringItem()],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      },
    })
    const result = await employeesApi.getExpiringDocumentsPaginated(
      { pageIndex: 0, pageSize: 10 },
      30,
    )
    expect(result.data).toHaveLength(1)
    expect(result.data[0]!.fullName).toBe('Ana López')
    expect(result.pagination.pageIndex).toBe(0)
    expect(result.pagination.totalCount).toBe(1)
  })
})

// ─── mapExpiringDocumentsPaginated — { data, meta } → PaginatedResponse (REQ-6)

describe('mapExpiringDocumentsPaginated — meta reader (REQ-6)', () => {
  it('maps { data, meta: { total, page, limit, totalPages } } → PaginatedResponse', () => {
    const result = mapExpiringDocumentsPaginated({
      data: [makeExpiringItem()],
      meta: { total: 25, page: 2, limit: 10, totalPages: 3 },
    })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]!.id).toBe('doc-1')
    expect(result.pagination).toEqual({
      pageIndex: 1, // meta.page - 1 (0-based)
      pageSize: 10, // meta.limit
      totalCount: 25, // meta.total
      pageCount: 3, // meta.totalPages
    })
  })

  it('preserves every item in the data array', () => {
    const items = [makeExpiringItem({ id: 'a' }), makeExpiringItem({ id: 'b' })]
    const result = mapExpiringDocumentsPaginated({
      data: items,
      meta: { total: 2, page: 1, limit: 10, totalPages: 1 },
    })
    expect(result.data).toHaveLength(2)
    expect(result.data[0]!.id).toBe('a')
    expect(result.data[1]!.id).toBe('b')
  })
})

// ─── useExpiringDocuments — useServerTable composition (REQ-1/2/7/8) ──────────

// Mock state for the shared (UNTOUCHABLE) useServerTable — Fase 3 #1 lesson.
const mockTable = {
  pagination: ref({ pageIndex: 0, pageSize: 10 }),
  sorting: ref([{ id: 'vencimiento', desc: false }]),
  globalFilter: ref(''),
  columnVisibility: ref({}),
  rowSelection: ref({}),
  columnPinning: ref({ left: [], right: [] }),
  data: ref<ExpiringDocumentItem[]>([]),
  totalCount: ref(0),
  pageCount: ref(0),
  isLoading: ref(false),
  isFetching: ref(false),
  isError: ref(false),
  error: ref<unknown>(null),
  refresh: vi.fn(),
  pageSizeOptions: [10, 20, 50],
  showingFrom: ref(0),
  showingTo: ref(0),
}

type CapturedConfig = {
  queryKey: () => readonly unknown[]
  queryFn: (params: unknown) => Promise<unknown>
  defaultSorting: unknown[]
  defaultPageSize: number
  debounceMs: number
  pageSizeOptions: number[]
  persistKey: string
  urlSync: boolean
}
let capturedConfig: CapturedConfig | undefined

vi.mock('@/core/shared/composables/useServerTable', () => ({
  useServerTable: (config: CapturedConfig) => {
    capturedConfig = config
    return mockTable
  },
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

// NOTE: the adapter is imported above directly; the composable under test calls
// `employeesApi.getExpiringDocumentsPaginated` through its queryFn closure.

describe('useExpiringDocuments — useServerTable options (REQ-1)', () => {
  let useExpiringDocuments:
    | ((
        options?: { defaultPageSize?: number; debounceMs?: number },
      ) => Record<string, unknown>)
    | undefined

  const okResponse = {
    data: { data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } },
  }

  beforeEach(async () => {
    capturedConfig = undefined
    mockTable.pagination.value = { pageIndex: 0, pageSize: 10 }
    mockTable.data.value = []
    const mod = await import('@/features/admin/employees/composables/useExpiringDocuments')
    useExpiringDocuments = mod.useExpiringDocuments
  })

  it('composes useServerTable with defaultSorting vencimiento asc, defaultPageSize 10, pageSizeOptions [10,20,50], persistKey, urlSync false', () => {
    useExpiringDocuments?.()
    expect(capturedConfig?.defaultSorting).toEqual([{ id: 'vencimiento', desc: false }])
    expect(capturedConfig?.defaultPageSize).toBe(10)
    expect(capturedConfig?.pageSizeOptions).toEqual([10, 20, 50])
    expect(capturedConfig?.persistKey).toBe('admin-expiring-documents')
    expect(capturedConfig?.urlSync).toBe(false)
  })

  it('closes queryKey with employeeDocumentQueryKeys.expiring(tenantId, selectedThreshold)', () => {
    useExpiringDocuments?.()
    const key = capturedConfig?.queryKey() ?? []
    expect(key).toEqual(employeeDocumentQueryKeys.expiring('tenant-1', 30))
  })

  it('queryKey changes when selectedThreshold changes', async () => {
    const result = useExpiringDocuments?.() as {
      selectedThreshold: { value: 30 | 60 | 90 }
    }
    result.selectedThreshold.value = 60
    await nextTick()
    const key = capturedConfig?.queryKey() ?? []
    expect(key).toEqual(employeeDocumentQueryKeys.expiring('tenant-1', 60))
  })

  it('closes queryFn over selectedThreshold — calls getExpiringDocumentsPaginated(params, days)', async () => {
    const result = useExpiringDocuments?.() as {
      selectedThreshold: { value: 30 | 60 | 90 }
    }
    result.selectedThreshold.value = 90
    const apiSpy = vi.spyOn(employeesApi, 'getExpiringDocumentsPaginated').mockResolvedValue({
      data: [],
      pagination: { pageIndex: 0, pageSize: 10, totalCount: 0, pageCount: 0 },
    })
    const params = { pageIndex: 0, pageSize: 10 }
    await capturedConfig?.queryFn(params)
    expect(apiSpy).toHaveBeenCalledWith(params, 90)
  })

  it('resets pageIndex to 0 when selectedThreshold changes (REQ-1/REQ-7)', async () => {
    const result = useExpiringDocuments?.() as {
      selectedThreshold: { value: 30 | 60 | 90 }
    }
    mockTable.pagination.value = { pageIndex: 3, pageSize: 10 }
    result.selectedThreshold.value = 60
    await nextTick()
    expect(mockTable.pagination.value.pageIndex).toBe(0)
  })

  it('sends selectedThreshold as daysUntilExpiry and translates page/limit via queryFn', async () => {
    const result = useExpiringDocuments?.() as {
      selectedThreshold: { value: 30 | 60 | 90 }
    }
    result.selectedThreshold.value = 90
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await capturedConfig?.queryFn({ pageIndex: 2, pageSize: 250 })
    const params = getSpy.mock.calls[0]![1]?.params ?? {}
    expect(params.daysUntilExpiry).toBe(90)
    expect(params.page).toBe(3)
    expect(params.limit).toBe(100)
  })

  it('omits search below 2 chars and passes it at 2+ chars through queryFn', async () => {
    useExpiringDocuments?.()
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await capturedConfig?.queryFn({ pageIndex: 0, pageSize: 10, globalFilter: 'a' })
    await capturedConfig?.queryFn({ pageIndex: 0, pageSize: 10, globalFilter: 'jo' })
    expect('search' in (getSpy.mock.calls[0]![1]?.params ?? {})).toBe(false)
    expect((getSpy.mock.calls[1]![1]?.params ?? {}).search).toBe('jo')
  })

  it('maps sorting through EXPIRING_DOCUMENTS_SORT_MAP and omits both on a whitelist miss via queryFn', async () => {
    useExpiringDocuments?.()
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await capturedConfig?.queryFn({
      pageIndex: 0,
      pageSize: 10,
      sorting: [{ id: 'vencimiento', desc: true }],
    })
    await capturedConfig?.queryFn({
      pageIndex: 0,
      pageSize: 10,
      sorting: [{ id: 'documento', desc: true }],
    })
    const first = getSpy.mock.calls[0]![1]?.params ?? {}
    const second = getSpy.mock.calls[1]![1]?.params ?? {}
    expect(first.sortBy).toBe('expiresAt')
    expect(first.sortOrder).toBe('desc')
    expect('sortBy' in second).toBe(false)
    expect('sortOrder' in second).toBe(false)
  })

  it('never sends tenantId when driven through the composable queryFn', async () => {
    useExpiringDocuments?.()
    const getSpy = vi.spyOn(http, 'get').mockResolvedValue(okResponse)
    await capturedConfig?.queryFn({ pageIndex: 0, pageSize: 10 })
    expect('tenantId' in (getSpy.mock.calls[0]![1]?.params ?? {})).toBe(false)
  })

  it('maps rows with fullName and employeeNumber (REQ-8)', () => {
    mockTable.data.value = [makeExpiringItem()]
    const result = useExpiringDocuments?.() as { documents: { value: unknown[] } }
    const row = result.documents.value[0] as Record<string, unknown>
    expect(row.fullName).toBe('Ana López')
    expect(row.employeeNumber).toBe('EMP-001')
    expect(row.title).toBe('Contrato temporal')
    expect(row.categoryLabel).toBe('Contrato (CONTRACT)')
  })

  it('exposes pagination, sorting, globalFilter, columnVisibility, error state, and refresh', () => {
    const result = useExpiringDocuments?.() as Record<string, unknown>
    expect(result.pagination).toBe(mockTable.pagination)
    expect(result.sorting).toBe(mockTable.sorting)
    expect(result.globalFilter).toBe(mockTable.globalFilter)
    expect(result.columnVisibility).toBe(mockTable.columnVisibility)
    expect(result.isLoading).toBe(mockTable.isLoading)
    expect(result.isError).toBe(mockTable.isError)
    expect(result.error).toBe(mockTable.error)
    expect(result.refresh).toBe(mockTable.refresh)
  })

  it('no longer re-exports paginateRows / PaginatedRows (dropped re-export)', async () => {
    const mod = await import('@/features/admin/employees/composables/useExpiringDocuments')
    expect('paginateRows' in mod).toBe(false)
    expect('PaginatedRows' in mod).toBe(false)
  })
})
