import { defineComponent, h } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import UApp from '@nuxt/ui/runtime/components/App.vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ShippingBoxesPanel from '../ShippingBoxesPanel.vue'
import { shippingSettingsApi } from '../../api/shippingSettings.api'
import type { ShippingBox } from '../../interfaces/shipping-settings.types'

vi.mock('../../api/shippingSettings.api', () => ({
  shippingSettingsApi: { listBoxes: vi.fn(), createBox: vi.fn(), updateBox: vi.fn(), deleteBox: vi.fn() },
}))

const chica: ShippingBox = {
  id: 'box-chica',
  name: 'Caja chica',
  innerLengthCm: 30,
  innerWidthCm: 20,
  innerHeightCm: 15,
  weightG: 180,
  maxContentWeightG: 5000,
  isActive: true,
  createdAt: '2026-11-06T18:00:00.000Z',
  updatedAt: '2026-11-06T18:00:00.000Z',
}
const vieja: ShippingBox = { ...chica, id: 'box-vieja', name: 'Caja vieja', innerWidthCm: 20.5, isActive: false }

const Overlay = defineComponent({
  props: ['open', 'title', 'description'],
  setup(props, { slots }) {
    return () => (props.open ? h('section', { 'data-overlay': props.title }, [props.title, props.description, slots.body?.(), slots.footer?.()]) : null)
  },
})

const dispose: Array<() => void> = []

function setup(canUpdate = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  const root = mount(
    defineComponent({ setup: () => () => h(UApp, null, { default: () => h(ShippingBoxesPanel, { tenantId: 't-1', canUpdate }) }) }),
    {
      attachTo: document.body,
      global: { plugins: [[VueQueryPlugin, { queryClient: client }]], stubs: { USlideover: Overlay, UModal: Overlay } },
    },
  )
  dispose.push(() => { root.unmount(); client.clear() })
  return root
}

const menuItem = (label: string) =>
  Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find((item) => item.textContent?.trim() === label)

async function chooseAction(wrapper: ReturnType<typeof setup>, label: string, name: string) {
  await wrapper.get(`button[aria-label="Acciones de ${name}"]`).trigger('click')
  await vi.waitFor(() => expect(menuItem(label)).toBeDefined())
  menuItem(label)!.click()
  await flushPromises()
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(shippingSettingsApi.listBoxes).mockResolvedValue([chica, vieja])
})
afterEach(() => {
  dispose.splice(0).forEach((fn) => fn())
  document.body.innerHTML = ''
})

describe('ShippingBoxesPanel — list (handoff §5, S4, S6)', () => {
  it('shows each box in cm and kg with its state, never its id', async () => {
    const wrapper = setup()
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('Caja chica')
    expect(text).toContain('30 × 20 × 15 cm')
    expect(text).toContain('30 × 20.5 × 15 cm')
    expect(text).toContain('0.18 kg')
    expect(text).toContain('5 kg')
    expect(text).toContain('Activa')
    expect(text).toContain('Retirada')
    expect(text).not.toContain('box-chica')
  })

  it('empty: names the noun and offers Crear caja only with update:ShippingSettings', async () => {
    vi.mocked(shippingSettingsApi.listBoxes).mockResolvedValue([])
    const editor = setup(true)
    await flushPromises()
    expect(editor.get('.hf-empty-state').text()).toContain('Aún no hay cajas')
    expect(editor.find('[data-testid="empty-state-action"]').text()).toBe('Crear caja')
    dispose.splice(0).forEach((fn) => fn())

    const reader = setup(false)
    await flushPromises()
    expect(reader.get('.hf-empty-state').text()).toContain('Aún no hay cajas')
    expect(reader.find('[data-testid="empty-state-action"]').exists()).toBe(false)
    expect(reader.find('[data-testid="create-box"]').exists()).toBe(false)
  })

  it('error: a fixed Spanish title with Reintentar that reads again', async () => {
    vi.mocked(shippingSettingsApi.listBoxes).mockRejectedValue({ response: { status: 500, data: { message: 'Internal server error' } } })
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.text()).toContain('No se pudieron cargar las cajas')
    expect(wrapper.text()).not.toContain('Internal server error')
    vi.mocked(shippingSettingsApi.listBoxes).mockResolvedValue([chica])
    await wrapper.get('[data-testid="table-error-retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Caja chica')
  })

  it('a reader gets no row actions', async () => {
    const wrapper = setup(false)
    await flushPromises()
    expect(wrapper.find('button[aria-label="Acciones de Caja chica"]').exists()).toBe(false)
  })
})

