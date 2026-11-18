/**
 * `useConvertQuotationToSale` — quotation → POS sale draft (backend handoff 23 §2, odd T3 / S4).
 *
 * `convert(id)` calls `POST /quotations/:id/convert-to-sale` with a fresh `Idempotency-Key` per
 * press (a second press while one is pending is ignored). On `201`:
 *   - the detail cache takes the converted quotation, and the quotation list, the detail and the
 *     POS drafts (`saleQueryKeys.drafts`) are invalidated;
 *   - the new draft becomes the POS active tab: it is put into the POS drafts cache (appended, or
 *     replaced when already there) BEFORE navigating, and its id is written to
 *     `POS_ACTIVE_TAB_STORAGE_KEY`, so `SalesView` finds it when it mounts (odd D6: with only an
 *     invalidation the POS read the stale list and opened the previous draft). The drafts stay
 *     invalidated, so the POS still rereads the full list;
 *   - `suppressedPromotions` (automatic promotions vetoed to keep the exact quoted total) is kept
 *     for that draft (`rememberSuppressedPromotions`): GET /sales/drafts does not expose vetoes, and
 *     «Promociones disponibles» offers them with «Aplicar» (odd T3b / S5).
 * On a rejection, `failure` holds the decoded code (`decodeQuotationConversionError`) and the
 * detail is refreshed (it may have been converted by someone else meanwhile); copy for the UI comes
 * from `conversionFailureCopy`.
 */
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { quotationQueryKeys, saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { POS_ACTIVE_TAB_STORAGE_KEY } from '@/features/POS/sales/constants/sale.constants'
import { rememberSuppressedPromotions } from '@/features/POS/sales/composables/useSuppressedPromotions'
import type { Sale } from '@/features/POS/sales/interfaces/sale.types'
import { quotationApi } from '../api/quotation.api'
import type {
  QuotationConversionFailure,
  QuotationResponseDto,
  UnavailableLine,
} from '../interfaces/quotation.types'
import { decodeQuotationConversionError } from '../utils/quotation-conversion.errors'
import { isExpired } from '../utils/quotation.utils'

/** Where the POS sale workspace lives (`pos-sales`). */
const POS_SALES_PATH = '/pos/ventas/nueva'

/** The confirm dialog's rule (backend owner rule «Exacto por defecto, se ajusta después»): the sale
 *  opens at the exact quoted total, no new automatic promotions; the cashier adjusts it in the POS. */
export const CONVERT_TO_SALE_RULE =
  'Se abre una venta con los precios y descuentos cotizados. Después puedes ajustarla en el punto de venta.'

/**
 * Convertible (handoff 23 §2-§3): DRAFT or SENT and not expired (the backend's `effectiveStatus`
 * already reads an expired draft as EXPIRED; a SENT one is also checked locally against
 * `expiresAt`), or CONVERTED_TO_SALE whose sale draft was discarded (`saleId: null`, «Convertir de
 * nuevo»). Permissions are the caller's job (create:Sale + update:Quotation).
 */
export function canConvertQuotation(quotation: QuotationResponseDto): boolean {
  const status = quotation.effectiveStatus ?? quotation.status
  if (status === 'DRAFT' || status === 'SENT') {
    return !(quotation.status === 'SENT' && isExpired(quotation))
  }
  return status === 'CONVERTED_TO_SALE' && quotation.saleId === null
}

export interface ConversionFailureCopy {
  title: string
  description: string
  /** One line per unavailable product, with its reason (QUOTATION_LINES_UNAVAILABLE). */
  lines: string[]
  /** Sale to open with «Ver venta» (QUOTATION_ALREADY_CONVERTED). */
  saleId: string | null
  /** Pressing again can succeed (network, still in flight, unknown). */
  retryable: boolean
}

function lineReason(line: UnavailableLine): string {
  switch (line.reason) {
    case 'INSUFFICIENT_STOCK':
      return line.availableQuantity === null
        ? 'stock insuficiente'
        : `stock insuficiente (pides ${line.requestedQuantity}, hay ${line.availableQuantity})`
    case 'PRODUCT_NOT_FOUND':
      return 'el producto ya no existe'
    case 'VARIANT_NOT_FOUND':
      return 'la variante ya no existe'
    case 'PRODUCT_NOT_SELLABLE':
      return 'ya no se vende en el punto de venta'
    default:
      return 'no está disponible'
  }
}

function lineLabel(line: UnavailableLine): string {
  const name = line.variantName ? `${line.productName} · ${line.variantName}` : line.productName
  return `${name}: ${lineReason(line)}`
}

function copy(
  title: string,
  description: string,
  extra: Partial<Pick<ConversionFailureCopy, 'lines' | 'saleId' | 'retryable'>> = {},
): ConversionFailureCopy {
  return { title, description, lines: [], saleId: null, retryable: false, ...extra }
}

/** Spanish copy for a decoded `convert-to-sale` rejection. */
export function conversionFailureCopy(failure: QuotationConversionFailure): ConversionFailureCopy {
  switch (failure.code) {
    case 'QUOTATION_EXPIRED':
      return copy('La cotización venció', 'Renuévala para venderla con precios vigentes.')
    case 'QUOTATION_CANCELLED':
      return copy(
        'La cotización está cancelada',
        'Una cotización cancelada no se puede convertir en venta.',
      )
    case 'QUOTATION_ALREADY_CONVERTED':
      return copy('Ya se convirtió en venta', 'Esta cotización ya generó una venta.', {
        saleId: failure.saleId,
      })
    case 'QUOTATION_HAS_NO_ITEMS':
      return copy(
        'La cotización no tiene productos',
        'Agrega productos antes de convertirla en venta.',
      )
    case 'QUOTATION_LINES_UNAVAILABLE':
      return copy(
        'Algunos productos no se pueden vender',
        'Edita la cotización o vende los productos disponibles desde el punto de venta.',
        { lines: failure.lines.map(lineLabel) },
      )
    case 'IDEMPOTENCY_KEY_IN_FLIGHT':
      return copy('La conversión sigue en proceso', 'Espera unos segundos e inténtalo de nuevo.', {
        retryable: true,
      })
    case 'FORBIDDEN':
      return copy(
        'No tienes permiso para convertir cotizaciones en venta',
        'Pide a un administrador el permiso de crear ventas y editar cotizaciones.',
      )
    case 'NETWORK':
      return copy(
        'No se pudo conectar',
        'No sabemos si la venta se creó. Inténtalo de nuevo: nunca se crea una venta doble.',
        { retryable: true },
      )
    case 'ENTITY_NOT_FOUND':
      return copy(
        'No encontramos la cotización',
        'Pudo haberse eliminado o pertenece a otra sucursal.',
      )
    case 'RESPONSE_INVALID':
      return copy(
        'La venta se creó, pero no pudimos mostrarla',
        'Abre el punto de venta para continuar con ella.',
      )
    default:
      return copy('No se pudo convertir en venta', 'Inténtalo de nuevo en un momento.', {
        retryable: true,
      })
  }
}

/** The POS drafts list with `sale` in it: replaced in place when present, appended otherwise. */
function withDraft(drafts: Sale[] | undefined, sale: Sale): Sale[] {
  const current = drafts ?? []
  return current.some((draft) => draft.id === sale.id)
    ? current.map((draft) => (draft.id === sale.id ? sale : draft))
    : [...current, sale]
}

export function useConvertQuotationToSale() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const authStore = useAuthStore()
  const tenantId = computed(() => authStore.currentTenantId ?? '')

  const pending = ref(false)
  const failure = ref<QuotationConversionFailure | null>(null)

  function reset(): void {
    failure.value = null
  }

  /** Resolves `true` when the sale draft was created and the POS was opened. */
  async function convert(quotationId: string): Promise<boolean> {
    if (pending.value) return false
    pending.value = true
    failure.value = null
    const detailKey = quotationQueryKeys.detail(tenantId.value, quotationId)
    let response: Awaited<ReturnType<typeof quotationApi.convertToSale>>
    try {
      // One key per attempt: the backend turns a double conversion into
      // QUOTATION_ALREADY_CONVERTED, so a new press never creates a second sale.
      response = await quotationApi.convertToSale(quotationId, crypto.randomUUID())
    } catch (error) {
      failure.value = decodeQuotationConversionError(error)
      void queryClient.invalidateQueries({ queryKey: detailKey })
      pending.value = false
      return false
    }

    queryClient.setQueryData(detailKey, response.quotation)
    void queryClient.invalidateQueries({ queryKey: quotationQueryKeys.list(tenantId.value) })
    void queryClient.invalidateQueries({ queryKey: detailKey })
    const draftsKey = saleQueryKeys.drafts(tenantId.value)
    queryClient.setQueryData(
      draftsKey,
      withDraft(queryClient.getQueryData<Sale[]>(draftsKey), response.sale),
    )
    void queryClient.invalidateQueries({ queryKey: draftsKey })
    rememberSuppressedPromotions(response.sale.id, response.suppressedPromotions ?? [])
    localStorage.setItem(POS_ACTIVE_TAB_STORAGE_KEY, response.sale.id)
    try {
      await router.push(POS_SALES_PATH)
    } finally {
      pending.value = false
    }
    return true
  }

  return {
    convert,
    isPending: computed(() => pending.value),
    failure,
    reset,
  }
}
