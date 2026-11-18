import { beforeEach, describe, expect, it, vi } from 'vitest'
import { quotationQueryKeys, saleQueryKeys } from '@/core/shared/constants/query-keys'
import { POS_ACTIVE_TAB_STORAGE_KEY } from '@/features/POS/sales/constants/sale.constants'
import type {
  QuotationConversionFailure,
  QuotationResponseDto,
} from '../../interfaces/quotation.types'

const queryClientMock = {
  getQueryData: vi.fn(),
  setQueryData: vi.fn(),
  invalidateQueries: vi.fn().mockResolvedValue(undefined),
}
const routerPush = vi.fn().mockResolvedValue(undefined)
const convertToSale = vi.fn()

vi.mock('@tanstack/vue-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/vue-query')>()
  return { ...actual, useQueryClient: () => queryClientMock }
})

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: routerPush }) }
})

vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({ currentTenantId: 'tenant-1' }),
}))

vi.mock('../../api/quotation.api', () => ({
  quotationApi: { convertToSale: (...args: unknown[]) => convertToSale(...args) },
}))

import {
  canConvertQuotation,
  conversionFailureCopy,
  useConvertQuotationToSale,
} from '../useConvertQuotationToSale'

function makeQuotation(overrides: Partial<QuotationResponseDto> = {}): QuotationResponseDto {
  return {
    id: 'q-1',
    customerId: null,
    customer: null,
    globalPriceListId: null,
    priceListExplicitlySet: false,
    status: 'SENT',
    effectiveStatus: 'SENT',
    expiresAt: null,
    cancelReason: null,
    canceledAt: null,
    subtotalCents: 0,
    discountCents: 0,
    totalCents: 0,
    ivaBreakdown: [],
    customerNotes: null,
    manuallyEnded: false,
    items: [],
    appliedPromotions: [],
    vetoedPromotionIds: [],
    optedInManualPromotionIds: [],
    sellerUserId: '',
    seller: null,
    saleId: null,
    convertedAt: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

function axiosRejection(status: number, data: unknown) {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status, data },
  })
}

let deferredResolve: ((value: unknown) => void) | null = null

beforeEach(() => {
  queryClientMock.setQueryData.mockReset()
  queryClientMock.invalidateQueries.mockReset().mockResolvedValue(undefined)
  routerPush.mockReset().mockResolvedValue(undefined)
  convertToSale.mockReset()
  localStorage.clear()
  deferredResolve = null
})

describe('useConvertQuotationToSale — success (S4)', () => {
  it('sends one fresh Idempotency-Key per attempt', async () => {
    const converted = makeQuotation({ status: 'CONVERTED_TO_SALE', saleId: 'sale-9' })
    convertToSale.mockResolvedValue({ quotation: converted, sale: { id: 'sale-9' } })
    const { convert } = useConvertQuotationToSale()

    await convert('q-1')
    await convert('q-1')

    expect(convertToSale).toHaveBeenCalledTimes(2)
    const [firstId, firstKey] = convertToSale.mock.calls[0]!
    const [, secondKey] = convertToSale.mock.calls[1]!
    expect(firstId).toBe('q-1')
    expect(typeof firstKey).toBe('string')
    expect((firstKey as string).length).toBeGreaterThan(0)
    expect(secondKey).not.toBe(firstKey)
  })

  it('ignores a second press while the first is pending (one request)', async () => {
    convertToSale.mockImplementation(
      () => new Promise((resolve) => (deferredResolve = resolve)),
    )
    const { convert, isPending } = useConvertQuotationToSale()

    const first = convert('q-1')
    expect(isPending.value).toBe(true)
    const second = await convert('q-1')
    expect(second).toBe(false)
    expect(convertToSale).toHaveBeenCalledTimes(1)

    deferredResolve!({
      quotation: makeQuotation({ status: 'CONVERTED_TO_SALE', saleId: 'sale-9' }),
      sale: { id: 'sale-9' },
    })
    await first
    expect(isPending.value).toBe(false)
  })

  it('updates the caches, selects the new draft in the POS and navigates there', async () => {
    const converted = makeQuotation({ status: 'CONVERTED_TO_SALE', saleId: 'sale-9' })
    convertToSale.mockResolvedValue({ quotation: converted, sale: { id: 'sale-9' } })
    const { convert, failure } = useConvertQuotationToSale()

    const ok = await convert('q-1')

    expect(ok).toBe(true)
    expect(failure.value).toBeNull()
    expect(queryClientMock.setQueryData).toHaveBeenCalledWith(
      quotationQueryKeys.detail('tenant-1', 'q-1'),
      converted,
    )
    const invalidated = queryClientMock.invalidateQueries.mock.calls.map((c) => c[0].queryKey)
    expect(invalidated).toContainEqual(quotationQueryKeys.list('tenant-1'))
    expect(invalidated).toContainEqual(quotationQueryKeys.detail('tenant-1', 'q-1'))
    expect(invalidated).toContainEqual(saleQueryKeys.drafts('tenant-1'))
    // The POS restores its active tab from this key on mount.
    expect(localStorage.getItem(POS_ACTIVE_TAB_STORAGE_KEY)).toBe('sale-9')
    expect(routerPush).toHaveBeenCalledWith('/pos/ventas/nueva')
  })
})

