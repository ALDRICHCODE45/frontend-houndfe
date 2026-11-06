import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { nextTick, shallowRef } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import VariantPackagingModal from '../VariantPackagingModal.vue'
import type { VariantPackagingResponse } from '../../interfaces/product-packaging.types'

const toast = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('@nuxt/ui/runtime/composables/useToast', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useToast: () => toast,
}))

const state = {
  data: shallowRef<VariantPackagingResponse | undefined>(undefined),
  isLoading: shallowRef(false),
  isError: shallowRef(false),
  refetch: vi.fn(),
  save: { mutateAsync: vi.fn(), isPending: shallowRef(false) },
  remove: { mutateAsync: vi.fn(), isPending: shallowRef(false) },
}
const enabledSeen: unknown[] = []
vi.mock('../../composables/useProductPackaging', () => ({
  useVariantPackaging: (_p: unknown, _v: unknown, options: { enabled: unknown }) => {
    enabledSeen.push(options.enabled)
    return state
  },
}))

const product = { weightG: 320, lengthCm: 25, widthCm: 18, heightCm: 4.5, updatedAt: 't' }
const own = { weightG: 480, lengthCm: 32, widthCm: 22, heightCm: 5.5, updatedAt: 't2' }
const base = { productId: 'p-uuid', variantId: 'v-uuid', productPackaging: product }
const inheriting: VariantPackagingResponse = { ...base, override: null, effective: product, source: 'PRODUCT' }
const overriding: VariantPackagingResponse = { ...base, override: own, effective: own, source: 'VARIANT' }
const nothing: VariantPackagingResponse = { ...base, override: null, productPackaging: null, effective: null, source: null }

const body = () => new DOMWrapper(document.body)
const mountModal = (props: Record<string, unknown> = {}) =>
  mountWithUApp(VariantPackagingModal, {
    attachTo: document.body,
    props: { open: true, productId: 'p-uuid', variantId: 'v-uuid', variantLabel: 'Grande', canUpdate: true, ...props },
  })

async function chooseOwn() {
  const radio = body().findAll('[role="radio"]').find((item) => item.text().includes('Empaque propio') || item.attributes('value') === 'own')
  await radio!.trigger('click')
  await nextTick()
}

beforeEach(() => {
  vi.clearAllMocks()
  state.data.value = undefined
  state.isLoading.value = false
  state.isError.value = false
  document.body.innerHTML = ''
})

describe('VariantPackagingModal — what the variant uses', () => {
  it('names the variant in the title and reads only while open', async () => {
    state.data.value = inheriting
    mountModal()
    await flushPromises()
    expect(body().text()).toContain('Empaque de Grande')
    expect(body().text()).not.toContain('v-uuid')
    expect(body().text()).not.toContain('p-uuid')
  })

  it('inheriting shows the effective record with «Heredado del producto»', async () => {
    state.data.value = inheriting
    mountModal()
    await flushPromises()
    const effective = body().find('[data-testid="variant-packaging-effective"]')
    expect(effective.text()).toContain('0.32 kg')
    expect(effective.text()).toContain('25 × 18 × 4.5 cm')
    expect(effective.text()).toContain('Heredado del producto')
  })

  it('an own record shows it without the inherited badge', async () => {
    state.data.value = overriding
    mountModal()
    await flushPromises()
    const effective = body().find('[data-testid="variant-packaging-effective"]')
    expect(effective.text()).toContain('0.48 kg')
    expect(effective.text()).not.toContain('Heredado del producto')
  })

  it('says when neither the variant nor the product has packaging', async () => {
    state.data.value = nothing
    mountModal()
    await flushPromises()
    expect(body().find('[data-testid="variant-packaging-effective"]').text()).toContain('Sin empaque')
  })

  it('loading and error states, with a retry', async () => {
    state.isLoading.value = true
    mountModal()
    await flushPromises()
    expect(body().find('[data-testid="variant-packaging-loading"]').exists()).toBe(true)

    document.body.innerHTML = ''
    state.isLoading.value = false
    state.isError.value = true
    mountModal()
    await flushPromises()
    expect(body().find('[role="alert"]').text()).toContain('No se pudo cargar el empaque')
    await body().find('[data-testid="variant-packaging-retry"]').trigger('click')
    expect(state.refetch).toHaveBeenCalled()
  })

  it('without update:Product there is no choice and no save', async () => {
    state.data.value = inheriting
    mountModal({ canUpdate: false })
    await flushPromises()
    expect(body().find('[data-testid="variant-packaging-choice"]').exists()).toBe(false)
    expect(body().find('[data-testid="variant-packaging-save"]').exists()).toBe(false)
  })
})

describe('VariantPackagingModal — choose inherit (DELETE) or own (PUT)', () => {
  it('«Empaque propio» sends the whole record in grams and cm', async () => {
    state.data.value = inheriting
    state.save.mutateAsync.mockResolvedValue(overriding)
    const wrapper = mountModal()
    await flushPromises()
    expect(body().text()).toContain('Usar el empaque del producto')
    await chooseOwn()
    // Prefilled from what it uses today, so a small change is quick.
    expect((body().find('#variant-packaging-weight').element as HTMLInputElement).value).toBe('0.32')
    await body().find('#variant-packaging-weight').setValue('0.48')
    await body().find('[data-testid="variant-packaging-save"]').trigger('click')
    await flushPromises()

    expect(state.save.mutateAsync).toHaveBeenCalledWith({ weightG: 480, lengthCm: 25, widthCm: 18, heightCm: 4.5 })
    expect(state.remove.mutateAsync).not.toHaveBeenCalled()
    const openEvents = wrapper.emitted('update:open') ?? []
    expect(openEvents[openEvents.length - 1]).toEqual([false])
  })

  it('«Usar el empaque del producto» on an own record sends DELETE', async () => {
    state.data.value = overriding
    state.remove.mutateAsync.mockResolvedValue(undefined)
    mountModal()
    await flushPromises()
    const productChoice = body().findAll('[role="radio"]').find((item) => item.attributes('value') === 'product')
    await productChoice!.trigger('click')
    await body().find('[data-testid="variant-packaging-save"]').trigger('click')
    await flushPromises()
    expect(state.remove.mutateAsync).toHaveBeenCalled()
    expect(state.save.mutateAsync).not.toHaveBeenCalled()
  })

  it('nothing to save while it already inherits', async () => {
    state.data.value = inheriting
    mountModal()
    await flushPromises()
    expect(body().find('[data-testid="variant-packaging-save"]').attributes('disabled')).toBeDefined()
  })

  it('validates the own record and maps a 404 to the variant, in Spanish', async () => {
    state.data.value = nothing
    mountModal()
    await flushPromises()
    await chooseOwn()
    await body().find('[data-testid="variant-packaging-save"]').trigger('click')
    expect(body().text()).toContain('Escribe el peso.')
    expect(state.save.mutateAsync).not.toHaveBeenCalled()

    for (const [id, value] of [['weight', '1'], ['length', '10'], ['width', '10'], ['height', '10']]) {
      await body().find(`#variant-packaging-${id}`).setValue(value)
    }
    state.save.mutateAsync.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404, data: { statusCode: 404, error: 'ENTITY_NOT_FOUND', message: 'Variant with id "v" not found', timestamp: 't' } },
    })
    await body().find('[data-testid="variant-packaging-save"]').trigger('click')
    await flushPromises()
    expect(body().find('[data-testid="variant-packaging-error"]').text()).toBe(
      'Esta variante ya no existe en este producto. Recarga la página.',
    )
    expect(body().text()).not.toContain('not found')
  })
})
