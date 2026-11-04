import { computed, defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inventoryApi } from '../../api/inventory.api'
import type { AdjustmentDialogTarget, AdjustmentResult } from '../../interfaces/inventory.types'
import type { InventoryContext } from '../../composables/useInventoryAccess'
import StockAdjustmentDialog from '../StockAdjustmentDialog.vue'

const holder = vi.hoisted(() => ({ context: null as unknown as { value: InventoryContext } }))
vi.mock('../../composables/useInventoryAccess', () => ({ useInventoryContext: () => holder.context }))
vi.mock('../../api/inventory.api', () => ({ inventoryApi: { adjust: vi.fn() } }))

const target = (patch: Partial<AdjustmentDialogTarget> = {}): AdjustmentDialogTarget => ({
  productId: 'p1', productName: 'Croquetas Adulto 15 kg', lotId: 'l1', bucketLabel: 'Lote L-2027-01',
  quantity: 22, version: 5, ...patch,
})
const result = { movement: { id: 'm1' }, stock: { product: { id: 'p1', quantity: 14 } } } as unknown as AdjustmentResult
const Overlay = defineComponent({
  props: ['open', 'title', 'dismissible', 'close'],
  setup(props, { slots }) {
    return () => props.open
      ? h('section', { 'data-testid': 'overlay', 'data-dismissible': String(props.dismissible) }, [
        h('h2', props.title), slots.body?.(), slots.footer?.(),
      ])
      : null
  },
})
const mounted: VueWrapper[] = []
function mountDialog(props: Record<string, unknown> = {}, canAdjust = true) {
  holder.context = computed(() => ({ userId: 'user-1', tenantId: 'branch-1', ready: true, canRead: true, canAdjust }))
  const wrapper = mount(StockAdjustmentDialog, {
    attachTo: document.body,
    props: { open: true, target: target(), ...props },
    global: { stubs: { UModal: Overlay, Modal: Overlay } },
  })
  mounted.push(wrapper)
  return wrapper
}
const quantityInput = (wrapper: VueWrapper) => wrapper.get('input[name="quantity"]')
const noteArea = (wrapper: VueWrapper) => wrapper.get('textarea[name="note"]')
const submit = (wrapper: VueWrapper) => wrapper.get('[data-testid="adjustment-submit"]')
async function chooseMode(wrapper: VueWrapper, mode: 'add' | 'remove' | 'count') {
  await wrapper.get(`[data-testid="adjustment-mode"] [value="${mode}"]`).trigger('click')
  await nextTick()
}
async function chooseReason(wrapper: VueWrapper, reason: string) {
  wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', reason)
  await nextTick()
}
async function fill(wrapper: VueWrapper, { mode = 'remove', quantity = '8', reason = 'EXPIRED', note = '' } = {}) {
  await chooseMode(wrapper, mode as 'add' | 'remove' | 'count')
  await quantityInput(wrapper).setValue(quantity)
  await chooseReason(wrapper, reason)
  if (note) await noteArea(wrapper).setValue(note)
}
const httpError = (status: number, error: string) =>
  Object.assign(new Error(error), { response: { status, data: { statusCode: status, error, message: 'server text' } } })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
beforeEach(() => vi.resetAllMocks())
afterEach(() => { mounted.splice(0).forEach(wrapper => wrapper.unmount()); document.body.innerHTML = '' })

