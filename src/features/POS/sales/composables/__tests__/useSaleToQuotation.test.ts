// T2 (quotation-sale-conversion, S1 + S3): POS sale draft → quotation.
//
// Backend handoff 23 §1: POST /quotations/from-sale/:saleId with a mandatory
// `Idempotency-Key` (one per press, reused only to retry the same request),
// optional `customerNotes` (≤ 280). On 201 the sale draft no longer exists:
// the drafts list and the quotations list are stale.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h } from 'vue'
import { http } from '@/core/shared/api/http'
import { quotationQueryKeys, saleQueryKeys } from '@/core/shared/constants/query-keys'
import type { Sale } from '../../interfaces/sale.types'
import {
  formatDroppedAdjustment,
  saleToQuotationFailureMessage,
  useSaleToQuotation,
  useSaleToQuotationPermission,
} from '../useSaleToQuotation'

vi.mock('@/core/shared/api/http', () => ({
  http: { post: vi.fn(), get: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}))

vi.mock('@/features/auth/composables/useSafeTenantId', () => ({
  useSafeTenantId: () => computed(() => 'tenant-1'),
}))

const { keys } = vi.hoisted(() => ({ keys: { next: 0 } }))
vi.mock('../../utils/idempotency.utils', () => ({
  newIdempotencyKey: () => `key-${++keys.next}`,
}))

const { grants } = vi.hoisted(() => ({ grants: { value: new Set<string>() } }))
vi.mock('@/features/auth/stores/useAuthStore', () => ({
  useAuthStore: () => ({
    userCan: (action: string, subject: string) => grants.value.has(`${action}:${subject}`),
  }),
}))

const quotation = {
  id: 'q-1',
  status: 'DRAFT',
  effectiveStatus: 'DRAFT',
  sellerUserId: 'u-1',
  seller: { id: 'u-1', name: 'Pedro Pérez' },
  customerId: null,
  customer: null,
  globalPriceListId: null,
  priceListExplicitlySet: false,
  customerNotes: 'Entrega en sucursal Norte',
  items: [],
  subtotalCents: 25000,
  discountCents: 0,
  totalCents: 25000,
  ivaBreakdown: [],
  saleId: null,
  convertedAt: null,
}

const created = {
  quotation,
  discardedSaleId: 'sale-1',
  droppedAdjustments: [
    {
      kind: 'ORDER_PROMOTION',
      saleItemId: null,
      productId: null,
      variantId: null,
      promotionId: 'promo-1',
      title: 'Promo X',
      discountCents: 1200,
    },
  ],
}

function rejection(status: number, data: Record<string, unknown>): AxiosError {
  const error = new AxiosError('Request failed')
  error.response = { status, data, statusText: '', headers: {}, config: {} as never }
  return error
}

function draft(id: string): Sale {
  return { id, userId: 'u', status: 'DRAFT', items: [], createdAt: 'x', updatedAt: 'x' }
}

function mountComposable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  queryClient.setQueryData(saleQueryKeys.drafts('tenant-1'), [draft('sale-1'), draft('sale-2')])
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  let api!: ReturnType<typeof useSaleToQuotation>
  let permission!: ReturnType<typeof useSaleToQuotationPermission>
  mount(
    defineComponent({
      setup() {
        api = useSaleToQuotation()
        permission = useSaleToQuotationPermission()
        return () => h('div')
      },
    }),
    { global: { plugins: [[VueQueryPlugin, { queryClient }]] } },
  )
  return { api, permission, queryClient, invalidateQueries }
}

beforeEach(() => {
  vi.mocked(http.post).mockReset()
  keys.next = 0
  grants.value = new Set(['create:Quotation', 'delete:Sale'])
})

describe('useSaleToQuotationPermission', () => {
  it('needs create:Quotation AND delete:Sale', () => {
    expect(mountComposable().permission.value).toBe(true)
    grants.value = new Set(['create:Quotation'])
    expect(mountComposable().permission.value).toBe(false)
    grants.value = new Set(['delete:Sale'])
    expect(mountComposable().permission.value).toBe(false)
  })
})

