import { computed, defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import { defineFiltersSchema } from '../../schema/defineFiltersSchema'
import { filter } from '../../schema/filterFactories'
import { useFiltersUrlAdapter } from '../useFiltersUrlAdapter'

const schema = defineFiltersSchema([
  filter.multiEnum({ id: 'paymentStatus', label: 'Estado', param: 'paymentStatus', options: [] }),
  filter.numericRange({ id: 'total', label: 'Total', minParam: 'totalMin', maxParam: 'totalMax' }),
])

describe('useFiltersUrlAdapter', () => {
  it('read/write preserves non schema query params', async () => {
    let adapter!: ReturnType<typeof useFiltersUrlAdapter>
    const Harness = defineComponent({ setup() { adapter = useFiltersUrlAdapter(schema); return () => null } })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Harness }] })
    await router.push('/?page=2&sort=desc&paymentStatus=PAID')
    await router.isReady()
    mount(Harness, { global: { plugins: [router] } })
    expect(adapter.read().paymentStatus).toEqual(['PAID'])
    const replaceSpy = vi.spyOn(router, 'replace')
    adapter.write({ ...schema.defaults(), paymentStatus: ['PARTIAL'] })
    await nextTick()
    expect(replaceSpy).toHaveBeenCalled()
    const last = replaceSpy.mock.calls[replaceSpy.mock.calls.length - 1]?.[0] as { query: Record<string, string> }
    expect(last.query.page).toBe('2')
    expect(last.query.sort).toBe('desc')
    expect(last.query.paymentStatus).toBe('PARTIAL')
  })

  it('loop guard ignores same canonical route updates', async () => {
    let adapter!: ReturnType<typeof useFiltersUrlAdapter>
    let cb = vi.fn()
    const Harness = defineComponent({ setup() { adapter = useFiltersUrlAdapter(schema); adapter.watch(cb); return () => null } })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Harness }] })
    await router.push('/?paymentStatus=PAID')
    await router.isReady()
    mount(Harness, { global: { plugins: [router] } })
    adapter.write({ ...schema.defaults(), paymentStatus: ['PAID'] })
    await router.replace('/?paymentStatus=PAID')
    await nextTick()
    expect(cb).not.toHaveBeenCalled()
  })

  it('router optional fallback does not throw', () => {
    const adapter = useFiltersUrlAdapter(schema)
    expect(() => adapter.write(schema.defaults())).not.toThrow()
  })

  it('uses latest schema when schema is reactive', async () => {
    let adapter!: ReturnType<typeof useFiltersUrlAdapter>
    const useV2 = ref(false)
    const reactiveSchema = computed(() => defineFiltersSchema([
      filter.multiEnum({ id: 'paymentStatus', label: 'Estado', param: useV2.value ? 'paymentStatusV2' : 'paymentStatus', options: [] }),
    ]))

    const Harness = defineComponent({ setup() { adapter = useFiltersUrlAdapter(reactiveSchema); return () => null } })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Harness }] })

    await router.push('/?paymentStatus=PAID')
    await router.isReady()
    mount(Harness, { global: { plugins: [router] } })

    expect(adapter.read().paymentStatus).toEqual(['PAID'])

    useV2.value = true
    await nextTick()

    const replaceSpy = vi.spyOn(router, 'replace')
    adapter.write({ paymentStatus: ['PARTIAL'] })
    await nextTick()

    const last = replaceSpy.mock.calls[replaceSpy.mock.calls.length - 1]?.[0] as { query: Record<string, string> }
    expect(last.query.paymentStatusV2).toBe('PARTIAL')
  })
})
