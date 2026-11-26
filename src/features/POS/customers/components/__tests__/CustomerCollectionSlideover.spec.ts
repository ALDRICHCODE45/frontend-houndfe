/**
 * «Cobrar todo» T1 (S2-S4): the collection sheet renders the ordered preview (due day, «Vencida»,
 * debt / applied now / remaining), builds the tenders, requires the open cash session, labels the
 * confirm «Cobrar $X» and shows the success screen with the receipt downloads.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { computed, ref, shallowRef } from 'vue'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { mountWithUApp } from '@/test/mountWithUApp'
import type { CashSession } from '@/features/POS/cash-register/interfaces/cash.types'
import type { ActivePaymentMethodProjection } from '@/features/POS/sales/interfaces/sale.types'
import type {
  CollectionPreview,
  CollectionResult,
  CollectionTender,
} from '../../collection/collection.types'
import type { CollectionFailure } from '../../collection/collectionErrors'
import CustomerCollectionSlideover from '../CustomerCollectionSlideover.vue'

// The composable has its own spec; here only the sheet's use of it is pinned.
const fake = {
  preview: shallowRef<CollectionPreview | null>(null),
  previewLoading: shallowRef(false),
  previewError: shallowRef<CollectionFailure | null>(null),
  result: shallowRef<CollectionResult | null>(null),
  isSubmitting: shallowRef(false),
  applyError: shallowRef<CollectionFailure | null>(null),
  notice: shallowRef<string | null>(null),
  canConfirm: shallowRef(true),
  uncertain: shallowRef(false),
  pendingPayments: shallowRef<CollectionTender[] | null>(null),
  pendingCashSessionId: shallowRef<string | null>(null),
  retry: vi.fn(),
  checkOutcome: vi.fn(),
  setPayments: vi.fn<(payments: CollectionTender[]) => void>(),
  confirm: vi.fn(),
  refreshPreview: vi.fn(),
  cashSessionIdSeen: undefined as undefined | (() => string | null),
}
vi.mock('../../collection/useCustomerCollection', () => ({
  useCustomerCollection: (options: { cashSessionId: () => string | null }) => {
    fake.cashSessionIdSeen = options.cashSessionId
    return fake
  },
}))
const receipt = {
  downloading: shallowRef<'ticket' | 'a4' | null>(null),
  error: shallowRef<string | null>(null),
  download: vi.fn(async () => true),
}
vi.mock('../../collection/useCollectionReceiptDownload', () => ({
  useCollectionReceiptDownload: () => receipt,
}))
const VALES_ID = '6f1c2a3b-4d5e-4f60-8a71-9b2c3d4e5f60'
const catalog = ref<ActivePaymentMethodProjection[]>([])
vi.mock('@/features/POS/sales/composables/useSalePaymentMethods', () => ({
  useSalePaymentMethods: () => ({ data: computed(() => catalog.value), refetch: vi.fn() }),
}))
const session = (id: string): CashSession => ({
  id,
  tenantId: 'tenant-1',
  registerId: 'reg-1',
  status: 'OPEN',
  cashierUserId: 'user-1',
  openingCents: 0,
  frozenAt: null,
  drawerReleasedAt: null,
  blind: false,
})
const sessions = ref<CashSession[]>([session('sess-1')])
const selectedId = ref<string | null>(null)
const refetchSessions = vi.fn()
vi.mock('@/features/POS/cash-register/composables/useCashSaleSession', () => ({
  useCashSaleSession: () => ({
    availableSessions: computed(() => sessions.value),
    selectedId,
    isSelectionEligible: computed(() => sessions.value.some((row) => row.id === selectedId.value)),
    page: computed(() => 1),
    pageCount: computed(() => 1),
    total: computed(() => sessions.value.length),
    isFetching: computed(() => false),
    isError: computed(() => false),
    selectSession: (id: string | null) => {
      selectedId.value = id
    },
    clearSelection: () => {
      selectedId.value = null
    },
    revalidateSelection: () => sessions.value.some((row) => row.id === selectedId.value),
    setPage: vi.fn(),
    refetch: refetchSessions,
  }),
}))
vi.mock('@/features/POS/cash-register/composables/useCashAccess', () => ({
  useCashAccess: () => ({ canOpenSession: computed(() => true) }),
}))
vi.mock('@/features/POS/sales/composables/useCashRegisterNames', () => ({
  useCashRegisterNames: () => computed(() => ({ 'reg-1': 'Caja Principal' })),
}))

function makePreview(overrides: Partial<CollectionPreview> = {}): CollectionPreview {
  return {
    customer: { id: 'c-1', name: 'Ana López' },
    debtCents: 140000,
    tenderedCents: 90000,
    appliedCents: 90000,
    changeDueCents: 0,
    payments: [],
    sales: [
      {
        saleId: 's-a',
        folio: 'V-000120',
        confirmedAt: '2026-10-02T17:04:11.000Z',
        dueDate: '2026-11-01T00:00:00.000Z',
        overdue: true,
        appliedCents: 30000,
        paidCents: 30000,
        debtCents: 0,
        paymentStatus: 'PAID',
      },
      {
        saleId: 's-b',
        folio: 'V-000123',
        confirmedAt: '2026-10-11T18:30:00.000Z',
        dueDate: '2026-11-10T00:00:00.000Z',
        overdue: true,
        appliedCents: 50000,
        paidCents: 50000,
        debtCents: 0,
        paymentStatus: 'PAID',
      },
      {
        saleId: 's-c',
        folio: 'V-000130',
        confirmedAt: '2026-10-20T16:12:45.000Z',
        dueDate: null,
        overdue: false,
        appliedCents: 10000,
        paidCents: 10000,
        debtCents: 30000,
        paymentStatus: 'PARTIAL',
      },
      {
        saleId: 's-d',
        folio: 'V-000141',
        confirmedAt: '2026-11-15T19:40:02.000Z',
        dueDate: '2026-12-31T00:00:00.000Z',
        overdue: false,
        appliedCents: 0,
        paidCents: 0,
        debtCents: 20000,
        paymentStatus: 'CREDIT',
      },
    ],
    remainingCustomerDebtCents: 50000,
    ...overrides,
  }
}

function makeResult(): CollectionResult {
  return {
    collectionId: 'col-1',
    customer: { id: 'c-1', name: 'Ana López' },
    createdAt: '2026-11-25T18:02:33.120Z',
    tenderedCents: 95000,
    appliedCents: 90000,
    changeDueCents: 5000,
    payments: [],
    sales: [
      {
        saleId: 's-a',
        folio: 'V-000120',
        confirmedAt: '2026-10-02T17:04:11.000Z',
        dueDate: '2026-11-01T00:00:00.000Z',
        overdue: true,
        appliedCents: 30000,
        paidCents: 30000,
        debtCents: 0,
        paymentStatus: 'PAID',
        paymentIds: ['p1'],
      },
    ],
    remainingCustomerDebtCents: 50000,
  }
}

let wrapper: VueWrapper | undefined
const onUpdateOpen = vi.fn()
function mountSheet() {
  const queryClient = new QueryClient()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:path(.*)*', component: { render: () => null } }],
  })
  wrapper = mountWithUApp(CustomerCollectionSlideover, {
    props: {
      open: true,
      customerId: 'c-1',
      customerName: 'Ana López',
      'onUpdate:open': onUpdateOpen,
    },
    attachTo: document.body,
    global: { plugins: [[VueQueryPlugin, { queryClient }], router] },
  })
  return wrapper
}
const q = (selector: string) => document.body.querySelector<HTMLElement>(selector)
const qa = (selector: string) => [...document.body.querySelectorAll<HTMLElement>(selector)]
const text = (selector: string) => q(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

beforeEach(() => {
  document.body.innerHTML = ''
  fake.preview.value = makePreview()
  fake.previewLoading.value = false
  fake.previewError.value = null
  fake.result.value = null
  fake.isSubmitting.value = false
  fake.applyError.value = null
  fake.notice.value = null
  fake.canConfirm.value = true
  fake.uncertain.value = false
  fake.pendingPayments.value = null
  fake.pendingCashSessionId.value = null
  fake.retry.mockReset()
  fake.checkOutcome.mockReset()
  catalog.value = []
  onUpdateOpen.mockClear()
  fake.setPayments.mockReset()
  fake.confirm.mockReset()
  receipt.download.mockClear()
  receipt.error.value = null
  sessions.value = [session('sess-1')]
  selectedId.value = null
  refetchSessions.mockReset()
})
afterEach(() => {
  wrapper?.vm.$root?.$?.appContext.app.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('CustomerCollectionSlideover — preview', () => {
  it('shows the customer and the total debt', async () => {
    mountSheet()
    await flushPromises()
    expect(text('[data-testid="collection-customer"]')).toBe('Ana López')
    expect(text('[data-testid="collection-total-debt"]')).toContain('1,400.00')
  })

  it('lists the sales in the preview order with due day, debt, applied now and remaining', async () => {
    mountSheet()
    await flushPromises()
    const rows = qa('[data-testid="collection-sale-row"]')
    expect(rows.map((row) => row.dataset.folio)).toEqual([
      'V-000120',
      'V-000123',
      'V-000130',
      'V-000141',
    ])
    const b = rows[1]!.textContent!.replace(/\s+/g, ' ')
    expect(b).toContain('10/11/2026')
    expect(b).toContain('500.00')
    const c = rows[2]!
    expect(c.querySelector('[data-testid="collection-sale-due"]')?.textContent).toContain(
      'Sin vencimiento',
    )
    expect(c.querySelector('[data-testid="collection-sale-debt"]')?.textContent).toContain('400.00')
    expect(c.querySelector('[data-testid="collection-sale-applied"]')?.textContent).toContain(
      '100.00',
    )
    expect(c.querySelector('[data-testid="collection-sale-remaining"]')?.textContent).toContain(
      '300.00',
    )
  })

  it('marks overdue sales with a «Vencida» status badge only', async () => {
    mountSheet()
    await flushPromises()
    const rows = qa('[data-testid="collection-sale-row"]')
    expect(
      rows.map((row) => row.querySelector('.hf-status-badge')?.textContent?.trim() ?? null),
    ).toEqual(['Vencida', 'Vencida', null, null])
  })

  it('shows change due and remaining customer debt', async () => {
    fake.preview.value = makePreview({ changeDueCents: 5000 })
    mountSheet()
    await flushPromises()
    expect(text('[data-testid="collection-change"]')).toContain('50.00')
    expect(text('[data-testid="collection-remaining"]')).toContain('500.00')
  })

  it('shows a preview error inline', async () => {
    fake.previewError.value = {
      code: 'COLLECTION_EXCEEDS_DEBT',
      message: 'El pago supera la deuda.',
      network: false,
    }
    mountSheet()
    await flushPromises()
    expect(text('[data-testid="collection-preview-error"]')).toBe('El pago supera la deuda.')
  })

  it('shows the 409 notice', async () => {
    fake.notice.value = 'La deuda del cliente cambió. Revisa los montos y confirma de nuevo.'
    mountSheet()
    await flushPromises()
    expect(text('[data-testid="collection-notice"]')).toContain('La deuda del cliente cambió')
  })
})

describe('CustomerCollectionSlideover — tenders and session', () => {
  it('adds a cash tender for the debt and sends it to the preview', async () => {
    mountSheet()
    await flushPromises()
    q('[data-testid="collection-method-cash"]')!.click()
    await flushPromises()
    expect(fake.setPayments).toHaveBeenLastCalledWith([{ method: 'cash', amountCents: 140000 }])
  })

  it('trims the reference, omits it when blank and caps it at 120 characters', async () => {
    mountSheet()
    await flushPromises()
    q('[data-testid="collection-method-card_debit"]')!.click()
    await flushPromises()
    const amount = q('[data-testid="collection-amount-0"]') as HTMLInputElement
    amount.value = '600'
    amount.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(fake.setPayments).toHaveBeenLastCalledWith([
      { method: 'card_debit', amountCents: 60000 },
    ])
    const reference = q('[data-testid="collection-reference-0"]') as HTMLInputElement
    expect(reference.getAttribute('maxlength')).toBe('120')
    reference.value = '  R-1  '
    reference.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(fake.setPayments).toHaveBeenLastCalledWith([
      { method: 'card_debit', amountCents: 60000, reference: 'R-1' },
    ])
  })

  it('allows at most 5 tenders', async () => {
    mountSheet()
    await flushPromises()
    for (const method of ['cash', 'card_credit', 'card_debit', 'transfer']) {
      q(`[data-testid="collection-method-${method}"]`)!.click()
      await flushPromises()
    }
    expect(qa('[data-testid^="collection-entry-"]')).toHaveLength(4)
  })

  it('uses the only open session of the cashier', async () => {
    mountSheet()
    await flushPromises()
    expect(fake.cashSessionIdSeen?.()).toBe('sess-1')
    expect(refetchSessions).toHaveBeenCalled()
  })

  it('without an open session: says so and passes no session (confirm stays off)', async () => {
    sessions.value = []
    mountSheet()
    await flushPromises()
    expect(fake.cashSessionIdSeen?.()).toBeNull()
    expect(text('[data-testid="collection-session-missing"]')).toContain('Abre tu caja')
  })

  it('with several sessions it needs an explicit choice', async () => {
    sessions.value = [session('sess-1'), session('sess-2')]
    mountSheet()
    await flushPromises()
    expect(fake.cashSessionIdSeen?.()).toBeNull()
    selectedId.value = 'sess-2'
    expect(fake.cashSessionIdSeen?.()).toBe('sess-2')
  })
})

describe('CustomerCollectionSlideover — confirm', () => {
  it('labels the confirm «Cobrar $X» with the amount applied now', async () => {
    mountSheet()
    await flushPromises()
    expect(text('[data-testid="collection-confirm"]')).toBe('Cobrar $900.00')
  })

  it('is disabled when the composable says so', async () => {
    fake.canConfirm.value = false
    mountSheet()
    await flushPromises()
    expect((q('[data-testid="collection-confirm"]') as HTMLButtonElement).disabled).toBe(true)
  })

  it('calls confirm on click', async () => {
    mountSheet()
    await flushPromises()
    q('[data-testid="collection-confirm"]')!.click()
    await flushPromises()
    expect(fake.confirm).toHaveBeenCalledTimes(1)
  })

  it('a cash session error refreshes the open sessions', async () => {
    mountSheet()
    await flushPromises()
    refetchSessions.mockClear()
    fake.applyError.value = {
      code: 'CASH_SESSION_NOT_WRITABLE',
      message: 'La caja elegida está cerrada o congelada.',
      network: false,
    }
    await flushPromises()
    expect(refetchSessions).toHaveBeenCalled()
    expect(text('[data-testid="collection-apply-error"]')).toContain('cerrada o congelada')
  })
})

describe('CustomerCollectionSlideover — success', () => {
  it('shows the summary per sale, change and remaining debt', async () => {
    fake.result.value = makeResult()
    mountSheet()
    await flushPromises()
    expect(q('[data-testid="collection-result"]')).not.toBeNull()
    expect(qa('[data-testid="collection-sale-row"]').map((row) => row.dataset.folio)).toEqual([
      'V-000120',
    ])
    expect(text('[data-testid="collection-result-change"]')).toContain('50.00')
    expect(text('[data-testid="collection-result-remaining"]')).toContain('500.00')
    expect(q('[data-testid="collection-confirm"]')).toBeNull()
  })

  it('«Imprimir comprobante» downloads the ticket, «Descargar A4» the A4', async () => {
    fake.result.value = makeResult()
    mountSheet()
    await flushPromises()
    q('[data-testid="collection-receipt-ticket"]')!.click()
    q('[data-testid="collection-receipt-a4"]')!.click()
    await flushPromises()
    expect(receipt.download).toHaveBeenNthCalledWith(1, 'ticket')
    expect(receipt.download).toHaveBeenNthCalledWith(2, 'a4')
  })

  it('«Listo» closes the sheet', async () => {
    fake.result.value = makeResult()
    mountSheet()
    await flushPromises()
    onUpdateOpen.mockClear()
    q('[data-testid="collection-done"]')!.click()
    await flushPromises()
    expect(onUpdateOpen).toHaveBeenLastCalledWith(false)
  })
})

const UNCERTAIN_MESSAGE =
  'No sabemos si el cobro se registró. Vuelve a confirmar con los mismos montos; no se duplicará.'

/** The sheet with one cash tender typed, then an uncertain apply answer. */
async function mountUncertain() {
  mountSheet()
  await flushPromises()
  q('[data-testid="collection-method-cash"]')!.click()
  q('[data-testid="collection-method-transfer"]')!.click()
  await flushPromises()
  fake.setPayments.mockClear()
  fake.uncertain.value = true
  fake.pendingPayments.value = [
    { method: 'cash', amountCents: 140000 },
    { method: 'transfer', amountCents: 140000 },
  ]
  fake.pendingCashSessionId.value = 'sess-2'
  fake.applyError.value = { code: 'UNKNOWN', message: UNCERTAIN_MESSAGE, network: false }
  await flushPromises()
}