describe('useSaleToQuotation.convert', () => {
  it('posts the exact route, body and Idempotency-Key header', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: created })
    const { api } = mountComposable()

    const result = await api.convert('sale-1', '  Entrega en sucursal Norte ')

    expect(http.post).toHaveBeenCalledTimes(1)
    expect(http.post).toHaveBeenCalledWith(
      '/quotations/from-sale/sale-1',
      { customerNotes: 'Entrega en sucursal Norte' },
      { headers: { 'Idempotency-Key': 'key-1' } },
    )
    expect(result?.quotation.id).toBe('q-1')
    expect(result?.droppedAdjustments).toHaveLength(1)
  })

  it('sends blank notes as null', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: created })
    const { api } = mountComposable()

    await api.convert('sale-1', '   ')

    expect(vi.mocked(http.post).mock.calls[0]![1]).toEqual({ customerNotes: null })
  })

  it('on success drops the discarded draft and invalidates the drafts and quotations lists', async () => {
    vi.mocked(http.post).mockResolvedValue({ data: created })
    const { api, queryClient, invalidateQueries } = mountComposable()

    await api.convert('sale-1', '')

    expect(queryClient.getQueryData<Sale[]>(saleQueryKeys.drafts('tenant-1'))?.map((d) => d.id)).toEqual([
      'sale-2',
    ])
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: saleQueryKeys.drafts('tenant-1') })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: quotationQueryKeys.list('tenant-1') })
    expect(api.failure.value).toBeNull()
  })

  it('reuses the same key to retry the same attempt after a failure', async () => {
    vi.mocked(http.post).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: created })
    const { api } = mountComposable()

    expect(await api.convert('sale-1', 'Nota')).toBeNull()
    expect(api.failure.value).toEqual({ code: 'NETWORK' })
    await api.convert('sale-1', 'Nota')

    const headers = vi.mocked(http.post).mock.calls.map((call) => (call[2] as { headers: Record<string, string> }).headers)
    expect(headers).toEqual([{ 'Idempotency-Key': 'key-1' }, { 'Idempotency-Key': 'key-1' }])
  })

  it('mints a new key when the notes change, after a conflict and for a new attempt', async () => {
    vi.mocked(http.post)
      .mockRejectedValueOnce(rejection(422, { error: 'SALE_HAS_PAYMENTS' }))
      .mockRejectedValueOnce(rejection(409, { error: 'IDEMPOTENCY_KEY_CONFLICT' }))
      .mockRejectedValueOnce(rejection(422, { error: 'SALE_HAS_PAYMENTS' }))
      .mockRejectedValueOnce(rejection(422, { error: 'SALE_HAS_PAYMENTS' }))
    const { api } = mountComposable()

    await api.convert('sale-1', 'A') // key-1
    await api.convert('sale-1', 'B') // other notes → key-2 (then conflict)
    await api.convert('sale-1', 'B') // after a conflict → key-3
    api.startAttempt()
    await api.convert('sale-1', 'B') // new dialog → key-4

    const used = vi.mocked(http.post).mock.calls.map(
      (call) => (call[2] as { headers: Record<string, string> }).headers['Idempotency-Key'],
    )
    expect(used).toEqual(['key-1', 'key-2', 'key-3', 'key-4'])
  })

  it('ignores a second press while the first is pending', async () => {
    let resolve!: (value: unknown) => void
    vi.mocked(http.post).mockReturnValue(new Promise((r) => (resolve = r)))
    const { api } = mountComposable()

    const first = api.convert('sale-1', '')
    expect(api.isPending.value).toBe(true)
    expect(await api.convert('sale-1', '')).toBeNull()
    resolve({ data: created })
    await first

    expect(http.post).toHaveBeenCalledTimes(1)
    expect(api.isPending.value).toBe(false)
  })

  it('decodes a rejection into failure (with the unavailable lines)', async () => {
    const lines = [
      {
        lineId: 'l-1',
        productId: 'p-1',
        variantId: null,
        productName: 'Playera',
        variantName: 'Talla M',
        reason: 'PRODUCT_NOT_SELLABLE',
        requestedQuantity: 2,
        availableQuantity: null,
      },
    ]
    vi.mocked(http.post).mockRejectedValue(rejection(422, { error: 'SALE_LINES_UNAVAILABLE', lines }))
    const { api, invalidateQueries } = mountComposable()

    expect(await api.convert('sale-1', '')).toBeNull()

    expect(api.failure.value).toMatchObject({ code: 'SALE_LINES_UNAVAILABLE', lines: [{ productName: 'Playera' }] })
    expect(invalidateQueries).not.toHaveBeenCalled()
  })

  it.each(['SALE_NOT_FOUND', 'SALE_NOT_DRAFT'])('reloads the drafts on %s', async (code) => {
    vi.mocked(http.post).mockRejectedValue(rejection(code === 'SALE_NOT_FOUND' ? 404 : 409, { error: code }))
    const { api, invalidateQueries } = mountComposable()

    await api.convert('sale-1', '')

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: saleQueryKeys.drafts('tenant-1') })
  })
})

