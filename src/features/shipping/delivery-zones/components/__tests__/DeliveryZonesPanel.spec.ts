import { defineComponent, h, reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DeliveryZonesPanel from '../DeliveryZonesPanel.vue'
import { deliveryZonesApi } from '../../api/deliveryZones.api'

vi.mock('../../api/deliveryZones.api', () => ({
  deliveryZonesApi: { list: vi.fn(), upsert: vi.fn(), deactivate: vi.fn() },
  zoneValidationsApi: { list: vi.fn(), get: vi.fn(), resolve: vi.fn() },
}))
const holder = vi.hoisted(() => ({ auth: null as unknown as { grants: string[]; currentTenantId: string; userCan: (a: string, s: string) => boolean; logout: () => Promise<void> } }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({ useAuthStore: () => holder.auth }))
vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  refDebounced: (source: unknown) => source,
}))

const zone = (patch: Record<string, unknown>) => ({
  id: `id-${String(patch.zipCode)}`, type: 'FREE', surchargeCents: null, etaDays: 1,
  state: 'Ciudad de México', municipality: 'Benito Juárez', neighborhood: 'Narvarte Poniente', isActive: true,
  approvedBy: { id: 'u1', displayName: 'Manager Centro' }, approvedAt: '2026-11-06T04:40:56.876Z',
  sourceValidationId: null, createdAt: '2026-11-06T04:40:56.877Z', updatedAt: '2026-11-06T04:40:56.877Z',
  ...patch,
})
const zones = [
  zone({ zipCode: '03100', etaDays: 0, neighborhood: 'Del Valle Centro' }),
  zone({ zipCode: '06700', type: 'SURCHARGE', surchargeCents: 4500, etaDays: 2, municipality: 'Cuauhtémoc', neighborhood: 'Roma Norte' }),
  zone({ zipCode: '14000', type: 'CARRIER_ONLY', etaDays: null, municipality: 'Tlalpan', neighborhood: 'Tlalpan Centro' }),
  zone({ zipCode: '12000', type: 'DENIED', etaDays: null, isActive: false, municipality: 'Milpa Alta', neighborhood: 'Villa Milpa Alta' }),
]
const page = { data: zones, pagination: { pageIndex: 0, pageSize: 20, totalCount: 4, pageCount: 1 } }

const Overlay = defineComponent({ props: ['open'], setup(props, { slots }) { return () => (props.open ? h('section', { 'data-overlay': '' }, [slots.body?.(), slots.footer?.()]) : null) } })
const dispose: Array<() => void> = []

async function setup(grants = ['read', 'manage', 'validate']) {
  holder.auth = reactive({
    grants, currentTenantId: 'tenant-1',
    userCan(action: string, subject: string) { return subject === 'DeliveryZone' && this.grants.includes(action) },
    logout: vi.fn(async () => {}),
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/', component: { template: '<div />' } },
    { path: '/sistema/envios/validaciones', component: { template: '<div />' } },
    { path: '/login', component: { template: '<div />' } },
  ] })
  await router.push('/')
  const root = mount(defineComponent({ setup: () => () => h(UApp, null, { default: () => h(DeliveryZonesPanel) }) }), {
    global: { plugins: [router, [VueQueryPlugin, { queryClient: client }]], stubs: { USlideover: Overlay, UModal: Overlay, Slideover: Overlay, Modal: Overlay } },
  })
  dispose.push(() => { root.unmount(); client.clear() })
  await flushPromises()
  return { wrapper: root.findComponent(DeliveryZonesPanel), router }
}

beforeEach(() => {
  vi.mocked(deliveryZonesApi.list).mockReset().mockResolvedValue(page as never)
  vi.mocked(deliveryZonesApi.upsert).mockReset()
  vi.mocked(deliveryZonesApi.deactivate).mockReset()
})
afterEach(() => { dispose.splice(0).forEach((fn) => fn()); document.body.innerHTML = '' })

const rowOf = (wrapper: Awaited<ReturnType<typeof setup>>['wrapper'], zip: string) =>
  wrapper.findAll('tbody tr').find((row) => row.text().includes(zip))!

describe('DeliveryZonesPanel list', () => {
  it('shows type badges, the surcharge in pesos, the delivery days and the place labels, never ids', async () => {
    const { wrapper } = await setup()
    expect(rowOf(wrapper, '03100').text()).toContain('Envío gratis')
    expect(rowOf(wrapper, '03100').text()).toContain('Mismo día')
    expect(rowOf(wrapper, '03100').text()).toContain('Del Valle Centro, Benito Juárez')
    expect(rowOf(wrapper, '06700').text()).toContain('Con cargo')
    expect(rowOf(wrapper, '06700').text()).toContain('$45.00')
    expect(rowOf(wrapper, '06700').text()).toContain('2 días')
    expect(rowOf(wrapper, '14000').text()).toContain('Solo paquetería')
    expect(rowOf(wrapper, '12000').text()).toContain('Sin entrega')
    expect(rowOf(wrapper, '12000').text()).toContain('Inactiva')
    expect(wrapper.text()).not.toMatch(/id-0|u1/)
    expect(wrapper.text()).toContain('Mostrando 1-4 de 4')
  })

  it('is read-only without manage:DeliveryZone: no create, no row menu', async () => {
    const { wrapper } = await setup(['read'])
    expect(wrapper.find('[data-testid="zone-create"]').exists()).toBe(false)
    expect(wrapper.find('tbody button[aria-haspopup="menu"]').exists()).toBe(false)
    expect(wrapper.find('tbody .hf-row-primary').element.tagName).toBe('SPAN')
  })

  it('shows the error state with Reintentar when the list fails', async () => {
    vi.mocked(deliveryZonesApi.list).mockRejectedValue({ response: { status: 500, data: {} } })
    const { wrapper } = await setup()
    expect(wrapper.find('[data-testid="table-error-state"]').text()).toContain('No se pudieron cargar las zonas')
  })

  it('shows the first-use state with the create action', async () => {
    vi.mocked(deliveryZonesApi.list).mockResolvedValue({ data: [], pagination: { pageIndex: 0, pageSize: 20, totalCount: 0, pageCount: 0 } })
    const { wrapper } = await setup()
    expect(wrapper.find('.hf-empty-state').text()).toContain('Aún no hay zonas de entrega')
  })
})

