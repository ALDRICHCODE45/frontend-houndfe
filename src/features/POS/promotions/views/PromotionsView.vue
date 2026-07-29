<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { AppDataTable, SelectColumn, SortableHeader } from '@/core/shared/components/DataTable'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { promotionQueryKeys } from '@/core/shared/constants/query-keys'
import type { BulkAction } from '@/core/shared/types/table.types'
import TableHeaderDescription from '@/core/shared/components/DataTable/TableHeaderDescription.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import type { DomainApiError } from '@/core/shared/utils/error.utils'
import { normalizeApiError } from '@/core/shared/utils/error.utils'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import { promotionApi } from '../api/promotion.api'
import { usePromotionColumns } from '../composables/usePromotionColumns'
import type { PromotionMethod, PromotionResponse, PromotionStatus, PromotionType } from '../interfaces/promotion.types'
import PromotionTypeSelector from '../components/PromotionTypeSelector.vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import {
  PROMOTION_METHOD,
  PROMOTION_STATUS,
  PROMOTION_TYPE,
} from '../constants/promotion.constants'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const router = useRouter()
const queryClient = useQueryClient()
const toast = useToast()
const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)
const { columns, getStatusConfig, getTypeConfig, getMethodConfig, formatDate } = usePromotionColumns()

// ── Permission helpers ────────────────────────────────────────────────────────
//
// BD-REQ-001: batch_delete is an EXPLICIT action — NOT derived from `manage`
// or `delete`. The UI gate is a dedicated computed; the CASL layer grants
// `batch_delete:Promotion` independently.
const canCreate = computed(() => authStore.userCan('create', 'Promotion'))
const canUpdate = computed(() => authStore.userCan('update', 'Promotion'))
const canDelete = computed(() => authStore.userCan('delete', 'Promotion'))
const canBatchDelete = computed(() => authStore.userCan('batch_delete', 'Promotion'))
const canBatchEnd = computed(() => authStore.userCan('update', 'Promotion'))
const canBatchActivate = computed(() => authStore.userCan('update', 'Promotion'))

// ── Filter state ─────────────────────────────────────────────────────────────

const filterType = ref<PromotionType | ''>('')
const filterStatus = ref<PromotionStatus | ''>('')
const filterMethod = ref<PromotionMethod | ''>('')

const ALL_FILTER_VALUE = '__ALL__'

const filterTypeSelect = computed<PromotionType | typeof ALL_FILTER_VALUE>({
  get: () => filterType.value || ALL_FILTER_VALUE,
  set: (value) => {
    filterType.value = value === ALL_FILTER_VALUE ? '' : value
  },
})

const filterStatusSelect = computed<PromotionStatus | typeof ALL_FILTER_VALUE>({
  get: () => filterStatus.value || ALL_FILTER_VALUE,
  set: (value) => {
    filterStatus.value = value === ALL_FILTER_VALUE ? '' : value
  },
})

const filterMethodSelect = computed<PromotionMethod | typeof ALL_FILTER_VALUE>({
  get: () => filterMethod.value || ALL_FILTER_VALUE,
  set: (value) => {
    filterMethod.value = value === ALL_FILTER_VALUE ? '' : value
  },
})

const TYPE_OPTIONS = [
  { label: 'Todos los tipos', value: ALL_FILTER_VALUE },
  { label: 'Descuento en productos', value: PROMOTION_TYPE.PRODUCT_DISCOUNT },
  { label: 'Descuento en pedido', value: PROMOTION_TYPE.ORDER_DISCOUNT },
  { label: '2x1, 3x2 o similares', value: PROMOTION_TYPE.BUY_X_GET_Y },
  { label: 'Avanzada', value: PROMOTION_TYPE.ADVANCED },
]

const STATUS_OPTIONS = [
  { label: 'Todos los estados', value: ALL_FILTER_VALUE },
  { label: 'Activa', value: PROMOTION_STATUS.ACTIVE },
  { label: 'Programada', value: PROMOTION_STATUS.SCHEDULED },
  { label: 'Finalizada', value: PROMOTION_STATUS.ENDED },
]

