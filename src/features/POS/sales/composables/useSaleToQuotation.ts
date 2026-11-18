import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { quotationQueryKeys, saleQueryKeys } from '@/core/shared/constants/query-keys'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { useSafeTenantId } from '@/features/auth/composables/useSafeTenantId'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { AppAction, AppSubject } from '@/features/auth/interfaces/auth.types'
import { quotationApi } from '@/features/POS/quotations/api/quotation.api'
import { decodeQuotationConversionError } from '@/features/POS/quotations/utils/quotation-conversion.errors'
import type {
  CreateQuotationFromSaleResponse,
  DroppedAdjustment,
  QuotationConversionFailure,
  UnavailableLine,
} from '@/features/POS/quotations/interfaces/quotation.types'
import type { Sale } from '../interfaces/sale.types'
import { newIdempotencyKey } from '../utils/idempotency.utils'

/**
 * T2 (quotation-sale-conversion, S1 + S3): POS sale draft → quotation.
 *
 * Backend handoff 23 §1 — `POST /quotations/from-sale/:saleId`:
 * - needs `create:Quotation` AND `delete:Sale` (the button is hidden otherwise);
 * - needs an `Idempotency-Key`: one per attempt (one dialog session with the
 *   same sale and notes), reused only to retry that same request (a timeout or
 *   a rejection the cashier fixed). A 409 conflict or a new dialog mints a new key;
 * - on 201 the sale draft no longer exists (deleted in the same transaction),
 *   so it leaves the drafts cache at once and both lists are invalidated.
 */

/** Notes limit of the contract (`customerNotes` ≤ 280, backend 400 otherwise). */
export const SALE_TO_QUOTATION_NOTES_MAX = 280

function safeUserCan(action: AppAction, subject: AppSubject): boolean {
  try {
    const store = useAuthStore()
    return typeof store.userCan === 'function' && store.userCan(action, subject)
  } catch {
    // No Pinia (isolated mounts): no permission, so the action stays hidden.
    return false
  }
}

/** The guard checks both permissions: hide the action when either is missing. */
export function useSaleToQuotationPermission() {
  return computed(() => safeUserCan('create', 'Quotation') && safeUserCan('delete', 'Sale'))
}

interface Attempt {
  key: string
  saleId: string
  notes: string | null
}

export function useSaleToQuotation() {
  const queryClient = useQueryClient()
  const tenantId = useSafeTenantId()

  const isPending = ref(false)
  const failure = ref<QuotationConversionFailure | null>(null)
  let attempt: Attempt | null = null

  /** A new dialog session: forget the previous key and failure. */
  function startAttempt() {
    attempt = null
    failure.value = null
  }

  function invalidateDrafts() {
    void queryClient.invalidateQueries({ queryKey: saleQueryKeys.drafts(tenantId.value) })
  }

  function invalidateQuotations() {
    void queryClient.invalidateQueries({ queryKey: quotationQueryKeys.list(tenantId.value) })
  }

  /** Resolves to the 201 body, or `null` on a rejection (read `failure`) or a press while pending. */
  async function convert(
    saleId: string,
    customerNotes: string,
  ): Promise<CreateQuotationFromSaleResponse | null> {
    if (isPending.value) return null
    const notes = customerNotes.trim() || null
    if (!attempt || attempt.saleId !== saleId || attempt.notes !== notes) {
      attempt = { key: newIdempotencyKey(), saleId, notes }
    }

    isPending.value = true
    failure.value = null
    try {
      const result = await quotationApi.createFromSale(saleId, { customerNotes: notes }, attempt.key)
      attempt = null
      // The draft is gone server-side: drop it now so its tab never lingers,
      // then reread the authoritative lists.
      queryClient.setQueryData<Sale[]>(saleQueryKeys.drafts(tenantId.value), (current) =>
        current?.filter((draft) => draft.id !== result.discardedSaleId),
      )
      invalidateDrafts()
      invalidateQuotations()
      return result
    } catch (error) {
      const decoded = decodeQuotationConversionError(error)
      failure.value = decoded
      if (decoded.code === 'IDEMPOTENCY_KEY_CONFLICT') attempt = null
      if (decoded.code === 'SALE_NOT_FOUND' || decoded.code === 'SALE_NOT_DRAFT') invalidateDrafts()
      if (decoded.code === 'RESPONSE_INVALID') {
        // 2xx with an unreadable body: the conversion happened.
        attempt = null
        invalidateDrafts()
        invalidateQuotations()
      }
      return null
    } finally {
      isPending.value = false
    }
  }

  return {
    convert,
    startAttempt,
    isPending: computed(() => isPending.value),
    failure: computed(() => failure.value),
  }
}

