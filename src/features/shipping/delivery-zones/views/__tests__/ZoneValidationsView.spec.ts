import { defineComponent, h, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ZoneValidationsView from '../ZoneValidationsView.vue'
import { zoneValidationsApi } from '../../api/deliveryZones.api'

vi.mock('../../api/deliveryZones.api', () => ({
  deliveryZonesApi: { list: vi.fn(), upsert: vi.fn(), deactivate: vi.fn() },
  zoneValidationsApi: { list: vi.fn(), get: vi.fn(), resolve: vi.fn() },
}))
const holder = vi.hoisted(() => ({ auth: null as unknown as { grants: string[]; currentTenantId: string; userCan: (a: string, s: string) => boolean; logout: ReturnType<typeof vi.fn> } }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => holder.auth }))

const HOUR = 3_600_000
const pending = (patch: Record<string, unknown>) => {
  const hoursLeft = (patch.hoursLeft as number | undefined) ?? 20
  return {
    id: `val-${String(patch.zipCode)}`, zipCode: '', state: 'Ciudad de México', municipality: 'Cuauhtémoc', neighborhood: 'Juárez',
    status: 'PENDING', version: 1, createdAt: '2026-11-05T13:40:55.006Z', requesterCount: 1,
    lastCustomerMessageAt: new Date(Date.now() - (24 - hoursLeft) * HOUR).toISOString(),
    urgency: { deadlineAt: new Date(Date.now() + hoursLeft * HOUR).toISOString(), hoursLeft, level: 'OK' },
    resolution: null,
    ...patch,
  }
}
const queue = [
  pending({ zipCode: '03900', hoursLeft: 2.5, neighborhood: 'San José Insurgentes', municipality: 'Benito Juárez' }),
  pending({ zipCode: '06600', hoursLeft: 8.5, requesterCount: 2 }),
  pending({ zipCode: '04510', hoursLeft: 21.5, neighborhood: 'Ciudad Universitaria', municipality: 'Coyoacán' }),
  pending({ zipCode: '07000', hoursLeft: -1 }),
]
const page = (data: unknown[]) => ({ data, pagination: { pageIndex: 0, pageSize: 20, totalCount: data.length, pageCount: data.length ? 1 : 0 } })
const resolved = {
  ...queue[1], status: 'RESOLVED', version: 2, lastCustomerMessageAt: null, urgency: null,
  resolution: { action: 'APPROVE_DELIVERY_ZONE', zoneType: 'SURCHARGE', surchargeCents: 8900, etaDays: 3, resolvedAt: '2026-11-06T18:00:00.000Z', resolvedBy: { id: 'u2', displayName: 'Ana Gerente' } },
}

const Overlay = defineComponent({ props: ['open'], setup(props, { slots }) { return () => (props.open ? h('section', { 'data-overlay': '' }, [slots.description?.(), slots.body?.(), slots.footer?.()]) : null) } })
const dispose: Array<() => void> = []

async function setup(query: Record<string, string> = {}, grants = ['validate']) {
  holder.auth = reactive({
    grants, currentTenantId: 'tenant-1',
    userCan(action: string, subject: string) { return subject === 'DeliveryZone' && this.grants.includes(action) },
    logout: vi.fn(async () => {}),
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/sistema/envios/validaciones', component: ZoneValidationsView },
    { path: '/login', component: { template: '<div />' } },
  ] })
  await router.push({ path: '/sistema/envios/validaciones', query })
  const root = mount(defineComponent({ setup: () => () => h(UApp, null, { default: () => h('main', [h(ZoneValidationsView)]) }) }), {
    global: { plugins: [router, [VueQueryPlugin, { queryClient: client }]], stubs: { USlideover: Overlay, Slideover: Overlay } },
  })
  dispose.push(() => { root.unmount(); client.clear() })
  await flushPromises()
  return { wrapper: root.findComponent(ZoneValidationsView), router }
}

beforeEach(() => {
  vi.mocked(zoneValidationsApi.list).mockReset().mockImplementation(async (params) =>
    page(params.zipCode ? queue.filter((v) => v.zipCode === params.zipCode) : queue) as never)
  vi.mocked(zoneValidationsApi.get).mockReset().mockImplementation(async (id) => queue.find((v) => v.id === id) as never)
  vi.mocked(zoneValidationsApi.resolve).mockReset()
})
afterEach(() => { dispose.splice(0).forEach((fn) => fn()); document.body.innerHTML = '' })