const METHOD_OPTIONS = [
  { label: 'Todos los métodos', value: ALL_FILTER_VALUE },
  { label: 'Automático', value: PROMOTION_METHOD.AUTOMATIC },
  { label: 'Manual', value: PROMOTION_METHOD.MANUAL },
]

// ── Server table ──────────────────────────────────────────────────────────────

const BATCH_DELETE_CAP = 100
// BATCH_END_CAP is shared between batch-end and batch-activate (same 100-id
// server-side cap; user explicitly directed reuse to avoid constant proliferation).
const BATCH_END_CAP = 100

const {
  pagination,
  sorting,
  globalFilter,
  rowSelection,
  columnPinning,
  columnVisibility,
  data,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  refresh,
  pageSizeOptions,
  showingFrom,
  showingTo,
  selectedRows,
} = useServerTable<PromotionResponse>({
  queryKey: () => [
    ...promotionQueryKeys.paginated(tenantId.value),
    { type: filterType.value, status: filterStatus.value, method: filterMethod.value },
  ],
  queryFn: (params) =>
    promotionApi.getPaginated({
      ...params,
      ...(filterType.value ? { type: filterType.value } : {}),
      ...(filterStatus.value ? { status: filterStatus.value } : {}),
      ...(filterMethod.value ? { method: filterMethod.value } : {}),
    }),
  defaultPageSize: 20,
  persistKey: 'pos-promotions',
  defaultSorting: [{ id: 'createdAt', desc: true }],
  defaultPinning: { left: [], right: ['actions'] },
})

// ── Reset pagination + clear selection when filters change ───────────────────
//
// BD-REQ-010: filter / search change MUST reset pagination to page 0 AND
// clear the bulk selection — page-relative selection can't survive a filter
// switch because the row indices map to different entities.
watch([filterType, filterStatus, filterMethod], () => {
  pagination.value = { ...pagination.value, pageIndex: 0 }
  rowSelection.value = {}
})

// ── Offending IDs (BD-REQ-006) ────────────────────────────────────────────────
//
// 409 PROMOTION_REFERENCED_BY_SALE returns `offendingIds: string[]` — the
// subset that referenced existing sales. We store them as a Set for O(1)
// lookups from the #title-cell template and clear the Set on every new
// selection (so highlights don't bleed across batches).
const offendingIds = ref<Set<string>>(new Set())

watch(
  () => rowSelection.value,
  () => {
    // Clear stale highlights whenever the user changes their selection —
    // BD-REQ-006 only flags the LAST batch, not historical state.
    if (offendingIds.value.size > 0) {
      offendingIds.value = new Set()
    }
  },
)

// ── Local UI state ────────────────────────────────────────────────────────────

const isTypeSelectorOpen = ref(false)

interface ConfirmStateShape {
  open: boolean
  description: string
  loading: boolean
  label: string
  color: 'error' | 'warning' | 'primary'
  items?: { id: string; title: string; status?: string }[]
  onConfirm: () => void
}

const confirmState = ref<ConfirmStateShape>({
  open: false,
  description: '',
  loading: false,
  label: 'Confirmar',
  color: 'error',
  onConfirm: () => {},
})

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleAddPromotion() {
  isTypeSelectorOpen.value = true
}

function openConfirm(
  description: string,
  label: string,
  color: 'error' | 'warning' | 'primary',
  onConfirm: () => void,
  items?: { id: string; title: string; status?: string }[],
) {
  confirmState.value = {
    open: true,
    description,
    loading: false,
    label,
    color: color as 'error',
    onConfirm,
    ...(items ? { items } : {}),
  }
}

function handleConfirm() {
  confirmState.value.onConfirm()
  confirmState.value.open = false
}

// ── Mutations ─────────────────────────────────────────────────────────────────

const endMutation = useMutation({
  mutationFn: (promotionId: string) => promotionApi.end(promotionId),
  onSuccess: async () => {
    toast.add({
      title: 'Promoción finalizada',
      color: 'success',
    })
    await queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated(tenantId.value) })
  },
  onError: (error) => {
    const err = error as AxiosError<DomainApiError>
    const message = err.response?.data?.message ?? 'No se pudo finalizar la promoción'
    toast.add({ title: 'Error', description: message, color: 'error' })
  },
})

