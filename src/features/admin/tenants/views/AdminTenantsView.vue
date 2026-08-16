<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import ViewToggle from '@/core/shared/components/ViewToggle.vue'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { adminTenantQueryKeys } from '@/core/shared/constants/query-keys'
import { activityToBadgeTone } from '@/core/shared/utils/badge.utils'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { tenantsApi, mapTenantError } from '../api/tenants.api'
import { useTenantColumns } from '../composables/useTenantColumns'
import { useTenantViewMode, isTenantViewMode } from '../composables/useTenantViewMode'
import type { TenantTableRow } from '../interfaces/tenant.types'
import type { CreateTenantFormValues, EditTenantFormValues } from '../composables/useTenantForm'
import TenantUpsertSlideover from '../components/TenantUpsertSlideover.vue'
import TenantCardGrid from '../components/TenantCardGrid.vue'
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'
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
const { columns } = useTenantColumns()

// ── View mode (table ↔ card) ──────────────────────────────────────────────────
const { viewMode, setMode: setViewMode, displayMode } = useTenantViewMode()

function handleViewModeChange(mode: string) {
  if (!isTenantViewMode(mode)) return
  setViewMode(mode)
}

const includeInactive = ref(false)

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
} = useServerTable<TenantTableRow>({
  queryKey: () => adminTenantQueryKeys.list(includeInactive.value),
  queryFn: (params) => tenantsApi.getPaginated(params, includeInactive.value),
  defaultPageSize: 10,
  persistKey: 'admin-tenants',
  defaultSorting: [{ id: 'name', desc: false }],
  defaultPinning: { left: [], right: ['actions'] },
})

// Human-readable error message for the admin tenants table. Mirrors
// AdminRolesView: prefer backend `response.data.message`, then
// `error.message`, then the Spanish fallback. The error block in
// AppDataTable is rendered instead of "No se encontraron sucursales"
// whenever `isError` is true.
const tenantsErrorMessage = computed(() => {
  const err = error.value as
    | { response?: { data?: { message?: unknown } }; message?: string }
    | null
    | undefined
  const backendMessage = err?.response?.data?.message
  if (typeof backendMessage === 'string' && backendMessage.trim()) {
    return backendMessage
  }
  if (Array.isArray(backendMessage) && backendMessage.length > 0) {
    const first = backendMessage[0]
    if (typeof first === 'string') return first
  }
  if (typeof err?.message === 'string' && err.message.trim()) {
    return err.message
  }
  return 'No se pudieron cargar las sucursales. Reintenta.'
})

const headerDescription = 'Gestión global de sucursales (solo super-admin).'

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
const canManageTenantActions = computed(() => authStore.isSuperAdmin)

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function openEdit(tenant: TenantTableRow) {
  if (!canUpdateTenant.value) return
  selectedTenant.value = tenant
  isEditOpen.value = true
}

function handleCardClick(tenant: TenantTableRow) {
  openEdit(tenant)
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

function getRowItems(tenant: TenantTableRow) {
  return buildTenantRowActions(tenant, {
    canUpdate: canUpdateTenant.value,
    canDelete: canDeleteTenant.value,
    canManageMembers: authStore.isSuperAdmin,
    onEdit: openEdit,
    onDeactivate: handleDeactivate,
    onManageMembers: handleManageMembers,
  })
}
</script>

<template>
  <div class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
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
      @update:open="confirmState.open = $event"
      @confirm="handleConfirm"
    />

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <AdminPageHeader title="Gestión de sucursales" :description="headerDescription" />
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
          :error-message="tenantsErrorMessage"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :display-mode="displayMode"
          search-placeholder="Buscar sucursales..."
          :show-add-button="canCreateTenant"
          :active-filter-count="includeInactive ? 1 : 0"
          add-button-text="Crear sucursal"
          add-button-icon="i-lucide-building"
          enable-column-visibility
          empty="No se encontraron sucursales"
          data-testid="create-tenant-button"
          @add="isCreateOpen = true"
          @refresh="refresh"
        >
          <template #filters>
            <!-- WU-4 / polish-filters-bottom-sheet: the section wrapper carries
                 data-section-id="inactive" so the mobile sheet wraps it in a
                 card with a "Filtros" title (CreateEmployeeSlideover pattern). -->
            <div data-section-id="inactive">
              <UCheckbox v-model="includeInactive" label="Mostrar inactivos" />
            </div>
          </template>

          <template #name-header="{ column }">
            <SortableHeader :column="column" label="Nombre" />
          </template>

          <template #slug-header="{ column }">
            <SortableHeader :column="column" label="Slug" />
          </template>

          <template #createdAt-header="{ column }">
            <SortableHeader :column="column" label="Creación" />
          </template>

          <template #isActive-cell="{ row }">
            <StatusDotBadge
              :data-testid="`status-badge-${row.original.id}`"
              :tone="activityToBadgeTone(row.original.isActive)"
              :label="row.original.isActive ? 'Activa' : 'Inactiva'"
            />
          </template>

          <template #createdAt-cell="{ row }">
            <span>{{ dateFormatter.format(new Date(row.original.createdAt)) }}</span>
          </template>

          <template #actions-cell="{ row }">
            <UDropdownMenu
              v-if="canManageTenantActions"
              :items="getRowItems(row.original)"
              :content="{ align: 'end' }"
            >
              <UButton
                :data-testid="`edit-tenant-${row.original.id}`"
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
              aria-label="Seleccionar vista de sucursales"
              @update:model-value="handleViewModeChange"
            />
          </template>

          <template #cards>
            <TenantCardGrid
              :tenants="data"
              :loading="isLoading || isFetching"
              :empty="'No se encontraron sucursales'"
              @card-click="handleCardClick"
            />
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>