<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ToolbarSelectFilter from '@/core/shared/components/DataTable/ToolbarSelectFilter.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import RowActionsMenu from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { adminTenantQueryKeys } from '@/core/shared/constants/query-keys'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { tenantsApi, mapTenantError } from '../api/tenants.api'
import { useTenantColumns } from '../composables/useTenantColumns'
import type { TenantTableRow } from '../interfaces/tenant.types'
import type { EditTenantFormValues } from '../composables/useTenantForm'
import TenantUpsertSlideover from '../components/TenantUpsertSlideover.vue'
import AdminMobileCard from '../../shared/components/AdminMobileCard.vue'
import { noMatchTitleFor } from '../../shared/utils/list-state.utils'
import '../styles/tenants-visual.css'
import { buildTenantRowActions } from '../utils/tenant-actions.utils'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const router = useRouter()
const queryClient = useQueryClient()
const authStore = useAuthStore()
const toast = useToast()
const { columns: allColumns } = useTenantColumns()

const includeInactive = ref(false)

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
} = useServerTable<TenantTableRow>({
  queryKey: () => adminTenantQueryKeys.list(includeInactive.value),
  queryFn: (params) => tenantsApi.getPaginated(params, includeInactive.value),
  defaultPageSize: 10,
  persistKey: 'admin-tenants',
  defaultSorting: [{ id: 'name', desc: false }],
})

// A column that is "—" on every row of the page carries nothing, so it hides;
// with no rows (loading, empty) the full set stays so the skeleton keeps its shape.
const columns = computed(() => {
  if (data.value.length === 0) return allColumns
  const empty = new Set<string>(
    (['address', 'phone'] as const).filter((key) => data.value.every((row) => !row[key])),
  )
  return allColumns.filter(
    (column) => !('accessorKey' in column) || !empty.has(String(column.accessorKey)),
  )
})

const tenantsErrorMessage = 'No se pudieron cargar las sucursales'

const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const selectedTenant = ref<TenantTableRow | null>(null)
const confirmState = ref({
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

const createMutation = useMutation({
  mutationFn: tenantsApi.create,
  onSuccess: async () => {
    isCreateOpen.value = false
    toast.add({
      title: 'Sucursal creada',
      description: 'La sucursal se creó correctamente.',
      color: 'success',
    })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] })
  },
  onError: (error: AxiosError<{ message?: string }>) => {
    const message = mapTenantError(error.response?.data?.message || error.message || '')
    toast.add({ title: 'Error al crear sucursal', description: message, color: 'error' })
  },
})

const editMutation = useMutation({
  mutationFn: (payload: { tenantId: string; data: EditTenantFormValues }) =>
    tenantsApi.update(payload.tenantId, payload.data),
  onSuccess: async () => {
    isEditOpen.value = false
    selectedTenant.value = null
    toast.add({
      title: 'Sucursal actualizada',
      description: 'Los cambios se guardaron correctamente.',
      color: 'success',
    })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] })
  },
  onError: (error: AxiosError<{ message?: string }>) => {
    const message = mapTenantError(error.response?.data?.message || error.message || '')
    toast.add({ title: 'Error al actualizar sucursal', description: message, color: 'error' })
  },
})

const deactivateMutation = useMutation({
  mutationFn: tenantsApi.deactivate,
  onSuccess: async () => {
    toast.add({
      title: 'Sucursal desactivada',
      description: 'La sucursal fue desactivada correctamente.',
      color: 'success',
    })
    await queryClient.invalidateQueries({ queryKey: ['admin', 'tenants'] })
  },
  onError: (error: AxiosError<{ message?: string }>) => {
    const message = mapTenantError(error.response?.data?.message || error.message || '')
    toast.add({ title: 'Error al desactivar sucursal', description: message, color: 'error' })
  },
})

const isSubmitting = computed(
  () => createMutation.isPending.value || editMutation.isPending.value || deactivateMutation.isPending.value,
)

// Tenant management is restricted to super-admins only (global resource, not permission-based)
const canCreateTenant = computed(() => authStore.isSuperAdmin)
const canUpdateTenant = computed(() => authStore.isSuperAdmin)
const canDeleteTenant = computed(() => authStore.isSuperAdmin)

function openEdit(tenant: TenantTableRow) {
  if (!canUpdateTenant.value) return
  selectedTenant.value = tenant
  isEditOpen.value = true
}

async function handleDeactivate(tenant: TenantTableRow) {
  if (!canDeleteTenant.value) return
  openConfirm(`¿Quieres desactivar la sucursal ${tenant.name}?`, () => {
    void deactivateMutation.mutateAsync(tenant.id)
  })
}

function handleManageMembers(tenant: TenantTableRow) {
  void router.push(`/admin/tenants/${tenant.id}/members`)
}

const rowActions = computed(() =>
  buildTenantRowActions({
    canUpdate: canUpdateTenant.value,
    canDelete: canDeleteTenant.value,
    canManageMembers: authStore.isSuperAdmin,
  }),
)

function handleRowAction(key: string, tenant: TenantTableRow) {
  if (key === 'edit') openEdit(tenant)
  else if (key === 'members') handleManageMembers(tenant)
  else if (key === 'deactivate') void handleDeactivate(tenant)
}