const deleteMutation = useMutation({
  mutationFn: (promotionId: string) => promotionApi.remove(promotionId),
  onSuccess: async () => {
    toast.add({
      title: 'Promoción eliminada',
      color: 'success',
    })
    await queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated(tenantId.value) })
  },
  onError: (error) => {
    const err = error as AxiosError<DomainApiError>
    const message = err.response?.data?.message ?? 'No se pudo eliminar la promoción'
    toast.add({ title: 'Error', description: message, color: 'error' })
  },
})

// ── Batch delete mutation (sdd-10) ────────────────────────────────────────────
//
// Backend shape:
//   200 → { deleted: number }
//   409 PROMOTION_REFERENCED_BY_SALE → { error, offendingIds: string[] }
//   409 BATCH_DELETE_NOT_FOUND       → { error, offendingIds: string[] }
//   403 INSUFFICIENT_PERMISSIONS     → { error }
//   400                              → Nest class-validator messages
//
// Error dispatch reads `err.response?.data.error` directly (NOT through
// normalizeApiError) because offendingIds lives in `response.data` alongside
// the code, and normalizeApiError doesn't surface it.
type BatchDeleteErrorData = DomainApiError & { offendingIds?: string[] }

const batchDeleteMutation = useMutation({
  mutationFn: (ids: string[]) => promotionApi.batchDelete(ids),
  onSuccess: async (result) => {
    toast.add({
      title: `${result.deleted} promociones eliminadas`,
      color: 'success',
    })
    await queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated(tenantId.value) })
    rowSelection.value = {}
    offendingIds.value = new Set()
  },
  onError: (error) => {
    const axiosErr = error as AxiosError<BatchDeleteErrorData>
    const code = axiosErr.response?.data?.error
    const errOffendingIds = axiosErr.response?.data?.offendingIds ?? []

    switch (code) {
      case 'PROMOTION_REFERENCED_BY_SALE':
        offendingIds.value = new Set(errOffendingIds)
        toast.add({
          title:
            'No se pueden eliminar. Las promociones marcadas fueron utilizadas en ventas. Finalizalas en lugar de eliminarlas.',
          color: 'error',
        })
        break
      case 'BATCH_DELETE_NOT_FOUND':
        toast.add({
          title: 'Algunas promociones ya no existen. La lista se actualizó.',
          color: 'warning',
        })
        void queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated(tenantId.value) })
        rowSelection.value = {}
        break
      case 'INSUFFICIENT_PERMISSIONS':
        toast.add({
          title: 'No tenés permisos para eliminar promociones en lote.',
          color: 'error',
        })
        break
      default: {
        const normalized = normalizeApiError(error, 'No se pudieron eliminar las promociones.')
        toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      }
    }
  },
})

// ── Batch end mutation (promotions-batch-end) ──────────────────────────────────
// The backend reuses the `BATCH_DELETE_NOT_FOUND` literal for batch-end 404s.
type BatchEndErrorData = DomainApiError & { offendingIds?: string[] }

const batchEndMutation = useMutation({
  mutationFn: (ids: string[]) => promotionApi.batchEnd(ids),
  onSuccess: async (result) => {
    toast.add({
      title: `${result.ended} promociones finalizadas`,
      color: 'success',
    })
    await queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated(tenantId.value) })
    rowSelection.value = {}
  },
  onError: (error) => {
    const axiosErr = error as AxiosError<BatchEndErrorData>
    const code = axiosErr.response?.data?.error
    const offendingCount = axiosErr.response?.data?.offendingIds?.length ?? 0

    switch (code) {
      // Backend naming quirk: batch-end 404s still emit BATCH_DELETE_NOT_FOUND.
      case 'BATCH_DELETE_NOT_FOUND':
        toast.add({
          title: `${offendingCount} promocion(es) no encontrada(s)`,
          color: 'warning',
        })
        void queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated(tenantId.value) })
        rowSelection.value = {}
        break
      case 'INSUFFICIENT_PERMISSIONS':
        toast.add({
          title: 'No tenés permisos para finalizar promociones en lote.',
          color: 'error',
        })
        break
      default: {
        const normalized = normalizeApiError(error, 'No se pudieron finalizar las promociones.')
        toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      }
    }
  },
})