describe('adjustment dialog — four states', () => {
  it('empty: a blank form with the target summary, no preview, no counter and no error', () => {
    const wrapper = mountDialog()
    const summary = wrapper.get('[data-testid="adjustment-summary"]').text()
    expect(wrapper.get('h2').text()).toBe('Ajustar stock')
    expect(summary).toContain('Croquetas Adulto 15 kg')
    expect(summary).toContain('Lote L-2027-01')
    expect(summary).toContain('22')
    expect(summary).not.toContain('l1')
    expect((quantityInput(wrapper).element as HTMLInputElement).value).toBe('')
    expect(wrapper.find('[data-testid="adjustment-result"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="note-counter"]').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(submit(wrapper).text()).toBe('Aplicar ajuste')
  })

  it('data: a typed quantity previews the resulting stock', async () => {
    const wrapper = mountDialog()
    await chooseMode(wrapper, 'remove')
    await quantityInput(wrapper).setValue('8')
    expect(wrapper.get('[data-testid="adjustment-result"]').text()).toContain('14')
    await chooseMode(wrapper, 'add')
    expect(wrapper.get('[data-testid="adjustment-result"]').text()).toContain('30')
  })

  it('loading: locks the fields, shows the busy primary and refuses to be dismissed while sending', async () => {
    const wrapper = mountDialog()
    const pending = deferred<AdjustmentResult>()
    vi.mocked(inventoryApi.adjust).mockReturnValue(pending.promise)
    await fill(wrapper, { note: 'Retirado del anaquel' })
    await submit(wrapper).trigger('click')
    await nextTick()
    expect(wrapper.get('[data-testid="overlay"]').attributes('data-dismissible')).toBe('false')
    expect(submit(wrapper).attributes('disabled')).toBeDefined()
    expect(quantityInput(wrapper).attributes('disabled')).toBeDefined()
    expect(noteArea(wrapper).attributes('disabled')).toBeDefined()
    await submit(wrapper).trigger('click')
    expect(inventoryApi.adjust).toHaveBeenCalledTimes(1)
    pending.resolve(result)
    await flushPromises()
    expect(wrapper.get('[data-testid="overlay"]').attributes('data-dismissible')).toBe('true')
  })

  it('error: a rejection shows a fixed sentence, never the server text, and keeps the dialog open', async () => {
    const wrapper = mountDialog()
    vi.mocked(inventoryApi.adjust).mockRejectedValue(httpError(404, 'NOT_FOUND'))
    await fill(wrapper)
    await submit(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('El producto, lote o variante ya no existe.')
    expect(wrapper.text()).not.toContain('server text')
    expect(wrapper.emitted('applied')).toBeUndefined()
    expect(wrapper.emitted('update:open')).toBeUndefined()
  })
})

describe('adjustment request', () => {
  it('sends a subtraction as a negative delta with the row version, reason, trimmed note and a fresh key', async () => {
    const wrapper = mountDialog()
    vi.mocked(inventoryApi.adjust).mockResolvedValue(result)
    await fill(wrapper, { note: '  Lote vencido retirado  ' })
    await submit(wrapper).trigger('click')
    await flushPromises()
    const [body, key, signal] = vi.mocked(inventoryApi.adjust).mock.calls[0]!
    expect(body).toEqual({
      target: { productId: 'p1', lotId: 'l1' }, expectedVersion: 5, delta: -8, reason: 'EXPIRED', note: 'Lote vencido retirado',
    })
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
    expect(signal).toEqual(expect.any(AbortSignal))
    expect(wrapper.emitted('applied')).toEqual([[result]])
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })

  it('sends an addition as a positive delta on a variant target', async () => {
    const wrapper = mountDialog({ target: target({ lotId: undefined, variantId: 'v1', bucketLabel: 'Chico · Azul', quantity: 15, version: 1 }) })
    vi.mocked(inventoryApi.adjust).mockResolvedValue(result)
    await fill(wrapper, { mode: 'add', quantity: '3', reason: 'DATA_ENTRY_CORRECTION' })
    await submit(wrapper).trigger('click')
    await flushPromises()
    expect(vi.mocked(inventoryApi.adjust).mock.calls[0]![0]).toStrictEqual({
      target: { productId: 'p1', variantId: 'v1' }, expectedVersion: 1, delta: 3, reason: 'DATA_ENTRY_CORRECTION',
    })
  })

  it('targets the untracked bucket with the product alone', async () => {
    const wrapper = mountDialog({ target: target({ lotId: undefined, bucketLabel: 'Sin lote', quantity: 12, version: 3 }) })
    vi.mocked(inventoryApi.adjust).mockResolvedValue(result)
    await fill(wrapper, { quantity: '2', reason: 'THEFT_LOSS' })
    await submit(wrapper).trigger('click')
    await flushPromises()
    expect(vi.mocked(inventoryApi.adjust).mock.calls[0]![0].target).toStrictEqual({ productId: 'p1' })
  })

  it('sends nothing when the user cannot adjust', async () => {
    const wrapper = mountDialog({}, false)
    await fill(wrapper)
    await submit(wrapper).trigger('click')
    await flushPromises()
    expect(inventoryApi.adjust).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toBe('No tienes permiso para ajustar el stock.')
  })
})

describe('reasons and note', () => {
  it('offers the six fixed reasons in a USelect with the Spanish labels', () => {
    const wrapper = mountDialog()
    const select = wrapper.findComponent({ name: 'Select' })
    expect(select.exists()).toBe(true)
    expect((select.props('items') as Array<{ label: string; value: string }>).map(item => [item.value, item.label])).toEqual([
      ['PHYSICAL_COUNT', 'Conteo físico'], ['DAMAGE', 'Merma/daño'], ['EXPIRED', 'Caducado'],
      ['THEFT_LOSS', 'Robo/pérdida'], ['DATA_ENTRY_CORRECTION', 'Corrección de captura'], ['OTHER', 'Otro'],
    ])
  })

  it('requires a reason before sending', async () => {
    const wrapper = mountDialog()
    await chooseMode(wrapper, 'remove')
    await quantityInput(wrapper).setValue('2')
    await submit(wrapper).trigger('click')
    expect(inventoryApi.adjust).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="reason-error"]').text()).toBe('Elige un motivo.')
  })

  it('requires a note for «Otro» and sends nothing until it is written', async () => {
    const wrapper = mountDialog()
    vi.mocked(inventoryApi.adjust).mockResolvedValue(result)
    await fill(wrapper, { reason: 'OTHER' })
    await submit(wrapper).trigger('click')
    expect(inventoryApi.adjust).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="note-error"]').text()).toBe('Escribe una nota para el motivo «Otro».')
    await noteArea(wrapper).setValue('   ')
    await submit(wrapper).trigger('click')
    expect(inventoryApi.adjust).not.toHaveBeenCalled()
    await noteArea(wrapper).setValue('Se cayó el estante')
    await nextTick()
    expect(wrapper.find('[data-testid="note-error"]').exists()).toBe(false)
    await submit(wrapper).trigger('click')
    await flushPromises()
    expect(vi.mocked(inventoryApi.adjust).mock.calls[0]![0]).toMatchObject({ reason: 'OTHER', note: 'Se cayó el estante' })
  })

  it('keeps the note optional for the other reasons and omits a blank one', async () => {
    const wrapper = mountDialog()
    vi.mocked(inventoryApi.adjust).mockResolvedValue(result)
    await fill(wrapper, { reason: 'DAMAGE', note: '    ' })
    await submit(wrapper).trigger('click')
    await flushPromises()
    expect(vi.mocked(inventoryApi.adjust).mock.calls[0]![0]).not.toHaveProperty('note')
  })

  it('shows the counter only from 90% of the 500 limit, warning first and danger at the limit', async () => {
    const wrapper = mountDialog()
    await noteArea(wrapper).setValue('x'.repeat(449))
    expect(wrapper.find('[data-testid="note-counter"]').exists()).toBe(false)
    await noteArea(wrapper).setValue('x'.repeat(450))
    const counter = wrapper.get('[data-testid="note-counter"]')
    expect(counter.text()).toBe('450 / 500')
    expect(counter.attributes('aria-live')).toBe('polite')
    expect(counter.classes()).not.toContain('at-limit')
    await noteArea(wrapper).setValue('x'.repeat(500))
    expect(wrapper.get('[data-testid="note-counter"]').classes()).toContain('at-limit')
  })

  it('refuses a note over 500 characters next to the field', async () => {
    const wrapper = mountDialog()
    await fill(wrapper, { reason: 'DAMAGE', note: 'x'.repeat(501) })
    await submit(wrapper).trigger('click')
    expect(inventoryApi.adjust).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="note-error"]').text()).toBe('La nota admite hasta 500 caracteres.')
  })
})

