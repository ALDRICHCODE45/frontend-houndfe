<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { promotionQueryKeys } from '@/core/shared/constants/query-keys'
import type { BulkAction } from '@/core/shared/types/table.types'
import TableHeaderDescription from '@/core/shared/components/DataTable/TableHeaderDescription.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import type { DomainApiError } from '@/core/shared/utils/error.utils'
import { promotionApi } from '../api/promotion.api'
import { usePromotionColumns } from '../composables/usePromotionColumns'
import type { PromotionMethod, PromotionResponse, PromotionStatus, PromotionType } from '../interfaces/promotion.types'
import PromotionTypeSelector from '../components/PromotionTypeSelector.vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'

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
const { columns, getStatusConfig, getTypeConfig, getMethodConfig, formatDate } = usePromotionColumns()

// ── Permission helpers ────────────────────────────────────────────────────────
const canCreate = computed(() => authStore.userCan('create', 'Promotion'))
const canUpdate = computed(() => authStore.userCan('update', 'Promotion'))
const canDelete = computed(() => authStore.userCan('delete', 'Promotion'))

// ── Filter state ─────────────────────────────────────────────────────────────

const filterType = ref<PromotionType | ''>('')
const filterStatus = ref<PromotionStatus | ''>('')
const filterMethod = ref<PromotionMethod | ''>('')

const TYPE_OPTIONS = [
  { label: 'Todos los tipos', value: '' },
  { label: 'Descuento en productos', value: 'PRODUCT_DISCOUNT' },
  { label: 'Descuento en pedido', value: 'ORDER_DISCOUNT' },
  { label: '2x1, 3x2 o similares', value: 'BUY_X_GET_Y' },
  { label: 'Avanzada', value: 'ADVANCED' },
]

const STATUS_OPTIONS = [
  { label: 'Todos los estados', value: '' },
  { label: 'Activa', value: 'ACTIVE' },
  { label: 'Programada', value: 'SCHEDULED' },
  { label: 'Finalizada', value: 'ENDED' },
]

const METHOD_OPTIONS = [
  { label: 'Todos los métodos', value: '' },
  { label: 'Automático', value: 'AUTOMATIC' },
  { label: 'Manual', value: 'MANUAL' },
]

// ── Server table ──────────────────────────────────────────────────────────────

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
} = useServerTable<PromotionResponse>({
  queryKey: () => [
    ...promotionQueryKeys.paginated(),
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

// ── Reset pagination when filters change ─────────────────────────────────────

watch([filterType, filterStatus, filterMethod], () => {
  pagination.value = { ...pagination.value, pageIndex: 0 }
})

// ── Local UI state ────────────────────────────────────────────────────────────

const isTypeSelectorOpen = ref(false)

const confirmState = ref({
  open: false,
  description: '',
  loading: false,
  label: 'Confirmar',
  color: 'error' as const,
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
) {
  confirmState.value = {
    open: true,
    description,
    loading: false,
    label,
    color: color as 'error',
    onConfirm,
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
    await queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated() })
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
    await queryClient.invalidateQueries({ queryKey: promotionQueryKeys.paginated() })
  },
  onError: (error) => {
    const err = error as AxiosError<DomainApiError>
    const message = err.response?.data?.message ?? 'No se pudo eliminar la promoción'
    toast.add({ title: 'Error', description: message, color: 'error' })
  },
})

// ── Row actions ───────────────────────────────────────────────────────────────

function handleEdit(promotion: PromotionResponse) {
  void router.push(`/pos/promociones/${promotion.id}`)
}

function handleEnd(promotion: PromotionResponse) {
  openConfirm(
    `¿Querés finalizar la promoción "${promotion.title}"? Esta acción no se puede deshacer.`,
    'Finalizar',
    'warning',
    () => { void endMutation.mutateAsync(promotion.id) },
  )
}

function handleDelete(promotion: PromotionResponse) {
  openConfirm(
    `¿Querés eliminar la promoción "${promotion.title}"?`,
    'Eliminar',
    'error',
    () => { void deleteMutation.mutateAsync(promotion.id) },
  )
}

function getRowItems(promotion: PromotionResponse) {
  const mainActions = [
    ...(canUpdate.value
      ? [{ label: 'Editar', onSelect: () => handleEdit(promotion) }]
      : []),
  ]

  const extraActions = [
    ...(canUpdate.value && promotion.status !== 'ENDED'
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

const bulkActions = computed<BulkAction<PromotionResponse>[]>(() => [])

const isEmpty = computed(() => !isLoading.value && data.value.length === 0)

defineExpose({ filterType, filterStatus, filterMethod, getRowItems })
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
      :loading="endMutation.isPending.value || deleteMutation.isPending.value"
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
            v-model="filterType"
            :items="TYPE_OPTIONS"
            value-key="value"
            label-key="label"
            placeholder="Tipo"
            class="w-48"
            data-testid="filter-type"
          />
          <USelect
            v-model="filterStatus"
            :items="STATUS_OPTIONS"
            value-key="value"
            label-key="label"
            placeholder="Estado"
            class="w-44"
            data-testid="filter-status"
          />
          <USelect
            v-model="filterMethod"
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
          :show-add-button="canCreate"
          search-placeholder="Buscar promociones..."
          add-button-text="Nueva Promoción"
          add-button-icon="i-lucide-percent"
          :enable-row-selection="false"
          enable-column-visibility
          empty="No hay promociones todavía"
          @add="handleAddPromotion"
          @refresh="refresh"
        >
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
            <span class="font-medium">{{ row.original.title }}</span>
          </template>

          <template #status-cell="{ row }">
            <UBadge
              :color="getStatusConfig(row.original.status).color"
              :variant="getStatusConfig(row.original.status).variant"
              :icon="getStatusConfig(row.original.status).icon"
              :label="getStatusConfig(row.original.status).label"
              size="md"
              :ui="{ label: 'font-medium' }"
            />
          </template>

          <template #type-cell="{ row }">
            <UBadge
              :color="getTypeConfig(row.original.type).color"
              :variant="getTypeConfig(row.original.type).variant"
              :icon="getTypeConfig(row.original.type).icon"
              :label="getTypeConfig(row.original.type).label"
              size="md"
              :ui="{ label: 'font-medium' }"
            />
          </template>

          <template #method-cell="{ row }">
            <UBadge
              :color="getMethodConfig(row.original.method).color"
              :variant="getMethodConfig(row.original.method).variant"
              :label="getMethodConfig(row.original.method).label"
              size="md"
              :ui="{ label: 'font-medium' }"
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
