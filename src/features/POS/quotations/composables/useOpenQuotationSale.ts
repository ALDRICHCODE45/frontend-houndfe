/**
 * `useOpenQuotationSale` — «Ver venta» for a converted quotation (backend handoff 23 §3, odd T3b).
 *
 * The route depends on the linked sale's live `saleStatus`:
 *   - CONFIRMED / CANCELED → sale detail (`/pos/ventas/:saleId`, GET /sales/:id serves only those).
 *   - DRAFT → the POS draft, opened like `useConvertQuotationToSale` does (`pos:active-tab` +
 *     `/pos/ventas/nueva`). The draft belongs to the cashier who converted, and the quotation does
 *     not say who that was, so ownership is checked BEFORE navigating: `GET /sales/drafts` lists only
 *     the caller's drafts (fetched fresh through the POS drafts query key, which also warms the POS
 *     cache). Not among them → stay on the quotation and set `notice`. Checking after navigating
 *     would not work: `SalesView` ignores an active-tab key that is not one of the caller's drafts
 *     and silently selects another tab, so the cashier would land on an unrelated sale.
 *   - null → no link (`hasSaleLink` hides it).
 *   - unknown (QUOTATION_ALREADY_CONVERTED carries only `saleId`, or a payload without the field)
 *     → the quotation is re-read for its live status; if that fails, the caller's own draft opens in
 *     the POS and anything else goes to the sale detail.
 */
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { saleApi } from '@/features/POS/sales/api/sale.api'
import { POS_ACTIVE_TAB_STORAGE_KEY } from '@/features/POS/sales/constants/sale.constants'
import type { Sale } from '@/features/POS/sales/interfaces/sale.types'
import { quotationApi } from '../api/quotation.api'
import type { QuotationResponseDto, QuotationSaleStatus } from '../interfaces/quotation.types'

const POS_SALES_PATH = '/pos/ventas/nueva'

export const SALE_IN_PROGRESS_ELSEWHERE =
  'La venta está en curso en el punto de venta de quien la convirtió.'
export const SALE_OPEN_FAILED = 'No pudimos abrir la venta. Inténtalo de nuevo.'
export const SALE_DISCARDED = 'La venta que salió de esta cotización se eliminó.'

/** «Ver venta» is offered when there is a sale and its status is not `null` (deleted / no link).
 *  A payload without `saleStatus` keeps the link; the status is resolved on click. */
export function hasSaleLink(quotation: Pick<QuotationResponseDto, 'saleId' | 'saleStatus'>): boolean {
  return !!quotation.saleId && quotation.saleStatus !== null
}

export interface OpenQuotationSaleTarget {
  saleId: string
  /** `undefined` = unknown (resolved through `quotationId`). */
  saleStatus?: QuotationSaleStatus | null
  quotationId?: string
}

export function useOpenQuotationSale() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const authStore = useAuthStore()

  const pending = ref(false)
  const notice = ref<string | null>(null)

  /** The caller's drafts, fresh (`null` when they cannot be read). */
  async function fetchMyDrafts(): Promise<Sale[] | null> {
    try {
      return await queryClient.fetchQuery({
        queryKey: saleQueryKeys.drafts(authStore.currentTenantId ?? ''),
        queryFn: saleApi.listDrafts,
        staleTime: 0,
      })
    } catch {
      return null
    }
  }

  async function goToDetail(saleId: string): Promise<boolean> {
    await router.push(`/pos/ventas/${saleId}`)
    return true
  }

  async function openDraft(saleId: string, fallbackToDetail: boolean): Promise<boolean> {
    const drafts = await fetchMyDrafts()
    if (drafts?.some((draft) => draft.id === saleId)) {
      localStorage.setItem(POS_ACTIVE_TAB_STORAGE_KEY, saleId)
      await router.push(POS_SALES_PATH)
      return true
    }
    if (fallbackToDetail) return goToDetail(saleId)
    notice.value = drafts ? SALE_IN_PROGRESS_ELSEWHERE : SALE_OPEN_FAILED
    return false
  }

  async function resolve(
    target: OpenQuotationSaleTarget,
  ): Promise<{ saleId: string | null; saleStatus: QuotationSaleStatus | null } | null> {
    if (target.saleStatus !== undefined) {
      return { saleId: target.saleId, saleStatus: target.saleStatus }
    }
    if (!target.quotationId) return null
    try {
      const fresh = await quotationApi.getById(target.quotationId)
      if (fresh.saleStatus === undefined) return null
      return { saleId: fresh.saleId ?? null, saleStatus: fresh.saleStatus }
    } catch {
      return null
    }
  }

  /** Resolves `true` when it navigated; otherwise `notice` may explain why. */
  async function open(target: OpenQuotationSaleTarget): Promise<boolean> {
    if (pending.value) return false
    pending.value = true
    notice.value = null
    try {
      const resolved = await resolve(target)
      // Status still unknown: my draft → POS, anything else → sale detail (pre-saleStatus behavior).
      if (!resolved) return await openDraft(target.saleId, true)
      if (!resolved.saleId || resolved.saleStatus === null) {
        if (target.saleStatus === undefined) notice.value = SALE_DISCARDED
        return false
      }
      if (resolved.saleStatus === 'DRAFT') return await openDraft(resolved.saleId, false)
      return await goToDetail(resolved.saleId)
    } finally {
      pending.value = false
    }
  }

  return {
    open,
    notice,
    isPending: computed(() => pending.value),
  }
}
