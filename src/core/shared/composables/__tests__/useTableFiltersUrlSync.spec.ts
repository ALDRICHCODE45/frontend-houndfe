import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useTableFiltersUrlSync } from '../useTableFiltersUrlSync'
import type { FilterDefinition } from '@/core/shared/components/data-table-filters/types'

const schema: FilterDefinition[] = [
  {
    kind: 'multi-enum',
    id: 'paymentStatus',
    label: 'Estado de pago',
    param: 'paymentStatus',
    options: [],
  },
  {
    kind: 'multi-uuid',
    id: 'customers',
    label: 'Clientes',
    param: 'customerIds',
    options: [],
  },
  {
    kind: 'number-range',
    id: 'total',
    label: 'Total',
    minParam: 'totalMin',
    maxParam: 'totalMax',
  },
  {
    kind: 'date-range',
    id: 'confirmedAt',
    label: 'Confirmada',
    fromParam: 'confirmedFrom',
    toParam: 'confirmedTo',
  },
]

function createHarness(routerOptions: { path?: string } = {}) {
  const state = ref<Record<string, unknown>>({
    paymentStatus: [],
    customerIds: [],
    totalMin: undefined,
    totalMax: undefined,
    confirmedFrom: undefined,
    confirmedTo: undefined,
    includeDebt: false,
  })

  const Harness = defineComponent({
    setup() {
      useTableFiltersUrlSync(state, { schema })
      return { state }
    },
    template: '<div />',
  })

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/sales', component: Harness }],
  })

  return { router, Harness, state, path: routerOptions.path ?? '/sales' }
}

describe('useTableFiltersUrlSync', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('hydrates state from URL query on mount', async () => {
    const { router, Harness, state } = createHarness({
      path: '/sales?paymentStatus=PAID,PARTIAL&customerIds=uuid-a,uuid-b&totalMin=100&totalMax=900&confirmedFrom=2026-01-01T00:00:00.000Z&confirmedTo=2026-01-31T23:59:59.999Z',
    })

    await router.push('/sales?paymentStatus=PAID,PARTIAL&customerIds=uuid-a,uuid-b&totalMin=100&totalMax=900&confirmedFrom=2026-01-01T00:00:00.000Z&confirmedTo=2026-01-31T23:59:59.999Z')
    await router.isReady()
    const wrapper = mount(Harness, { global: { plugins: [router] } })
    expect(wrapper.exists()).toBe(true)
    await nextTick()
    await nextTick()

    expect(state.value.paymentStatus).toEqual(['PAID', 'PARTIAL'])
    expect(state.value.customerIds).toEqual(['uuid-a', 'uuid-b'])
    expect(state.value.totalMin).toBe(100)
    expect(state.value.totalMax).toBe(900)
    expect(state.value.confirmedFrom).toBe('2026-01-01T00:00:00.000Z')
    expect(state.value.confirmedTo).toBe('2026-01-31T23:59:59.999Z')
  })

  it('serializes state into route query while preserving other params', async () => {
    vi.useFakeTimers()
    const { router, Harness, state } = createHarness()
    const replaceSpy = vi.spyOn(router, 'replace')
    await router.push('/sales?page=2&sort=folio:desc')
    await router.isReady()
    mount(Harness, { global: { plugins: [router] } })

    state.value = {
      ...state.value,
      paymentStatus: ['PAID', 'PARTIAL'],
      totalMin: 500,
      confirmedFrom: '2026-02-01T00:00:00.000Z',
      includeDebt: true,
    }

    await nextTick()
    vi.advanceTimersByTime(120)
    await Promise.resolve()
    await nextTick()

    const call = replaceSpy.mock.calls[replaceSpy.mock.calls.length - 1]
    expect(call?.[0]).toMatchObject({
      query: {
        page: '2',
        sort: 'folio:desc',
        paymentStatus: 'PAID,PARTIAL',
        totalMin: '500',
        confirmedFrom: '2026-02-01T00:00:00.000Z',
      },
    })
  })

  it('restores state when route changes (popstate/back-forward)', async () => {
    const { router, Harness, state } = createHarness()
    await router.push('/sales?paymentStatus=PAID')
    await router.isReady()
    mount(Harness, { global: { plugins: [router] } })
    await nextTick()

    expect(state.value.paymentStatus).toEqual(['PAID'])

    await router.push('/sales?paymentStatus=PARTIAL')
    await nextTick()
    expect(state.value.paymentStatus).toEqual(['PARTIAL'])

    await router.back()
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()

    expect(state.value.paymentStatus).toEqual(['PAID'])
  })

  it('is a no-op when router is not available', () => {
    const state = ref<Record<string, unknown>>({ paymentStatus: [] })

    expect(() => {
      useTableFiltersUrlSync(state, { schema, routerOptional: true })
      state.value.paymentStatus = ['PAID']
    }).not.toThrow()
  })
})
