import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed, ref, nextTick } from 'vue'
import { mountWithUApp } from '@/test/mountWithUApp'
import SaleDetailView from '../SaleDetailView.vue'
import { saleApi } from '../../api/sale.api'

const debtSubmit = vi.fn()
const debtSubmittingRef = ref(false)
const addToast = vi.fn()

vi.mock('../../api/sale.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/sale.api')>()
  return {
    ...actual,
    saleApi: {
      ...actual.saleApi,
      getById: vi.fn(),
      getPdfBlob: vi.fn(),
    },
  }
})

// Intercept Nuxt UI's useToast. Nuxt UI's vite plugin auto-imports useToast
// as a module import at compile time (not as a free variable), so
// vi.stubGlobal cannot override it. Mocking the module replaces the import
// binding in the compiled SaleDetailView module.
vi.mock('@nuxt/ui/composables/useToast', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@nuxt/ui/composables/useToast')>()
  return {
    ...actual,
    useToast: () => ({
      add: addToast,
      update: vi.fn(),
      remove: vi.fn(),
      clear: vi.fn(),
      toasts: { value: [] },
    }),
  }
})

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: 'sale-1' } }),
  useRouter: () => ({ push: vi.fn() }),
}))

const mockSaleDetail = vi.hoisted(() => ({ value: null as any }))

vi.mock('../../composables/useSaleDetail', () => ({
  useSaleDetail: () => ({
    sale: computed(() => mockSaleDetail.value),
    isLoading: computed(() => false),
    isError: computed(() => false),
  }),
}))

vi.mock('../../composables/useDebtPayment', () => ({
  useDebtPayment: () => ({
    submit: debtSubmit,
    submitSafe: debtSubmit,
    isSubmitting: computed(() => debtSubmittingRef.value),
    externalError: computed(() => null),
    externalErrorCode: computed(() => null),
    shouldClose: computed(() => false),
    resetError: vi.fn(),
  }),
}))

vi.mock('../../composables/useSaleComments', () => ({
  useSaleComments: () => ({
    addComment: vi.fn().mockResolvedValue(undefined),
    updateComment: vi.fn().mockResolvedValue(undefined),
    deleteComment: vi.fn().mockResolvedValue(undefined),
    isPending: computed(() => false),
    lastError: computed(() => null),
  }),
}))

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ userCan: vi.fn(() => true) }),
}))

const defaultSale = {
  id: 'sale-1',
  folio: 'A-202605-000012',
  status: 'CONFIRMED' as const,
  channel: 'POS',
  register: 'Principal',
  confirmedAt: '2026-05-06T14:43:00.000Z',
  subtotalCents: 127000,
  discountCents: 0,
  totalCents: 127000,
  paidCents: 127000,
  debtCents: 0,
  changeDueCents: 0,
  paymentStatus: 'PAID' as const,
  deliveryStatus: 'DELIVERED' as const,
  customer: null,
  cashier: { id: 'u1', name: 'Cajero' },
  seller: null,
  items: [],
  payments: [],
  timeline: [],
}

