/**
 * SatKeySelect — async-searchable SAT key select tests.
 *
 * Mounted via `mountWithUApp` so Nuxt UI's provide/inject tree
 * (UIcon, UApp) is available.
 *
 * The component delegates the actual network call to useSatKeySearch
 * and useSatKeyLookup — both are mocked here so the tests focus on
 * the UI contract:
 *  - Empty state shows the "type to search" prompt.
 *  - Single char doesn't fire the network.
 *  - Debounce window — typing flushes only after 300ms idle.
 *  - Loading spinner appears when the query is fetching.
 *  - "no results" state appears when the response has 0 items.
 *  - Selecting an option emits update:modelValue with the key only.
 *  - "showing 20 of N" hint appears only when total > items.length.
 *  - 404 hydration falls back to the raw key string (no crash).
 *  - Clearing emits the empty string.
 *  - :error binding renders the message in the surrounding UFormField
 *    via a wrapper <p data-testid="sat-error">.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { enableAutoUnmount } from '@vue/test-utils'

enableAutoUnmount(afterEach)
import { mountWithUApp } from '@/test/mountWithUApp'
import SatKeySelect from '../SatKeySelect.vue'

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Control the search composable's reactive state from outside.
const searchState = {
  options: ref<{ value: string; label: string }[]>([]),
  isLoading: ref(false),
  isFetching: ref(false),
  isEnabled: ref(false),
  total: ref(0),
  limit: ref(20),
  debouncedTerm: ref(''),
  items: ref<{ key: string; description: string }[]>([]),
}
const useSatKeySearchMock = vi.fn((_input: unknown) => searchState)
vi.mock('../../composables/useSatKeySearch', () => ({
  useSatKeySearch: (input: unknown) => useSatKeySearchMock(input),
}))

const lookupState = {
  satKey: ref<{ key: string; description: string } | null>(null),
  isLoading: ref(false),
  isFetching: ref(false),
}
const useSatKeyLookupMock = vi.fn((_input: unknown) => lookupState)
vi.mock('../../composables/useSatKeyLookup', () => ({
  useSatKeyLookup: (input: unknown) => useSatKeyLookupMock(input),
}))

const flushPromises = async () => {
  await nextTick()
  await vi.advanceTimersByTimeAsync(0)
}

function mountSelect(props: Record<string, unknown> = {}) {
  return mountWithUApp(SatKeySelect, {
    attachTo: document.body,
    props: { modelValue: '', ...props },
  })
}

/** Open the dropdown so the search input is in the DOM. */
async function openDropdown(wrapper: ReturnType<typeof mountSelect>) {
  // Click the trigger (the <button> wrapping the chevron + label).
  const buttons = wrapper.findAll('button[type="button"]')
  const trigger =
    buttons.find((b) => b.classes().length === 0) ?? buttons[0]
  if (!trigger) throw new Error('No trigger button found')
  await trigger.trigger('click')
  await flushPromises()
}

