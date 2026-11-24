/**
 * Sales history redesign T1 (S2): the expandable row detail shared by the customer history and,
 * next, the seller report. One GET /sales/:id per opened row (cached), products with the line pet,
 * «Abrir venta» and a permission-gated «Cobrar».
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import type { SaleDetail } from '@/features/POS/sales/interfaces/sale.types'
import SaleHistoryRowDetail from '../SaleHistoryRowDetail.vue'

const { getByIdMock, routerPush, userCan } = vi.hoisted(() => ({
  getByIdMock: vi.fn(),
  routerPush: vi.fn(async () => undefined),
  userCan: vi.fn(() => true),
}))

vi.mock('@/features/POS/sales/api/sale.api', () => ({ saleApi: { getById: getByIdMock } }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', userCan }),
}))
vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useRouter: () => ({ push: routerPush }),
}))

function detail(overrides: Partial<SaleDetail> = {}): SaleDetail {
  return {
    id: 'sale-1',
    folio: 'S-000412',
    status: 'CONFIRMED',
    channel: 'POS',
    register: 'Caja 1',
    confirmedAt: '2026-11-22T23:42:00.000Z',
    dueDate: '2026-12-06T00:00:00.000Z',
    subtotalCents: 148_600,
    discountCents: 0,
    totalCents: 148_600,
    paidCents: 70_000,
    debtCents: 78_600,
    changeDueCents: 0,
    paymentStatus: 'PARTIAL',
    deliveryStatus: 'PENDING',
    customer: { id: 'customer-1', name: 'Ana' },
    cashier: { id: 'u-2', name: 'Jorge Ríos' },
    seller: { id: 'u-1', name: 'Karla Méndez' },
    items: [
      {
        productName: 'Croquetas Adulto Raza Mediana',
        variantName: '15 kg',
        imageUrl: null,
        unitPriceCents: 108_900,
        quantity: 1,
        discountCents: 0,
        subtotalCents: 108_900,
        pet: { id: 'p1', name: 'Bruno', species: 'DOG', status: 'ACTIVE' },
      },
      {
        productName: 'Premios dentales',
        variantName: null,
        imageUrl: null,
        unitPriceCents: 5_400,
        quantity: 2,
        discountCents: 0,
        subtotalCents: 10_800,
        pet: null,
      },
    ],
    payments: [
      {
        method: 'CASH',
        amountCents: 70_000,
        tenderedCents: 70_000,
        changeCents: 0,
        reference: null,
        paidAt: '2026-11-22T23:42:00.000Z',
        paymentId: 'pay-1',
      },
    ],
    timeline: [],
    ...overrides,
  } as SaleDetail
}

const stubs = {
  UIcon: { template: '<span />' },
  USkeleton: { template: '<span data-testid="skeleton" />' },
}

let queryClient: QueryClient
const wrappers: VueWrapper[] = []
function mountDetail(props: Record<string, unknown> = {}) {
  const wrapper = mount(SaleHistoryRowDetail, {
    props: { saleId: 'sale-1', ...props },
    global: { plugins: [[VueQueryPlugin, { queryClient }]], stubs },
  })
  wrappers.push(wrapper)
  return wrapper
}

const buttonWith = (wrapper: VueWrapper, text: string) =>
  wrapper.findAll('button').find((button) => button.text().includes(text))

describe('SaleHistoryRowDetail', () => {
  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    getByIdMock.mockReset()
    getByIdMock.mockResolvedValue(detail())
    routerPush.mockClear()
    userCan.mockReset()
    userCan.mockReturnValue(true)
  })
  afterEach(() => {
    while (wrappers.length) wrappers.pop()?.unmount()
    queryClient.clear()
  })

  it('loads GET /sales/:id once and shows a loading state first', async () => {
    const wrapper = mountDetail()
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(true)
    await flushPromises()
    expect(getByIdMock).toHaveBeenCalledTimes(1)
    expect(getByIdMock).toHaveBeenCalledWith('sale-1')
    expect(wrapper.find('[aria-busy="true"]').exists()).toBe(false)
  })

  it('reuses the cached detail when the row is opened again', async () => {
    mountDetail()
    await flushPromises()
    wrappers.pop()?.unmount()
    mountDetail()
    await flushPromises()
    expect(getByIdMock).toHaveBeenCalledTimes(1)
  })

  it('shows seller, cashier, payment methods, paid amount, due date and delivery', async () => {
    const wrapper = mountDetail()
    await flushPromises()
    const data = wrapper.get('[data-testid="sale-history-detail-data"]').text()
    expect(data).toContain('Karla Méndez')
    expect(data).toContain('Jorge Ríos')
    expect(data).toContain('Efectivo')
    expect(data).toContain('$700.00')
    expect(data).toContain('06/12/2026')
    expect(data).toContain('No entregada')
  })

  it('lists the products with variant, quantity, subtotal and «Para: <mascota>»', async () => {
    const wrapper = mountDetail()
    await flushPromises()
    expect(wrapper.text()).toContain('Productos · 2')
    const lines = wrapper.findAll('[data-testid="sale-history-detail-item"]')
    expect(lines).toHaveLength(2)
    expect(lines[0]!.text()).toContain('Croquetas Adulto Raza Mediana')
    expect(lines[0]!.text()).toContain('15 kg · 1 pza')
    expect(lines[0]!.text()).toContain('$1,089.00')
    expect(lines[0]!.text()).toContain('Para: Bruno')
    expect(lines[1]!.text()).toContain('2 pzas')
    expect(lines[1]!.text()).not.toContain('Para:')
  })

  it('«Abrir venta» routes to the sale detail by name', async () => {
    const wrapper = mountDetail()
    await flushPromises()
    await buttonWith(wrapper, 'Abrir venta')!.trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ name: 'pos-sale-detail', params: { id: 'sale-1' } })
  })

  it('«Cobrar» emits the sale and its debt when charging is allowed and the user may update sales', async () => {
    const wrapper = mountDetail({ allowCharge: true })
    await flushPromises()
    const charge = buttonWith(wrapper, 'Cobrar')
    expect(charge!.text()).toContain('$786.00')
    await charge!.trigger('click')
    expect(userCan).toHaveBeenCalledWith('update', 'Sale')
    expect(wrapper.emitted('charge')).toEqual([[{ saleId: 'sale-1', debtCents: 78_600 }]])
  })

  it('hides «Cobrar» without the permission, without debt, on a canceled sale or when not allowed', async () => {
    userCan.mockReturnValue(false)
    const noPermission = mountDetail({ allowCharge: true })
    await flushPromises()
    expect(buttonWith(noPermission, 'Cobrar')).toBeUndefined()

    userCan.mockReturnValue(true)
    const notAllowed = mountDetail()
    await flushPromises()
    expect(buttonWith(notAllowed, 'Cobrar')).toBeUndefined()

    queryClient.clear()
    getByIdMock.mockResolvedValue(
      detail({ debtCents: 0, paidCents: 148_600, paymentStatus: 'PAID' }),
    )
    const paid = mountDetail({ allowCharge: true, saleId: 'sale-paid' })
    await flushPromises()
    expect(buttonWith(paid, 'Cobrar')).toBeUndefined()

    getByIdMock.mockResolvedValue(detail({ status: 'CANCELED' }))
    const canceled = mountDetail({ allowCharge: true, saleId: 'sale-canceled' })
    await flushPromises()
    expect(buttonWith(canceled, 'Cobrar')).toBeUndefined()
  })

  it('shows an error with «Reintentar» that loads the detail again', async () => {
    getByIdMock.mockRejectedValueOnce(
      Object.assign(new Error('boom'), { response: { status: 500 } }),
    )
    const wrapper = mountDetail()
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain(
      'No se pudo cargar el detalle de la venta',
    )
    await buttonWith(wrapper, 'Reintentar')!.trigger('click')
    await flushPromises()
    expect(getByIdMock).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Croquetas Adulto Raza Mediana')
  })
})