describe('useConvertQuotationToSale — suppressedPromotions (odd T3b / S5)', () => {
  it('keeps the vetoed automatic promotions for the new draft before opening the POS', async () => {
    const { readSuppressedPromotions } = await import(
      '@/features/POS/sales/composables/useSuppressedPromotions'
    )
    convertToSale.mockResolvedValue({
      quotation: makeQuotation({ status: 'CONVERTED_TO_SALE', saleId: 'sale-9' }),
      sale: { id: 'sale-9' },
      suppressedPromotions: [{ promotionId: 'promo-auto', title: 'Orden auto' }],
    })
    const { convert } = useConvertQuotationToSale()

    await convert('q-1')

    expect(readSuppressedPromotions('sale-9')).toEqual([
      { promotionId: 'promo-auto', title: 'Orden auto' },
    ])
  })
})

describe('useConvertQuotationToSale — rejections (S4)', () => {
  it('decodes the rejection into `failure`, does not navigate and refreshes the quotation', async () => {
    convertToSale.mockRejectedValue(
      axiosRejection(422, { error: 'QUOTATION_ALREADY_CONVERTED', saleId: 'sale-7' }),
    )
    const { convert, failure, isPending } = useConvertQuotationToSale()

    const ok = await convert('q-1')

    expect(ok).toBe(false)
    expect(isPending.value).toBe(false)
    expect(failure.value).toEqual({ code: 'QUOTATION_ALREADY_CONVERTED', saleId: 'sale-7' })
    expect(routerPush).not.toHaveBeenCalled()
    expect(localStorage.getItem(POS_ACTIVE_TAB_STORAGE_KEY)).toBeNull()
    const invalidated = queryClientMock.invalidateQueries.mock.calls.map((c) => c[0].queryKey)
    expect(invalidated).toContainEqual(quotationQueryKeys.detail('tenant-1', 'q-1'))
  })

  it('a network failure is NETWORK and reset() clears it', async () => {
    convertToSale.mockRejectedValue(new Error('offline'))
    const { convert, failure, reset } = useConvertQuotationToSale()

    await convert('q-1')
    expect(failure.value).toEqual({ code: 'NETWORK' })
    reset()
    expect(failure.value).toBeNull()
  })
})