// ── Batch activate mutation (promotions-batch-activate) ───────────────────────
// The backend reuses the `BATCH_DELETE_NOT_FOUND` literal for batch-activate
// 404s (same naming quirk as batch-end). Reactivate is idempotent: reactivating
// a non-ENDED promo is a server-side no-op success.
type BatchActivateErrorData = DomainApiError & { offendingIds?: string[] }

const batchActivateMutation = useMutation({
  mutationFn: (ids: string[]) => promotionApi.batchActivate(ids),
  onSuccess: async (result) => {
    toast.add({
      title: `${result.activated} promociones reactivadas`,
      color: 'success',
    })
    await queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated(tenantId.value) })
    rowSelection.value = {}
  },
  onError: (error) => {
    const axiosErr = error as AxiosError<BatchActivateErrorData>
    const code = axiosErr.response?.data?.error
    const offendingCount = axiosErr.response?.data?.offendingIds?.length ?? 0

    switch (code) {
      // Backend naming quirk: batch-activate 404s still emit BATCH_DELETE_NOT_FOUND.
      case 'BATCH_DELETE_NOT_FOUND':
        toast.add({
          title: `${offendingCount} promocion(es) no encontrada(s)`,
          color: 'warning',
        })
        void queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated(tenantId.value) })
        rowSelection.value = {}
        break
      case 'INSUFFICIENT_PERMISSIONS':
        toast.add({
          title: 'No tenés permisos para reactivar promociones en lote.',
          color: 'error',
        })
        break
      default: {
        const normalized = normalizeApiError(error, 'No se pudieron reactivar las promociones.')
        toast.add({ title: 'Error', description: normalized.message, color: 'error' })
      }
    }
  },
})

function handleEdit(promotion: PromotionResponse) {
  void router.push(`/pos/promociones/${promotion.id}`)
}

function handleEnd(promotion: PromotionResponse) {
  openConfirm(
    `¿Quieres finalizar la promoción "${promotion.title}"? Esta acción no se puede deshacer.`,
    'Finalizar',
    'warning',
    () => { void endMutation.mutateAsync(promotion.id) },
  )
}

function handleDelete(promotion: PromotionResponse) {
  openConfirm(
    `¿Quieres eliminar la promoción "${promotion.title}"?`,
    'Eliminar',
    'error',
    () => { void deleteMutation.mutateAsync(promotion.id) },
  )
}

function getRowItems(promotion: PromotionResponse) {
  const mainActions = (canUpdate.value
      ? [{ label: 'Editar', onSelect: () => handleEdit(promotion) }]
      : [])

  const extraActions = [
    ...(canUpdate.value && promotion.status !== PROMOTION_STATUS.ENDED
      ? [{ label: 'Finalizar', onSelect: () => handleEnd(promotion) }]
      : []),
    ...(canDelete.value
      ? [{
          label: 'Eliminar',
          color: 'error' as const,
          onSelect: () => handleDelete(promotion),
        }]
      : []),
  ]

  return [mainActions, extraActions].filter((section) => section.length > 0)
}

