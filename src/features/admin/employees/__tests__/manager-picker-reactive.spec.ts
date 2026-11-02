import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { employeeQueryKeys } from '@/core/shared/constants/query-keys'
import { useManagerPicker, type UseManagerPickerOptions } from '../composables/useManagerPicker'
import type { Employee } from '../interfaces/employee.types'

const api = vi.hoisted(() => ({ listForPicker: vi.fn() }))
vi.mock('../api/employees.api', () => ({ employeesApi: api }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => ({ currentTenantId: 'tenant' }) }))
const raw = ['Luis', 'Maria', 'Raul'].map((name) => ({ id: name, fullName: name, currentPosition: 'Position', currentDepartment: 'Department' }) as Employee)
const wrappers: VueWrapper[] = []
const clients: QueryClient[] = []
afterEach(() => { wrappers.forEach(w => w.unmount()); clients.forEach(c => c.clear()); wrappers.length = 0; clients.length = 0; vi.clearAllMocks(); vi.useRealTimers() })

function setup(options: UseManagerPickerOptions = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  client.setQueryData(employeeQueryKeys.activeForPicker('tenant', ''), raw)
  let picker!: ReturnType<typeof useManagerPicker>
  wrappers.push(mount(defineComponent({ setup() { picker = useManagerPicker(options); return () => h('div', picker.managers.value.map(m => m.label).join(',')) } }), {
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]] },
  }))
  return { picker, client }
}

describe('manager picker reactive exclusion', () => {
  it('reacts to null, employee switches and cached reopen without mutating shared data', async () => {
    const employeeId = ref<string | null>(null)
    const { picker, client } = setup({ excludeId: () => employeeId.value })
    expect(picker.managers.value.map(m => m.id)).toEqual(['Luis', 'Maria', 'Raul'])
    for (const id of ['Luis', 'Raul', 'Luis']) {
      employeeId.value = id
      picker.isOpen.value = true
      await flushPromises()
      expect(picker.managers.value.map(m => m.id)).toEqual(raw.filter(e => e.id !== id).map(e => e.id))
      picker.isOpen.value = false
      await flushPromises()
    }
    expect(client.getQueryData(employeeQueryKeys.activeForPicker('tenant', ''))).toEqual(raw)
    expect(api.listForPicker).not.toHaveBeenCalled()
  })

  it('does not merge self back while preserving legitimate selected manager labels', () => {
    const selected = ref({ id: 'Luis', label: 'Luis', position: '', department: '' })
    const { picker, client } = setup({ excludeId: 'Luis', currentManager: () => selected.value })
    expect(picker.managers.value.some(m => m.id === 'Luis')).toBe(false)
    selected.value = { id: 'external', label: 'Current manager', position: '', department: '' }
    expect(picker.managers.value[0]?.label).toBe('Current manager')
    selected.value = { id: 'Maria', label: 'Maria', position: '', department: '' }
    expect(picker.managers.value.filter(m => m.id === 'Maria')).toHaveLength(1)
    expect(client.getQueryData(employeeQueryKeys.activeForPicker('tenant', ''))).toEqual(raw)
  })

  it.each([undefined, null, 'Luis'])('preserves scalar/create exclusion %s', excludeId => {
    const { picker } = setup({ excludeId })
    expect(picker.managers.value.map(m => m.id)).toEqual(excludeId ? ['Maria', 'Raul'] : ['Luis', 'Maria', 'Raul'])
  })

  it('filters a delayed search response against the latest employee', async () => {
    vi.useFakeTimers()
    let resolve!: (value: Employee[]) => void
    api.listForPicker.mockReturnValue(new Promise<Employee[]>(r => { resolve = r }))
    const id = ref('Luis')
    const { picker } = setup({ excludeId: id })
    picker.search.value = 'Raul'
    await flushPromises()
    await vi.advanceTimersByTimeAsync(300)
    id.value = 'Raul'
    resolve(raw)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(0)
    expect(api.listForPicker).toHaveBeenCalledWith('Raul')
    expect(picker.managers.value.map(m => m.id)).toEqual(['Luis', 'Maria'])
  })
})