describe('conversionFailureCopy — Spanish messages (S4)', () => {
  const cases: Array<[QuotationConversionFailure, string, string]> = [
    [{ code: 'QUOTATION_EXPIRED' }, 'La cotización venció', 'Renuévala para venderla con precios vigentes.'],
    [{ code: 'QUOTATION_CANCELLED' }, 'La cotización está cancelada', 'Una cotización cancelada no se puede convertir en venta.'],
    [{ code: 'QUOTATION_HAS_NO_ITEMS' }, 'La cotización no tiene productos', 'Agrega productos antes de convertirla en venta.'],
    [{ code: 'IDEMPOTENCY_KEY_IN_FLIGHT' }, 'La conversión sigue en proceso', 'Espera unos segundos e inténtalo de nuevo.'],
    [{ code: 'FORBIDDEN' }, 'No tienes permiso para convertir cotizaciones en venta', 'Pide a un administrador el permiso de crear ventas y editar cotizaciones.'],
    [{ code: 'NETWORK' }, 'No se pudo conectar', 'No sabemos si la venta se creó. Inténtalo de nuevo: nunca se crea una venta doble.'],
    [{ code: 'UNKNOWN', status: 500, error: null }, 'No se pudo convertir en venta', 'Inténtalo de nuevo en un momento.'],
  ]

  it.each(cases)('%o → %s', (failure, title, description) => {
    const copy = conversionFailureCopy(failure)
    expect(copy.title).toBe(title)
    expect(copy.description).toBe(description)
    expect(copy.lines).toEqual([])
  })

  it('QUOTATION_ALREADY_CONVERTED carries the saleId for «Ver venta»', () => {
    expect(conversionFailureCopy({ code: 'QUOTATION_ALREADY_CONVERTED', saleId: 'sale-7' })).toEqual({
      title: 'Ya se convirtió en venta',
      description: 'Esta cotización ya generó una venta.',
      lines: [],
      saleId: 'sale-7',
      retryable: false,
    })
    expect(conversionFailureCopy({ code: 'QUOTATION_ALREADY_CONVERTED', saleId: null }).saleId).toBeNull()
  })

  it('QUOTATION_LINES_UNAVAILABLE lists every line with its reason', () => {
    const copy = conversionFailureCopy({
      code: 'QUOTATION_LINES_UNAVAILABLE',
      lines: [
        { lineId: 'l1', productId: 'p1', variantId: 'v1', productName: 'Playera', variantName: 'Roja', reason: 'INSUFFICIENT_STOCK', requestedQuantity: 2, availableQuantity: 1 },
        { lineId: 'l2', productId: 'p2', variantId: null, productName: 'Gorra', variantName: null, reason: 'PRODUCT_NOT_FOUND', requestedQuantity: 1, availableQuantity: null },
        { lineId: 'l3', productId: 'p3', variantId: 'v3', productName: 'Jeans', variantName: '32', reason: 'VARIANT_NOT_FOUND', requestedQuantity: 1, availableQuantity: null },
        { lineId: 'l4', productId: 'p4', variantId: null, productName: 'Collar', variantName: null, reason: 'PRODUCT_NOT_SELLABLE', requestedQuantity: 1, availableQuantity: null },
        { lineId: 'l5', productId: 'p5', variantId: null, productName: 'Correa', variantName: null, reason: 'UNKNOWN', requestedQuantity: 1, availableQuantity: null },
      ],
    })
    expect(copy.title).toBe('Algunos productos no se pueden vender')
    expect(copy.description).toBe('Edita la cotización o vende los productos disponibles desde el punto de venta.')
    expect(copy.lines).toEqual([
      'Playera · Roja: stock insuficiente (pides 2, hay 1)',
      'Gorra: el producto ya no existe',
      'Jeans · 32: la variante ya no existe',
      'Collar: ya no se vende en el punto de venta',
      'Correa: no está disponible',
    ])
    expect(copy.retryable).toBe(false)
  })

  it('marks NETWORK, IN_FLIGHT and UNKNOWN as retryable; terminal rejections are not', () => {
    expect(conversionFailureCopy({ code: 'NETWORK' }).retryable).toBe(true)
    expect(conversionFailureCopy({ code: 'IDEMPOTENCY_KEY_IN_FLIGHT' }).retryable).toBe(true)
    expect(conversionFailureCopy({ code: 'UNKNOWN', status: 500, error: null }).retryable).toBe(true)
    expect(conversionFailureCopy({ code: 'QUOTATION_EXPIRED' }).retryable).toBe(false)
    expect(conversionFailureCopy({ code: 'FORBIDDEN' }).retryable).toBe(false)
  })
})

describe('canConvertQuotation — DRAFT and SENT only (S4/S5)', () => {
  it.each([
    ['DRAFT', true],
    ['SENT', true],
    ['EXPIRED', false],
    ['CANCELLED', false],
  ] as const)('%s → %s', (status, expected) => {
    expect(canConvertQuotation(makeQuotation({ status, effectiveStatus: status }))).toBe(expected)
  })

  it('a converted quotation with its sale is not convertible', () => {
    expect(
      canConvertQuotation(
        makeQuotation({ status: 'CONVERTED_TO_SALE', effectiveStatus: 'CONVERTED_TO_SALE', saleId: 'sale-1' }),
      ),
    ).toBe(false)
  })

  it('a converted quotation whose sale draft was discarded (saleId null) can convert again', () => {
    expect(
      canConvertQuotation(
        makeQuotation({ status: 'CONVERTED_TO_SALE', effectiveStatus: 'CONVERTED_TO_SALE', saleId: null }),
      ),
    ).toBe(true)
  })

  it('a DRAFT the backend reads as EXPIRED (effectiveStatus) is not convertible', () => {
    expect(canConvertQuotation(makeQuotation({ status: 'DRAFT', effectiveStatus: 'EXPIRED' }))).toBe(false)
  })

  it('a SENT quotation whose expiresAt already passed is not convertible', () => {
    expect(
      canConvertQuotation(makeQuotation({ status: 'SENT', effectiveStatus: 'SENT', expiresAt: '2020-01-01T00:00:00.000Z' })),
    ).toBe(false)
  })
})
