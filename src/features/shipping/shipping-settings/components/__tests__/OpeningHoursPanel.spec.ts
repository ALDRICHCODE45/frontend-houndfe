import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OpeningHoursPanel from '../OpeningHoursPanel.vue'
import { shippingSettingsApi } from '../../api/shippingSettings.api'
import type { OpeningDay, OpeningHoursResponse } from '../../interfaces/shipping-settings.types'

vi.mock('../../api/shippingSettings.api', () => ({
  shippingSettingsApi: { getOpeningHours: vi.fn(), putOpeningHours: vi.fn() },
}))

const split = [{ open: '09:00', close: '14:00' }, { open: '16:00', close: '19:30' }]
const days: OpeningDay[] = [
  { day: 'MONDAY', ranges: split },
  { day: 'TUESDAY', ranges: split },
  { day: 'WEDNESDAY', ranges: split },
  { day: 'THURSDAY', ranges: split },
  { day: 'FRIDAY', ranges: split },
  { day: 'SATURDAY', ranges: [{ open: '09:00', close: '14:00' }] },
  { day: 'SUNDAY', ranges: [] },
]
const seeded: OpeningHoursResponse = {
  configured: true,
  openingHours: { timeZone: 'America/Mexico_City', days, updatedAt: '2026-11-06T18:00:00.000Z' },
}

const dispose: Array<() => void> = []
function setup(canUpdate = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  const root = mount(
    defineComponent({ setup: () => () => h(UApp, null, { default: () => h(OpeningHoursPanel, { tenantId: 't-1', canUpdate }) }) }),
    { attachTo: document.body, global: { plugins: [[VueQueryPlugin, { queryClient: client }]] } },
  )
  dispose.push(() => { root.unmount(); client.clear() })
  return root
}

const button = (wrapper: ReturnType<typeof setup>, label: string) =>
  wrapper.findAll('button').find((b) => b.text().trim() === label)
const save = (wrapper: ReturnType<typeof setup>) => button(wrapper, 'Guardar')!.trigger('click')

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(shippingSettingsApi.getOpeningHours).mockResolvedValue(seeded)
})
afterEach(() => {
  dispose.splice(0).forEach((fn) => fn())
  document.body.innerHTML = ''
})

describe('OpeningHoursPanel — states (S6)', () => {
  it('loading shows a skeleton', () => {
    vi.mocked(shippingSettingsApi.getOpeningHours).mockReturnValue(new Promise(() => {}))
    expect(setup().find('[data-testid="hours-loading"]').exists()).toBe(true)
  })

  it('error: a fixed Spanish title with Reintentar', async () => {
    vi.mocked(shippingSettingsApi.getOpeningHours).mockRejectedValueOnce({ response: { status: 500, data: { message: 'Internal' } } })
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.text()).toContain('No se pudo cargar el horario')
    await wrapper.get('[data-testid="hours-retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="hours-summary"]').exists()).toBe(true)
  })

  it('configured false: «Configurar horario» for editors opens a closed week; readers get no action', async () => {
    vi.mocked(shippingSettingsApi.getOpeningHours).mockResolvedValue({ configured: false, openingHours: null })
    const editor = setup()
    await flushPromises()
    expect(editor.get('.hf-empty-state').text()).toContain('Aún no hay horario')
    await editor.get('[data-testid="hours-configure"]').trigger('click')
    expect(editor.get('[data-testid="day-MONDAY"]').text()).toContain('Cerrado')
    dispose.splice(0).forEach((fn) => fn())

    const reader = setup(false)
    await flushPromises()
    expect(reader.find('[data-testid="hours-configure"]').exists()).toBe(false)
  })
})

describe('OpeningHoursPanel — summary and time zone (S7)', () => {
  it('shows the FE summary line and the fixed time zone as text', async () => {
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.get('[data-testid="hours-summary"]').text()).toBe('Lun–Vie 09:00–14:00 y 16:00–19:30 · Sáb 09:00–14:00 · Dom cerrado')
    expect(wrapper.text()).toContain('America/Mexico_City')
    expect(wrapper.find('select').exists()).toBe(false)
  })

  it('a reader sees the week without inputs', async () => {
    const wrapper = setup(false)
    await flushPromises()
    expect(wrapper.find('input').exists()).toBe(false)
    expect(wrapper.get('[data-testid="hours-read"]').text()).toContain('Domingo')
    expect(wrapper.get('[data-testid="hours-read"]').text()).toContain('Cerrado')
  })
})

describe('OpeningHoursPanel — weekly editor', () => {
  it('blocks overlapping or touching ranges with the message next to the day', async () => {
    const wrapper = setup()
    await flushPromises()
    await wrapper.get('input[name="MONDAY-1-open"]').setValue('14:00')
    await save(wrapper)
    await flushPromises()
    expect(shippingSettingsApi.putOpeningHours).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="day-MONDAY"]').text()).toContain('Se encima o se toca con otro horario del día')
  })

  it('allows up to 6 ranges a day', async () => {
    const wrapper = setup()
    await flushPromises()
    const monday = () => wrapper.get('[data-testid="day-MONDAY"]')
    for (let i = 0; i < 4; i++) await monday().get('[data-testid="add-range"]').trigger('click')
    expect(monday().findAll('input[name^="MONDAY-"][name$="-open"]')).toHaveLength(6)
    expect(monday().find('[data-testid="add-range"]').exists()).toBe(false)
  })

  it('closing a day and saving sends the whole week with the fixed time zone', async () => {
    vi.mocked(shippingSettingsApi.putOpeningHours).mockResolvedValue(seeded)
    const wrapper = setup()
    await flushPromises()
    await wrapper.get('[data-testid="day-SATURDAY"] button[role="switch"]').trigger('click')
    await wrapper.get('input[name="MONDAY-0-open"]').setValue('8:30')
    await wrapper.get('input[name="MONDAY-0-open"]').trigger('blur')
    await save(wrapper)
    await flushPromises()
    const [, body] = vi.mocked(shippingSettingsApi.putOpeningHours).mock.calls[0]!
    expect(body.timeZone).toBe('America/Mexico_City')
    expect(body.days).toHaveLength(7)
    expect(body.days[0]).toEqual({ day: 'MONDAY', ranges: [{ open: '08:30', close: '14:00' }, { open: '16:00', close: '19:30' }] })
    expect(body.days[5]).toEqual({ day: 'SATURDAY', ranges: [] })
  })

  it('INVALID_OPENING_HOURS shows next to the day its message starts with, in Spanish', async () => {
    vi.mocked(shippingSettingsApi.putOpeningHours).mockRejectedValue({
      response: { status: 400, data: { statusCode: 400, error: 'INVALID_OPENING_HOURS', message: 'FRIDAY: ranges must not overlap or touch', timestamp: 'x' } },
    })
    const wrapper = setup()
    await flushPromises()
    await wrapper.get('input[name="MONDAY-0-open"]').setValue('08:00')
    await save(wrapper)
    await flushPromises()
    expect(wrapper.get('[data-testid="day-FRIDAY-error"]').text()).toBe('Hay horarios que se enciman o se tocan; únelos en uno solo.')
    expect(wrapper.text()).not.toContain('must not')
  })
})