// ── Cashier copy ────────────────────────────────────────────────────────────

const GENERIC_FAILURE = 'No se pudo pasar la venta a cotización. Vuelve a intentar.'

function unavailableReason(line: UnavailableLine): string {
  switch (line.reason) {
    case 'PRODUCT_NOT_FOUND':
      return 'el producto ya no existe'
    case 'VARIANT_NOT_FOUND':
      return 'la variante ya no existe'
    case 'PRODUCT_NOT_SELLABLE':
      return 'ya no se vende en punto de venta'
    case 'INSUFFICIENT_STOCK': {
      const available = line.availableQuantity ?? 0
      const noun = available === 1 ? 'disponible' : 'disponibles'
      return `solo hay ${available} ${noun} (pediste ${line.requestedQuantity})`
    }
    default:
      return 'no está disponible'
  }
}

function unavailableLineLabel(line: UnavailableLine): string {
  const name = line.variantName ? `${line.productName} · ${line.variantName}` : line.productName
  return `${name} — ${unavailableReason(line)}`
}

/** Human Spanish message (and per-line details) for a rejected conversion. */
export function saleToQuotationFailureMessage(failure: QuotationConversionFailure): {
  message: string
  lines: string[]
} {
  const plain = (message: string) => ({ message, lines: [] })
  switch (failure.code) {
    case 'SALE_HAS_PAYMENTS':
      return plain('Esta venta ya tiene pagos registrados, así que no se puede pasar a cotización.')
    case 'SALE_HAS_STOCK_MOVEMENTS':
      return plain('Esta venta ya movió inventario, así que no se puede pasar a cotización.')
    case 'SALE_NOT_DISCARDABLE':
      return plain(
        'Esta venta está en una ruta de entrega o ya usó el cupo de una promoción, así que no se puede pasar a cotización.',
      )
    case 'SALE_HAS_NO_ITEMS':
      return plain('La venta no tiene productos. Agrega al menos uno para crear la cotización.')
    case 'SALE_LINES_UNAVAILABLE':
      return {
        message: 'Estos productos ya no se pueden cotizar. Quítalos de la venta y vuelve a intentar:',
        lines: failure.lines.map(unavailableLineLabel),
      }
    case 'SALE_UPDATE_FORBIDDEN':
      return plain('Esta venta es de otro cajero; solo quien la abrió puede pasarla a cotización.')
    case 'SALE_NOT_FOUND':
      return plain('Esta venta ya no existe. Actualizamos tus ventas en curso.')
    case 'SALE_NOT_DRAFT':
      return plain('Esta venta ya se cobró o se canceló. Actualizamos tus ventas en curso.')
    case 'IDEMPOTENCY_KEY_IN_FLIGHT':
      return plain('La cotización se está creando. Espera unos segundos y vuelve a intentar.')
    case 'IDEMPOTENCY_KEY_CONFLICT':
      return plain('La solicitud cambió desde el primer intento. Vuelve a intentar.')
    case 'VALIDATION':
      return plain(`Revisa la nota para el cliente: máximo ${SALE_TO_QUOTATION_NOTES_MAX} caracteres.`)
    case 'FORBIDDEN':
      return plain('Tu rol no permite pasar ventas a cotización: necesitas crear cotizaciones y eliminar ventas.')
    case 'NETWORK':
      return plain(
        'No hubo respuesta del servidor. Revisa tu conexión y vuelve a intentar; no se creará una cotización duplicada.',
      )
    case 'RESPONSE_INVALID':
      return plain('La cotización se creó, pero no pudimos leer la respuesta. Búscala en Cotizaciones.')
    default:
      // IDEMPOTENCY_KEY_REQUIRED (a client bug), UNKNOWN and the quotation → sale codes.
      return plain(GENERIC_FAILURE)
  }
}

/** «No se trasladó: Promo X (−$12.00)» — `discountCents` is what the customer stops saving. */
export function formatDroppedAdjustment(adjustment: DroppedAdjustment): string {
  return `No se trasladó: ${adjustment.title} (−${formatCentsMXN(adjustment.discountCents)})`
}