// ── Bulk action (BD-REQ-003 / BD-REQ-004) ──────────────────────────────────────
//
// The onClick closure is wired against the view's `selectedRows` (NOT the
// hardcoded `[]` inside DataTableBulkActions.vue:51) so the confirm modal
// receives the actual row data. This sidesteps a known latent bug in the
// bulk-actions component while keeping that component untouched.
const bulkActions = computed<BulkAction<PromotionResponse>[]>(() => {
  const rows = selectedRows?.value ?? []
  const n = rows.length
  const actions: BulkAction<PromotionResponse>[] = []

  if (canBatchDelete.value) {
    const label = n > 0 ? `Eliminar (${n})` : 'Eliminar'
    actions.push({
      id: 'batch-delete',
      label,
      variant: 'destructive',
      disabled: n === 0 || n > BATCH_DELETE_CAP,
      onClick: () => {
        openConfirm(
          'Vas a eliminar las siguientes promociones. Esta acción no se puede deshacer.',
          'Eliminar seleccionadas',
          'error',
          () => {
            void batchDeleteMutation.mutateAsync(rows.map((r) => r.id))
          },
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            status: r.status,
          })),
        )
      },
    })
  }

  if (canBatchEnd.value) {
    const label = n > 0 ? `Finalizar (${n})` : 'Finalizar'
    actions.push({
      id: 'batch-end',
      label,
      variant: 'warning',
      disabled: n === 0 || n > BATCH_END_CAP,
      onClick: () => {
        openConfirm(
          'Vas a finalizar las siguientes promociones. Esta acción no se puede deshacer.',
          'Finalizar seleccionadas',
          'warning',
          () => {
            void batchEndMutation.mutateAsync(rows.map((r) => r.id))
          },
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            status: r.status,
          })),
        )
      },
    })
  }

  if (canBatchActivate.value) {
    const label = n > 0 ? `Reactivar (${n})` : 'Reactivar'
    actions.push({
      id: 'batch-activate',
      label,
      variant: 'primary',
      disabled: n === 0 || n > BATCH_END_CAP,
      onClick: () => {
        openConfirm(
          'Vas a reactivar las siguientes promociones. Esta acción las devuelve a su estado activo.',
          'Reactivar seleccionadas',
          'primary',
          () => {
            void batchActivateMutation.mutateAsync(rows.map((r) => r.id))
          },
          rows.map((r) => ({
            id: r.id,
            title: r.title,
            status: r.status,
          })),
        )
      },
    })
  }

  return actions
})

const isEmpty = computed(() => !isLoading.value && data.value.length === 0)

defineExpose({
  filterType,
  filterStatus,
  filterMethod,
  getRowItems,
  bulkActions,
  canBatchDelete,
  canBatchEnd,
  canBatchActivate,
  batchEndMutation,
  batchActivateMutation,
  offendingIds,
  rowSelection,
})
</script>