describe('quantity and physical count', () => {
  it('refuses a result below zero next to the field without calling the server', async () => {
    const wrapper = mountDialog()
    await fill(wrapper, { quantity: '23' })
    await submit(wrapper).trigger('click')
    expect(inventoryApi.adjust).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="quantity-error"]').text()).toBe('El stock no puede quedar en negativo.')
  })

  it.each(['', '0', '1.5', '-3', 'abc'])('refuses the quantity «%s»', async (value) => {
    const wrapper = mountDialog()
    await fill(wrapper, { quantity: value })
    await submit(wrapper).trigger('click')
    expect(inventoryApi.adjust).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="quantity-error"]').exists()).toBe(true)
  })

  it('asks for the counted quantity in «Conteo físico» and shows the computed delta', async () => {
    const wrapper = mountDialog()
    await chooseMode(wrapper, 'count')
    expect(wrapper.text()).toContain('Cantidad contada')
    await quantityInput(wrapper).setValue('14')
    expect(wrapper.get('[data-testid="count-delta"]').text()).toBe('Diferencia: −8')
    await quantityInput(wrapper).setValue('30')
    expect(wrapper.get('[data-testid="count-delta"]').text()).toBe('Diferencia: +8')
  })

  it('sends counted minus shown as the delta with the physical-count reason preselected', async () => {
    const wrapper = mountDialog()
    vi.mocked(inventoryApi.adjust).mockResolvedValue(result)
    await chooseMode(wrapper, 'count')
    await quantityInput(wrapper).setValue('14')
    await submit(wrapper).trigger('click')
    await flushPromises()
    expect(vi.mocked(inventoryApi.adjust).mock.calls[0]![0]).toStrictEqual({
      target: { productId: 'p1', lotId: 'l1' }, expectedVersion: 5, delta: -8, reason: 'PHYSICAL_COUNT',
    })
  })

  it('counts zero units as a valid count and refuses a count equal to the shown stock', async () => {
    const wrapper = mountDialog()
    vi.mocked(inventoryApi.adjust).mockResolvedValue(result)
    await chooseMode(wrapper, 'count')
    await quantityInput(wrapper).setValue('22')
    expect(wrapper.get('[data-testid="count-delta"]').text()).toBe('Sin diferencia')
    await submit(wrapper).trigger('click')
    expect(inventoryApi.adjust).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="quantity-error"]').text()).toBe('La cantidad contada es igual al stock actual.')
    await quantityInput(wrapper).setValue('0')
    await submit(wrapper).trigger('click')
    await flushPromises()
    expect(vi.mocked(inventoryApi.adjust).mock.calls[0]![0].delta).toBe(-22)
  })
})