describe('ShippingBoxesPanel — Retirar, Reactivar, Eliminar (S5)', () => {
  it('Retirar sends isActive false and Reactivar sends it back', async () => {
    vi.mocked(shippingSettingsApi.updateBox).mockResolvedValue(chica)
    const wrapper = setup()
    await flushPromises()
    await chooseAction(wrapper, 'Retirar', 'Caja chica')
    await chooseAction(wrapper, 'Reactivar', 'Caja vieja')
    expect(shippingSettingsApi.updateBox).toHaveBeenNthCalledWith(1, 't-1', 'box-chica', { isActive: false })
    expect(shippingSettingsApi.updateBox).toHaveBeenNthCalledWith(2, 't-1', 'box-vieja', { isActive: true })
  })

  it('Eliminar asks first, says it is permanent, then deletes', async () => {
    vi.mocked(shippingSettingsApi.deleteBox).mockResolvedValue()
    const wrapper = setup()
    await flushPromises()
    await chooseAction(wrapper, 'Eliminar…', 'Caja chica')
    expect(shippingSettingsApi.deleteBox).not.toHaveBeenCalled()
    const dialog = document.body.textContent ?? ''
    expect(dialog).toContain('¿Eliminar la caja «Caja chica»?')
    expect(dialog).toContain('para siempre')
    const confirm = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Eliminar caja')!
    confirm.click()
    await flushPromises()
    expect(shippingSettingsApi.deleteBox).toHaveBeenCalledWith('t-1', 'box-chica')
  })

  it('a failed action reads as a Spanish sentence, never the server text', async () => {
    vi.mocked(shippingSettingsApi.updateBox).mockRejectedValue({
      response: { status: 404, data: { statusCode: 404, error: 'ENTITY_NOT_FOUND', message: 'ShippingBox with id "box-chica" not found' } },
    })
    const wrapper = setup()
    await flushPromises()
    await chooseAction(wrapper, 'Retirar', 'Caja chica')
    expect(wrapper.text()).toContain('Esta caja ya no existe. Actualiza la lista.')
    expect(wrapper.text()).not.toContain('not found')
  })
})

describe('ShippingBoxesPanel — create and edit form (S4)', () => {
  // The slideover teleports to the body, so the form is read from the document.
  const body = (selector: string) => {
    const found = document.body.querySelector<HTMLElement>(selector)
    if (!found) throw new Error(`missing ${selector}`)
    return found
  }
  async function fill(_wrapper: ReturnType<typeof setup>, values: Record<string, string>) {
    await vi.waitFor(() => body('[data-testid="box-form"]'))
    for (const [name, value] of Object.entries(values)) {
      const input = body(`input[name="${name}"]`) as HTMLInputElement
      input.value = value
      input.dispatchEvent(new Event('input'))
    }
    await flushPromises()
  }
  async function submit() {
    body('[data-testid="box-form"]').dispatchEvent(new Event('submit'))
    await flushPromises()
  }

  it('types kg and sends grams; a duplicate name lands on the name field', async () => {
    vi.mocked(shippingSettingsApi.createBox).mockRejectedValue({
      response: { status: 409, data: { statusCode: 409, error: 'ENTITY_ALREADY_EXISTS', message: 'ShippingBox "Caja chica" already exists' } },
    })
    const wrapper = setup()
    await flushPromises()
    await wrapper.get('[data-testid="create-box"]').trigger('click')
    await fill(wrapper, { name: 'Caja chica', length: '40', width: '30,5', height: '20', weightKg: '0.25', maxContentKg: '1.25' })
    await submit()
    expect(shippingSettingsApi.createBox).toHaveBeenCalledWith('t-1', {
      name: 'Caja chica',
      innerLengthCm: 40,
      innerWidthCm: 30.5,
      innerHeightCm: 20,
      weightG: 250,
      maxContentWeightG: 1250,
    })
    expect(body('#box-name-message').textContent?.trim()).toBe('Ya existe una caja con ese nombre.')
    expect(body('input[name="name"]').getAttribute('aria-invalid')).toBe('true')
  })

  it('validates on the client before sending', async () => {
    const wrapper = setup()
    await flushPromises()
    await wrapper.get('[data-testid="create-box"]').trigger('click')
    await fill(wrapper, { name: 'Caja', length: '10.25', width: '20', height: '20', weightKg: '0', maxContentKg: '80' })
    await submit()
    expect(shippingSettingsApi.createBox).not.toHaveBeenCalled()
    expect(body('#box-length-message').textContent).toContain('un decimal como máximo')
    expect(body('#box-weightKg-message').textContent?.trim()).toBe('Escribe un peso entre 0.001 y 70 kg.')
  })

  it('Editar opens the box in cm and kg and PATCHes only what changed', async () => {
    vi.mocked(shippingSettingsApi.updateBox).mockResolvedValue(chica)
    const wrapper = setup()
    await flushPromises()
    await chooseAction(wrapper, 'Editar', 'Caja chica')
    await vi.waitFor(() => body('input[name="weightKg"]'))
    expect((body('input[name="weightKg"]') as HTMLInputElement).value).toBe('0.18')
    await fill(wrapper, { maxContentKg: '6' })
    await submit()
    expect(shippingSettingsApi.updateBox).toHaveBeenCalledWith('t-1', 'box-chica', { maxContentWeightG: 6000 })
  })
})
