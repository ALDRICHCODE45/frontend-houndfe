/**
 * customers-module T5 (S4, handoff 32 §6): «Cobros y recibos» — the payments feed of one customer as
 * a plain table (rows on a phone): both kinds, cancelled sales marked, receipt downloads, a null
 * receipt, the empty state, pagination and the «no refunds» note (never a running balance).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mountWithUApp } from '@/test/mountWithUApp'
import type {
  CustomerCollectionEvent,
  CustomerPaymentsResponse,
  CustomerSalePaymentEvent,
} from '../../../interfaces/customer.types'
import CustomerPaymentsTab from '../CustomerPaymentsTab.vue'

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  RouterLink: { props: ['to'], template: '<a :href="to" data-router-link><slot /></a>' },
}))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1', userCan: () => true }),
}))

const api = vi.hoisted(() => ({ getPayments: vi.fn(), getReceiptPdf: vi.fn() }))
vi.mock('../../../api/customer-detail.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api/customer-detail.api')>()
  return { ...actual, customerDetailApi: { ...actual.customerDetailApi, ...api } }
})
const save = vi.hoisted(() => vi.fn())
vi.mock('../../../statement/customerStatementFile', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  saveCustomerStatementPdf: save,
}))

const collection = (overrides: Partial<CustomerCollectionEvent> = {}): CustomerCollectionEvent => ({
  kind: 'collection',
  eventId: 'col-1',
  occurredAt: '2026-11-26T18:02:11.000Z',
  amountCents: 90_000,
  tenderedCents: 90_000,
  changeDueCents: 0,
  payments: [
    { method: 'card_debit', amountCents: 60_000, catalog: null },
    { method: 'cash', amountCents: 30_000, catalog: null },
  ],
  sales: [
    { saleId: 's-1', folio: 'V-000123', status: 'CONFIRMED', appliedCents: 30_000 },
    { saleId: 's-3', folio: 'V-000125', status: 'CANCELED', appliedCents: 60_000 },
  ],
  cashier: { id: 'u-1', name: 'María' },
  receiptPath: '/collections/col-1/pdf',
  ...overrides,
})
const payment = (overrides: Partial<CustomerSalePaymentEvent> = {}): CustomerSalePaymentEvent => ({
  kind: 'payment',
  eventId: 'pay-1',
  occurredAt: '2026-11-20T19:31:02.000Z',
  method: 'transfer',
  catalog: null,
  reference: null,
  amountCents: 45_000,
  tenderedCents: 50_000,
  changeCents: 5_000,
  sale: { id: 's-2', folio: 'V-000140', status: 'CONFIRMED', totalCents: 45_000 },
  cashier: { id: 'u-2', name: 'Luis' },
  receiptPath: '/sales/s-2/pdf',
  ...overrides,
})
const page = (data: CustomerPaymentsResponse['data'], pagination: Partial<CustomerPaymentsResponse['pagination']> = {}) => ({
  data,
  pagination: { page: 1, limit: 50, total: data.length, totalPages: 1, ...pagination },
})

let wrapper: VueWrapper | undefined
async function mountTab(props: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  wrapper = mountWithUApp(CustomerPaymentsTab, {
    attachTo: document.body,
    props: { customerId: 'c-1', phone: false, ...props },
    global: { plugins: [[VueQueryPlugin, { queryClient }]] },
  })
  await flushPromises()
  return wrapper
}
const q = (selector: string) => document.body.querySelector<HTMLElement>(selector)
const qa = (selector: string) => [...document.body.querySelectorAll<HTMLElement>(selector)]
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

beforeEach(() => {
  document.body.innerHTML = ''
  api.getPayments.mockReset().mockResolvedValue(page([collection(), payment()]))
  api.getReceiptPdf.mockReset().mockResolvedValue({ blob: new Blob(['%PDF-']), fileName: 'r.pdf' })
  save.mockReset()
})
afterEach(() => {
  wrapper?.vm.$root?.$?.appContext.app.unmount()
  wrapper = undefined
})

describe('CustomerPaymentsTab — desktop table', () => {
  it('asks for page 1 of the feed and shows Fecha, Tipo, Monto, Cajero and Comprobante', async () => {
    await mountTab()
    expect(api.getPayments).toHaveBeenCalledWith('c-1', 1)
    const table = q('table.hf-plain-table')
    expect(table).not.toBeNull()
    expect(qa('thead th').map(text)).toEqual(['Fecha', 'Tipo', 'Monto', 'Cajero', 'Comprobante'])
    expect(qa('tbody tr')).toHaveLength(2)
  })

  it('a «Cobrar todo» row lists its tenders and the sales it covered, each folio opening the sale', async () => {
    await mountTab()
    const row = q('[data-testid="customer-payment-col-1"]')!
    expect(text(row)).toContain('Cobrar todo')
    expect(text(row)).toContain('Tarjeta de débito $600.00')
    expect(text(row)).toContain('Efectivo $300.00')
    expect(text(row)).toContain('$900.00')
    expect(text(row)).toContain('María')
    const links = [...row.querySelectorAll('a[data-router-link]')]
    expect(links.map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['V-000123', '/pos/ventas/s-1'],
      ['V-000125', '/pos/ventas/s-3'],
    ])
  })

  it('a cancelled sale is marked with a «Cancelada» StatusBadge', async () => {
    await mountTab()
    const badges = qa('[data-testid="customer-payment-col-1"] .hf-status-badge')
    expect(badges.map(text)).toEqual(['Cancelada'])
  })

  it('a «Pago» row shows its method in Spanish, the net amount and the sale folio', async () => {
    await mountTab()
    const row = q('[data-testid="customer-payment-pay-1"]')!
    expect(text(row)).toContain('Pago')
    expect(text(row)).toContain('Transferencia')
    expect(text(row)).toContain('$450.00')
    expect(text(row)).not.toContain('$500.00')
    expect(row.querySelector('a[data-router-link]')?.getAttribute('href')).toBe('/pos/ventas/s-2')
  })

  it('a catalog payment method shows its catalog name', async () => {
    api.getPayments.mockResolvedValue(page([payment({ method: 'card_credit', catalog: { name: 'Mercado Pago' } })]))
    await mountTab()
    expect(text(q('[data-testid="customer-payment-pay-1"]'))).toContain('Mercado Pago')
  })

  it('downloads the receipt in ticket or A4 and saves the PDF', async () => {
    await mountTab()
    q('[data-testid="customer-payment-col-1-receipt-a4"]')!.click()
    await flushPromises()
    expect(api.getReceiptPdf).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'col-1' }), 'a4')
    expect(save).toHaveBeenCalledWith(expect.any(Blob), 'r.pdf')
    q('[data-testid="customer-payment-pay-1-receipt-ticket"]')!.click()
    await flushPromises()
    expect(api.getReceiptPdf).toHaveBeenLastCalledWith(expect.objectContaining({ eventId: 'pay-1' }), 'ticket')
  })

  it('a failed download says so in words', async () => {
    api.getReceiptPdf.mockRejectedValue({ response: { status: 403 } })
    await mountTab()
    q('[data-testid="customer-payment-col-1-receipt-ticket"]')!.click()
    await flushPromises()
    expect(text(q('[data-testid="customer-payments-receipt-error"]'))).toContain('No tienes permiso')
  })

  it('a null receiptPath has no download and reads «Venta cancelada» (muted)', async () => {
    api.getPayments.mockResolvedValue(page([
      payment({ receiptPath: null, sale: { id: 's-2', folio: 'V-000140', status: 'CANCELED', totalCents: 45_000 } }),
    ]))
    await mountTab()
    const row = q('[data-testid="customer-payment-pay-1"]')!
    expect(row.querySelector('[data-testid^="customer-payment-pay-1-receipt"]')).toBeNull()
    expect(text(row.querySelector('[data-testid="customer-payment-no-receipt"]'))).toBe('Venta cancelada')
    expect(text(row)).toContain('Cancelada')
  })

  it('notes that refunds are not included and never shows a balance column', async () => {
    await mountTab()
    expect(text(q('[data-testid="customer-payments-note"]'))).toBe('No incluye reembolsos.')
    expect(text(q('[data-testid="customer-tab-cobros"]'))).not.toMatch(/Saldo/i)
  })
})

describe('CustomerPaymentsTab — empty, errors and pagination', () => {
  it('without events shows «Sin cobros todavía»', async () => {
    api.getPayments.mockResolvedValue(page([]))
    await mountTab()
    expect(text(q('[data-testid="customer-payments-empty"]'))).toContain('Sin cobros todavía')
    expect(q('table')).toBeNull()
  })

  it('a failure offers «Reintentar»', async () => {
    // A 5xx is retried once on its own before the error shows.
    api.getPayments.mockRejectedValue({ response: { status: 500 } })
    await mountTab()
    const findRetry = () =>
      [...document.body.querySelectorAll('button')].find((b) => b.textContent?.includes('Reintentar'))
    await vi.waitFor(() => expect(findRetry()).toBeDefined(), { timeout: 4000 })
    api.getPayments.mockResolvedValue(page([collection(), payment()]))
    findRetry()!.click()
    await flushPromises()
    expect(qa('tbody tr')).toHaveLength(2)
  })

  it('more than one page shows the total and pages through the feed', async () => {
    api.getPayments.mockResolvedValue(page([collection(), payment()], { total: 120, totalPages: 3 }))
    await mountTab()
    expect(text(q('[data-testid="customer-payments-pager"]'))).toContain('120 cobros')
    const second = qa('[data-testid="customer-payments-pager"] button').find((b) => text(b) === '2')
    expect(second).toBeDefined()
    second!.click()
    await flushPromises()
    expect(api.getPayments).toHaveBeenLastCalledWith('c-1', 2)
  })

  it('one page has no pager', async () => {
    await mountTab()
    expect(q('[data-testid="customer-payments-pager"]')).toBeNull()
  })
})

describe('CustomerPaymentsTab — phone rows', () => {
  it('shows one row per event with type, amount, folios and the receipt buttons, no table', async () => {
    await mountTab({ phone: true })
    expect(q('table')).toBeNull()
    const rows = qa('[data-testid^="customer-payment-row-"]')
    expect(rows).toHaveLength(2)
    expect(text(rows[0])).toContain('Cobrar todo')
    expect(text(rows[0])).toContain('$900.00')
    expect(text(rows[0])).toContain('V-000123')
    expect(rows[0]!.querySelector('[data-testid="customer-payment-col-1-receipt-ticket"]')).not.toBeNull()
    expect(text(rows[1])).toContain('Pago')
  })
})