describe('rejections leave the shown stock unchanged', () => {
  it('explains INSUFFICIENT_STOCK next to the quantity field and does not report an applied adjustment', async () => {
    const wrapper = mountDialog()
    vi.mocked(inventoryApi.adjust).mockRejectedValue(httpError(409, 'INSUFFICIENT_STOCK'))
    await fill(wrapper, { quantity: '20' })
    await submit(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="quantity-error"]').text()).toBe('No hay suficiente stock para restar esa cantidad.')
    expect(wrapper.emitted('applied')).toBeUndefined()
    expect(wrapper.get('[data-testid="adjustment-summary"]').text()).toContain('22')
    expect(wrapper.get('[data-testid="adjustment-summary"]').text()).not.toContain('2 unidades')
  })

  it('on a version conflict asks the parent to reload and resubmits with the new version and a new key', async () => {
    const wrapper = mountDialog()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(httpError(409, 'STOCK_VERSION_CONFLICT')).mockResolvedValueOnce(result)
    await fill(wrapper, { quantity: '5' })
    await submit(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('El stock cambió mientras lo ajustabas. Revisa la cantidad actual.')
    expect(wrapper.emitted('reload')).toHaveLength(1)
    expect(wrapper.emitted('applied')).toBeUndefined()
    await wrapper.setProps({ target: target({ quantity: 30, version: 6 }) })
    expect(wrapper.get('[data-testid="adjustment-summary"]').text()).toContain('30')
    await submit(wrapper).trigger('click')
    await flushPromises()
    const [first, second] = vi.mocked(inventoryApi.adjust).mock.calls
    expect(second![0].expectedVersion).toBe(6)
    expect(second![1]).not.toBe(first![1])
    expect(wrapper.emitted('applied')).toHaveLength(1)
  })

  it.each([
    ['STOCK_NOT_TRACKED', 409, 'Este producto no lleva control de stock.'],
    ['IDEMPOTENCY_KEY_CONFLICT', 409, 'Este ajuste ya se había enviado con otros datos. Ábrelo de nuevo para ajustar.'],
    ['FORBIDDEN', 403, 'No tienes permiso para ajustar el stock.'],
    ['MALFORMED', 400, 'Revisa la cantidad, el motivo y la nota.'],
  ])('maps %s to its sentence in the alert', async (code, status, copy) => {
    const wrapper = mountDialog()
    vi.mocked(inventoryApi.adjust).mockRejectedValue(httpError(status, code))
    await fill(wrapper)
    await submit(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe(copy)
    expect(wrapper.emitted('applied')).toBeUndefined()
  })

  it('clears a stale rejection once the user edits the quantity', async () => {
    const wrapper = mountDialog()
    vi.mocked(inventoryApi.adjust).mockRejectedValue(httpError(409, 'INSUFFICIENT_STOCK'))
    await fill(wrapper, { quantity: '20' })
    await submit(wrapper).trigger('click')
    await flushPromises()
    await quantityInput(wrapper).setValue('5')
    expect(wrapper.find('[data-testid="quantity-error"]').exists()).toBe(false)
  })
})

describe('uncertain result', () => {
  it('keeps the form locked, offers Reintentar with the same key and body, and applies on success', async () => {
    const wrapper = mountDialog()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(new Error('Network Error')).mockResolvedValueOnce(result)
    await fill(wrapper)
    await submit(wrapper).trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('No pudimos confirmar si el ajuste se aplicó.')
    expect(submit(wrapper).text()).toBe('Reintentar')
    expect(quantityInput(wrapper).attributes('disabled')).toBeDefined()
    await submit(wrapper).trigger('click')
    await flushPromises()
    const [first, second] = vi.mocked(inventoryApi.adjust).mock.calls
    expect(second![1]).toBe(first![1])
    expect(second![0]).toBe(first![0])
    expect(wrapper.emitted('applied')).toEqual([[result]])
  })

  it('lets the user review the stock instead, dropping the attempt and asking the parent to reload', async () => {
    const wrapper = mountDialog()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(httpError(500, 'INTERNAL_ERROR'))
    await fill(wrapper)
    await submit(wrapper).trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="adjustment-review"]').trigger('click')
    await flushPromises()
    expect(wrapper.emitted('reload')).toHaveLength(1)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(submit(wrapper).text()).toBe('Aplicar ajuste')
    expect(quantityInput(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('asks the parent to reload when dismissed with an unknown result', async () => {
    const wrapper = mountDialog()
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(new Error('timeout'))
    await fill(wrapper)
    await submit(wrapper).trigger('click')
    await flushPromises()
    wrapper.findComponent(Overlay).vm.$emit('update:open', false)
    await flushPromises()
    expect(wrapper.emitted('reload')).toHaveLength(1)
    expect(wrapper.emitted('update:open')).toEqual([[false]])
  })
})

describe('reopening', () => {
  it('starts blank every time it opens', async () => {
    const wrapper = mountDialog()
    await fill(wrapper, { note: 'algo' })
    await wrapper.setProps({ open: false })
    await wrapper.setProps({ open: true })
    expect((quantityInput(wrapper).element as HTMLInputElement).value).toBe('')
    expect((noteArea(wrapper).element as HTMLTextAreaElement).value).toBe('')
  })
})
