<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import RowActionsMenu from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { adminPaymentDetailQueryKeys } from '@/core/shared/constants/query-keys'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { paymentDetailsApi } from '../api/payment-details.api'
import { usePaymentDetailsTable } from '../composables/usePaymentDetailsTable'
import { usePaymentDetailColumns } from '../composables/usePaymentDetailColumns'
import { extractPaymentDetailErrorCode, PAYMENT_DETAIL_ERROR_MAP } from '../interfaces/errors'
import { paymentDetailStatusLabel } from '../interfaces/payment-detail.types'
import type { PaymentDetailTableRow } from '../interfaces/payment-detail.types'
import {
  buildPaymentDetailDeactivateDescription,
  buildPaymentDetailRowActions,
} from '../utils/payment-detail-actions.utils'
import PaymentDetailUpsertSlideover from '../components/PaymentDetailUpsertSlideover.vue'
import AdminMobileCard from '../../shared/components/AdminMobileCard.vue'
import { noMatchTitleFor } from '../../shared/utils/list-state.utils'
import '../styles/payment-details-visual.css'

/**
 * AdminPaymentDetailsView — sdd payment-details-admin S4 (design.md §6.2/§6.3/§6.5)
 *
 * Route-level composition surface for the "Datos bancarios" admin CRUD.
 *
 *   - Read: single-source `usePaymentDetailsTable` (one fetch → `data` page slice
 *     + `fullList` + `hasActiveAccount`) — the banner reflects the WHOLE tenant.
 *   - Mutations: INLINE `useMutation` (create / update / delete) — compact
 *     tenants/users pattern, no dedicated mutation composables.
 *   - isActive is NEVER editable (no toggle, no checkbox). Deactivation is the
 *     DELETE (baja lógica) path only, gated by `delete:PaymentDetail`.
 *   - Banner: inline `UAlert` "Sin cuenta activa" shown when `!hasActiveAccount`.
 *   - Gating: menu/route (read) + create/edit/delete buttons via `userCan`.
 *
 * The view destructures the wrapper return at the TOP LEVEL of `<script setup>`
 * so template refs auto-unwrap (design.md §8.2). It stays a composition surface:
 * no card markup, no field markup — those live in the components.
 */
const queryClient = useQueryClient()
const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)

const { columns } = usePaymentDetailColumns()

// Single-source wrapper. All of these refs auto-unwrap in the template because
// they are destructured at the top level of <script setup>.
const {
  pagination,
  sorting,
  globalFilter,
  data,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  isError,
  error,
  refresh,
  pageSizeOptions,
  showingFrom,
  showingTo,
  fullList,
  hasActiveAccount,
} = usePaymentDetailsTable()

// ── View gating (CASL) ─────────────────────────────────────────────────────────
const canCreatePaymentDetail = computed(() => authStore.userCan('create', 'PaymentDetail'))
const canUpdatePaymentDetail = computed(() => authStore.userCan('update', 'PaymentDetail'))
const canDeletePaymentDetail = computed(() => authStore.userCan('delete', 'PaymentDetail'))

// ── List error title (a human sentence, never the server message) ─────────────
const paymentDetailsErrorMessage = 'No se pudieron cargar las cuentas bancarias'

// ── Toast provider (Nuxt UI auto-imports `useToast`) ───────────────────────────
declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}
const toast = useToast()

// ── Slideover / confirm state ──────────────────────────────────────────────────
const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const selectedPaymentDetail = ref<PaymentDetailTableRow | null>(null)
const confirmState = ref<{ open: boolean; description: string; onConfirm: () => void }>({
  open: false,
  description: '',
  onConfirm: () => {},
})

function openConfirm(description: string, onConfirm: () => void) {
  confirmState.value = { open: true, description, onConfirm }
}

function handleConfirm() {
  confirmState.value.onConfirm()
  confirmState.value.open = false
}

// ── Mutations (inline, compact tenant/users pattern) ───────────────────────────
function invalidateList() {
  void queryClient.invalidateQueries({ queryKey: adminPaymentDetailQueryKeys.list(tenantId.value) })
}

