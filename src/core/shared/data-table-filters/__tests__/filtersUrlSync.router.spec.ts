import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { afterEach, describe, expect, it } from 'vitest'
import { defineFiltersSchema } from '../schema/defineFiltersSchema'
import { filter } from '../schema/filterFactories'
import { useFiltersUrlAdapter } from '../composables/useFiltersUrlAdapter'
import { useDataTableFilters } from '../composables/useDataTableFilters'

// U7 / customers-module L15: the URL adapter must own only its filter params.
// Another query writer (sort/page/tab…) must not wipe a filter change that is
// still waiting for the debounced URL write, while real URL navigation that
// changes the filter params (back/forward, shared links) still drives state.

const DEBOUNCE_MS = 40

const schema = defineFiltersSchema([
  filter.multiEnum({ id: 'paymentStatus', label: 'Estado', param: 'paymentStatus', options: [] }),
  filter.numericRange({ id: 'total', label: 'Total', minParam: 'totalMin', maxParam: 'totalMax' }),
])

type Ctl = ReturnType<typeof useDataTableFilters>

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const afterDebounce = async () => {
  await sleep(DEBOUNCE_MS * 2)
  await flushPromises()
}

const mounted: Array<{ unmount: () => void }> = []
afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
})

async function setup(initialUrl: string): Promise<{ router: Router, ctl: Ctl }> {
  let ctl!: Ctl
  const Harness = defineComponent({
    setup() {
      const adapter = useFiltersUrlAdapter(schema)
      ctl = useDataTableFilters(schema, adapter, { debounceMs: DEBOUNCE_MS })
      return () => null
    },
  })
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: Harness }] })
  await router.push(initialUrl)
  await router.isReady()
  mounted.push(mount(Harness, { global: { plugins: [router] } }))
  await flushPromises()
  return { router, ctl }
}

async function navigateHistory(router: Router, delta: number) {
  const done = new Promise<void>(resolve => {
    const remove = router.afterEach(() => {
      remove()
      resolve()
    })
  })
  router.go(delta)
  await done
  await flushPromises()
}

describe('filters URL sync with a real router', () => {
  it('an unrelated query writer does not wipe a pending filter change (empty URL)', async () => {
    const { router, ctl } = await setup('/')

    ctl.setFieldValue('paymentStatus', ['PAID'])
    // Another writer replaces the whole query before the debounce flushes.
    await router.replace({ query: { sort: 'x' } })
    await flushPromises()

    expect(ctl.state.value.paymentStatus).toEqual(['PAID'])

    await afterDebounce()
    expect(router.currentRoute.value.query).toEqual({ sort: 'x', paymentStatus: 'PAID' })
    expect(ctl.state.value.paymentStatus).toEqual(['PAID'])
  })

  it('an unrelated query writer that keeps filter params does not revert a pending change', async () => {
    const { router, ctl } = await setup('/?paymentStatus=PAID')

    ctl.setFieldValue('paymentStatus', ['PARTIAL'])
    await router.replace({ query: { ...router.currentRoute.value.query, page: '2' } })
    await flushPromises()

    expect(ctl.state.value.paymentStatus).toEqual(['PARTIAL'])

    await afterDebounce()
    expect(router.currentRoute.value.query).toEqual({ page: '2', paymentStatus: 'PARTIAL' })
  })

  it('the debounced write merges with unrelated params written meanwhile', async () => {
    const { router, ctl } = await setup('/?tab=ventas')

    ctl.setFieldValue('total', { min: 10 })
    await router.replace({ query: { ...router.currentRoute.value.query, sort: 'createdAt:desc' } })
    await afterDebounce()

    expect(router.currentRoute.value.query).toEqual({ tab: 'ventas', sort: 'createdAt:desc', totalMin: '10' })
  })

  it('keeps the debounce: the URL is not written before the debounce elapses', async () => {
    const { router, ctl } = await setup('/')

    ctl.setFieldValue('paymentStatus', ['PAID'])
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})

    await afterDebounce()
    expect(router.currentRoute.value.query).toEqual({ paymentStatus: 'PAID' })
  })

  it('a shared link with filter params hydrates state and keeps unrelated params', async () => {
    const { router, ctl } = await setup('/?paymentStatus=PAID&totalMin=10&sort=x')

    expect(ctl.state.value.paymentStatus).toEqual(['PAID'])
    expect(ctl.state.value.total).toEqual({ min: 10 })

    await afterDebounce()
    expect(router.currentRoute.value.query).toEqual({ paymentStatus: 'PAID', totalMin: '10', sort: 'x' })
  })

  it('back/forward navigation that changes filter params updates state', async () => {
    const { router, ctl } = await setup('/?paymentStatus=PAID')

    await router.push('/?paymentStatus=PARTIAL&sort=x')
    await flushPromises()
    expect(ctl.state.value.paymentStatus).toEqual(['PARTIAL'])

    await navigateHistory(router, -1)
    expect(router.currentRoute.value.query).toEqual({ paymentStatus: 'PAID' })
    expect(ctl.state.value.paymentStatus).toEqual(['PAID'])

    await navigateHistory(router, 1)
    expect(ctl.state.value.paymentStatus).toEqual(['PARTIAL'])

    await afterDebounce()
    expect(router.currentRoute.value.query).toEqual({ paymentStatus: 'PARTIAL', sort: 'x' })
  })

  it('back navigation to a URL without filter params clears state', async () => {
    const { router, ctl } = await setup('/?sort=x')

    await router.push('/?sort=x&paymentStatus=PAID')
    await flushPromises()
    expect(ctl.state.value.paymentStatus).toEqual(['PAID'])

    await navigateHistory(router, -1)
    expect(ctl.state.value.paymentStatus).toEqual([])
  })

  it('back navigation that only changes unrelated params keeps applied filters', async () => {
    const { router, ctl } = await setup('/?paymentStatus=PAID&page=1')

    await router.push('/?paymentStatus=PAID&page=2')
    await flushPromises()
    await navigateHistory(router, -1)

    expect(ctl.state.value.paymentStatus).toEqual(['PAID'])
  })
})
