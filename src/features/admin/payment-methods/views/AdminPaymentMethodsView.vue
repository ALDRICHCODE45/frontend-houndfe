<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import ViewToggle from '@/core/shared/components/ViewToggle.vue'
import { activityToBadgeTone } from '@/core/shared/utils/badge.utils'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { paymentMethodsApi } from '../api/payment-methods.api'
import { adminPaymentMethodQueryKeys } from '@/core/shared/constants/query-keys'
import { usePaymentMethodsTable } from '../composables/usePaymentMethodsTable'
import { usePaymentMethodColumns } from '../composables/usePaymentMethodColumns'
import { usePaymentMethodViewMode, isPaymentMethodViewMode } from '../composables/usePaymentMethodViewMode'
import {
  extractPaymentMethodErrorCode,
  PAYMENT_METHOD_ERROR_MAP,
} from '../interfaces/errors'
import { paymentMethodStatusLabel } from '../interfaces/payment-method.types'
import type {
  PaymentMethodTableRow,
  CreatePaymentMethodRequest,
  UpdatePaymentMethodRequest,
} from '../interfaces/payment-method.types'
import {
  buildPaymentMethodDeactivateDescription,
  buildPaymentMethodRowActions,
} from '../utils/payment-method-actions.utils'
import PaymentMethodUpsertSlideover from '../components/PaymentMethodUpsertSlideover.vue'
import PaymentMethodCardGrid from '../components/PaymentMethodCardGrid.vue'
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'

/**
 * AdminPaymentMethodsView — sdd custom-payment-methods S3B (design §6)
 *
 * Route-level composition surface for the "Métodos de cobro" admin CRUD.
 *
 *   - Read: single-source `usePaymentMethodsTable` (one fetch → `data` page slice
 *     + `fullList`). No banner required (REQ-PM-001 — empty catalog is OK).
 *   - Mutations: INLINE `useMutation` (create / update / delete) — compact
 *     tenants/users pattern, no dedicated mutation composables.
 *   - Edit slideover pre-fills `isActive` and forwards it on PATCH
 *     (REQ-PM-003 REVERSAL). Delete is the logical-baja path only.
 *   - Gating: menu/route (read) + create/update/delete buttons via `userCan`.
 *   - ConfirmModal: required for delete (REQ-PM-004).
 *   - Error dispatch: domain code → specific Spanish toast (REQ-PM-007);
 *     fallback uses `normalizeApiError`.
 *   - List-key invalidation: every successful mutation invalidates
 *     `adminPaymentMethodQueryKeys.list(tenantId)` (REQ-PM-010). Admin
 *     mutations do NOT invalidate `saleQueryKeys.paymentMethods` (REQ-PM-010
 *     cross-check — the POS catalog only refreshes on its own fetches +
 *     S5A error dispatch).
 */
const queryClient = useQueryClient()
const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)

const { columns } = usePaymentMethodColumns()
const { viewMode, setMode: setViewMode, displayMode } = usePaymentMethodViewMode()

function handleViewModeChange(mode: string) {
  if (!isPaymentMethodViewMode(mode)) return
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
} = usePaymentMethodsTable()

// ── View gating (CASL) ─────────────────────────────────────────────────────────
const canCreatePaymentMethod = computed(() => authStore.userCan('create', 'PaymentMethod'))
const canUpdatePaymentMethod = computed(() => authStore.userCan('update', 'PaymentMethod'))
const canDeletePaymentMethod = computed(() => authStore.userCan('delete', 'PaymentMethod'))
const canManagePaymentMethodActions = computed(
  () => canUpdatePaymentMethod.value || canDeletePaymentMethod.value,
)

// ── Human-readable list error (block, not toast) ──────────────────────────────
const paymentMethodsErrorMessage = computed(() =>
  normalizeApiError(error.value, 'No se pudieron cargar los métodos de cobro. Reintenta.').message,
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
const selectedPaymentMethod = ref<PaymentMethodTableRow | null>(null)
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
  void queryClient.invalidateQueries({ queryKey: adminPaymentMethodQueryKeys.list(tenantId.value) })
}

const createMutation = useMutation({
  mutationFn: paymentMethodsApi.create,
  onSuccess: () => {
    isCreateOpen.value = false
    invalidateList()
    toast.add({ title: 'Método creado', color: 'success' })
  },
  onError: (err) => resolveMutationError(err, 'No se pudo crear el método'),
})

const updateMutation = useMutation({
  mutationFn: (payload: { id: string; data: UpdatePaymentMethodRequest }) =>
    paymentMethodsApi.update(payload.id, payload.data),
  onSuccess: () => {
    isEditOpen.value = false
    selectedPaymentMethod.value = null
    invalidateList()
    toast.add({ title: 'Método actualizado', color: 'success' })
  },
  onError: (err) => resolveMutationError(err, 'No se pudo actualizar el método'),
})