const createMutation = useMutation({
  mutationFn: paymentDetailsApi.create,
  onSuccess: () => {
    isCreateOpen.value = false
    invalidateList()
    toast.add({ title: 'Cuenta creada', color: 'success' })
  },
  onError: (err) => resolveMutationError(err, 'No se pudo crear la cuenta'),
})

const updateMutation = useMutation({
  mutationFn: (payload: { id: string; data: Parameters<typeof paymentDetailsApi.update>[1] }) =>
    paymentDetailsApi.update(payload.id, payload.data),
  onSuccess: () => {
    isEditOpen.value = false
    selectedPaymentDetail.value = null
    invalidateList()
    toast.add({ title: 'Cuenta actualizada', color: 'success' })
  },
  onError: (err) => resolveMutationError(err, 'No se pudo actualizar la cuenta'),
})

const deleteMutation = useMutation({
  mutationFn: paymentDetailsApi.remove,
  onSuccess: () => {
    invalidateList()
    toast.add({ title: 'Cuenta desactivada', color: 'success' })
  },
  onError: (err) => resolveMutationError(err, 'No se pudo desactivar la cuenta'),
})

// Domain-code first; generic fallback otherwise (REQ-PD-008, error envelope `.error`).
function resolveMutationError(err: unknown, fallbackTitle: string) {
  const code = extractPaymentDetailErrorCode(err)
  if (code) {
    toast.add({ title: PAYMENT_DETAIL_ERROR_MAP[code], color: 'error' })
    return
  }
  toast.add({
    title: fallbackTitle,
    description: normalizeApiError(err).message,
    color: 'error',
  })
}

const isSubmitting = computed(
  () =>
    createMutation.isPending.value ||
    updateMutation.isPending.value ||
    deleteMutation.isPending.value,
)

// ── Row actions ─────────────────────────────────────────────────────────────────
function openEdit(row: PaymentDetailTableRow) {
  if (!canUpdatePaymentDetail.value) return
  selectedPaymentDetail.value = row
  isEditOpen.value = true
}

function handleDelete(row: PaymentDetailTableRow) {
  if (!canDeletePaymentDetail.value) return
  const description = buildPaymentDetailDeactivateDescription(row, fullList.value)
  openConfirm(description, () => {
    void deleteMutation.mutateAsync(row.id)
  })
}

const rowActions = computed(() =>
  buildPaymentDetailRowActions({
    canUpdate: canUpdatePaymentDetail.value,
    canDelete: canDeletePaymentDetail.value,
  }),
)

function handleRowAction(key: string, row: PaymentDetailTableRow) {
  if (key === 'edit') openEdit(row)
  else if (key === 'delete') handleDelete(row)
}

const rowOpen = computed(() => (canUpdatePaymentDetail.value ? openEdit : undefined))

const searchTerm = computed(() => globalFilter.value.trim())
const noMatchTitle = computed(() => noMatchTitleFor(searchTerm.value))
const emptyState = computed(() => ({
  title: 'Aún no hay cuentas bancarias',
  description: 'Aquí aparecerán las cuentas que agregues.',
  ...(canCreatePaymentDetail.value
    ? { actionLabel: 'Crear cuenta', actionIcon: 'i-lucide-credit-card' }
    : {}),
}))

function clearFilters() {
  globalFilter.value = ''
}
</script>

