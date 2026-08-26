<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import ViewToggle from '@/core/shared/components/ViewToggle.vue'
import { adminPaymentDetailQueryKeys } from '@/core/shared/constants/query-keys'
import { activityToBadgeTone } from '@/core/shared/utils/badge.utils'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { paymentDetailsApi } from '../api/payment-details.api'
import { usePaymentDetailsTable } from '../composables/usePaymentDetailsTable'
import { usePaymentDetailColumns } from '../composables/usePaymentDetailColumns'
import { usePaymentDetailViewMode, isPaymentDetailViewMode } from '../composables/usePaymentDetailViewMode'
import { extractPaymentDetailErrorCode, PAYMENT_DETAIL_ERROR_MAP } from '../interfaces/errors'
import { paymentDetailStatusLabel } from '../interfaces/payment-detail.types'
import type { PaymentDetailTableRow } from '../interfaces/payment-detail.types'
import {
  buildPaymentDetailDeactivateDescription,
  buildPaymentDetailRowActions,
} from '../utils/payment-detail-actions.utils'
import PaymentDetailUpsertSlideover from '../components/PaymentDetailUpsertSlideover.vue'
import PaymentDetailCardGrid from '../components/PaymentDetailCardGrid.vue'
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'

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
const { viewMode, setMode: setViewMode, displayMode } = usePaymentDetailViewMode()

function handleViewModeChange(mode: string) {
  if (!isPaymentDetailViewMode(mode)) return
  setViewMode(mode)
}

// Single-source wrapper. All of these refs auto-unwrap in the template because
// they are destructured at the top level of <script setup>.
const {
  pagination,
  sorting,
  globalFilter,
  columnPinning,
  columnVisibility,
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

const headerDescription = 'Cuentas bancarias para cobros por transferencia.'

// ── View gating (CASL) ─────────────────────────────────────────────────────────
const canCreatePaymentDetail = computed(() => authStore.userCan('create', 'PaymentDetail'))
const canUpdatePaymentDetail = computed(() => authStore.userCan('update', 'PaymentDetail'))
const canDeletePaymentDetail = computed(() => authStore.userCan('delete', 'PaymentDetail'))
const canManagePaymentDetailActions = computed(
  () => canUpdatePaymentDetail.value || canDeletePaymentDetail.value,
)

// ── Human-readable list error (block, not toast) ──────────────────────────────
const paymentDetailsErrorMessage = computed(() =>
  normalizeApiError(error.value, 'No se pudieron cargar las cuentas bancarias. Reintenta.').message,
)

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

function handleCardClick(row: PaymentDetailTableRow) {
  openEdit(row)
}

function handleDelete(row: PaymentDetailTableRow) {
  if (!canDeletePaymentDetail.value) return
  const description = buildPaymentDetailDeactivateDescription(row, fullList.value)
  openConfirm(description, () => {
    void deleteMutation.mutateAsync(row.id)
  })
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function getRowItems(row: PaymentDetailTableRow) {
  return buildPaymentDetailRowActions(row, {
    canUpdate: canUpdatePaymentDetail.value,
    canDelete: canDeletePaymentDetail.value,
    onEdit: openEdit,
    onDelete: handleDelete,
  })
}
</script>

<template>
  <div class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
    <UAlert
      v-if="!isLoading && !isError && !hasActiveAccount"
      data-testid="no-active-account-banner"
      color="warning"
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
      @update:open="confirmState.open = $event"
      @confirm="handleConfirm"
    />

    <UCard :ui="{ body: 'p-0 sm:p-0 bg-coco-neutral-50 dark:bg-coco-neutral-950' }">
      <template #header>
        <AdminPageHeader title="Datos bancarios" description="Cuentas bancarias para cobros por transferencia" />
      </template>

      <div class="px-6 py-5">
        <AppDataTable
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          v-model:column-pinning="columnPinning"
          v-model:column-visibility="columnVisibility"
          :columns="columns"
          :data="data"
          :loading="isLoading"
          :fetching="isFetching"
          :error="isError"
          :error-message="paymentDetailsErrorMessage"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :display-mode="displayMode"
          search-placeholder="Buscar cuentas..."
          :show-add-button="canCreatePaymentDetail"
          add-button-text="Crear cuenta"
          add-button-icon="i-lucide-credit-card"
          enable-column-visibility
          empty="No hay cuentas bancarias"
          @add="isCreateOpen = true"
          @refresh="refresh"
        >
          <template #bankName-header="{ column }">
            <SortableHeader :column="column" label="Banco" />
          </template>

          <template #bankName-cell="{ row }">
            <span class="font-medium">{{ row.original.bankName }}</span>
          </template>

          <template #beneficiary-cell="{ row }">
            <span class="text-sm text-muted">{{ row.original.beneficiary }}</span>
          </template>

          <template #clabe-cell="{ row }">
            <span class="font-mono text-sm">{{ row.original.clabe }}</span>
          </template>

          <template #accountNumber-cell="{ row }">
            <span class="font-mono text-sm">{{ row.original.accountNumber }}</span>
          </template>

          <template #isActive-cell="{ row }">
            <StatusDotBadge
              :tone="activityToBadgeTone(row.original.isActive)"
              :label="paymentDetailStatusLabel(row.original.isActive)"
            />
          </template>

          <template #updatedAt-cell="{ row }">
            <span class="text-sm text-muted">{{ dateFormatter.format(new Date(row.original.updatedAt)) }}</span>
          </template>

          <template #actions-cell="{ row }">
            <UDropdownMenu
              v-if="canManagePaymentDetailActions"
              :items="getRowItems(row.original)"
              :content="{ align: 'end' }"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                class="size-7"
              />
            </UDropdownMenu>
          </template>

          <template #actions>
            <ViewToggle
              :model-value="viewMode"
              aria-label="Seleccionar vista de datos bancarios"
              @update:model-value="handleViewModeChange"
            />
          </template>

          <template #cards>
            <PaymentDetailCardGrid
              :payment-details="data"
              :loading="isLoading || isFetching"
              :empty="'No hay cuentas bancarias'"
              @card-click="handleCardClick"
            />
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
