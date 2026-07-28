/**
 * WU-12 — employees-batch-operations
 *
 * Strict TDD — Phase 2 RED specs for the composables:
 * 1. useEmployeesList — rowSelection / selectedEmployees / clearSelection()
 * 2. useBatchDeleteEmployee — 200/404/403 dispatch
 * 3. useBatchTerminateEmployee — same dispatch with reason
 * 4. useBatchReactivateEmployee — same dispatch
 *
 * All RED tests reference production code that does NOT yet exist.
 *
 * Testing strategy:
 * - useEmployeesList: state-only extensions (rowSelection, selectedEmployees,
 *   clearSelection). The composable imports useQuery/useQueryClient from
 *   TanStack, but our new code adds ONLY refs + computed + a fn, so we can
 *   mock the query layer to return a stable shape.
 * - Mutation composables (useBatch*): we mock `useMutation` and capture the
 *   onSuccess/onError callbacks via the factory spy. We invoke those
 *   callbacks manually and assert toast + queryClient.invalidateQueries
 *   were called. This avoids the complexity of mounting a Vue Query
 *   plugin while still proving the dispatch contract.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { ref } from 'vue'
import { setActivePinia, createPinia } from 'pinia'

// ── Mock @tanstack/vue-query BEFORE the composables import it ─────────────────
//
// Pattern: capture the options passed to useMutation so tests can invoke
// onSuccess/onError directly. This lets us assert the dispatch contract
// (toast color/title, queryClient.invalidateQueries, selection state) without
// standing up a full Vue app or letting the mutation actually fire.
const { mutationOptionsCalls, invalidateCalls } = vi.hoisted(() => ({
  mutationOptionsCalls: [] as Array<{
    onSuccess?: (data: unknown, vars: unknown) => void
    onError?: (err: unknown, vars: unknown) => void
    mutationFn?: (vars: unknown) => unknown
  }>,
  invalidateCalls: [] as Array<{ queryKey: unknown[] }>,
}))

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: (cfg: { queryKey: unknown[] }) => {
        invalidateCalls.push(cfg)
      },
    }),
    useQuery: vi.fn((opts: unknown) => {
      const config = opts as {
        queryKey: { value: unknown }
        queryFn: () => unknown
        enabled: { value: boolean }
      }
      return {
        data: ref(null),
        isLoading: ref(false),
        isFetching: ref(false),
        refetch: vi.fn(),
        // Capture config so tests can assert query gating / key shape.
        __config: config,
      }
    }),
    useMutation: vi.fn((opts: unknown) => {
      const config = opts as {
        mutationFn: (vars: unknown) => unknown
        onSuccess?: (data: unknown, vars: unknown) => void
        onError?: (err: unknown, vars: unknown) => void
      }
      mutationOptionsCalls.push(config)
      return {
        mutateAsync: config.mutationFn,
        mutate: config.mutationFn,
        isPending: ref(false),
        error: ref(null),
      }
    }),
  }
})

// ── Mock auth store ───────────────────────────────────────────────────────────
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    currentTenantId: 'tenant-test',
  }),
}))

// ── Mock Nuxt UI useToast ────────────────────────────────────────────────────
const { toastCalls } = vi.hoisted(() => ({ toastCalls: [] as Array<Record<string, unknown>> }))
vi.mock('@nuxt/ui/runtime/composables/useToast', () => ({
  useToast: () => ({
    add: (opts: Record<string, unknown>) => {
      toastCalls.push(opts)
    },
  }),
}))

// ── Task 2.1/2.2: useEmployeesList extension ─────────────────────────────────
import { useEmployeesList } from '@/features/admin/employees/composables/useEmployeesList'

// ── Task 2.3/2.4: useBatchDeleteEmployee ─────────────────────────────────────
import { useBatchDeleteEmployee } from '@/features/admin/employees/composables/useBatchDeleteEmployee'

// ── Task 2.5/2.6: useBatchTerminateEmployee ──────────────────────────────────
import { useBatchTerminateEmployee } from '@/features/admin/employees/composables/useBatchTerminateEmployee'

// ── Task 2.7/2.8: useBatchReactivateEmployee ─────────────────────────────────
import { useBatchReactivateEmployee } from '@/features/admin/employees/composables/useBatchReactivateEmployee'

// ── Supporting imports ────────────────────────────────────────────────────────
import { employeesApi } from '@/features/admin/employees/api/employees.api'
import type { Employee } from '@/features/admin/employees/interfaces/employee.types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: `emp-${Math.random().toString(36).slice(2, 8)}`,
    employeeNumber: 'EMP-001',
    fullName: 'Juan García',
    email: 'juan@empresa.com',
    status: 'ACTIVE',
    contractType: 'PERMANENT',
    workModality: 'HYBRID',
    currentPosition: 'Analista',
    currentDepartment: 'Finanzas',
    managerId: null,
    hireDate: '2026-01-15',
    terminationDate: null,
    photoFileId: null,
    cvFileId: null,
    ...overrides,
  }
}

function getLatestMutationConfig() {
  return mutationOptionsCalls[mutationOptionsCalls.length - 1]
}

// ─── useEmployeesList — row selection extension (Task 2.1/2.2) ────────────────

describe('useEmployeesList — row selection extension (Task 2.1/2.2)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('exposes rowSelection ref (empty by default)', () => {
    const { rowSelection } = useEmployeesList()
    expect(rowSelection).toBeDefined()
    expect(rowSelection.value).toEqual({})
  })

  it('exposes selectedEmployees computed (empty when no row selected)', () => {
    const { selectedEmployees } = useEmployeesList()
    expect(selectedEmployees.value).toEqual([])
  })

  it('exposes clearSelection function', () => {
    const { clearSelection } = useEmployeesList()
    expect(typeof clearSelection).toBe('function')
  })

  it('clearSelection empties rowSelection', () => {
    const { rowSelection, clearSelection } = useEmployeesList()
    rowSelection.value = { 'emp-1': true }
    expect(rowSelection.value).toEqual({ 'emp-1': true })
    clearSelection()
    expect(rowSelection.value).toEqual({})
  })

  it('selectedEmployees derives from rowSelection filtered against employees list', () => {
    const { rowSelection, selectedEmployees } = useEmployeesList()
    // Note: in this minimal mock, employees.value starts empty. Setting
    // rowSelection keys won't populate selectedEmployees because employees
    // is empty. The derived contract is: selectedEmployees = employees
    // filtered by rowSelection. This is enforced by the view test in Phase 4.
    rowSelection.value = { 'nonexistent-id': true }
    expect(selectedEmployees.value).toEqual([])
  })
})

// ─── useBatchDeleteEmployee — 200/404/403 dispatch (Task 2.3/2.4) ─────────────

describe('useBatchDeleteEmployee — response dispatch (Task 2.3/2.4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mutationOptionsCalls.length = 0
    invalidateCalls.length = 0
    toastCalls.length = 0
  })

  it('returns mutateAsync and isPending', () => {
    const result = useBatchDeleteEmployee()
    expect(typeof result.mutateAsync).toBe('function')
    expect(result.isPending).toBeDefined()
    expect(result.isPending.value).toBe(false)
  })

  it('200 success → success toast with count and invalidateQueries fires', async () => {
    useBatchDeleteEmployee()
    const config = getLatestMutationConfig()
    expect(config?.onSuccess).toBeDefined()

    config!.onSuccess!({ deleted: 3 }, ['a', 'b', 'c'])

    const successToast = toastCalls.find((t) => t.color === 'success')
    expect(successToast).toBeDefined()
    expect(successToast?.title).toContain('3')

    // queryClient.invalidateQueries was called
    expect(invalidateCalls.length).toBeGreaterThan(0)
    // First call should target the paginated key
    expect(JSON.stringify(invalidateCalls[0]?.queryKey)).toContain('paginated')
  })

  it('404 BATCH_DELETE_NOT_FOUND → warning toast + invalidateQueries fires', async () => {
    useBatchDeleteEmployee()
    const config = getLatestMutationConfig()

    const axiosError = {
      response: {
        status: 404,
        data: { error: 'BATCH_DELETE_NOT_FOUND', offendingIds: ['a'] },
      },
    }
    config!.onError!(axiosError, ['a'])

    const warningToast = toastCalls.find((t) => t.color === 'warning')
    expect(warningToast).toBeDefined()
    expect(invalidateCalls.length).toBeGreaterThan(0)
  })

  it('403 INSUFFICIENT_PERMISSIONS → error toast, NO invalidateQueries', async () => {
    useBatchDeleteEmployee()
    const config = getLatestMutationConfig()

    const axiosError = {
      response: {
        status: 403,
        data: { error: 'INSUFFICIENT_PERMISSIONS' },
      },
    }
    config!.onError!(axiosError, ['a'])

    const errorToast = toastCalls.find((t) => t.color === 'error')
    expect(errorToast).toBeDefined()
    // Selection preserved — no invalidateQueries fires for 403
    expect(invalidateCalls.length).toBe(0)
  })

  it('mutationFn delegates to employeesApi.batchDelete', async () => {
    const spy = vi.spyOn(employeesApi, 'batchDelete').mockResolvedValueOnce({ deleted: 1 })
    useBatchDeleteEmployee()
    const config = getLatestMutationConfig()
    await config!.mutationFn!(['a'])
    expect(spy).toHaveBeenCalledWith(['a'])
  })
})

// ─── useBatchTerminateEmployee — same dispatch with reason (Task 2.5/2.6) ─────

describe('useBatchTerminateEmployee — same dispatch (Task 2.5/2.6)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mutationOptionsCalls.length = 0
    invalidateCalls.length = 0
    toastCalls.length = 0
  })

  it('returns mutateAsync(ids, reason) and isPending', () => {
    const result = useBatchTerminateEmployee()
    expect(typeof result.mutateAsync).toBe('function')
    expect(result.isPending).toBeDefined()
  })

  it('200 success → success toast with count', () => {
    useBatchTerminateEmployee()
    const config = getLatestMutationConfig()
    config!.onSuccess!({ updated: 5 }, { ids: ['a', 'b', 'c', 'd', 'e'], reason: 'Reorg' })

    const successToast = toastCalls.find((t) => t.color === 'success')
    expect(successToast).toBeDefined()
    expect(successToast?.title).toContain('5')
    expect(successToast?.title).toContain('dados de baja')
  })

  it('404 BATCH_DELETE_NOT_FOUND → warning toast', () => {
    useBatchTerminateEmployee()
    const config = getLatestMutationConfig()

    const axiosError = {
      response: {
        status: 404,
        data: { error: 'BATCH_DELETE_NOT_FOUND', offendingIds: ['a'] },
      },
    }
    config!.onError!(axiosError, { ids: ['a'], reason: 'Reorg' })

    expect(toastCalls.find((t) => t.color === 'warning')).toBeDefined()
  })

  it('403 INSUFFICIENT_PERMISSIONS → error toast', () => {
    useBatchTerminateEmployee()
    const config = getLatestMutationConfig()

    const axiosError = {
      response: {
        status: 403,
        data: { error: 'INSUFFICIENT_PERMISSIONS' },
      },
    }
    config!.onError!(axiosError, { ids: ['a'], reason: 'Reorg' })

    expect(toastCalls.find((t) => t.color === 'error')).toBeDefined()
  })

  it('mutationFn delegates to employeesApi.batchTerminate with reason', async () => {
    const spy = vi.spyOn(employeesApi, 'batchTerminate').mockResolvedValueOnce({ updated: 1 })
    useBatchTerminateEmployee()
    const config = getLatestMutationConfig()
    await config!.mutationFn!({ ids: ['a'], reason: 'Reorg' })
    expect(spy).toHaveBeenCalledWith(['a'], 'Reorg')
  })
})

// ─── useBatchReactivateEmployee — same dispatch (Task 2.7/2.8) ────────────────

describe('useBatchReactivateEmployee — same dispatch (Task 2.7/2.8)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mutationOptionsCalls.length = 0
    invalidateCalls.length = 0
    toastCalls.length = 0
  })

  it('returns mutateAsync(ids) and isPending', () => {
    const result = useBatchReactivateEmployee()
    expect(typeof result.mutateAsync).toBe('function')
    expect(result.isPending).toBeDefined()
  })

  it('200 success → success toast with count', () => {
    useBatchReactivateEmployee()
    const config = getLatestMutationConfig()
    config!.onSuccess!({ updated: 2 }, ['a', 'b'])

    const successToast = toastCalls.find((t) => t.color === 'success')
    expect(successToast).toBeDefined()
    expect(successToast?.title).toContain('2')
    expect(successToast?.title).toContain('reactivados')
  })

  it('404 BATCH_DELETE_NOT_FOUND → warning toast', () => {
    useBatchReactivateEmployee()
    const config = getLatestMutationConfig()

    const axiosError = {
      response: {
        status: 404,
        data: { error: 'BATCH_DELETE_NOT_FOUND', offendingIds: ['a'] },
      },
    }
    config!.onError!(axiosError, ['a'])

    expect(toastCalls.find((t) => t.color === 'warning')).toBeDefined()
  })

  it('403 INSUFFICIENT_PERMISSIONS → error toast', () => {
    useBatchReactivateEmployee()
    const config = getLatestMutationConfig()

    const axiosError = {
      response: {
        status: 403,
        data: { error: 'INSUFFICIENT_PERMISSIONS' },
      },
    }
    config!.onError!(axiosError, ['a'])

    expect(toastCalls.find((t) => t.color === 'error')).toBeDefined()
  })

  it('mutationFn delegates to employeesApi.batchReactivate', async () => {
    const spy = vi.spyOn(employeesApi, 'batchReactivate').mockResolvedValueOnce({ updated: 1 })
    useBatchReactivateEmployee()
    const config = getLatestMutationConfig()
    await config!.mutationFn!(['a'])
    expect(spy).toHaveBeenCalledWith(['a'])
  })
})