describe('CustomerCollectionSlideover — unresolved submission lock (R1/R4)', () => {
  const disabled = (selector: string) =>
    (q(selector) as HTMLButtonElement | HTMLInputElement | null)?.disabled

  it('disables tenders, amounts, references and remove buttons', async () => {
    await mountUncertain()
    expect(disabled('[data-testid="collection-method-cash"]')).toBe(true)
    expect(disabled('[data-testid="collection-method-card_debit"]')).toBe(true)
    expect(disabled('[data-testid="collection-amount-0"]')).toBe(true)
    expect(disabled('[data-testid="collection-reference-1"]')).toBe(true)
    expect(disabled('[aria-label="Quitar pago 1"]')).toBe(true)
    q('[data-testid="collection-method-cash"]')!.click()
    await flushPromises()
    expect(fake.setPayments).not.toHaveBeenCalled()
  })

  it('replaces the session picker with the session of the retried submission', async () => {
    sessions.value = [session('sess-1'), session('sess-2')]
    await mountUncertain()
    expect(q('[data-testid="cash-session-binding"]')).toBeNull()
    expect(text('[data-testid="collection-session-locked"]')).toContain('Caja Principal')
  })

  it('explains the lock and lists the submission being retried', async () => {
    await mountUncertain()
    const panel = text('[data-testid="collection-uncertain"]')
    expect(panel).toContain('No sabemos si el cobro se registró')
    expect(panel).toContain('Efectivo')
    expect(panel).toContain('1,400.00')
  })

  it('offers only «Reintentar con los mismos datos», which calls retry()', async () => {
    await mountUncertain()
    expect(q('[data-testid="collection-confirm"]')).toBeNull()
    const retry = q('[data-testid="collection-retry"]')!
    expect(retry.textContent?.trim()).toBe('Reintentar con los mismos datos')
    retry.click()
    await flushPromises()
    expect(fake.retry).toHaveBeenCalledTimes(1)
    expect(fake.confirm).not.toHaveBeenCalled()
  })

  it('«Revisar historial» checks the outcome', async () => {
    await mountUncertain()
    q('[data-testid="collection-check-outcome"]')!.click()
    await flushPromises()
    expect(fake.checkOutcome).toHaveBeenCalledTimes(1)
  })

  it('closing asks for confirmation first, then closes', async () => {
    await mountUncertain()
    q('[aria-label="Cerrar cobro"]')!.click()
    await flushPromises()
    expect(onUpdateOpen).not.toHaveBeenCalled()
    expect(text('[data-testid="collection-close-confirm"]')).toContain(
      'Revisa el historial del cliente',
    )
    q('[data-testid="collection-close-stay"]')!.click()
    await flushPromises()
    expect(q('[data-testid="collection-close-confirm"]')).toBeNull()
    q('[aria-label="Cerrar cobro"]')!.click()
    await flushPromises()
    q('[data-testid="collection-close-anyway"]')!.click()
    await flushPromises()
    expect(onUpdateOpen).toHaveBeenLastCalledWith(false)
  })

  it('a definitive answer unlocks the tenders again', async () => {
    await mountUncertain()
    fake.uncertain.value = false
    fake.applyError.value = null
    await flushPromises()
    expect(disabled('[data-testid="collection-method-cash"]')).toBe(false)
    expect(q('[data-testid="collection-retry"]')).toBeNull()
    expect(q('[data-testid="collection-confirm"]')).not.toBeNull()
  })
})