describe('SatKeySelect', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    searchState.options.value = []
    searchState.items.value = []
    searchState.isLoading.value = false
    searchState.isFetching.value = false
    searchState.isEnabled.value = false
    searchState.total.value = 0
    searchState.limit.value = 20
    searchState.debouncedTerm.value = ''
    lookupState.satKey.value = null
    lookupState.isLoading.value = false
    lookupState.isFetching.value = false
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the "type to search" empty state when the dropdown opens with an empty query', async () => {
    const wrapper = mountSelect()
    await openDropdown(wrapper)
    expect(wrapper.text()).toContain('Escribe al menos 2 caracteres')
  })

  it('does not render the "no results" message on the empty state', async () => {
    const wrapper = mountSelect()
    await openDropdown(wrapper)
    expect(wrapper.text()).not.toContain('Sin resultados')
  })

  it('emits update:modelValue with the key string only when an option is selected', async () => {
    searchState.items.value = [
      { key: '12345678', description: 'Servicios' },
      { key: '87654321', description: 'Comida' },
    ]
    const wrapper = mountSelect()
    await openDropdown(wrapper)
    await wrapper.find('input[type="text"]').setValue('Servi')
    searchState.debouncedTerm.value = 'Servi'
    vi.advanceTimersByTime(300)
    await flushPromises()

    const optionButtons = wrapper.findAll('button[type="button"]')
    // The trigger button + the option buttons
    const target = optionButtons.find((b) => b.text().includes('12345678 — Servicios'))
    expect(target).toBeTruthy()
    await target!.trigger('click')

    const events = wrapper.emitted('update:modelValue')
    expect(events).toBeTruthy()
    expect(events![events!.length - 1]).toEqual(['12345678'])
  })

  it('shows the "showing 20 of N" hint when total > items.length', async () => {
    searchState.items.value = Array.from({ length: 20 }, (_, i) => ({
      key: `1${String(i).padStart(7, '0')}`,
      description: `desc ${i}`,
    }))
    searchState.total.value = 152
    searchState.limit.value = 20

    const wrapper = mountSelect()
    await openDropdown(wrapper)
    await wrapper.find('input[type="text"]').setValue('1')
    searchState.debouncedTerm.value = '1'
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.text()).toContain('mostrando 20 de 152')
  })

  it('hides the hint when total fits in items.length', async () => {
    searchState.items.value = [
      { key: '11111111', description: 'Foo' },
    ]
    searchState.total.value = 1

    const wrapper = mountSelect()
    await openDropdown(wrapper)
    await wrapper.find('input[type="text"]').setValue('1')
    searchState.debouncedTerm.value = '1'
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.text()).not.toContain('mostrando')
  })

  it('shows the "no results" state when the response has 0 items', async () => {
    searchState.options.value = []
    searchState.isLoading.value = false
    searchState.total.value = 0

    const wrapper = mountSelect()
    await openDropdown(wrapper)
    await wrapper.find('input[type="text"]').setValue('zzzzz')
    searchState.debouncedTerm.value = 'zzzzz'
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.text()).toContain('Sin resultados')
  })

  it('hydrates from useSatKeyLookup on mount with a non-empty modelValue', async () => {
    lookupState.satKey.value = { key: '12345678', description: 'Servicios' }

    const wrapper = mountSelect({ modelValue: '12345678' })
    await flushPromises()

    // Trigger button renders the "key — description" label.
    expect(wrapper.text()).toContain('12345678 — Servicios')
  })

  it('falls back to the raw key when useSatKeyLookup returns null (404)', async () => {
    lookupState.satKey.value = null

    const wrapper = mountSelect({ modelValue: '99999999' })
    await flushPromises()

    expect(wrapper.text()).toContain('99999999')
    expect(wrapper.text()).not.toContain('null')
  })

  it('emits "" when the user clears the selection via the clear button', async () => {
    lookupState.satKey.value = { key: '12345678', description: 'Servicios' }

    const wrapper = mountSelect({ modelValue: '12345678' })
    await flushPromises()

    // The clear button is rendered only when the model is non-empty.
    const clearBtn = wrapper.find('button[aria-label="Limpiar"]')
    expect(clearBtn.exists()).toBe(true)
    await clearBtn.trigger('click')

    const updateEvents = wrapper.emitted('update:modelValue')
    expect(updateEvents).toBeTruthy()
    expect(updateEvents![updateEvents!.length - 1]).toEqual([''])
  })

  it('forwards :error to the wrapper test-id', () => {
    const wrapper = mountSelect({ modelValue: '00000000', error: 'SAT key inválida' })
    expect(wrapper.find('[data-testid="sat-error"]').text()).toBe('SAT key inválida')
  })

  it('does not render the error test-id when :error is empty', () => {
    const wrapper = mountSelect({ modelValue: '00000000' })
    expect(wrapper.find('[data-testid="sat-error"]').exists()).toBe(false)
  })

  it('uses HF selection roles for every consumer', async () => {
    searchState.items.value = [
      { key: '12345678', description: 'Servicios' },
      { key: '87654321', description: 'Comida' },
    ]
    lookupState.satKey.value = { key: '12345678', description: 'Servicios' }

    const wrapper = mountSelect({ modelValue: '12345678' })
    await openDropdown(wrapper)
    await wrapper.find('input[type="text"]').setValue('Servi')
    searchState.debouncedTerm.value = 'Servi'
    vi.advanceTimersByTime(300)
    await flushPromises()

    expect(wrapper.classes()).toContain('hf-theme')
    expect(wrapper.html()).not.toContain('coco-gold')
    expect(wrapper.get('[aria-selected="true"]').text()).toContain('Servicios')
  })

  it('selects results with arrows/Enter and exposes an accessible error relationship', async () => {
    searchState.items.value = [{ key: '12345678', description: 'Servicios' }]
    const wrapper = mountSelect({ id: 'sat', error: 'Clave inválida' })
    const trigger = wrapper.get('button.products-select-trigger')
    await trigger.trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    const input = wrapper.get('input')
    expect(document.activeElement).toBe(input.element)
    await input.setValue('Serv')
    searchState.debouncedTerm.value = 'Serv'
    await flushPromises()
    await input.trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.get('[data-highlighted="true"]').text()).toContain('Servicios')
    await input.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('update:modelValue')).toEqual([['12345678']])
    expect(document.activeElement).toBe(trigger.element)
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(trigger.attributes('aria-invalid')).toBe('true')
    expect(trigger.attributes('aria-describedby')).toBe(wrapper.get('[data-testid="sat-error"]').attributes('id'))
  })

  it('announces loading and closes with Escape; disabled selections cannot be cleared', async () => {
    const wrapper = mountSelect()
    await openDropdown(wrapper)
    searchState.debouncedTerm.value = 'Serv'
    searchState.isFetching.value = true
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('Buscando')
    await wrapper.get('input').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('input').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('button').element)
    const disabled = mountSelect({ modelValue: '12345678', disabled: true })
    expect(disabled.find('button[aria-label="Limpiar"]').exists()).toBe(false)
    await disabled.get('button').trigger('click')
    expect(disabled.find('input').exists()).toBe(false)
    expect(disabled.emitted('update:modelValue')).toBeUndefined()
  })
})
