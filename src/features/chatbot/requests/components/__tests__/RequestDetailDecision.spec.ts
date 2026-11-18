import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'

vi.mock('../../api/chatbot-receipt.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/chatbot-receipt.api')>()),
  chatbotReceiptApi: { getFile: vi.fn() },
}))

const auth = vi.hoisted(() => ({ perms: new Set<string>(), tenantId: 'tenant-1' }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    get currentTenantId() {
      return auth.tenantId
    },
    userCan: (action: string, subject: string) => auth.perms.has(`${action}:${subject}`),
  }),
}))
vi.mock('@/features/auth/composables/useSafeTenantId', async () => {
  const { computed } = await import('vue')
  return { useSafeTenantId: () => computed(() => auth.tenantId) }
})

vi.mock('@/features/POS/sales/api/sale.api', () => ({ saleApi: { getById: vi.fn() } }))

import RequestDetailDecision from '../RequestDetailDecision.vue'
import { saleApi } from '@/features/POS/sales/api/sale.api'
import { chatbotReceiptApi } from '../../api/chatbot-receipt.api'
import { DETAIL_STUBS, makeDetail } from '../../utils/detail-fixture'
import type { ChatbotRequestDetail } from '../../interfaces/chatbot-request.types'

const TZ = 'America/Mexico_City'
const NOW = new Date('2026-11-11T17:05:00.000Z')

const getFile = vi.mocked(chatbotReceiptApi.getFile)
const getSale = vi.mocked(saleApi.getById)

const modalStub = {
  name: 'UModal',
  props: ['open', 'title', 'description'],
  emits: ['update:open'],
  template:
    '<div v-if="open" data-stub="modal" :data-title="title"><slot name="body" /><slot name="footer" /></div>',
}

const MODAL_STUBS = {
  UModal: modalStub,
  Modal: modalStub,
  SaleDetailItemsList: {
    props: ['items'],
    template:
      '<ul data-stub="sale-items"><li v-for="i in items" :key="i.id">{{ i.productName }}<template v-if="i.variantName"> · {{ i.variantName }}</template> ×{{ i.quantity }}</li></ul>',
  },
  SaleDetailTotalsCard: {
    props: [
      'subtotalCents',
      'discountCents',
      'totalCents',
      'paidCents',
      'debtCents',
      'changeDueCents',
    ],
    template:
      '<div data-stub="sale-totals">{{ subtotalCents }}|{{ discountCents }}|{{ totalCents }}|{{ paidCents }}|{{ debtCents }}|{{ changeDueCents }}</div>',
  },
}
const createObjectURL = vi.fn<(blob: Blob) => string>()
const revokeObjectURL = vi.fn<(url: string) => void>()
let counter = 0
const blobUrl = (n: number) => `blob:${window.location.origin}/${n}`

beforeEach(() => {
  getFile.mockReset()
  getSale.mockReset()
  createObjectURL.mockReset()
  revokeObjectURL.mockReset()
  counter = 0
  createObjectURL.mockImplementation(() => blobUrl(++counter))
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
  auth.perms = new Set(['read:ChatbotRequest', 'read:ReceiptEvidence', 'read:Sale'])
  auth.tenantId = 'tenant-1'
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function mountDecision(request: ChatbotRequestDetail) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(RequestDetailDecision, {
    props: { request, timeZone: TZ, now: NOW },
    global: {
      stubs: { ...DETAIL_STUBS, ...MODAL_STUBS },
      plugins: [[VueQueryPlugin, { queryClient }]],
    },
  })
}

const httpError = (status: number) =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data: {} } })

const panel = (w: ReturnType<typeof mountDecision>) => w.get('[data-testid="request-decision"]')