const rowOf = (wrapper: Awaited<ReturnType<typeof setup>>['wrapper'], zip: string) =>
  wrapper.findAll('tbody tr').find((row) => row.text().includes(zip))!

describe('ZoneValidationsView queue', () => {
  it('lists the queue in server order with live countdown, urgency, requesters and last message', async () => {
    const { wrapper } = await setup()
    const rows = wrapper.findAll('tbody tr')
    expect(rows.map((row) => row.text().match(/\d{5}/)?.[0])).toEqual(['03900', '06600', '04510', '07000'])
    expect(rowOf(wrapper, '03900').text()).toContain('Urgente')
    expect(rowOf(wrapper, '03900').text()).toMatch(/Quedan 2 h (29|30) min/)
    expect(rowOf(wrapper, '06600').text()).toContain('Vence pronto')
    expect(rowOf(wrapper, '06600').text()).toContain('2 clientes')
    expect(rowOf(wrapper, '04510').text()).toContain('A tiempo')
    expect(rowOf(wrapper, '04510').text()).toContain('1 cliente')
    expect(rowOf(wrapper, '07000').text()).toContain('Plazo vencido')
    expect(wrapper.text()).not.toContain('val-')
  })

  it('shows the empty state when nothing is pending, and the error state with Reintentar', async () => {
    vi.mocked(zoneValidationsApi.list).mockResolvedValue(page([]) as never)
    const { wrapper } = await setup()
    expect(wrapper.find('.hf-empty-state').text()).toContain('No hay validaciones pendientes')
    dispose.splice(0).forEach((fn) => fn())

    vi.mocked(zoneValidationsApi.list).mockRejectedValue({ response: { status: 500, data: {} } })
    const failed = await setup()
    expect(failed.wrapper.find('[data-testid="table-error-state"]').text()).toContain('No se pudieron cargar las validaciones')
  })

  it('opens a row in the drawer and keeps it in ?validation=', async () => {
    const { wrapper, router } = await setup()
    await rowOf(wrapper, '06600').get('button.hf-row-primary').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ validation: 'val-06600' })
    expect(wrapper.get('[data-overlay]').text()).toContain('2 clientes esperan respuesta')
  })
})

describe('ZoneValidationsView deep links', () => {
  it('opens ?validation=<id> directly', async () => {
    const { wrapper } = await setup({ validation: 'val-04510' })
    expect(zoneValidationsApi.get).toHaveBeenCalledWith('val-04510', expect.anything())
    expect(wrapper.get('[data-overlay]').text()).toContain('Ciudad Universitaria')
  })

  it('finds the pending validation of ?zipCode= and opens it', async () => {
    const { router } = await setup({ zipCode: '06600' })
    expect(zoneValidationsApi.list).toHaveBeenCalledWith({ page: 1, limit: 1, zipCode: '06600' }, expect.anything())
    expect(router.currentRoute.value.query).toEqual({ validation: 'val-06600' })
  })

  it('says so when the postal code has nothing pending', async () => {
    const { wrapper, router } = await setup({ zipCode: '11000' })
    expect(wrapper.text()).toContain('No hay una validación pendiente para el código postal 11000.')
    expect(router.currentRoute.value.query).toEqual({})
  })
})