describe('SaleDetailView', () => {
  beforeEach(() => {
    mockSaleDetail.value = defaultSale
    debtSubmittingRef.value = false
    addToast.mockReset()
    vi.mocked(saleApi.getPdfBlob).mockReset()
  })

  // sales-pdf-download: a tiny UDropdownMenu stub that renders each item as a
  // real <button> wired to the item's onSelect handler, so the test can drive
  // "user clicked the dropdown item" without depending on Nuxt UI internals.
  function pdfDropdownStub() {
    return {
      props: ['items'],
      template: `
        <div data-testid="dropdown">
          <button
            v-for="item in items"
            :key="item.label"
            :disabled="item.disabled || item.loading"
            :data-testid="'pdf-item-' + item.label"
            :data-loading="item.loading ? 'true' : 'false'"
            @click="item.onSelect && item.onSelect($event)"
          >
            {{ item.label }}
          </button>
        </div>
      `,
    }
  }

  function findActionItem(label: string) {
    return (items: Array<{ label: string; disabled?: boolean; loading?: boolean; onSelect?: (e: Event) => void }>) =>
      items.find(i => i.label === label)
  }

  // PDF tests need to vary sale.status across CONFIRMED / DRAFT / CANCELED,
  // so widen the helper's input type away from the CONFIRMED-only default.
  type TestSale = Omit<typeof defaultSale, 'status'> & { status: typeof defaultSale.status | 'DRAFT' | 'CANCELED' }

  function mountWithDropdown(sale: TestSale) {
    mockSaleDetail.value = sale as typeof defaultSale
    return mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          UDropdownMenu: pdfDropdownStub(),
          // The real sidebar pulls in useSellerAssignment → useQueryClient,
          // which requires VueQueryPlugin. The PDF tests don't exercise the
          // sidebar, so stub it out (matching the pattern used by the rest
          // of this file).
          SaleDetailSidebar: { template: '<div data-testid="sidebar" />' },
          DebtPaymentModal: { template: '<div />' },
        },
      },
    })
  }

  it('renders two-column detail layout and title', () => {
    const wrapper = mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          UDropdownMenu: { template: '<div data-testid="dropdown"><slot /></div>' },

          SaleDetailItemsList: { template: '<div data-testid="items" />' },
          SaleDetailTotalsCard: { template: '<div data-testid="totals" />' },
          SaleDetailTimeline: { template: '<div data-testid="timeline" />' },
          SaleCommentInput: { template: '<div data-testid="comment-input" />' },
          SaleDetailSidebar: { template: '<div data-testid="sidebar" />' },
        },
      },
    })

    expect(wrapper.get('[data-testid="sale-detail-layout"]')).toBeTruthy()
    expect(wrapper.text()).toContain('Venta #12')
    expect(wrapper.find('[data-testid="sidebar"]').exists()).toBe(true)
  })

  it('renders payment badge with correct label for PAID status', () => {
    const wrapper = mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span data-testid="badge"><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          UDropdownMenu: { template: '<div><slot /></div>' },

          SaleDetailItemsList: { template: '<div />' },
          SaleDetailTotalsCard: { template: '<div />' },
          SaleDetailTimeline: { template: '<div />' },
          SaleCommentInput: { template: '<div />' },
          SaleDetailSidebar: { template: '<div />' },
        },
      },
    })

    const badges = wrapper.findAll('[data-testid="badge"]')
    expect(badges).toHaveLength(2) // delivery + payment
    expect(badges[1]?.text()).toBe('Pagada')
  })

  it('renders payment badge with correct label for PARTIAL status', () => {
    mockSaleDetail.value = { ...defaultSale, paymentStatus: 'PARTIAL' }
    
    const wrapper = mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span data-testid="badge"><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          UDropdownMenu: { template: '<div><slot /></div>' },

          SaleDetailItemsList: { template: '<div />' },
          SaleDetailTotalsCard: { template: '<div />' },
          SaleDetailTimeline: { template: '<div />' },
          SaleCommentInput: { template: '<div />' },
          SaleDetailSidebar: { template: '<div />' },
        },
      },
    })

    const badges = wrapper.findAll('[data-testid="badge"]')
    expect(badges[1]?.text()).toBe('Impaga')
  })

  it('renders payment badge with correct label for CREDIT status', () => {
    mockSaleDetail.value = { ...defaultSale, paymentStatus: 'CREDIT' }
    
    const wrapper = mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span data-testid="badge"><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          UDropdownMenu: { template: '<div><slot /></div>' },

          SaleDetailItemsList: { template: '<div />' },
          SaleDetailTotalsCard: { template: '<div />' },
          SaleDetailTimeline: { template: '<div />' },
          SaleCommentInput: { template: '<div />' },
          SaleDetailSidebar: { template: '<div />' },
        },
      },
    })

    const badges = wrapper.findAll('[data-testid="badge"]')
    expect(badges[1]?.text()).toBe('Deuda')
  })

  it('does not render payment badge when paymentStatus is null', () => {
    mockSaleDetail.value = { ...defaultSale, paymentStatus: null }
    
    const wrapper = mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span data-testid="badge"><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          UDropdownMenu: { template: '<div><slot /></div>' },

          SaleDetailItemsList: { template: '<div />' },
          SaleDetailTotalsCard: { template: '<div />' },
          SaleDetailTimeline: { template: '<div />' },
          SaleCommentInput: { template: '<div />' },
          SaleDetailSidebar: { template: '<div />' },
        },
      },
    })

    const badges = wrapper.findAll('[data-testid="badge"]')
    expect(badges).toHaveLength(1) // only delivery badge
  })

  it('shows debt payment CTA for non-PAID sale and opens modal', async () => {
    vi.mocked(debtSubmit).mockResolvedValue(undefined)

    const wrapper = mountWithUApp(SaleDetailView, {
      global: {
        stubs: {
          AppBadge: { template: '<span><slot /></span>' },
          UCard: { template: '<div><slot /></div>' },
          UButton: { template: '<button><slot /></button>' },
          SaleDetailItemsList: { template: '<div data-testid="items" />' },
          SaleDetailTotalsCard: { template: '<div data-testid="totals" />' },
          SaleDetailTimeline: { template: '<div data-testid="timeline" />' },
          SaleCommentInput: { template: '<div data-testid="comment-input" />' },
          SaleDetailSidebar: {
            props: ['sale'],
            emits: ['register-payment'],
            template:
              '<button data-testid="register-debt-payment" @click="$emit(\'register-payment\')">Registrar Pago</button>',
          },
          DebtPaymentModal: {
            props: ['open', 'saleId', 'debtCents'],
            emits: ['submit', 'update:open'],
            template:
              '<div v-if="open"><button data-testid="submit-debt-payment" @click="$emit(\'submit\', { method: \'cash\', amountCents: debtCents })">submit</button></div>',
          },
        },
      },
    })

    await wrapper.get('[data-testid="register-debt-payment"]').trigger('click')
    expect(wrapper.find('[data-testid="submit-debt-payment"]').exists()).toBe(true)
  })

  it('shows register payment button when sale is CREDIT or PARTIAL and CONFIRMED; hides when PAID', () => {
    const SidebarStub = {
      props: ['sale'],
      template: `
        <button
          v-if="sale.paymentStatus !== 'PAID' && sale.status === 'CONFIRMED'"
          data-testid="register-debt-payment"
        >
          Registrar Pago
        </button>
      `,
    }

    mockSaleDetail.value = { ...defaultSale, paymentStatus: 'PARTIAL' }
    const partialWrapper = mountWithUApp(SaleDetailView, {
      global: { stubs: { SaleDetailSidebar: SidebarStub } },
    })
    expect(partialWrapper.find('[data-testid="register-debt-payment"]').exists()).toBe(true)

    mockSaleDetail.value = { ...defaultSale, paymentStatus: 'CREDIT' }
    const creditWrapper = mountWithUApp(SaleDetailView, {
      global: { stubs: { SaleDetailSidebar: SidebarStub } },
    })
    expect(creditWrapper.find('[data-testid="register-debt-payment"]').exists()).toBe(true)

    mockSaleDetail.value = { ...defaultSale, paymentStatus: 'PAID' }
    const paidWrapper = mountWithUApp(SaleDetailView, {
      global: { stubs: { SaleDetailSidebar: SidebarStub } },
    })
    expect(paidWrapper.find('[data-testid="register-debt-payment"]').exists()).toBe(false)
  })

  it('disables register payment button while submitting', () => {
    debtSubmittingRef.value = true

    const SidebarStub = {
      props: ['sale', 'isPaymentSubmitting'],
      template: `
        <button
          v-if="sale.paymentStatus !== 'PAID' && sale.status === 'CONFIRMED'"
          data-testid="register-debt-payment"
          :disabled="isPaymentSubmitting"
        >
          Registrar Pago
        </button>
      `,
    }

    mockSaleDetail.value = { ...defaultSale, paymentStatus: 'PARTIAL', status: 'CONFIRMED' }
    const wrapper = mountWithUApp(SaleDetailView, {
      global: { stubs: { SaleDetailSidebar: SidebarStub } },
    })

    expect(wrapper.get('[data-testid="register-debt-payment"]').attributes('disabled')).toBeDefined()
  })

  // sales-pdf-download: actionItems computed wires CONFIRMED/DRAFT/CANCELED
  // to the right PDF entry state. CANCELED MUST hide PDF entries entirely
  // (R7). CONFIRMED enables both. DRAFT keeps them visible-but-disabled so
  // the SaleDetailHeader can show the "Solo disponible para ventas
  // confirmadas" tooltip (R1).
  describe('actionItems PDF entries (sales-pdf-download)', () => {
    it('CONFIRMED sale exposes both Recibo A4 and Recibo Ticket enabled with onSelect handlers', () => {
      const wrapper = mountWithDropdown({ ...defaultSale, status: 'CONFIRMED' })
      const items = wrapper.vm.actionItems as Array<{ label: string; disabled: boolean; onSelect?: () => void }>

      const a4 = findActionItem('Recibo A4')(items)
      const ticket = findActionItem('Recibo Ticket')(items)

      expect(a4).toBeDefined()
      expect(a4?.disabled).toBe(false)
      expect(typeof a4?.onSelect).toBe('function')

      expect(ticket).toBeDefined()
      expect(ticket?.disabled).toBe(false)
      expect(typeof ticket?.onSelect).toBe('function')
    })

    it('DRAFT sale shows both PDF entries disabled (header renders the tooltip)', () => {
      const draftSale = { ...defaultSale, status: 'DRAFT' as TestSale['status'] }
      const wrapper = mountWithDropdown(draftSale)
      const items = wrapper.vm.actionItems as Array<{ label: string; disabled: boolean }>

      const a4 = findActionItem('Recibo A4')(items)
      const ticket = findActionItem('Recibo Ticket')(items)

      expect(a4).toBeDefined()
      expect(a4?.disabled).toBe(true)
      expect(ticket).toBeDefined()
      expect(ticket?.disabled).toBe(true)
    })

    it('CANCELED sale hides PDF entries entirely (R7)', () => {
      const canceledSale = { ...defaultSale, status: 'CANCELED' as TestSale['status'] }
      const wrapper = mountWithDropdown(canceledSale)
      const items = wrapper.vm.actionItems as Array<{ label: string }>

      expect(findActionItem('Recibo A4')(items)).toBeUndefined()
      expect(findActionItem('Recibo Ticket')(items)).toBeUndefined()
      // unrelated placeholders stay
      expect(findActionItem('Imprimir Ticket')(items)).toBeDefined()
      expect(findActionItem('Facturar Venta')(items)).toBeDefined()
    })
  })

  // sales-pdf-download: handlePreviewPdf fetches the blob, creates an object
  // URL, opens it in a new tab, and revokes the URL after a 1-second timeout.
  // Nuxt UI's UDropdownMenu hides items in a Teleport until clicked, so we
  // drive the handler directly through the actionItems wiring instead of
  // through DOM clicks — the onSelect callback IS the click handler.
  describe('handlePreviewPdf (sales-pdf-download)', () => {
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>
    let windowOpenSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url-123')
      revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(null)
    })

    afterEach(() => {
      createObjectURLSpy.mockRestore()
      revokeObjectURLSpy.mockRestore()
      windowOpenSpy.mockRestore()
      vi.useRealTimers()
    })

    function triggerPreviewPdf(wrapper: ReturnType<typeof mountWithDropdown>, label: 'Recibo A4' | 'Recibo Ticket') {
      const items = wrapper.vm.actionItems as Array<{ label: string; onSelect?: () => void }>
      const item = items.find((i) => i.label === label)
      expect(item?.onSelect).toBeTypeOf('function')
      item?.onSelect?.()
    }

    it('CONFIRMED click on "Recibo A4" fetches the blob, opens it in a new tab, and revokes the URL after 1s', async () => {
      vi.useFakeTimers()
      const pdfBlob = new Blob(['%PDF fake'], { type: 'application/pdf' })
      vi.mocked(saleApi.getPdfBlob).mockResolvedValue(pdfBlob)

      const wrapper = mountWithDropdown({ ...defaultSale, status: 'CONFIRMED' as const })
      triggerPreviewPdf(wrapper, 'Recibo A4')
      // Let the awaited getPdfBlob + window.open microtasks flush.
      await nextTick()
      await nextTick()

      expect(saleApi.getPdfBlob).toHaveBeenCalledWith('sale-1', 'receipt-a4', expect.any(Object))
      expect(createObjectURLSpy).toHaveBeenCalledWith(pdfBlob)
      expect(windowOpenSpy).toHaveBeenCalledWith('blob:mock-url-123', '_blank')

      // Before the timeout fires, the URL must NOT be revoked yet.
      expect(revokeObjectURLSpy).not.toHaveBeenCalled()

      vi.advanceTimersByTime(1000)
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url-123')

      vi.useRealTimers()
    })

    it('CONFIRMED click on "Recibo Ticket" passes receipt-ticket format', async () => {
      vi.mocked(saleApi.getPdfBlob).mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))

      const wrapper = mountWithDropdown({ ...defaultSale, status: 'CONFIRMED' as const })
      triggerPreviewPdf(wrapper, 'Recibo Ticket')
      await nextTick()
      await nextTick()

      expect(saleApi.getPdfBlob).toHaveBeenCalledWith('sale-1', 'receipt-ticket', expect.any(Object))
    })

    it('shows an info toast with download fallback when window.open returns null (popup blocked)', async () => {
      vi.mocked(saleApi.getPdfBlob).mockResolvedValue(new Blob(['%PDF'], { type: 'application/pdf' }))
      windowOpenSpy.mockReturnValue(null)
      vi.stubGlobal('useToast', () => ({ add: addToast }))

      const wrapper = mountWithDropdown({ ...defaultSale, status: 'CONFIRMED' as const })
      triggerPreviewPdf(wrapper, 'Recibo A4')
      await nextTick()
      await nextTick()

      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'primary', description: expect.stringContaining('descargó el recibo') }),
      )

      vi.unstubAllGlobals()
    })
  })

  // sales-pdf-download: every documented backend error code maps to a
  // distinct toast (R3). Toast assertions are pinned against the exact
  // wording from the spec — these messages are user-facing copy.
  describe('handlePreviewPdf error toasts (sales-pdf-download)', () => {
    beforeEach(() => {
      vi.stubGlobal('useToast', () => ({ add: addToast }))
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
      vi.spyOn(window, 'open').mockReturnValue(null)
    })

    afterEach(() => {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })

    async function clickAndExpectToast(sale: typeof defaultSale, label: 'Recibo A4' | 'Recibo Ticket', expectedDescription: string, expectedColor: 'error' | 'warning') {
      const wrapper = mountWithDropdown(sale)
      const items = wrapper.vm.actionItems as Array<{ label: string; onSelect?: () => void }>
      const item = items.find((i) => i.label === label)
      expect(item?.onSelect).toBeTypeOf('function')
      item?.onSelect?.()
      await nextTick()
      await nextTick()
      expect(addToast).toHaveBeenCalledWith(
        expect.objectContaining({ description: expectedDescription, color: expectedColor }),
      )
    }

    it('400 INVALID_FORMAT → "Formato de recibo no válido"', async () => {
      const { SalePdfError } = await import('../../api/sale.api')
      vi.mocked(saleApi.getPdfBlob).mockRejectedValue(new SalePdfError('INVALID_FORMAT'))

      await clickAndExpectToast({ ...defaultSale, status: 'CONFIRMED' as const }, 'Recibo A4', 'Formato de recibo no válido', 'error')
    })

    it('400 SALE_NOT_CONFIRMED → "Solo ventas confirmadas pueden descargar recibo"', async () => {
      const { SalePdfError } = await import('../../api/sale.api')
      vi.mocked(saleApi.getPdfBlob).mockRejectedValue(new SalePdfError('SALE_NOT_CONFIRMED'))

      await clickAndExpectToast(
        { ...defaultSale, status: 'CONFIRMED' as const },
        'Recibo A4',
        'Solo ventas confirmadas pueden descargar recibo',
        'error',
      )
    })

    it('401 → "Sesión expirada. Iniciá sesión nuevamente"', async () => {
      vi.mocked(saleApi.getPdfBlob).mockRejectedValue({ response: { status: 401 } })

      await clickAndExpectToast(
        { ...defaultSale, status: 'CONFIRMED' as const },
        'Recibo A4',
        'Sesión expirada. Iniciá sesión nuevamente',
        'error',
      )
    })

    it('403 → "No tenés permiso para descargar este recibo"', async () => {
      vi.mocked(saleApi.getPdfBlob).mockRejectedValue({ response: { status: 403 } })

      await clickAndExpectToast(
        { ...defaultSale, status: 'CONFIRMED' as const },
        'Recibo A4',
        'No tenés permiso para descargar este recibo',
        'error',
      )
    })

    it('404 → "Venta no encontrada"', async () => {
      vi.mocked(saleApi.getPdfBlob).mockRejectedValue({ response: { status: 404 } })

      await clickAndExpectToast(
        { ...defaultSale, status: 'CONFIRMED' as const },
        'Recibo A4',
        'Venta no encontrada',
        'error',
      )
    })

    it('500 PDF_GENERATION_FAILED → "Error al generar el PDF. Intentá nuevamente"', async () => {
      const { SalePdfError } = await import('../../api/sale.api')
      vi.mocked(saleApi.getPdfBlob).mockRejectedValue(new SalePdfError('PDF_GENERATION_FAILED'))

      await clickAndExpectToast(
        { ...defaultSale, status: 'CONFIRMED' as const },
        'Recibo A4',
        'Error al generar el PDF. Intentá nuevamente',
        'error',
      )
    })

    it('network error (no axios response) → "Error de conexión. Verificá tu red"', async () => {
      vi.mocked(saleApi.getPdfBlob).mockRejectedValue(new Error('Network Error'))

      await clickAndExpectToast(
        { ...defaultSale, status: 'CONFIRMED' as const },
        'Recibo A4',
        'Error de conexión. Verificá tu red',
        'error',
      )
    })
  })
})