const deleteMutation = useMutation({
  mutationFn: paymentMethodsApi.remove,
  onSuccess: () => {
    invalidateList()
    toast.add({ title: 'Método desactivado', color: 'success' })
  },
  onError: (err) => resolveMutationError(err, 'No se pudo desactivar el método'),
})

// Domain-code first; generic fallback otherwise (REQ-PM-007, error envelope
// `.error` per design §5.2).
function resolveMutationError(err: unknown, fallbackTitle: string) {
  const code = extractPaymentMethodErrorCode(err)
  if (code) {
    toast.add({ title: PAYMENT_METHOD_ERROR_MAP[code], color: 'error' })
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
function openEdit(row: PaymentMethodTableRow) {
  if (!canUpdatePaymentMethod.value) return
  selectedPaymentMethod.value = row
  isEditOpen.value = true
}

function handleCardClick(row: PaymentMethodTableRow) {
  openEdit(row)
}

function handleDelete(row: PaymentMethodTableRow) {
  if (!canDeletePaymentMethod.value) return
  const description = buildPaymentMethodDeactivateDescription(row, [])
  openConfirm(description, () => {
    void deleteMutation.mutateAsync(row.id)
  })
}

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function paymentMethodCategoryLabel(category: string): string {
  // Inline label map mirror — the canonical map lives in
  // `@/core/shared/constants/payment-method-category` and is also imported
  // by the slideover. This keeps the view self-contained.
  const labels: Record<string, string> = {
    cash: 'Efectivo',
    card_credit: 'Tarjeta de crédito',
    card_debit: 'Tarjeta de débito',
    transfer: 'Transferencia',
  }
  return labels[category] ?? category
}

function getRowItems(row: PaymentMethodTableRow) {
  return buildPaymentMethodRowActions(row, {
    canUpdate: canUpdatePaymentMethod.value,
    canDelete: canDeletePaymentMethod.value,
    onEdit: openEdit,
    onDelete: handleDelete,
  })
}

function handleCreateSubmit(payload: CreatePaymentMethodRequest) {
  createMutation.mutate(payload)
}

function handleEditSubmit(payload: UpdatePaymentMethodRequest) {
  if (!selectedPaymentMethod.value) return
  updateMutation.mutate({ id: selectedPaymentMethod.value.id, data: payload })
}
</script>

<template>
  <div class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
    <PaymentMethodUpsertSlideover
      v-if="canCreatePaymentMethod"
      v-model:open="isCreateOpen"
      mode="create"
      :loading="isSubmitting"
      @create="handleCreateSubmit"
    />

    <PaymentMethodUpsertSlideover
      v-model:open="isEditOpen"
      mode="edit"
      :payment-method="selectedPaymentMethod"
      :loading="isSubmitting"
      @edit="handleEditSubmit"
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
        <AdminPageHeader
          title="Métodos de cobro"
          description="Catálogo personalizado de métodos para recibir pagos en esta sucursal."
        />
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
          :error-message="paymentMethodsErrorMessage"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :display-mode="displayMode"
          search-placeholder="Buscar métodos..."
          :show-add-button="canCreatePaymentMethod"
          add-button-text="Crear método"
          add-button-icon="i-lucide-credit-card"
          enable-column-visibility
          empty="No hay métodos de cobro"
          @add="isCreateOpen = true"
          @refresh="refresh"
        >
          <template #name-header="{ column }">
            <SortableHeader :column="column" label="Nombre" />
          </template>

          <template #name-cell="{ row }">
            <span class="font-medium">{{ row.original.name }}</span>
          </template>

          <template #category-cell="{ row }">
            <span class="text-sm text-muted">{{ paymentMethodCategoryLabel(row.original.category) }}</span>
          </template>

          <template #subtitle-cell="{ row }">
            <span class="text-sm text-muted">{{ row.original.subtitle ?? '—' }}</span>
          </template>

          <template #isActive-cell="{ row }">
            <StatusDotBadge
              :tone="activityToBadgeTone(row.original.isActive)"
              :label="paymentMethodStatusLabel(row.original.isActive)"
            />
          </template>

          <template #updatedAt-cell="{ row }">
            <span class="text-sm text-muted">{{ dateFormatter.format(new Date(row.original.updatedAt)) }}</span>
          </template>

          <template #actions-cell="{ row }">
            <UDropdownMenu
              v-if="canManagePaymentMethodActions"
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
              aria-label="Seleccionar vista de métodos de cobro"
              @update:model-value="handleViewModeChange"
            />
          </template>

          <template #cards>
            <PaymentMethodCardGrid
              :payment-methods="data"
              :loading="isLoading || isFetching"
              empty="No hay métodos de cobro"
              @card-click="handleCardClick"
            />
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>