<template>
  <div class="hf-theme hf-ui payment-details-visual flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
    <UAlert
      v-if="!isLoading && !isError && !hasActiveAccount"
      data-testid="no-active-account-banner"
      color="warning"
      variant="soft"
      icon="i-lucide-triangle-alert"
      class="payment-details-notice"
      title="Sin cuenta activa"
      description="El bot no puede cobrar por transferencia hasta que haya una cuenta activa."
    />

    <PaymentDetailUpsertSlideover
      v-model:open="isCreateOpen"
      mode="create"
      :loading="isSubmitting"
      @create="createMutation.mutate"
    />

    <PaymentDetailUpsertSlideover
      v-model:open="isEditOpen"
      mode="edit"
      :payment-detail="selectedPaymentDetail"
      :loading="isSubmitting"
      @edit="
        (payload) =>
          selectedPaymentDetail &&
          updateMutation.mutate({ id: selectedPaymentDetail.id, data: payload })
      "
    />

    <ConfirmModal
      :open="confirmState.open"
      :description="confirmState.description"
      confirm-label="Desactivar"
      confirm-color="error"
      :loading="deleteMutation.isPending.value"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay payment-details-form-portal' }"
      @update:open="confirmState.open = $event"
      @confirm="handleConfirm"
    />

    <header class="hf-page-header">
      <h1 class="hf-page-title">Datos bancarios</h1>
    </header>

    <UCard
      :ui="{ body: 'p-0 sm:p-0' }"
      class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm"
    >
      <div class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4">
        <AppDataTable
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          :columns="columns"
          :data="data"
          :loading="isLoading"
          :fetching="isFetching"
          :error="isError"
          :error-message="paymentDetailsErrorMessage"
          :empty-state="emptyState"
          :filtered="searchTerm !== ''"
          :no-match-title="noMatchTitle"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :row-open="rowOpen"
          display-mode="auto"
          mobile-render="cards"
          search-placeholder="Buscar cuentas..."
          :show-add-button="canCreatePaymentDetail"
          add-button-text="Crear cuenta"
          add-button-icon="i-lucide-credit-card"
          empty="No hay cuentas bancarias"
          class="hf-data-table"
          portal-class="hf-theme hf-ui payment-details-list-portal"
          pagination-portal-class="hf-theme hf-ui payment-details-list-portal"
          @add="isCreateOpen = true"
          @empty-action="isCreateOpen = true"
          @clear-filters="clearFilters"
          @refresh="refresh"
        >
          <template #bankName-header="{ column }">
            <SortableHeader :column="column" label="Banco" />
          </template>

          <template #bankName-cell="{ row }">
            <button
              v-if="canUpdatePaymentDetail"
              type="button"
              class="hf-row-primary text-left"
              data-testid="payment-detail-name"
              @click="openEdit(row.original)"
            >
              {{ row.original.bankName }}
            </button>
            <span v-else class="hf-row-primary" data-testid="payment-detail-name">{{
              row.original.bankName
            }}</span>
            <span class="hf-row-secondary">{{ row.original.beneficiary }}</span>
          </template>

          <template #isActive-cell="{ row }">
            <StatusBadge
              :label="paymentDetailStatusLabel(row.original.isActive)"
              :tone="row.original.isActive ? 'success' : 'neutral'"
            />
          </template>

          <template #clabe-cell="{ row }">
            <span class="hf-figure font-mono text-sm">{{ row.original.clabe }}</span>
          </template>

          <template #accountNumber-cell="{ row }">
            <span class="hf-figure font-mono text-sm">{{ row.original.accountNumber }}</span>
          </template>

          <template #updatedAt-cell="{ row }">
            <span class="text-sm text-muted">{{ formatShortDateTime(row.original.updatedAt) }}</span>
          </template>

          <template #actions-header><span class="sr-only">Acciones</span></template>

          <template #actions-cell="{ row }">
            <RowActionsMenu
              :actions="rowActions"
              :row-label="row.original.bankName"
              portal-class="payment-details-list-portal"
              @select="handleRowAction($event, row.original)"
            />
          </template>

          <template #mobile-card="{ row }">
            <AdminMobileCard
              :item="row"
              :label="row.bankName"
              :actions="rowActions"
              :openable="canUpdatePaymentDetail"
              portal-class="payment-details-list-portal"
              test-id="payment-detail-card"
              @open="openEdit"
              @action="handleRowAction"
            >
              <template #secondary>{{ row.beneficiary }}</template>
              <template #badges>
                <StatusBadge
                  :label="paymentDetailStatusLabel(row.isActive)"
                  :tone="row.isActive ? 'success' : 'neutral'"
                />
              </template>
              <template #footer>
                <span class="hf-figure min-w-0 truncate font-mono">{{ row.clabe }}</span>
                <span class="shrink-0">{{ formatShortDateTime(row.updatedAt) }}</span>
              </template>
            </AdminMobileCard>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