describe('ZoneValidationsView resolve', () => {
  async function decide(wrapper: Awaited<ReturnType<typeof setup>>['wrapper'], choice: string) {
    await wrapper.findAll('[data-overlay] [role="radio"]').find((radio) => radio.text() === choice)!.trigger('click')
  }

  it('approves with a surcharge in pesos, the days, expectedVersion and a request id', async () => {
    vi.mocked(zoneValidationsApi.resolve).mockResolvedValue({ validation: resolved, zone: {} } as never)
    const { wrapper } = await setup({ validation: 'val-06600' })
    await decide(wrapper, 'Con cargo')
    await wrapper.get('#resolve-surcharge').setValue('89')
    await wrapper.get('#resolve-surcharge').trigger('blur')
    await wrapper.get('#resolve-eta').setValue('3')
    await wrapper.get('form[data-testid="resolve-form"]').trigger('submit')
    await flushPromises()
    expect(zoneValidationsApi.resolve).toHaveBeenCalledWith('val-06600', expect.objectContaining({
      expectedVersion: 1, action: 'APPROVE_DELIVERY_ZONE', zoneType: 'SURCHARGE', surchargeCents: 8900, etaDays: 3,
      resolutionRequestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    }))
    expect(wrapper.get('[data-overlay]').text()).toContain('Decisión guardada.')
  })

  it('rejects with no zone fields (saved as «Sin entrega»)', async () => {
    vi.mocked(zoneValidationsApi.resolve).mockResolvedValue({ validation: { ...resolved, resolution: { ...resolved.resolution, action: 'REJECT_DELIVERY_ZONE', zoneType: 'DENIED', surchargeCents: null, etaDays: null } }, zone: {} } as never)
    const { wrapper } = await setup({ validation: 'val-06600' })
    await decide(wrapper, 'No entregar')
    expect(wrapper.find('#resolve-eta').exists()).toBe(false)
    await wrapper.get('form[data-testid="resolve-form"]').trigger('submit')
    await flushPromises()
    const body = vi.mocked(zoneValidationsApi.resolve).mock.calls[0]![1]
    expect(body).toEqual({ expectedVersion: 1, resolutionRequestId: expect.any(String), action: 'REJECT_DELIVERY_ZONE' })
  })

  it('on ALREADY_RESOLVED reloads and shows who decided and what', async () => {
    vi.mocked(zoneValidationsApi.resolve).mockRejectedValue({ response: { status: 409, data: { statusCode: 409, code: 'ALREADY_RESOLVED', message: 'Already resolved' } } })
    const { wrapper } = await setup({ validation: 'val-06600' })
    vi.mocked(zoneValidationsApi.get).mockResolvedValue(resolved as never)
    await decide(wrapper, 'No entregar')
    await wrapper.get('form[data-testid="resolve-form"]').trigger('submit')
    await flushPromises()
    const drawer = wrapper.get('[data-overlay]').text()
    expect(drawer).toContain('Otra persona ya resolvió esta validación.')
    expect(drawer).toContain('Ana Gerente')
    expect(drawer).toContain('Con cargo · $89.00 · 3 días')
    expect(drawer).not.toContain('Already resolved')
  })

  it('retries a network failure with the very same request', async () => {
    vi.mocked(zoneValidationsApi.resolve).mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce({ validation: resolved, zone: {} } as never)
    const { wrapper } = await setup({ validation: 'val-06600' })
    await decide(wrapper, 'No entregar')
    await wrapper.get('form[data-testid="resolve-form"]').trigger('submit')
    await flushPromises()
    await wrapper.get('[data-testid="resolve-retry"]').trigger('click')
    await flushPromises()
    const calls = vi.mocked(zoneValidationsApi.resolve).mock.calls
    expect(calls).toHaveLength(2)
    expect(calls[1]).toEqual(calls[0])
  })

  it('a 404 closes the drawer with a message', async () => {
    vi.mocked(zoneValidationsApi.resolve).mockRejectedValue({ response: { status: 404, data: { statusCode: 404, code: 'DELIVERY_ZONE_VALIDATION_NOT_FOUND', message: 'x' } } })
    const { wrapper, router } = await setup({ validation: 'val-06600' })
    await decide(wrapper, 'No entregar')
    await wrapper.get('form[data-testid="resolve-form"]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({})
    expect(wrapper.text()).toContain('Esta validación ya no existe en esta sucursal.')
  })

  it('a 401 logs out through the auth store', async () => {
    vi.mocked(zoneValidationsApi.resolve).mockRejectedValue({ response: { status: 401, data: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Unauthorized' } } })
    const { wrapper, router } = await setup({ validation: 'val-06600' })
    await decide(wrapper, 'No entregar')
    await wrapper.get('form[data-testid="resolve-form"]').trigger('submit')
    await flushPromises()
    expect(holder.auth.logout).toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/login')
  })
})
