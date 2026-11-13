/**
 * Test-only builders for the detail specs (T2.U3). Not imported by any runtime module: it lives
 * under `utils/detail-*` because the U3 edit surface has no `__tests__` fixture slot.
 */
import { makeRow } from '../interfaces/__tests__/chatbot-request.fixture'
import type {
  ChatbotRequestAuditItem,
  ChatbotRequestDetail,
  ChatbotRequestDetailCustomer,
} from '../interfaces/chatbot-request.types'

export function makeCustomer(
  overrides: Partial<ChatbotRequestDetailCustomer> = {},
): ChatbotRequestDetailCustomer {
  return {
    id: 'cus-1',
    displayName: 'Juan Pérez',
    phone: '+5233 **** 5678',
    customerSince: '2025-03-02T10:00:00.000Z',
    isTrusted: true,
    priceList: { id: 'pl-1', name: 'Mayoreo' },
    ambiguous: false,
    candidates: [],
    recentOrders: [
      {
        saleId: 'sale-1',
        folio: 'V-1042',
        createdAt: '2026-11-09T17:00:00.000Z',
        totalCents: 184000,
        status: 'CONFIRMED',
        paymentStatus: 'PENDING',
      },
    ],
    ...overrides,
  }
}

export function makeAuditEvent(
  type: ChatbotRequestAuditItem['type'],
  overrides: Record<string, unknown> = {},
): ChatbotRequestAuditItem {
  // SAFETY: a test builder; `type` and the `overrides` data are chosen together by each spec, so
  // the discriminated union (type → data shape) holds even though the compiler cannot correlate them.
  return {
    id: `${type}-1`,
    type,
    createdAt: '2026-11-11T16:00:00.000Z',
    actor: { kind: 'USER', id: 'u-2', displayName: 'Luis Ortega' },
    fromStatus: null,
    toStatus: null,
    version: 2,
    data: {},
    ...overrides,
  } as unknown as ChatbotRequestAuditItem
}

/** A NEW restock detail with the final v1.3 shape; override what a test cares about. */
export function makeDetail(overrides: Partial<ChatbotRequestDetail> = {}): ChatbotRequestDetail {
  return {
    ...makeRow({ id: 'req-1', folio: 'S-000123', summary: 'Croquetas 15 kg para el viernes' }),
    needs: 'Quiere saber cuándo habrá Croquetas Premium. Necesita 6 piezas.',
    context: { cartRef: 'cart-9', quantity: 6 },
    customer: makeCustomer(),
    otherOpenRequests: [],
    decision: {
      subtype: 'RESTOCK',
      snapshot: {
        branchName: 'Sucursal Centro',
        productId: 'p-1',
        productName: 'Croquetas Premium Adulto 15 kg',
        variantId: null,
        sku: 'CRQ-PA-15',
        requestedQuantity: 6,
        observedStockAtRequest: 0,
        stockObservedAt: '2026-11-10T17:00:00.000Z',
      },
      resolution: null,
    },
    zoneImpact: null,
    deliveries: [],
    audit: [makeAuditEvent('CREATED', { toStatus: 'NEW', actor: { kind: 'SYSTEM', id: null, displayName: null } })],
    auditNextCursor: null,
    ...overrides,
  }
}

/** Global stubs for mounting the detail parts without Nuxt UI or a router. */
export const DETAIL_STUBS = {
  RouterLink: {
    props: ['to'],
    template: '<a data-stub="router-link" :data-to="JSON.stringify(to)"><slot /></a>',
  },
  UIcon: { props: ['name'], template: '<span data-stub="icon" :data-name="name" />' },
  UButton: {
    props: ['label', 'disabled', 'icon', 'color', 'variant', 'loading', 'block'],
    emits: ['click'],
    template:
      '<button type="button" :disabled="disabled" @click="$emit(\'click\')"><slot>{{ label }}</slot></button>',
  },
}