describe('DeliveryZonesPanel form', () => {
  async function openCreate(wrapper: Awaited<ReturnType<typeof setup>>['wrapper']) {
    await wrapper.get('[data-testid="zone-create"]').trigger('click')
    await flushPromises()
  }

  it('shows the fields of the chosen type and PUTs the whole record with the three labels', async () => {
    vi.mocked(deliveryZonesApi.upsert).mockResolvedValue(zones[1] as never)
    const { wrapper } = await setup()
    await openCreate(wrapper)
    expect(wrapper.find('#zone-surcharge').exists()).toBe(false)
    expect(wrapper.find('#zone-eta').exists()).toBe(true)

    await wrapper.findAll('[role="radio"]').find((radio) => radio.text() === 'Con cargo')!.trigger('click')
    await wrapper.get('#zone-zip').setValue('06750')
    await wrapper.get('#zone-surcharge').setValue('45')
    await wrapper.get('#zone-surcharge').trigger('blur')
    await wrapper.get('#zone-eta').setValue('2')
    await wrapper.get('#zone-neighborhood').setValue('Condesa')
    await wrapper.get('form[data-testid="zone-form"]').trigger('submit')
    await flushPromises()

    expect(deliveryZonesApi.upsert).toHaveBeenCalledWith('06750', {
      type: 'SURCHARGE', surchargeCents: 4500, etaDays: 2, state: null, municipality: null, neighborhood: 'Condesa',
    })
  })

  it('stops a bad postal code next to the field without calling the backend', async () => {
    const { wrapper } = await setup()
    await openCreate(wrapper)
    await wrapper.get('#zone-zip').setValue('067')
    await wrapper.get('#zone-eta').setValue('1')
    await wrapper.get('form[data-testid="zone-form"]').trigger('submit')
    await flushPromises()
    expect(deliveryZonesApi.upsert).not.toHaveBeenCalled()
    expect(wrapper.get('#zone-zip-message').text()).toBe('Escribe un código postal de 5 dígitos.')
  })

  it('opens the pending validation from the 409 validationId (L7)', async () => {
    vi.mocked(deliveryZonesApi.upsert).mockRejectedValue({ response: { status: 409, data: { statusCode: 409, code: 'DELIVERY_ZONE_VALIDATION_PENDING', message: 'x', validationId: 'val-9' } } })
    const { wrapper, router } = await setup()
    await openCreate(wrapper)
    await wrapper.get('#zone-zip').setValue('06600')
    await wrapper.get('#zone-eta').setValue('1')
    await wrapper.get('form[data-testid="zone-form"]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/sistema/envios/validaciones')
    expect(router.currentRoute.value.query).toEqual({ validation: 'val-9' })
  })

  it('routes a validation-pipe error to its field in Spanish', async () => {
    vi.mocked(deliveryZonesApi.upsert).mockRejectedValue({ response: { status: 400, data: { statusCode: 400, error: 'Bad Request', message: [{ property: 'neighborhood', children: [], constraints: { maxLength: 'neighborhood must be shorter' } }] } } })
    const { wrapper } = await setup()
    await openCreate(wrapper)
    await wrapper.get('#zone-zip').setValue('06750')
    await wrapper.get('#zone-eta').setValue('1')
    await wrapper.get('form[data-testid="zone-form"]').trigger('submit')
    await flushPromises()
    expect(wrapper.get('#zone-neighborhood-message').text()).toBe('Escribe de 1 a 120 caracteres.')
    expect(wrapper.text()).not.toContain('must be')
  })
})

describe('DeliveryZonesPanel deactivate', () => {
  it('asks before deactivating and sends DELETE on the postal code', async () => {
    vi.mocked(deliveryZonesApi.deactivate).mockResolvedValue({ ...zones[1], isActive: false } as never)
    const { wrapper } = await setup()
    await rowOf(wrapper, '06700').get('button[aria-haspopup="menu"]').trigger('click')
    await vi.waitFor(() => expect(document.querySelector('[role="menuitem"]')).not.toBeNull())
    Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) => item.textContent?.includes('Desactivar'))!.click()
    await flushPromises()
    expect(deliveryZonesApi.deactivate).not.toHaveBeenCalled()
    expect(wrapper.get('[data-overlay]').text()).toContain('La zona 06700 deja de usarse')
    await wrapper.get('[data-testid="zone-deactivate-confirm"]').trigger('click')
    await flushPromises()
    expect(deliveryZonesApi.deactivate).toHaveBeenCalledWith('06700')
  })
})