describe('saleToQuotationFailureMessage', () => {
  it.each([
    [{ code: 'SALE_HAS_PAYMENTS' }, 'Esta venta ya tiene pagos registrados, así que no se puede pasar a cotización.'],
    [{ code: 'SALE_HAS_STOCK_MOVEMENTS' }, 'Esta venta ya movió inventario, así que no se puede pasar a cotización.'],
    [
      { code: 'SALE_NOT_DISCARDABLE' },
      'Esta venta está en una ruta de entrega o ya usó el cupo de una promoción, así que no se puede pasar a cotización.',
    ],
    [{ code: 'SALE_HAS_NO_ITEMS' }, 'La venta no tiene productos. Agrega al menos uno para crear la cotización.'],
    [
      { code: 'IDEMPOTENCY_KEY_IN_FLIGHT' },
      'La cotización se está creando. Espera unos segundos y vuelve a intentar.',
    ],
    [
      { code: 'IDEMPOTENCY_KEY_CONFLICT' },
      'La solicitud cambió desde el primer intento. Vuelve a intentar.',
    ],
    [
      { code: 'FORBIDDEN' },
      'Tu rol no permite pasar ventas a cotización: necesitas crear cotizaciones y eliminar ventas.',
    ],
    [{ code: 'SALE_UPDATE_FORBIDDEN' }, 'Esta venta es de otro cajero; solo quien la abrió puede pasarla a cotización.'],
    [{ code: 'SALE_NOT_FOUND' }, 'Esta venta ya no existe. Actualizamos tus ventas en curso.'],
    [{ code: 'SALE_NOT_DRAFT' }, 'Esta venta ya se cobró o se canceló. Actualizamos tus ventas en curso.'],
    [{ code: 'VALIDATION' }, 'Revisa la nota para el cliente: máximo 280 caracteres.'],
    [
      { code: 'NETWORK' },
      'No hubo respuesta del servidor. Revisa tu conexión y vuelve a intentar; no se creará una cotización duplicada.',
    ],
    [
      { code: 'RESPONSE_INVALID' },
      'La cotización se creó, pero no pudimos leer la respuesta. Búscala en Cotizaciones.',
    ],
    [{ code: 'UNKNOWN', status: 500, error: null }, 'No se pudo pasar la venta a cotización. Vuelve a intentar.'],
    [{ code: 'IDEMPOTENCY_KEY_REQUIRED' }, 'No se pudo pasar la venta a cotización. Vuelve a intentar.'],
  ] as const)('%o → human Spanish copy', (failure, message) => {
    expect(saleToQuotationFailureMessage(failure)).toEqual({ message, lines: [] })
  })

  it('lists each unavailable line with its reason', () => {
    const base = { productId: 'p', variantId: null, requestedQuantity: 2, availableQuantity: null }
    expect(
      saleToQuotationFailureMessage({
        code: 'SALE_LINES_UNAVAILABLE',
        lines: [
          { ...base, lineId: '1', productName: 'Playera', variantName: 'Talla M', reason: 'PRODUCT_NOT_SELLABLE' },
          { ...base, lineId: '2', productName: 'Gorra', variantName: null, reason: 'PRODUCT_NOT_FOUND' },
          { ...base, lineId: '3', productName: 'Taza', variantName: 'Roja', reason: 'VARIANT_NOT_FOUND' },
          { ...base, lineId: '4', productName: 'Vaso', variantName: null, reason: 'INSUFFICIENT_STOCK', availableQuantity: 1 },
          { ...base, lineId: '5', productName: 'Plato', variantName: null, reason: 'UNKNOWN' },
        ],
      }),
    ).toEqual({
      message: 'Estos productos ya no se pueden cotizar. Quítalos de la venta y vuelve a intentar:',
      lines: [
        'Playera · Talla M — ya no se vende en punto de venta',
        'Gorra — el producto ya no existe',
        'Taza · Roja — la variante ya no existe',
        'Vaso — solo hay 1 disponible (pediste 2)',
        'Plato — no está disponible',
      ],
    })
  })
})

describe('formatDroppedAdjustment', () => {
  it('reads «No se trasladó: título (−$monto)»', () => {
    expect(
      formatDroppedAdjustment({
        kind: 'ORDER_PROMOTION',
        saleItemId: null,
        productId: null,
        variantId: null,
        promotionId: 'p',
        title: 'Promo X',
        discountCents: 1200,
      }),
    ).toBe('No se trasladó: Promo X (−$12.00)')
  })
})
