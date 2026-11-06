import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { shallowRef } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import ProductPackagingSection from '../ProductPackagingSection.vue'
import type { PackagingRecord } from '../../interfaces/product-packaging.types'

const toast = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('@nuxt/ui/runtime/composables/useToast', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useToast: () => toast,
}))

const confirm = vi.fn()
vi.mock('@/core/shared/composables/useConfirm', () => ({ useConfirm: () => ({ confirm }) }))

const state = {
  packaging: shallowRef<PackagingRecord | null | undefined>(undefined),
  isLoading: shallowRef(false),
  isError: shallowRef(false),
  isFetching: shallowRef(false),
  refetch: vi.fn(),
  save: { mutateAsync: vi.fn(), isPending: shallowRef(false) },
  remove: { mutateAsync: vi.fn(), isPending: shallowRef(false) },
}
vi.mock('../../composables/useProductPackaging', () => ({ useProductPackaging: () => state }))

const record: PackagingRecord = {
  weightG: 320,
  lengthCm: 25,
  widthCm: 18,
  heightCm: 4.5,
  updatedAt: '2026-11-04T19:40:00.000Z',
}

const mountSection = (props: Record<string, unknown> = {}) =>
  mountWithUApp(ProductPackagingSection, {
    attachTo: document.body,
    props: { productId: '6f1c0000-0000-4000-8000-000000000001', canUpdate: true, ...props },
  })

async function typeInto(wrapper: ReturnType<typeof mountSection>, id: string, value: string) {
  await wrapper.find(`#${id}`).setValue(value)
}

const axiosError = (status: number, data: unknown) => ({ isAxiosError: true, response: { status, data } })

beforeEach(() => {
  vi.clearAllMocks()
  state.packaging.value = undefined
  state.isLoading.value = false
  state.isError.value = false
  document.body.innerHTML = ''
})

describe('ProductPackagingSection — states', () => {
  it('loading shows the skeleton of the summary', () => {
    state.isLoading.value = true
    const wrapper = mountSection()
    expect(wrapper.find('[data-testid="packaging-loading"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Empaque para envío')
  })

  it('error says what did not load, in Spanish, and retries', async () => {
    state.isError.value = true
    const wrapper = mountSection()
    const alert = wrapper.find('[role="alert"]')
    expect(alert.text()).toContain('No se pudo cargar el empaque')
    await wrapper.find('[data-testid="packaging-retry"]').trigger('click')
    expect(state.refetch).toHaveBeenCalled()
  })

  it('empty offers «Agregar empaque» only with update:Product', () => {
    state.packaging.value = null
    const editable = mountSection()
    expect(editable.text()).toContain('Sin empaque registrado')
    expect(editable.find('[data-testid="packaging-add"]').exists()).toBe(true)

    const readonly = mountSection({ canUpdate: false })
    expect(readonly.text()).toContain('Sin empaque registrado')
    expect(readonly.find('[data-testid="packaging-add"]').exists()).toBe(false)
  })

  it('data shows weight in kg and size in cm, never the product id', () => {
    state.packaging.value = record
    const wrapper = mountSection()
    const summary = wrapper.find('[data-testid="packaging-summary"]')
    expect(summary.text()).toContain('0.32 kg')
    expect(summary.text()).toContain('25 × 18 × 4.5 cm')
    expect(wrapper.text()).not.toContain('6f1c')
    expect(wrapper.find('[data-testid="packaging-edit"]').exists()).toBe(true)
  })

  it('without update:Product the summary has no actions', () => {
    state.packaging.value = record
    const wrapper = mountSection({ canUpdate: false })
    expect(wrapper.find('[data-testid="packaging-edit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="packaging-remove"]').exists()).toBe(false)
  })
})

describe('ProductPackagingSection — save and remove', () => {
  it('saves kg and cm as grams and cm through its own action', async () => {
    state.packaging.value = record
    state.save.mutateAsync.mockResolvedValue({ productId: 'p', packaging: record })
    const wrapper = mountSection()
    await wrapper.find('[data-testid="packaging-edit"]').trigger('click')
    expect((wrapper.find('#product-packaging-weight').element as HTMLInputElement).value).toBe('0.32')

    await typeInto(wrapper, 'product-packaging-weight', '1,25')
    await typeInto(wrapper, 'product-packaging-height', '8.3')
    await wrapper.find('[data-testid="packaging-save"]').trigger('click')
    await flushPromises()

    expect(state.save.mutateAsync).toHaveBeenCalledWith({ weightG: 1250, lengthCm: 25, widthCm: 18, heightCm: 8.3 })
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Empaque guardado', color: 'success' }))
    expect(wrapper.find('[data-testid="packaging-summary"]').exists()).toBe(true)
  })

  it('requires all four fields before sending', async () => {
    state.packaging.value = null
    const wrapper = mountSection()
    await wrapper.find('[data-testid="packaging-add"]').trigger('click')
    await wrapper.find('[data-testid="packaging-save"]').trigger('click')

    expect(state.save.mutateAsync).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Escribe el peso.')
    expect(wrapper.text()).toContain('Escribe el largo.')
    expect(wrapper.find('#product-packaging-weight').attributes('aria-invalid')).toBe('true')
  })

  it('shows a 400 constraint under its field and a 404 by the action, in Spanish', async () => {
    state.packaging.value = record
    state.save.mutateAsync.mockRejectedValueOnce(
      axiosError(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: [{ property: 'widthCm', children: [], constraints: { max: 'widthCm must not be greater than 300' } }],
      }),
    )
    const wrapper = mountSection()
    await wrapper.find('[data-testid="packaging-edit"]').trigger('click')
    await wrapper.find('[data-testid="packaging-save"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('#product-packaging-width-message').text()).toContain('Revisa el ancho')
    expect(wrapper.text()).not.toContain('must not be')

    state.save.mutateAsync.mockRejectedValueOnce(
      axiosError(404, { statusCode: 404, error: 'ENTITY_NOT_FOUND', message: 'Product with id "x" not found', timestamp: 't' }),
    )
    await wrapper.find('[data-testid="packaging-save"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="packaging-form-error"]').text()).toBe(
      'Este producto ya no existe en la sucursal. Recarga la página.',
    )
  })

  it('removes after a danger confirmation, and not when it is declined', async () => {
    state.packaging.value = record
    const wrapper = mountSection()
    confirm.mockResolvedValueOnce(false)
    await wrapper.find('[data-testid="packaging-remove"]').trigger('click')
    await flushPromises()
    expect(state.remove.mutateAsync).not.toHaveBeenCalled()

    confirm.mockResolvedValueOnce(true)
    state.remove.mutateAsync.mockResolvedValue(undefined)
    await wrapper.find('[data-testid="packaging-remove"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenLastCalledWith(expect.objectContaining({ tone: 'danger', title: '¿Quitar el empaque?' }))
    expect(state.remove.mutateAsync).toHaveBeenCalled()
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ title: 'Empaque quitado' }))
  })
})
