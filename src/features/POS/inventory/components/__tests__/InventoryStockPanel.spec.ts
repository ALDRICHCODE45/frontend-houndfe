/**
 * InventoryStockPanel — the four S9 states (empty, loading, data, error) against the
 * real composables, kardex table and adjustment dialog; only the API, the context and
 * the overlay primitive are replaced.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { computed, defineComponent, h, ref } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inventoryApi } from '../../api/inventory.api'
import type { AdjustmentResult, StockMovement, StockSnapshot } from '../../interfaces/inventory.types'
import type { InventoryContext } from '../../composables/useInventoryAccess'
import InventoryStockPanel from '../InventoryStockPanel.vue'

const holder = vi.hoisted(() => ({ context: null as unknown as { value: InventoryContext } }))
vi.mock('../../composables/useInventoryAccess', () => ({ useInventoryContext: () => holder.context }))
vi.mock('../../api/inventory.api', () => ({ inventoryApi: { getStock: vi.fn(), listMovements: vi.fn(), adjust: vi.fn() } }))
const isBelowBreakpoint = ref(false)
vi.mock('@vueuse/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useBreakpoints: () => ({ smaller: () => isBelowBreakpoint }) }
})

const snapshot = (overrides: Partial<StockSnapshot> = {}): StockSnapshot => ({
  product: { id: 'p1', name: 'Croquetas Adulto 15 kg', useStock: true, quantity: 72, untracked: { quantity: 12, version: 1 }, sellable: 64 },
  lots: [
    { id: 'l-old', lotNumber: 'L-2026-08', expirationDate: '2026-10-15', quantity: 8, expired: true, version: 1 },
    { id: 'l-a', lotNumber: 'L-2027-01', expirationDate: '2027-01-15', quantity: 22, expired: false, version: 1 },
    { id: 'l-b', lotNumber: 'L-2027-06', expirationDate: '2027-06-30', quantity: 30, expired: false, version: 1 },
  ],
  variants: [], ...overrides,
})
const variantStock = snapshot({
  product: { id: 'p2', name: 'Collar ajustable', useStock: true, quantity: 24, untracked: { quantity: 0, version: 0 }, sellable: 24 },
  lots: [], variants: [{ id: 'v1', label: 'Chico · Azul', quantity: 15, version: 1 }, { id: 'v2', label: 'Mediano · Rojo', quantity: 9, version: 1 }],
})
const movement = (id: string, patch: Partial<StockMovement> = {}): StockMovement => ({
  id, type: 'INITIAL', bucket: 'PRODUCT_UNTRACKED', productId: 'p1', variantId: null, lotId: null,
  labels: { product: 'Croquetas', variant: null, lot: null }, delta: 12, balanceAfter: 12, productBalanceAfter: 12,
  reason: null, note: null, removalCause: null, group: { type: 'PRODUCT', id: 'p1' }, actor: { displayName: 'Manager Centro' },
  createdAt: '2026-11-04T10:00:00.000Z', ...patch,
})
const Overlay = defineComponent({
  props: ['open'],
  setup(props, { slots }) { return () => props.open ? h('section', { 'data-testid': 'overlay' }, [slots.body?.(), slots.footer?.()]) : null },
})
const httpError = (status: number, error: string) =>
  Object.assign(new Error(error), { response: { status, data: { statusCode: status, error } } })
const mounted: Array<{ wrapper: VueWrapper; client: QueryClient }> = []

function setup(context: Partial<InventoryContext> = {}, productId = 'p1') {
  holder.context = computed(() => ({ userId: 'user-1', tenantId: 'branch-1', ready: true, canRead: true, canAdjust: true, ...context }))
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const wrapper = mount(InventoryStockPanel, {
    attachTo: document.body, props: { productId },
    global: { plugins: [[VueQueryPlugin, { queryClient: client }]], stubs: { UModal: Overlay, Modal: Overlay } },
  })
  mounted.push({ wrapper, client })
  return wrapper
}
const total = (wrapper: VueWrapper) => wrapper.get('[data-testid="stock-total"]').text()
const rows = (wrapper: VueWrapper) => wrapper.findAll('[data-testid="stock-row"]')
async function openAdjust(wrapper: VueWrapper, label: string) {
  await wrapper.get(`[data-testid="stock-adjust"][aria-label="Ajustar stock de ${label}"]`).trigger('click')
  await flushPromises()
}
async function typeAdjustment(wrapper: VueWrapper, quantity: string, reason = 'DAMAGE') {
  await wrapper.get('[data-testid="adjustment-mode"] [value="remove"]').trigger('click')
  await wrapper.get('input[name="quantity"]').setValue(quantity)
  wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', reason)
  await flushPromises()
  await wrapper.get('[data-testid="adjustment-submit"]').trigger('click')
  await flushPromises()
}
beforeEach(() => {
  vi.resetAllMocks()
  isBelowBreakpoint.value = false
  vi.mocked(inventoryApi.getStock).mockResolvedValue(snapshot())
  vi.mocked(inventoryApi.listMovements).mockResolvedValue({ items: [movement('m1')], nextCursor: null })
})
afterEach(() => { mounted.splice(0).forEach(({ wrapper, client }) => { wrapper.unmount(); client.clear() }); document.body.innerHTML = '' })

describe('stock panel — loading', () => {
  it('shows a skeleton with the final shape and no figures while the stock loads', async () => {
    vi.mocked(inventoryApi.getStock).mockReturnValue(new Promise(() => {}))
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.get('[data-testid="stock-skeleton"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-testid="stock-total"]').exists()).toBe(false)
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
  })
})

describe('stock panel — error', () => {
  it('shows a fixed title in a danger alert (never the server text) and Reintentar reads again', async () => {
    vi.mocked(inventoryApi.getStock).mockRejectedValueOnce(httpError(500, 'INTERNAL_ERROR'))
    const wrapper = setup()
    await flushPromises()
    const state = wrapper.get('[data-testid="stock-state"] .hf-empty-state')
    expect(state.attributes('data-kind')).toBe('error')
    expect(state.attributes('role')).toBe('alert')
    expect(state.get('.hf-empty-state__title').text()).toBe('No se pudo cargar el stock')
    await state.get('[data-testid="empty-state-action"]').trigger('click')
    await flushPromises()
    expect(inventoryApi.getStock).toHaveBeenCalledTimes(2)
    expect(total(wrapper)).toBe('72')
  })

  it('says the product was not found when the server answers 404', async () => {
    vi.mocked(inventoryApi.getStock).mockRejectedValueOnce(httpError(404, 'NOT_FOUND'))
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.get('.hf-empty-state').get('.hf-empty-state__title').text()).toBe('No se pudo cargar el stock')
  })
})

describe('stock panel — empty', () => {
  it('says a product without stock control has no stock to show, and offers no action', async () => {
    vi.mocked(inventoryApi.getStock).mockResolvedValue(snapshot({
      product: { id: 'p1', name: 'Placa grabada', useStock: false, quantity: 0, untracked: { quantity: 0, version: 0 }, sellable: null },
      lots: [],
    }))
    const wrapper = setup()
    await flushPromises()
    const state = wrapper.get('[data-testid="stock-state"] .hf-empty-state')
    expect(state.attributes('data-kind')).toBe('empty')
    expect(state.get('.hf-empty-state__title').text()).toBe('Este producto no lleva control de stock')
    // The switch is «Controlar inventario» in Presentaciones; «Usar stock» named nothing on screen.
    expect(state.text()).toContain('Activa «Controlar inventario» en Presentaciones para llevar sus existencias.')
    expect(wrapper.find('[data-testid="stock-adjust"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="stock-total"]').exists()).toBe(false)
  })

  it('shows «Sin acceso» and sends no request without the read grant', async () => {
    const wrapper = setup({ canRead: false, canAdjust: false })
    await flushPromises()
    expect(wrapper.get('.hf-empty-state').attributes('data-kind')).toBe('forbidden')
    expect(inventoryApi.getStock).not.toHaveBeenCalled()
    expect(inventoryApi.listMovements).not.toHaveBeenCalled()
  })
})

describe('stock panel — data', () => {
  it('shows total and sellable stock, the untracked bucket and the lots in FEFO order', async () => {
    const wrapper = setup()
    await flushPromises()
    expect(inventoryApi.getStock).toHaveBeenCalledExactlyOnceWith('p1', expect.any(AbortSignal))
    expect(total(wrapper)).toBe('72')
    expect(wrapper.get('[data-testid="stock-sellable"]').text()).toBe('64')
    expect(wrapper.find('.hf-empty-state').exists()).toBe(false)
    expect(rows(wrapper).map(row => row.get('[data-testid="stock-label"]').text())).toEqual([
      'Sin lote', 'Lote L-2026-08', 'Lote L-2027-01', 'Lote L-2027-06',
    ])
    expect(rows(wrapper).map(row => row.get('[data-testid="stock-quantity"]').text())).toEqual(['12', '8', '22', '30'])
    expect(rows(wrapper)[2]!.text()).toContain('15 ene 2027')
    expect(wrapper.html()).not.toMatch(/l-old|l-a|l-b/)
  })

  // A lot or a presentation is not a place: «Ubicación» read like the shelf of the product.
  it('heads the stock and the kardex with «Lote» for a product with lots', async () => {
    const wrapper = setup()
    await flushPromises()
    const table = wrapper.get('table[aria-label="Existencias por lote"]')
    expect(table.findAll('thead th')[0]!.text()).toBe('Lote')
    expect(wrapper.get('[data-testid="kardex-filters"]').attributes('aria-label')).toBe('Filtrar por lote')
    expect(wrapper.text()).not.toContain('Ubicación')
  })

  it('says «Venció» for the expired lot under its name', async () => {
    const wrapper = setup()
    await flushPromises()
    expect(rows(wrapper)[1]!.get('.stock-expires').text()).toBe('Venció 15 oct 2026')
  })

  // Found in the T10 runtime check: at 390 the four columns were 419px wide in a 356px card, so every
  // «Ajustar» sat behind a horizontal scroll. Below 480px the Vence column folds under the lot name.
  it('repeats the expiry under the lot name and folds the Vence column on narrow screens', async () => {
    const wrapper = setup()
    await flushPromises()
    expect(rows(wrapper)[0]!.find('.stock-expires').exists()).toBe(false)
    expect(rows(wrapper)[2]!.get('.stock-expires').text()).toBe('Vence 15 ene 2027')
    const source = readFileSync(resolve(__dirname, '../InventoryStockPanel.vue'), 'utf8')
    expect(source).toMatch(/@media \(max-width: 480px\)\s*\{[^}]*\.stock-when-col\s*\{\s*display:\s*none/)
    expect(source).toMatch(/\.stock-expires\s*\{\s*display:\s*none/)
  })

  it('marks only the expired lot as «Vencido» and says it is not sold', async () => {
    const wrapper = setup()
    await flushPromises()
    const expired = rows(wrapper)[1]!
    expect(expired.get('.hf-status-badge').text()).toContain('Vencido')
    expect(expired.text()).toContain('No se vende')
    expect(rows(wrapper).filter(row => row.text().includes('Vencido'))).toHaveLength(1)
  })

  it('omits the sellable figure when the product has none', async () => {
    vi.mocked(inventoryApi.getStock).mockResolvedValue(snapshot({ product: { ...snapshot().product, sellable: null } }))
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.find('[data-testid="stock-sellable"]').exists()).toBe(false)
  })

  it('lists the variants of a product with variants and no untracked row', async () => {
    vi.mocked(inventoryApi.getStock).mockResolvedValue(variantStock)
    const wrapper = setup({}, 'p2')
    await flushPromises()
    expect(rows(wrapper).map(row => row.get('[data-testid="stock-label"]').text())).toEqual(['Chico · Azul', 'Mediano · Rojo'])
    const table = wrapper.get('table[aria-label="Existencias por presentación"]')
    expect(table.text()).not.toContain('Sin lote')
    expect(table.findAll('thead th')[0]!.text()).toBe('Presentación')
    expect(wrapper.get('[data-testid="kardex-filters"]').attributes('aria-label')).toBe('Filtrar por presentación')
    expect(total(wrapper)).toBe('24')
  })

  it('reads the kardex of the product and offers the lots as filters', async () => {
    const wrapper = setup()
    await flushPromises()
    expect(inventoryApi.listMovements).toHaveBeenCalledExactlyOnceWith({ productId: 'p1', cursor: undefined, limit: 25 }, expect.any(AbortSignal))
    expect(wrapper.text()).toContain('Manager Centro')
    const chips = wrapper.findAll('[data-testid="kardex-filters"] button').map(chip => chip.text())
    expect(chips).toEqual(['Todos', 'Lote L-2026-08', 'Lote L-2027-01', 'Lote L-2027-06'])
    await wrapper.findAll('[data-testid="kardex-filters"] button')[2]!.trigger('click')
    await flushPromises()
    expect(vi.mocked(inventoryApi.listMovements).mock.lastCall![0]).toEqual({ productId: 'p1', lotId: 'l-a', cursor: undefined, limit: 25 })
  })

  it('keeps the stock in view when the kardex fails, with its own error state', async () => {
    vi.mocked(inventoryApi.listMovements).mockRejectedValue(httpError(500, 'INTERNAL_ERROR'))
    const wrapper = setup()
    await flushPromises()
    expect(total(wrapper)).toBe('72')
    expect(wrapper.get('[data-testid="table-error-state"]').text()).toContain('No se pudieron cargar los movimientos')
  })
})

describe('stock panel — who can adjust', () => {
  it('offers «Ajustar» on every bucket with create:InventoryAdjustment', async () => {
    const wrapper = setup()
    await flushPromises()
    expect(wrapper.findAll('[data-testid="stock-adjust"]')).toHaveLength(4)
  })
  it('offers none with read access only (the stock and kardex still show)', async () => {
    const wrapper = setup({ canAdjust: false })
    await flushPromises()
    expect(wrapper.find('[data-testid="stock-adjust"]').exists()).toBe(false)
    expect(total(wrapper)).toBe('72')
  })
})

describe('stock panel — adjusting', () => {
  it('opens the dialog on the chosen lot, sends the closed request and shows the returned stock without re-reading', async () => {
    const wrapper = setup()
    await flushPromises()
    await openAdjust(wrapper, 'Lote L-2027-01')
    expect(wrapper.get('[data-testid="adjustment-summary"]').text()).toContain('Lote L-2027-01')
    expect(wrapper.get('[data-testid="adjustment-summary"]').text()).toContain('22')
    const after = snapshot({
      product: { ...snapshot().product, quantity: 64, sellable: 56 },
      lots: snapshot().lots.map(lot => lot.id === 'l-a' ? { ...lot, quantity: 14, version: 2 } : lot),
    })
    vi.mocked(inventoryApi.adjust).mockResolvedValue({ movement: movement('m2'), stock: after } as AdjustmentResult)
    vi.mocked(inventoryApi.listMovements).mockResolvedValue({ items: [movement('m2', { type: 'ADJUSTMENT', delta: -8, reason: 'DAMAGE' }), movement('m1')], nextCursor: null })
    await typeAdjustment(wrapper, '8')
    expect(vi.mocked(inventoryApi.adjust).mock.calls[0]![0]).toEqual({
      target: { productId: 'p1', lotId: 'l-a' }, expectedVersion: 1, delta: -8, reason: 'DAMAGE',
    })
    expect(vi.mocked(inventoryApi.adjust).mock.calls[0]![1]).toMatch(/^[0-9a-f-]{36}$/)
    expect(wrapper.find('[data-testid="overlay"]').exists()).toBe(false)
    expect(total(wrapper)).toBe('64')
    expect(wrapper.get('[data-testid="stock-sellable"]').text()).toBe('56')
    expect(rows(wrapper)[2]!.get('[data-testid="stock-quantity"]').text()).toBe('14')
    expect(inventoryApi.getStock).toHaveBeenCalledTimes(1)
    expect(inventoryApi.listMovements).toHaveBeenCalledTimes(2)
    expect(vi.mocked(inventoryApi.listMovements).mock.lastCall![0].cursor).toBeUndefined()
    expect(wrapper.findAll('.kardex tbody tr')).toHaveLength(2)
  })

  it('adjusts the untracked bucket with the product as the only target', async () => {
    const wrapper = setup()
    await flushPromises()
    await openAdjust(wrapper, 'Sin lote')
    vi.mocked(inventoryApi.adjust).mockResolvedValue({ movement: movement('m2'), stock: snapshot() } as AdjustmentResult)
    await typeAdjustment(wrapper, '2')
    expect(vi.mocked(inventoryApi.adjust).mock.calls[0]![0].target).toStrictEqual({ productId: 'p1' })
    expect(vi.mocked(inventoryApi.adjust).mock.calls[0]![0].expectedVersion).toBe(1)
  })

  it('adjusts a variant by its id', async () => {
    vi.mocked(inventoryApi.getStock).mockResolvedValue(variantStock)
    const wrapper = setup({}, 'p2')
    await flushPromises()
    await openAdjust(wrapper, 'Mediano · Rojo')
    vi.mocked(inventoryApi.adjust).mockResolvedValue({ movement: movement('m2'), stock: variantStock } as AdjustmentResult)
    await typeAdjustment(wrapper, '1')
    expect(vi.mocked(inventoryApi.adjust).mock.calls[0]![0].target).toStrictEqual({ productId: 'p2', variantId: 'v2' })
  })

  it('leaves the shown stock and the kardex unchanged when the adjustment is rejected', async () => {
    const wrapper = setup()
    await flushPromises()
    await openAdjust(wrapper, 'Lote L-2027-01')
    vi.mocked(inventoryApi.adjust).mockRejectedValue(httpError(409, 'INSUFFICIENT_STOCK'))
    await typeAdjustment(wrapper, '20')
    expect(wrapper.get('[data-testid="quantity-error"]').text()).toBe('No hay suficiente stock para restar esa cantidad.')
    expect(wrapper.find('[data-testid="overlay"]').exists()).toBe(true)
    expect(total(wrapper)).toBe('72')
    expect(wrapper.get('[data-testid="stock-sellable"]').text()).toBe('64')
    expect(rows(wrapper).map(row => row.get('[data-testid="stock-quantity"]').text())).toEqual(['12', '8', '22', '30'])
    expect(inventoryApi.getStock).toHaveBeenCalledTimes(1)
    expect(inventoryApi.listMovements).toHaveBeenCalledTimes(1)
  })

  it('leaves the stock unchanged when the result is uncertain, and re-reads it only when asked', async () => {
    const wrapper = setup()
    await flushPromises()
    await openAdjust(wrapper, 'Lote L-2027-01')
    vi.mocked(inventoryApi.adjust).mockRejectedValue(new Error('Network Error'))
    await typeAdjustment(wrapper, '3')
    expect(wrapper.get('[role="alert"]').text()).toBe('No pudimos confirmar si el ajuste se aplicó.')
    expect(total(wrapper)).toBe('72')
    expect(inventoryApi.getStock).toHaveBeenCalledTimes(1)
    vi.mocked(inventoryApi.getStock).mockResolvedValue(snapshot({ product: { ...snapshot().product, quantity: 69 } }))
    await wrapper.get('[data-testid="adjustment-review"]').trigger('click')
    await flushPromises()
    expect(inventoryApi.getStock).toHaveBeenCalledTimes(2)
    expect(total(wrapper)).toBe('69')
  })

  it('reloads the stock on a version conflict and hands the dialog the new quantity and version', async () => {
    const wrapper = setup()
    await flushPromises()
    await openAdjust(wrapper, 'Lote L-2027-01')
    const fresh = snapshot({
      product: { ...snapshot().product, quantity: 70 },
      lots: snapshot().lots.map(lot => lot.id === 'l-a' ? { ...lot, quantity: 20, version: 3 } : lot),
    })
    vi.mocked(inventoryApi.getStock).mockResolvedValue(fresh)
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(httpError(409, 'STOCK_VERSION_CONFLICT'))
      .mockResolvedValueOnce({ movement: movement('m2'), stock: fresh } as AdjustmentResult)
    await typeAdjustment(wrapper, '5')
    expect(wrapper.get('[role="alert"]').text()).toBe('El stock cambió mientras lo ajustabas. Revisa la cantidad actual.')
    expect(inventoryApi.getStock).toHaveBeenCalledTimes(2)
    expect(total(wrapper)).toBe('70')
    expect(wrapper.get('[data-testid="adjustment-summary"]').text()).toContain('20')
    await wrapper.get('[data-testid="adjustment-submit"]').trigger('click')
    await flushPromises()
    const [first, second] = vi.mocked(inventoryApi.adjust).mock.calls
    expect(second![0].expectedVersion).toBe(3)
    expect(second![1]).not.toBe(first![1])
  })

  it('closes the dialog when its bucket disappears after a reload', async () => {
    const wrapper = setup()
    await flushPromises()
    await openAdjust(wrapper, 'Lote L-2027-01')
    vi.mocked(inventoryApi.getStock).mockResolvedValue(snapshot({ lots: snapshot().lots.filter(lot => lot.id !== 'l-a') }))
    vi.mocked(inventoryApi.adjust).mockRejectedValueOnce(httpError(409, 'STOCK_VERSION_CONFLICT'))
    await typeAdjustment(wrapper, '5')
    expect(wrapper.find('[data-testid="overlay"]').exists()).toBe(false)
    expect(rows(wrapper)).toHaveLength(3)
  })
})
