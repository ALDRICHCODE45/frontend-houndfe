<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import RowActionsMenu from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import {
  PAYMENT_METHOD_CATEGORY_LABELS,
  type PaymentMethodCategory,
} from '@/core/shared/constants/payment-method-category'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { paymentMethodsApi } from '../api/payment-methods.api'
import { adminPaymentMethodQueryKeys } from '@/core/shared/constants/query-keys'
import { usePaymentMethodsTable } from '../composables/usePaymentMethodsTable'
import { usePaymentMethodColumns } from '../composables/usePaymentMethodColumns'
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
import AdminMobileCard from '../../shared/components/AdminMobileCard.vue'
import { noMatchTitleFor } from '../../shared/utils/list-state.utils'
import '../styles/payment-methods-visual.css'

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
  refresh,
  pageSizeOptions,
  showingFrom,
  showingTo,
} = usePaymentMethodsTable()

// ── View gating (CASL) ─────────────────────────────────────────────────────────
const canCreatePaymentMethod = computed(() => authStore.userCan('create', 'PaymentMethod'))
const canUpdatePaymentMethod = computed(() => authStore.userCan('update', 'PaymentMethod'))
const canDeletePaymentMethod = computed(() => authStore.userCan('delete', 'PaymentMethod'))

// ── List error title (a human sentence, never the server message) ─────────────
const paymentMethodsErrorMessage = 'No se pudieron cargar los métodos de cobro'

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

function handleDelete(row: PaymentMethodTableRow) {
  if (!canDeletePaymentMethod.value) return
  const description = buildPaymentMethodDeactivateDescription(row, [])
  openConfirm(description, () => {
    void deleteMutation.mutateAsync(row.id)
  })
}

function categoryLabel(category: string): string {
  return PAYMENT_METHOD_CATEGORY_LABELS[category as PaymentMethodCategory] ?? category
}

const rowActions = computed(() =>
  buildPaymentMethodRowActions({
    canUpdate: canUpdatePaymentMethod.value,
    canDelete: canDeletePaymentMethod.value,
  }),
)

function handleRowAction(key: string, row: PaymentMethodTableRow) {
  if (key === 'edit') openEdit(row)
  else if (key === 'delete') handleDelete(row)
}

const rowOpen = computed(() => (canUpdatePaymentMethod.value ? openEdit : undefined))

const searchTerm = computed(() => globalFilter.value.trim())
const noMatchTitle = computed(() => noMatchTitleFor(searchTerm.value))
const emptyState = computed(() => ({
  title: 'Aún no hay métodos de cobro',
  description: 'Aquí aparecerán los métodos que agregues.',
  ...(canCreatePaymentMethod.value
    ? { actionLabel: 'Crear método', actionIcon: 'i-lucide-credit-card' }
    : {}),
}))

function clearFilters() {
  globalFilter.value = ''
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
  <div class="hf-theme hf-ui payment-methods-visual flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
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
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay payment-methods-form-portal' }"
      @update:open="confirmState.open = $event"
      @confirm="handleConfirm"
    />

    <header class="hf-page-header">
      <h1 class="hf-page-title">Métodos de cobro</h1>
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
          :error-message="paymentMethodsErrorMessage"
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
          search-placeholder="Buscar métodos..."
          :show-add-button="canCreatePaymentMethod"
          add-button-text="Crear método"
          add-button-icon="i-lucide-credit-card"
          empty="No hay métodos de cobro"
          class="hf-data-table"
          portal-class="hf-theme hf-ui payment-methods-list-portal"
          pagination-portal-class="hf-theme hf-ui payment-methods-list-portal"
          @add="isCreateOpen = true"
          @empty-action="isCreateOpen = true"
          @clear-filters="clearFilters"
          @refresh="refresh"
        >
          <template #name-header="{ column }">
            <SortableHeader :column="column" label="Método" />
          </template>

          <template #category-header="{ column }">
            <SortableHeader :column="column" label="Categoría" />
          </template>

          <template #name-cell="{ row }">
            <button
              v-if="canUpdatePaymentMethod"
              type="button"
              class="hf-row-primary text-left"
              data-testid="payment-method-name"
              @click="openEdit(row.original)"
            >
              {{ row.original.name }}
            </button>
            <span v-else class="hf-row-primary" data-testid="payment-method-name">{{
              row.original.name
            }}</span>
            <span v-if="row.original.subtitle" class="hf-row-secondary">{{
              row.original.subtitle
            }}</span>
          </template>

          <template #isActive-cell="{ row }">
            <StatusBadge
              :label="paymentMethodStatusLabel(row.original.isActive)"
              :tone="row.original.isActive ? 'success' : 'neutral'"
            />
          </template>

          <template #category-cell="{ row }">
            <span class="text-sm">{{ categoryLabel(row.original.category) }}</span>
          </template>

          <template #updatedAt-cell="{ row }">
            <span class="text-sm text-muted">{{ formatShortDateTime(row.original.updatedAt) }}</span>
          </template>

          <template #actions-header><span class="sr-only">Acciones</span></template>

          <template #actions-cell="{ row }">
            <RowActionsMenu
              :actions="rowActions"
              :row-label="row.original.name"
              portal-class="payment-methods-list-portal"
              @select="handleRowAction($event, row.original)"
            />
          </template>

          <template #mobile-card="{ row }">
            <AdminMobileCard
              :item="row"
              :label="row.name"
              :actions="rowActions"
              :openable="canUpdatePaymentMethod"
              portal-class="payment-methods-list-portal"
              test-id="payment-method-card"
              @open="openEdit"
              @action="handleRowAction"
            >
              <template v-if="row.subtitle" #secondary>{{ row.subtitle }}</template>
              <template #badges>
                <StatusBadge
                  :label="paymentMethodStatusLabel(row.isActive)"
                  :tone="row.isActive ? 'success' : 'neutral'"
                />
              </template>
              <template #footer>
                <span class="min-w-0 truncate">{{ categoryLabel(row.category) }}</span>
                <span class="shrink-0">{{ formatShortDateTime(row.updatedAt) }}</span>
              </template>
            </AdminMobileCard>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
