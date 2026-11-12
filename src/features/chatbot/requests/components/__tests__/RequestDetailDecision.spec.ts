import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RequestDetailDecision from '../RequestDetailDecision.vue'
import { DETAIL_STUBS, makeDetail } from '../../utils/detail-fixture'
import type { ChatbotRequestDetail } from '../../interfaces/chatbot-request.types'

const TZ = 'America/Mexico_City'
const NOW = new Date('2026-11-11T17:05:00.000Z')

function mountDecision(request: ChatbotRequestDetail) {
  return mount(RequestDetailDecision, {
    props: { request, timeZone: TZ, now: NOW },
    global: { stubs: DETAIL_STUBS },
  })
}

const panel = (w: ReturnType<typeof mountDecision>) => w.get('[data-testid="request-decision"]')

describe('RequestDetailDecision', () => {
  it('renders nothing for a request without decision (clarification, conversation)', () => {
    const wrapper = mountDecision(makeDetail({ kind: 'CLARIFICATION', subtype: 'UNKNOWN_QUESTION', decision: null }))
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
    expect(mountDecision(zone({ zoneImpact: null })).find('[data-testid="zone-impact"]').exists()).toBe(false)
    expect(
      mountDecision(zone({ status: 'RESOLVED', displayStatus: 'RESOLVED' })).find('[data-testid="zone-impact"]').exists(),
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
          originalUrl: 'https://cdn.example.com/original.jpg',
          previewUrl: 'https://cdn.example.com/preview.jpg',
        },
        extracted: null,
        mismatch: null,
        resolution: null,
        ...overrides,
      },
    } as Partial<ChatbotRequestDetail>)

  it('TRANSFER_RECEIPT: sale, amounts, declared data and the preview image', () => {
    const wrapper = mountDecision(receipt())
    const text = panel(wrapper).text()
    expect(text).toContain('Comprobante: datos de la solicitud')
    expect(text).toContain('V-1042')
    expect(text).toContain('$1,840.00')
    expect(text).toContain('$0.00')
    expect(text).toContain('SPEI 4471290')
    const img = wrapper.get('[data-testid="receipt-preview"] img')
    expect(img.attributes('src')).toBe('https://cdn.example.com/preview.jpg')
    expect(img.attributes('alt')).toBe('Comprobante enviado por el cliente')
    expect(wrapper.get('[data-testid="receipt-original"]').attributes('href')).toBe(
      'https://cdn.example.com/original.jpg',
    )
    expect(wrapper.get('[data-testid="receipt-original"]').attributes('rel')).toContain('noopener')
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
    expect(wrapper.get('[data-testid="receipt-preview"]').text()).toContain('Generando la vista previa')
    expect(wrapper.find('[data-testid="receipt-original"]').exists()).toBe(false)
  })

  it('TRANSFER_RECEIPT: never puts an unsafe URL in the page, and says when the file was purged', () => {
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

    const purged = mountDecision(receipt({ file: null }))
    expect(purged.get('[data-testid="receipt-preview"]').text()).toContain('El archivo ya se eliminó')
  })

  it('TRANSFER_RECEIPT: says so when the customer gave no amount, and flags a mismatch only when the server says so', () => {
    const none = mountDecision(receipt({ declaredAmountCents: null, declaredAmountProvided: false }))
    expect(none.text()).toContain('No indicó monto')
    expect(none.find('[data-testid="receipt-mismatch"]').exists()).toBe(false)

    const mismatch = mountDecision(receipt({ mismatch: true }))
    expect(mismatch.get('[data-testid="receipt-mismatch"]').text()).toContain('El monto no coincide')

    const odd = mountDecision(receipt({ mismatch: { weird: true }, extracted: { a: 1 } }))
    expect(odd.find('[data-testid="receipt-mismatch"]').exists()).toBe(false)
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