const rowOpen = computed(() => (canUpdateTenant.value ? openEdit : undefined))

// "Activas" is the default view; "Todas" is the one active filter.
const statusItems = [
  { label: 'Activas', value: 'active' },
  { label: 'Todas', value: 'all' },
]
const statusFilter = computed({
  get: () => (includeInactive.value ? 'all' : 'active'),
  set: (value: string) => {
    includeInactive.value = value === 'all'
  },
})

const searchTerm = computed(() => globalFilter.value.trim())
const noMatchTitle = computed(() => noMatchTitleFor(searchTerm.value))
const emptyState = computed(() => ({
  title: 'Aún no hay sucursales',
  description: 'Aquí aparecerán las sucursales que crees.',
  ...(canCreateTenant.value
    ? { actionLabel: 'Crear sucursal', actionIcon: 'i-lucide-building' }
    : {}),
}))

function clearFilters() {
  globalFilter.value = ''
  includeInactive.value = false
}
</script>

<template>
  <div class="hf-theme hf-ui tenants-visual flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
    <TenantUpsertSlideover
      v-model:open="isCreateOpen"
      mode="create"
      :loading="isSubmitting"
      @create="createMutation.mutate"
    />

    <TenantUpsertSlideover
      v-model:open="isEditOpen"
      mode="edit"
      :tenant="selectedTenant"
      :loading="isSubmitting"
      @edit="
        (payload) =>
          selectedTenant && editMutation.mutate({ tenantId: selectedTenant.id, data: payload })
      "
    />

    <ConfirmModal
      :open="confirmState.open"
      :description="confirmState.description"
      confirm-label="Desactivar"
      confirm-color="error"
      :loading="deactivateMutation.isPending.value"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay tenants-form-portal' }"
      @update:open="confirmState.open = $event"
      @confirm="handleConfirm"
    />

    <header class="hf-page-header">
      <h1 class="hf-page-title">Sucursales</h1>
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
          :error-message="tenantsErrorMessage"
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
          search-placeholder="Buscar sucursales..."
          :show-add-button="canCreateTenant"
          :active-filter-count="includeInactive ? 1 : 0"
          add-button-text="Crear sucursal"
          add-button-icon="i-lucide-building"
          empty="No se encontraron sucursales"
          class="hf-data-table"
          portal-class="hf-theme hf-ui tenants-list-portal"
          pagination-portal-class="hf-theme hf-ui tenants-list-portal"
          data-testid="create-tenant-button"
          @add="isCreateOpen = true"
          @empty-action="isCreateOpen = true"
          @clear-filters="clearFilters"
          @refresh="refresh"
        >
          <template #filters>
            <ToolbarSelectFilter
              v-model="statusFilter"
              :items="statusItems"
              label="Estado"
              portal-class="hf-theme hf-ui tenants-list-portal"
              test-id="tenant-status-filter"
            />
          </template>

          <template #name-header="{ column }">
            <SortableHeader :column="column" label="Sucursal" />
          </template>

          <template #createdAt-header="{ column }">
            <SortableHeader :column="column" label="Creación" />
          </template>

          <template #name-cell="{ row }">
            <button
              v-if="canUpdateTenant"
              type="button"
              class="hf-row-primary text-left"
              data-testid="tenant-name"
              @click="openEdit(row.original)"
            >
              {{ row.original.name }}
            </button>
            <span v-else class="hf-row-primary" data-testid="tenant-name">{{
              row.original.name
            }}</span>
          </template>

          <template #isActive-cell="{ row }">
            <StatusBadge
              :label="row.original.isActive ? 'Activa' : 'Inactiva'"
              :tone="row.original.isActive ? 'success' : 'neutral'"
            />
          </template>

          <template #address-cell="{ row }">
            <span class="text-sm text-muted">{{ row.original.address || '—' }}</span>
          </template>

          <template #phone-cell="{ row }">
            <span class="hf-figure text-sm">{{ row.original.phone || '—' }}</span>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-sm text-muted">{{ formatShortDateTime(row.original.createdAt) }}</span>
          </template>

          <template #actions-header><span class="sr-only">Acciones</span></template>

          <template #actions-cell="{ row }">
            <RowActionsMenu
              :actions="rowActions"
              :row-label="row.original.name"
              portal-class="tenants-list-portal"
              @select="handleRowAction($event, row.original)"
            />
          </template>

          <template #mobile-card="{ row }">
            <AdminMobileCard
              :item="row"
              :label="row.name"
              :actions="rowActions"
              :openable="canUpdateTenant"
              portal-class="tenants-list-portal"
              test-id="tenant-card"
              @open="openEdit"
              @action="handleRowAction"
            >
              <template v-if="row.address" #secondary>{{ row.address }}</template>
              <template #badges>
                <StatusBadge
                  :label="row.isActive ? 'Activa' : 'Inactiva'"
                  :tone="row.isActive ? 'success' : 'neutral'"
                />
              </template>
              <template #footer>
                <span v-if="row.phone" class="hf-figure min-w-0 truncate">{{ row.phone }}</span>
                <span :class="{ 'ml-auto shrink-0': row.phone }">Creada {{ formatShortDateTime(row.createdAt) }}</span>
              </template>
            </AdminMobileCard>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
