import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShippingOriginPanel from '../ShippingOriginPanel.vue'
import { shippingSettingsApi } from '../../api/shippingSettings.api'
import type { ShippingOrigin } from '../../interfaces/shipping-settings.types'

vi.mock('../../api/shippingSettings.api', () => ({
  shippingSettingsApi: { getOrigin: vi.fn(), putOrigin: vi.fn() },
}))

const origin: ShippingOrigin = {
  addressLine1: 'Av. Insurgentes Sur 1458',
  addressLine2: 'Local 3, planta baja',
  neighborhood: 'Del Valle Centro',
  municipality: 'Benito Juárez',
  state: 'Ciudad de México',
  postalCode: '03100',
  contactPhone: '5555432100',
  updatedAt: '2026-11-06T18:00:00.000Z',
}

const dispose: Array<() => void> = []
function setup(canUpdate = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  const root = mount(
    defineComponent({ setup: () => () => h(UApp, null, { default: () => h(ShippingOriginPanel, { tenantId: 't-1', canUpdate }) }) }),
    { attachTo: document.body, global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  )
  dispose.push(() => { root.unmount(); client.clear() })
  return root
}

const button = (wrapper: ReturnType<typeof setup>, label: string) =>
  wrapper.findAll('button').find((b) => b.text().trim() === label)

beforeEach(() => vi.resetAllMocks())
afterEach(() => {
  dispose.splice(0).forEach((fn) => fn())
  document.body.innerHTML = ''
})

describe('ShippingOriginPanel (handoff §6, S6)', () => {
  it('loading shows a skeleton', () => {
    vi.mocked(shippingSettingsApi.getOrigin).mockReturnValue(new Promise(() => {}))
    const wrapper = setup()
    expect(wrapper.find('[data-testid="origin-loading"]').exists()).toBe(true)
  })

  it('error: a fixed Spanish title with Reintentar', async () => {
    vi.mocked(shippingSettingsApi.getOrigin).mockRejectedValueOnce({ response: { status: 500, data: { message: 'Internal' } } })
    vi.mocked(shippingSettingsApi.getOrigin).mockResolvedValueOnce({ configured: true, origin })
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('error')
    expect(wrapper.text()).toContain('No se pudo cargar el origen')
    expect(wrapper.text()).not.toContain('Internal')
    await wrapper.get('[data-testid="origin-retry"]').trigger('click')
    await flushPromises()
    expect((wrapper.get('input[name="addressLine1"]').element as HTMLInputElement).value).toBe('Av. Insurgentes Sur 1458')
  })

  it('configured false: empty state with «Configurar origen» for editors, which opens a blank form', async () => {
    vi.mocked(shippingSettingsApi.getOrigin).mockResolvedValue({ configured: false, origin: null })
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.get('.hf-empty-state').text()).toContain('Aún no hay origen de envíos')
    await wrapper.get('[data-testid="origin-configure"]').trigger('click')
    expect((wrapper.get('input[name="addressLine1"]').element as HTMLInputElement).value).toBe('')
  })

  it('configured false for a reader: the empty state has no action', async () => {
    vi.mocked(shippingSettingsApi.getOrigin).mockResolvedValue({ configured: false, origin: null })
    const wrapper = setup(false)
    await flushPromises()
    expect(wrapper.get('.hf-empty-state').text()).toContain('Aún no hay origen de envíos')
    expect(wrapper.find('[data-testid="origin-configure"]').exists()).toBe(false)
  })

  it('a reader sees the address as a description list, without inputs', async () => {
    vi.mocked(shippingSettingsApi.getOrigin).mockResolvedValue({ configured: true, origin })
    const wrapper = setup(false)
    await flushPromises()
    expect(wrapper.find('dl').text()).toContain('Av. Insurgentes Sur 1458')
    expect(wrapper.find('dl').text()).toContain('03100')
    expect(wrapper.find('input').exists()).toBe(false)
  })

  it('an editor saves the whole address with PUT; client rules block a bad postal code', async () => {
    vi.mocked(shippingSettingsApi.getOrigin).mockResolvedValue({ configured: true, origin })
    vi.mocked(shippingSettingsApi.putOrigin).mockResolvedValue({ configured: true, origin: { ...origin, postalCode: '03104' } })
    const wrapper = setup()
    await flushPromises()
    await wrapper.get('input[name="postalCode"]').setValue('0310')
    await button(wrapper, 'Guardar')!.trigger('click')
    await flushPromises()
    expect(shippingSettingsApi.putOrigin).not.toHaveBeenCalled()
    expect(wrapper.get('#origin-postalCode-message').text()).toBe('El código postal tiene 5 dígitos.')

    await wrapper.get('input[name="postalCode"]').setValue('03104')
    await wrapper.get('input[name="addressLine2"]').setValue('')
    await button(wrapper, 'Guardar')!.trigger('click')
    await flushPromises()
    expect(shippingSettingsApi.putOrigin).toHaveBeenCalledWith('t-1', {
      addressLine1: 'Av. Insurgentes Sur 1458',
      addressLine2: null,
      neighborhood: 'Del Valle Centro',
      municipality: 'Benito Juárez',
      state: 'Ciudad de México',
      postalCode: '03104',
      contactPhone: '5555432100',
    })
  })

  it('a 400 from the backend lands on its field in Spanish', async () => {
    vi.mocked(shippingSettingsApi.getOrigin).mockResolvedValue({ configured: true, origin })
    vi.mocked(shippingSettingsApi.putOrigin).mockRejectedValue({
      response: {
        status: 400,
        data: { statusCode: 400, error: 'Bad Request', message: [{ property: 'contactPhone', children: [], constraints: { matches: 'contactPhone must be 10 to 15 digits' } }] },
      },
    })
    const wrapper = setup()
    await flushPromises()
    await wrapper.get('input[name="state"]').setValue('CDMX')
    await button(wrapper, 'Guardar')!.trigger('click')
    await flushPromises()
    expect(wrapper.get('#origin-contactPhone-message').text()).toBe('Escribe un teléfono de 10 a 15 dígitos; puede empezar con +.')
    expect(wrapper.text()).not.toContain('must be')
  })
})