<template>
  <div class="flex flex-col gap-6 px-10">
    <!-- ── Type Selector Modal ──────────────────────────────────────────────── -->
    <PromotionTypeSelector
      v-model:open="isTypeSelectorOpen"
      @select="isTypeSelectorOpen = false"
    />

    <!-- ── Confirm Modal ───────────────────────────────────────────────────── -->
    <ConfirmModal
      :open="confirmState.open"
      :description="confirmState.description"
      :confirm-label="confirmState.label"
      :confirm-color="confirmState.color"
      :loading="endMutation.isPending.value || deleteMutation.isPending.value || batchDeleteMutation.isPending.value || batchEndMutation.isPending.value"
      :items="confirmState.items"
      @update:open="confirmState.open = $event"
      @confirm="handleConfirm"
    />

    <!-- ── Main card ───────────────────────────────────────────────────────── -->
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <TableHeaderDescription
          title="Promociones"
          description="Gestión de promociones y descuentos"
        />
      </template>

      <div class="px-6 py-5">
        <!-- ── Filter toolbar ─────────────────────────────────────────────── -->
        <div class="mb-4 flex flex-wrap items-center gap-3" data-testid="filter-toolbar">
          <USelect
            v-model="filterTypeSelect"
            :items="TYPE_OPTIONS"
            value-key="value"
            label-key="label"
            placeholder="Tipo"
            class="w-48"
            data-testid="filter-type"
          />
          <USelect
            v-model="filterStatusSelect"
            :items="STATUS_OPTIONS"
            value-key="value"
            label-key="label"
            placeholder="Estado"
            class="w-44"
            data-testid="filter-status"
          />
          <USelect
            v-model="filterMethodSelect"
            :items="METHOD_OPTIONS"
            value-key="value"
            label-key="label"
            placeholder="Método"
            class="w-40"
            data-testid="filter-method"
          />
          <UButton
            v-if="filterType || filterStatus || filterMethod"
            label="Limpiar filtros"
            color="neutral"
            variant="ghost"
            size="sm"
            class="cursor-pointer"
            data-testid="clear-filters-btn"
            @click="filterType = ''; filterStatus = ''; filterMethod = ''"
          />
        </div>

        <AppDataTable
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          v-model:column-pinning="columnPinning"
          v-model:column-visibility="columnVisibility"
          v-model:row-selection="rowSelection"
          :columns="columns"
          :data="data"
          :loading="isLoading"
          :fetching="isFetching"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :bulk-actions="bulkActions"
          :enable-row-selection="canBatchDelete || canBatchEnd"
          :show-add-button="canCreate"
          search-placeholder="Buscar promociones..."
          add-button-text="Nueva Promoción"
          add-button-icon="i-lucide-percent"
          enable-column-visibility
          empty="No hay promociones todavía"
          @add="handleAddPromotion"
          @refresh="refresh"
        >
          <!-- ── Selection checkboxes ───────────────────────────────────── -->
          <template #select-header="{ table }">
            <SelectColumn mode="header" :table="table" />
          </template>

          <template #select-cell="{ row }">
            <SelectColumn mode="cell" :row="row" />
          </template>

          <!-- ── Sortable headers ───────────────────────────────────────── -->
          <template #title-header="{ column }">
            <SortableHeader :column="column" label="Título" />
          </template>

          <template #createdAt-header="{ column }">
            <SortableHeader :column="column" label="Creada" />
          </template>

          <template #startDate-header="{ column }">
            <SortableHeader :column="column" label="Inicio" />
          </template>

          <!-- ── Cell renderers ────────────────────────────────────────── -->
          <template #title-cell="{ row }">
            <span
              class="font-medium"
              :class="offendingIds.has(row.original.id) ? 'rounded ring-2 ring-error/60 px-1' : ''"
              :data-offending="offendingIds.has(row.original.id) ? 'true' : undefined"
            >
              {{ row.original.title }}
            </span>
          </template>

          <template #status-cell="{ row }">
            <StatusDotBadge
              :tone="getStatusConfig(row.original.status).tone"
              :label="getStatusConfig(row.original.status).label"
            />
          </template>

          <template #type-cell="{ row }">
            <AppBadge
              :tone="getTypeConfig(row.original.type).tone"
              :icon="getTypeConfig(row.original.type).icon"
              :label="getTypeConfig(row.original.type).label"
            />
          </template>

          <template #method-cell="{ row }">
            <AppBadge
              :tone="getMethodConfig(row.original.method).tone"
              :label="getMethodConfig(row.original.method).label"
              variant="outline"
            />
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-sm text-muted">
              {{ formatDate(row.original.createdAt) }}
            </span>
          </template>

          <template #startDate-cell="{ row }">
            <span class="text-sm text-muted">
              {{ formatDate(row.original.startDate) }}
            </span>
          </template>

          <template #updatedAt-cell="{ row }">
            <span class="text-sm text-muted">
              {{ formatDate(row.original.updatedAt) }}
            </span>
          </template>

          <!-- ── Empty state ────────────────────────────────────────────── -->
          <template #empty-state>
            <div
              v-if="isEmpty"
              class="flex flex-col items-center gap-4 py-16 text-center"
              data-testid="empty-state"
            >
              <div class="rounded-full bg-elevated p-4">
                <UIcon name="i-lucide-percent" class="h-8 w-8 text-dimmed" />
              </div>
              <div>
                <p class="text-base font-semibold text-highlighted">
                  No hay promociones todavía
                </p>
                <p class="mt-1 text-sm text-muted">
                  Añade tu primera promoción para empezar a ofrecer descuentos.
                </p>
              </div>
              <UButton
                v-if="canCreate"
                icon="i-lucide-plus"
                class="cursor-pointer"
                @click="handleAddPromotion"
              >
                Crear Promoción
              </UButton>
            </div>
          </template>

          <!-- ── Actions cell ───────────────────────────────────────────── -->
          <template #actions-cell="{ row }">
            <UDropdownMenu
              :items="getRowItems(row.original)"
              :content="{ align: 'end' }"
            >
              <UButton
                icon="i-lucide-ellipsis-vertical"
                color="neutral"
                variant="ghost"
                class="size-7 cursor-pointer"
              />
            </UDropdownMenu>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>