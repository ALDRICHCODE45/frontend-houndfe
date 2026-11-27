/**
 * `useStartSaleForCustomer` — «Nueva venta» from the customer page (owner-ideas-batch T4, S2, L2).
 *
 * `start(customerId)`: `POST /sales/drafts` → `PUT /sales/drafts/:id/customer { customerId }` (the
 * backend then applies the customer's price list to the fresh draft). On success the assigned draft
 * becomes the POS active tab, with the same handoff as «Convertir en venta»
 * (`useConvertQuotationToSale`): it is put into `saleQueryKeys.drafts` (appended, or replaced when
 * already there) BEFORE navigating, its id is written to `POS_ACTIVE_TAB_STORAGE_KEY`, the drafts and
 * its applicable promotions are invalidated, and the POS route opens.
 *
 * A second press while one is pending is ignored (one draft per press). Failures stay on the page
 * with a toast:
 *   - create fails → nothing was written;
 *   - assignment fails → with delete:Sale the empty draft is deleted (`DELETE /sales/drafts/:id`);
 *     without it (or when that delete fails) the draft is left — it shows in the POS tabs — and the
 *     toast says so. The reason is the shared customer-assignment copy.
 */
import { computed, ref } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { saleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { saleApi } from '../api/sale.api'
import { POS_ACTIVE_TAB_STORAGE_KEY } from '../constants/sale.constants'
import type { Sale } from '../interfaces/sale.types'
import { mapCustomerAssignmentErrorMessage } from '../utils/customerAssignmentErrors'

// useToast is auto-imported by the @nuxt/ui/vite plugin (unplugin-auto-import).
// In tests, stub via vi.mock('@nuxt/ui/composables/useToast').
declare const useToast: () => {
  add: (options: { title: string; description?: string; color?: 'error' }) => void
}

/** Where the POS sale workspace lives (`pos-sales`). */
const POS_SALES_PATH = '/pos/ventas/nueva'

export const EMPTY_DRAFT_LEFT_MESSAGE =
  'Se creó una venta vacía en el punto de venta; puedes cerrarla.'

const FAILURE_TITLE = 'No se pudo abrir la venta'

/** The POS drafts list with `sale` in it: replaced in place when present, appended otherwise. */
function withDraft(drafts: Sale[] | undefined, sale: Sale): Sale[] {
  const current = drafts ?? []
  return current.some((draft) => draft.id === sale.id)
    ? current.map((draft) => (draft.id === sale.id ? sale : draft))
    : [...current, sale]
}

function createFailureMessage(error: unknown): string {
  const status = (error as { response?: { status?: number } } | null)?.response?.status
  return status === 403
    ? 'No tienes permiso para crear ventas.'
    : 'No se pudo crear la venta. Inténtalo de nuevo.'
}

export function useStartSaleForCustomer() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const authStore = useAuthStore()
  const toast = useToast()
  const tenantId = computed(() => authStore.currentTenantId ?? '')
  const pending = ref(false)

  /** After a failed assignment: delete the empty draft when allowed; `true` when it is gone. */
  async function discardEmptyDraft(saleId: string): Promise<boolean> {
    if (!authStore.userCan('delete', 'Sale')) return false
    try {
      await saleApi.closeDraft(saleId)
      return true
    } catch {
      return false
    }
  }

  /** Resolves `true` when the draft was created with the customer and the POS was opened. */
  async function start(customerId: string): Promise<boolean> {
    if (pending.value) return false
    pending.value = true
    const draftsKey = saleQueryKeys.drafts(tenantId.value)
    try {
      let created: Sale
      try {
        created = await saleApi.createDraft()
      } catch (error) {
        toast.add({ title: FAILURE_TITLE, description: createFailureMessage(error), color: 'error' })
        return false
      }

      let assigned: Sale
      try {
        const { petsCleared: _petsCleared, ...sale } = await saleApi.assignCustomer(created.id, {
          customerId,
        })
        assigned = sale
      } catch (error) {
        const reason = mapCustomerAssignmentErrorMessage(error)
        const deleted = await discardEmptyDraft(created.id)
        void queryClient.invalidateQueries({ queryKey: draftsKey })
        toast.add({
          title: FAILURE_TITLE,
          description: deleted ? reason : `${reason} ${EMPTY_DRAFT_LEFT_MESSAGE}`,
          color: 'error',
        })
        return false
      }

      queryClient.setQueryData(
        draftsKey,
        withDraft(queryClient.getQueryData<Sale[]>(draftsKey), assigned),
      )
      void queryClient.invalidateQueries({ queryKey: draftsKey })
      void queryClient.invalidateQueries({
        queryKey: saleQueryKeys.applicablePromotions(tenantId.value, assigned.id),
      })
      localStorage.setItem(POS_ACTIVE_TAB_STORAGE_KEY, assigned.id)
      await router.push(POS_SALES_PATH)
      return true
    } finally {
      pending.value = false
    }
  }

  return {
    start,
    isPending: computed(() => pending.value),
  }
}