describe('RequestDetailDecision', () => {
  it('renders nothing for a request without decision (clarification, conversation)', () => {
    const wrapper = mountDecision(
      makeDetail({ kind: 'CLARIFICATION', subtype: 'UNKNOWN_QUESTION', decision: null }),
    )
    expect(wrapper.find('[data-testid="request-decision"]').exists()).toBe(false)
  })

  it('RESTOCK: product, sku, branch, requested quantity and observed stock', () => {
    const text = panel(mountDecision(makeDetail())).text()
    expect(text).toContain('Reposición: datos de la solicitud')
    expect(text).toContain('Croquetas Premium Adulto 15 kg')
    expect(text).toContain('CRQ-PA-15')
    expect(text).toContain('Sucursal Centro')
    expect(text).toContain('Cantidad pedida')
    expect(text).toContain('6')
    expect(text).toContain('Existencias al pedir')
  })

  it('EXPIRATION: product, variant and branch, with dashes for what is missing', () => {
    const request = makeDetail({
      subtype: 'EXPIRATION',
      decision: {
        subtype: 'EXPIRATION',
        snapshot: {
          branchId: 'b-1',
          branchName: 'Sucursal Centro',
          productId: 'p-2',
          productName: 'Antiparasitario en pipeta',
          unit: 'pieza',
          variantId: 'v-1',
          variantName: 'Talla L',
          variantOption: null,
          variantValue: null,
        },
        resolution: null,
      },
    })
    const text = panel(mountDecision(request)).text()
    expect(text).toContain('Caducidad: datos de la solicitud')
    expect(text).toContain('Antiparasitario en pipeta')
    expect(text).toContain('Talla L')
    expect(text).toContain('Sucursal Centro')

    const bare = makeDetail({
      subtype: 'EXPIRATION',
      decision: {
        subtype: 'EXPIRATION',
        snapshot: {
          branchId: 'b-1',
          branchName: null,
          productId: 'p-2',
          productName: 'Pipeta',
          unit: null,
          variantId: null,
          variantName: null,
          variantOption: null,
          variantValue: null,
        },
        resolution: null,
      },
    })
    expect(panel(mountDecision(bare)).get('[data-testid="decision-variant"]').text()).toBe('—')
  })

  const zone = (overrides: Partial<ChatbotRequestDetail> = {}) =>
    makeDetail({
      subtype: 'DELIVERY_ZONE',
      decision: {
        subtype: 'DELIVERY_ZONE',
        validationId: 'val-1',
        zipCode: '44150',
        state: 'Jalisco',
        municipality: 'Guadalajara',
        neighborhood: 'Lafayette',
        requesterCount: 5,
        lastCustomerMessageAt: null,
        resolution: null,
      },
      zoneImpact: { requests: 4, customers: 3, setVersion: 7, validationId: 'val-1' },
      ...overrides,
    })

  it('DELIVERY_ZONE: postal code, place, requesters and «Esto resolverá N solicitudes de M clientes»', () => {
    const wrapper = mountDecision(zone())
    const text = panel(wrapper).text()
    expect(text).toContain('Zona de entrega: datos de la solicitud')
    expect(text).toContain('44150')
    expect(text).toContain('Lafayette, Guadalajara, Jalisco')
    expect(text).toContain('Clientes que preguntaron')
    expect(wrapper.get('[data-testid="zone-impact"]').text()).toContain(
      'Esto resolverá 4 solicitudes de 3 clientes',
    )
  })

  it('DELIVERY_ZONE: no impact line without zoneImpact or once the request is closed', () => {
    expect(
      mountDecision(zone({ zoneImpact: null }))
        .find('[data-testid="zone-impact"]')
        .exists(),
    ).toBe(false)
    expect(
      mountDecision(zone({ status: 'RESOLVED', displayStatus: 'RESOLVED' }))
        .find('[data-testid="zone-impact"]')
        .exists(),
    ).toBe(false)
  })

  it('DELIVERY_ZONE: copes with a place the server did not fill in', () => {
    const wrapper = mountDecision(
      zone({
        decision: {
          subtype: 'DELIVERY_ZONE',
          validationId: null,
          zipCode: '44150',
          state: null,
          municipality: null,
          neighborhood: null,
          requesterCount: 1,
          lastCustomerMessageAt: null,
          resolution: null,
        },
        zoneImpact: null,
      }),
    )
    expect(panel(wrapper).get('[data-testid="decision-place"]').text()).toBe('—')
  })

  const receipt = (overrides: Record<string, unknown> = {}) =>
    makeDetail({
      subtype: 'TRANSFER_RECEIPT',
      decision: {
        subtype: 'TRANSFER_RECEIPT',
        receiptId: 'rec-1',
        saleId: 'sale-1',
        saleFolio: 'V-1042',
        declaredAmountCents: 184000,
        declaredAmountProvided: true,
        declaredDate: '2026-11-11',
        declaredReference: 'SPEI 4471290',
        saleTotalCents: 184000,
        salePaidCents: 0,
        saleDebtCents: 184000,
        file: {
          mimeType: 'image/jpeg',
          sizeBytes: 219136,
          previewStatus: 'READY',
          // The backend sends API-relative paths (no host): the file needs the Bearer token.
          originalUrl: '/sales/sale-1/receipts/rec-1/file',
          previewUrl: '/sales/sale-1/receipts/rec-1/preview',
        },
        extracted: null,
        mismatch: null,
        resolution: null,
        ...overrides,
      },
    } as Partial<ChatbotRequestDetail>)

  it('TRANSFER_RECEIPT: sale, amounts, declared data and the preview image fetched with auth', async () => {
    const preview = new Blob(['p'], { type: 'image/jpeg' })
    getFile.mockResolvedValue(preview)
    const wrapper = mountDecision(receipt())
    const text = panel(wrapper).text()
    expect(text).toContain('Comprobante: datos de la solicitud')
    expect(text).toContain('V-1042')
    expect(text).toContain('$1,840.00')
    expect(text).toContain('$0.00')
    expect(text).toContain('SPEI 4471290')
    expect(wrapper.get('[data-testid="receipt-preview"]').text()).toContain(
      'Cargando la vista previa',
    )
    await flushPromises()

    // Through the authenticated client, never as a relative <img src> on the app's own domain.
    expect(getFile).toHaveBeenCalledTimes(1)
    expect(getFile).toHaveBeenCalledWith('/sales/sale-1/receipts/rec-1/preview', {
      signal: expect.anything(),
    })
    const img = wrapper.get('[data-testid="receipt-preview"] img')
    expect(img.attributes('src')).toBe(blobUrl(1))
    expect(img.attributes('alt')).toBe('Comprobante enviado por el cliente')
    // «Abrir original» is a button: an <a href> to the API would carry no Bearer token.
    const original = wrapper.get('[data-testid="receipt-original"]')
    expect(original.element.tagName).toBe('BUTTON')
    expect(original.text()).toBe('Abrir original')
    expect(wrapper.html()).not.toContain('/receipts/rec-1/file')
  })

  it('TRANSFER_RECEIPT: «Abrir original» fetches the original with auth and opens it in a new tab', async () => {
    getFile.mockResolvedValueOnce(new Blob(['p'], { type: 'image/jpeg' }))
    const wrapper = mountDecision(receipt())
    await flushPromises()
    const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() }
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    getFile.mockResolvedValueOnce(new Blob(['o'], { type: 'image/jpeg' }))

    await wrapper.get('[data-testid="receipt-original"]').trigger('click')
    // The tab opens inside the click (popup blockers), before the download finishes.
    expect(open).toHaveBeenCalledWith('about:blank', '_blank')
    await flushPromises()

    expect(getFile).toHaveBeenLastCalledWith('/sales/sale-1/receipts/rec-1/file', {
      signal: undefined,
    })
    expect(tab.opener).toBeNull()
    expect(tab.location.href).toBe(blobUrl(2))
    expect(tab.close).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="receipt-original-error"]').exists()).toBe(false)
  })

  it('TRANSFER_RECEIPT: a failed original download closes the tab and says why', async () => {
    getFile.mockResolvedValueOnce(new Blob(['p'], { type: 'image/jpeg' }))
    const wrapper = mountDecision(receipt())
    await flushPromises()
    const tab = { opener: {} as unknown, location: { href: '' }, close: vi.fn() }
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window)
    getFile.mockRejectedValueOnce(httpError(404))

    await wrapper.get('[data-testid="receipt-original"]').trigger('click')
    await flushPromises()

    expect(tab.close).toHaveBeenCalledTimes(1)
    expect(tab.location.href).toBe('')
    expect(wrapper.get('[data-testid="receipt-original-error"]').text()).toBe(
      'No encontramos este archivo.',
    )
  })

  it('TRANSFER_RECEIPT: with the popup blocked the original still opens through a temporary link', async () => {
    getFile.mockResolvedValueOnce(new Blob(['p'], { type: 'image/jpeg' }))
    const wrapper = mountDecision(receipt())
    await flushPromises()
    vi.spyOn(window, 'open').mockReturnValue(null)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    getFile.mockResolvedValueOnce(new Blob(['o'], { type: 'image/jpeg' }))

    await wrapper.get('[data-testid="receipt-original"]').trigger('click')
    await flushPromises()

    expect(click).toHaveBeenCalledTimes(1)
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.href).toBe(blobUrl(2))
    expect(link.target).toBe('_blank')
    expect(link.rel).toContain('noopener')
  })

  it('TRANSFER_RECEIPT: a preview that fails to load says why instead of a broken image', async () => {
    getFile.mockRejectedValueOnce(httpError(403))
    const wrapper = mountDecision(receipt())
    await flushPromises()
    expect(wrapper.find('[data-testid="receipt-preview"] img').exists()).toBe(false)
    expect(wrapper.get('[data-testid="receipt-preview"]').text()).toContain(
      'No tienes permiso para ver este archivo.',
    )
  })

  it('TRANSFER_RECEIPT: without read:ReceiptEvidence nothing is fetched and the card says so', async () => {
    auth.perms = new Set(['read:ChatbotRequest'])
    const wrapper = mountDecision(receipt())
    await flushPromises()
    expect(getFile).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="receipt-preview"] img').exists()).toBe(false)
    expect(wrapper.find('[data-testid="receipt-original"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="receipt-preview"]').text()).toContain(
      'No tienes permiso para ver el comprobante.',
    )
  })

  it('TRANSFER_RECEIPT: the preview opens enlarged in a modal and closes again', async () => {
    getFile.mockResolvedValue(new Blob(['p'], { type: 'image/jpeg' }))
    const wrapper = mountDecision(receipt())
    await flushPromises()
    expect(wrapper.find('[data-stub="modal"]').exists()).toBe(false)

    const zoom = wrapper.get('[data-testid="receipt-zoom"]')
    expect(zoom.element.tagName).toBe('BUTTON')
    expect(zoom.attributes('aria-label')).toBe('Ampliar comprobante')
    await zoom.trigger('click')

    const modal = wrapper.get('[data-stub="modal"]')
    expect(modal.attributes('data-title')).toBe('Comprobante ampliado')
    const big = modal.get('[data-testid="receipt-zoom-image"]')
    expect(big.attributes('src')).toBe(blobUrl(1))
    expect(big.attributes('alt')).toBe('Comprobante enviado por el cliente')
    expect(getFile).toHaveBeenCalledTimes(1)

    await wrapper.findComponent({ name: 'UModal' }).vm.$emit('update:open', false)
    expect(wrapper.find('[data-stub="modal"]').exists()).toBe(false)
  })

  it('TRANSFER_RECEIPT: no zoom button while the preview has not loaded', async () => {
    getFile.mockRejectedValueOnce(httpError(404))
    const wrapper = mountDecision(receipt())
    await flushPromises()
    expect(wrapper.find('[data-testid="receipt-zoom"]').exists()).toBe(false)
  })

  it('TRANSFER_RECEIPT: «Ver venta» opens a summary with the products, variants and totals', async () => {
    getFile.mockResolvedValue(new Blob(['p'], { type: 'image/jpeg' }))
    getSale.mockResolvedValue({
      id: 'sale-1',
      folio: 'V-1042',
      items: [
        { id: 'i-1', productName: 'Croquetas Premium', variantName: '15 kg', quantity: 2 },
        { id: 'i-2', productName: 'Collar', variantName: null, quantity: 1 },
      ],
      subtotalCents: 190000,
      discountCents: 6000,
      totalCents: 184000,
      paidCents: 0,
      debtCents: 184000,
      changeDueCents: 0,
    } as never)
    const wrapper = mountDecision(receipt())
    await flushPromises()
    // The sale is read only when asked for.
    expect(getSale).not.toHaveBeenCalled()

    const open = wrapper.get('[data-testid="receipt-sale-open"]')
    expect(open.text()).toBe('Ver venta')
    await open.trigger('click')
    expect(wrapper.get('[data-stub="modal"]').attributes('data-title')).toBe('Venta V-1042')
    expect(wrapper.get('[data-testid="sale-summary"]').text()).toContain('Cargando la venta')
    await flushPromises()

    expect(getSale).toHaveBeenCalledWith('sale-1')
    const items = wrapper.get('[data-stub="sale-items"]').text()
    expect(items).toContain('Croquetas Premium · 15 kg ×2')
    expect(items).toContain('Collar ×1')
    expect(wrapper.get('[data-stub="sale-totals"]').text()).toBe('190000|6000|184000|0|184000|0')
  })

  it('TRANSFER_RECEIPT: the sale summary says so when the sale cannot be read', async () => {
    getFile.mockResolvedValue(new Blob(['p'], { type: 'image/jpeg' }))
    getSale.mockRejectedValue(httpError(500))
    const wrapper = mountDecision(receipt())
    await flushPromises()
    await wrapper.get('[data-testid="receipt-sale-open"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-stub="sale-items"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="sale-summary"]').text()).toContain(
      'No se pudo cargar la venta.',
    )
  })

  it('TRANSFER_RECEIPT: without read:Sale there is no «Ver venta»', async () => {
    auth.perms = new Set(['read:ChatbotRequest', 'read:ReceiptEvidence'])
    getFile.mockResolvedValue(new Blob(['p'], { type: 'image/jpeg' }))
    const wrapper = mountDecision(receipt())
    await flushPromises()
    expect(wrapper.find('[data-testid="receipt-sale-open"]').exists()).toBe(false)
    expect(panel(wrapper).text()).toContain('V-1042')
  })

  it('TRANSFER_RECEIPT: shows the preview status instead of an image while there is none', () => {
    const wrapper = mountDecision(
      receipt({
        file: {
          mimeType: 'image/jpeg',
          sizeBytes: 1024,
          previewStatus: 'PENDING',
          originalUrl: null,
          previewUrl: null,
        },
      }),
    )
    expect(wrapper.find('[data-testid="receipt-preview"] img').exists()).toBe(false)
    expect(wrapper.get('[data-testid="receipt-preview"]').text()).toContain(
      'Generando la vista previa',
    )
    expect(wrapper.find('[data-testid="receipt-original"]').exists()).toBe(false)
  })

  it('TRANSFER_RECEIPT: never puts an unsafe URL in the page, and says when the file was purged', async () => {
    const unsafe = mountDecision(
      receipt({
        file: {
          mimeType: 'image/jpeg',
          sizeBytes: 1,
          previewStatus: 'READY',
          originalUrl: 'javascript:alert(1)',
          previewUrl: 'javascript:alert(1)',
        },
      }),
    )
    expect(unsafe.find('img').exists()).toBe(false)
    expect(unsafe.find('[data-testid="receipt-original"]').exists()).toBe(false)

    // The Bearer token only goes to the API's own receipt paths, never to a foreign host.
    const foreign = mountDecision(
      receipt({
        file: {
          mimeType: 'image/jpeg',
          sizeBytes: 1,
          previewStatus: 'READY',
          originalUrl: 'https://evil.example.com/sales/sale-1/receipts/rec-1/file',
          previewUrl: '//evil.example.com/sales/sale-1/receipts/rec-1/preview',
        },
      }),
    )
    await flushPromises()
    expect(foreign.find('img').exists()).toBe(false)
    expect(foreign.find('[data-testid="receipt-original"]').exists()).toBe(false)
    expect(getFile).not.toHaveBeenCalled()

    const purged = mountDecision(receipt({ file: null }))
    expect(purged.get('[data-testid="receipt-preview"]').text()).toContain(
      'El archivo ya se eliminó',
    )
  })

  it('TRANSFER_RECEIPT: says so when the customer gave no amount, and flags a mismatch only when the server says so', () => {
    const none = mountDecision(
      receipt({ declaredAmountCents: null, declaredAmountProvided: false }),
    )
    expect(none.text()).toContain('No indicó monto')
    expect(none.find('[data-testid="receipt-mismatch"]').exists()).toBe(false)

    // The backend sends an object; only `flagged: true` raises the tag.
    const mismatch = mountDecision(
      receipt({ mismatch: { debtCents: 184000, declaredDiffCents: 4000, flagged: true } }),
    )
    expect(mismatch.get('[data-testid="receipt-mismatch"]').text()).toContain(
      'El monto no coincide',
    )
    const notFlagged = mountDecision(receipt({ mismatch: { debtCents: 184000, flagged: false } }))
    expect(notFlagged.find('[data-testid="receipt-mismatch"]').exists()).toBe(false)
    const legacy = mountDecision(receipt({ mismatch: true }))
    expect(legacy.find('[data-testid="receipt-mismatch"]').exists()).toBe(false)

    const odd = mountDecision(receipt({ mismatch: { weird: true }, extracted: { a: 1 } }))
    expect(odd.find('[data-testid="receipt-mismatch"]').exists()).toBe(false)
    expect(odd.find('[data-testid="receipt-extracted"]').exists()).toBe(false)
  })

  it('TRANSFER_RECEIPT: shows what the bot read on the image, marked as an automatic reading', () => {
    const wrapper = mountDecision(
      receipt({
        extracted: { amountCents: 17800, bank: 'BanCoppel', reference: '167050', confidence: 0.9 },
      }),
    )
    const row = wrapper.get('[data-testid="receipt-extracted"]')
    expect(panel(wrapper).text()).toContain('Detectado en la imagen')
    expect(row.text()).toContain('$178.00 · BanCoppel · ref. 167050 · confianza 90 %')
    expect(row.text()).toContain('Lectura automática del bot')

    const none = mountDecision(receipt({ extracted: null }))
    expect(none.find('[data-testid="receipt-extracted"]').exists()).toBe(false)
  })

  it('TRANSFER_RECEIPT: a destination mismatch raises its own alert, independent of the amount', () => {
    // The ⚠ of the handoff copy is the triangle icon, as on «El monto no coincide».
    const copy = 'El destinatario no coincide con la cuenta del negocio'
    const mismatch = mountDecision(receipt({ destinationCheck: 'mismatch' }))
    const tag = mismatch.get('[data-testid="receipt-destination-mismatch"]')
    expect(tag.text()).toBe(copy)
    expect(tag.classes()).toContain('rd-tag--warn')
    // Never color-only: an icon (hidden from screen readers) plus the words.
    expect(tag.find('svg[aria-hidden="true"]').exists()).toBe(true)
    expect(mismatch.find('[data-testid="receipt-mismatch"]').exists()).toBe(false)

    const both = mountDecision(
      receipt({
        destinationCheck: 'mismatch',
        mismatch: { debtCents: 184000, declaredDiffCents: 4000, flagged: true },
      }),
    )
    expect(both.find('[data-testid="receipt-destination-mismatch"]').exists()).toBe(true)
    expect(both.find('[data-testid="receipt-mismatch"]').exists()).toBe(true)

    const amountOnly = mountDecision(
      receipt({
        destinationCheck: 'match',
        mismatch: { debtCents: 184000, declaredDiffCents: 4000, flagged: true },
      }),
    )
    expect(amountOnly.find('[data-testid="receipt-mismatch"]').exists()).toBe(true)
    expect(amountOnly.find('[data-testid="receipt-destination-mismatch"]').exists()).toBe(false)

    for (const destinationCheck of ['match', 'unknown', undefined, null, 'MISMATCH', 1]) {
      const wrapper = mountDecision(receipt({ destinationCheck }))
      expect(wrapper.find('[data-testid="receipt-destination-mismatch"]').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('destinatario')
      expect(wrapper.text()).not.toContain('verificado')
    }
  })

  it('TRANSFER_RECEIPT: the image reading shows the destination and payer, omitting missing parts', () => {
    const full = mountDecision(
      receipt({
        extracted: {
          amountCents: 17800,
          destinationBank: 'BBVA MEXICO',
          destinationName: 'Abril Vazquez',
          destinationAccountLast4: '9616',
          originName: 'Juan Pérez',
        },
      }),
    )
    const row = full.get('[data-testid="receipt-extracted"]')
    expect(row.text()).toContain('$178.00')
    expect(full.get('[data-testid="receipt-extracted-destination"]').text()).toBe(
      'Beneficiario: Abril Vazquez · Banco destino: BBVA MEXICO · Cuenta destino: ****9616',
    )
    expect(full.get('[data-testid="receipt-extracted-origin"]').text()).toBe(
      'Ordenante: Juan Pérez',
    )
    expect(row.text()).toContain('Lectura automática del bot')

    const destinationOnly = mountDecision(
      receipt({ extracted: { destinationAccountLast4: '9616', originName: '  ' } }),
    )
    expect(destinationOnly.find('[data-testid="receipt-extracted-reading"]').exists()).toBe(false)
    expect(destinationOnly.get('[data-testid="receipt-extracted-destination"]').text()).toBe(
      'Cuenta destino: ****9616',
    )
    expect(destinationOnly.find('[data-testid="receipt-extracted-origin"]').exists()).toBe(false)
    expect(destinationOnly.text()).toContain('Lectura automática del bot')

    const garbage = mountDecision(
      receipt({
        extracted: {
          destinationBank: 7,
          destinationName: '<img src=x onerror=alert(1)>'.repeat(10),
          destinationAccountLast4: '12ab',
          originName: ['x'],
        },
      }),
    )
    expect(garbage.find('[data-testid="receipt-extracted"]').exists()).toBe(false)
    expect(garbage.find('img[src="x"]').exists()).toBe(false)
  })

  it('shows the resolution of a closed decision: what was chosen, by whom and when', () => {
    const request = makeDetail({
      status: 'RESOLVED',
      displayStatus: 'RESOLVED',
      decision: {
        subtype: 'RESTOCK',
        snapshot: {
          branchName: null,
          productId: 'p-1',
          productName: 'Croquetas',
          variantId: null,
          sku: null,
          requestedQuantity: 1,
          observedStockAtRequest: 0,
          stockObservedAt: '2026-11-10T17:00:00.000Z',
        },
        resolution: {
          action: 'PROVIDE_RESTOCK_ESTIMATE',
          restockDays: 5,
          resolvedBy: { id: 'u-1', displayName: 'Laura Méndez' },
          resolvedAt: '2026-11-11T16:00:00.000Z',
        },
      },
    })
    const resolution = mountDecision(request).get('[data-testid="decision-resolution"]').text()
    expect(resolution).toContain('Dio un estimado de reposición')
    expect(resolution).toContain('Laura Méndez')
  })

  it('renders an unknown decision shape defensively instead of crashing', () => {
    const request = makeDetail({
      decision: { subtype: 'FUTURE_THING', surprise: { a: 1 } } as never,
    })
    const wrapper = mountDecision(request)
    expect(panel(wrapper).text()).toContain('no sabe mostrar')

    const broken = makeDetail({ decision: { subtype: 'RESTOCK' } as never })
    expect(() => mountDecision(broken)).not.toThrow()
    expect(panel(mountDecision(broken)).text()).toContain('Reposición: datos de la solicitud')
  })
})