describe('CustomerCollectionSlideover — removed catalog method (R3)', () => {
  async function mountWithCatalogTender() {
    catalog.value = [{ id: VALES_ID, name: 'Vales Sodexo', category: 'card_debit', subtitle: null }]
    mountSheet()
    await flushPromises()
    q(`[data-testid="collection-method-custom-${VALES_ID}"]`)!.click()
    q('[data-testid="collection-method-cash"]')!.click()
    await flushPromises()
    // The composable clears its errors as soon as the tenders change (setPayments, new preview).
    fake.setPayments.mockImplementation(() => {
      fake.applyError.value = null
      fake.previewError.value = null
    })
    fake.applyError.value = {
      code: 'PAYMENT_METHOD_NOT_FOUND',
      message: 'Ese método de pago ya no existe. Elige otro.',
      network: false,
    }
    await flushPromises()
  }

  it('drops the tender and keeps a notice that names the removed method', async () => {
    await mountWithCatalogTender()
    expect(qa('[data-testid^="collection-entry-"]')).toHaveLength(1)
    expect(fake.applyError.value).toBeNull()
    const notice = text('[data-testid="collection-catalog-notice"]')
    expect(notice).toContain('Vales Sodexo')
    expect(notice).toContain('ya no existe')
  })

  it('the notice goes away when the cashier dismisses it', async () => {
    await mountWithCatalogTender()
    q('[data-testid="collection-catalog-notice"] button')!.click()
    await flushPromises()
    expect(q('[data-testid="collection-catalog-notice"]')).toBeNull()
  })

  it('the notice goes away when the cashier edits the tenders again', async () => {
    await mountWithCatalogTender()
    q('[data-testid="collection-method-transfer"]')!.click()
    await flushPromises()
    expect(q('[data-testid="collection-catalog-notice"]')).toBeNull()
  })
})
