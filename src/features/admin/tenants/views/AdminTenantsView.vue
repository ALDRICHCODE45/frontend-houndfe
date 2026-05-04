<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { adminTenantQueryKeys } from '@/core/shared/constants/query-keys'
import { activityToBadgeTone } from '@/core/shared/utils/badge.utils'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { tenantsApi, mapTenantError } from '../api/tenants.api'
import { useTenantColumns } from '../composables/useTenantColumns'
import type { TenantTableRow } from '../interfaces/tenant.types'
import type { CreateTenantFormValues, EditTenantFormValues } from '../composables/useTenantForm'
import TenantUpsertSlideover from '../components/TenantUpsertSlideover.vue'
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

async function handleDeactivate(tenant: TenantTableRow) {
  if (!canDeleteTenant.value) return
  openConfirm(`¿Querés desactivar la sucursal ${tenant.name}?`, () => {
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
        <div>
          <h2 class="text-2xl font-semibold">Admin · Sucursales</h2>
          <p class="text-sm text-muted">Gestión global de sucursales (solo super-admin).</p>
        </div>
      </template>

      <div class="px-6 py-5">
        <div class="mb-4 flex items-center gap-2">
          <UCheckbox v-model="includeInactive" label="Mostrar inactivos" />
        </div>

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
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          search-placeholder="Buscar sucursales..."
          :show-add-button="canCreateTenant"
          add-button-text="Crear sucursal"
          add-button-icon="i-lucide-building"
          empty="No se encontraron sucursales"
          data-testid="create-tenant-button"
          @add="isCreateOpen = true"
          @refresh="refresh"
        >
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
            <AppBadge
              :data-testid="`status-badge-${row.original.id}`"
              :tone="activityToBadgeTone(row.original.isActive)"
              :label="row.original.isActive ? 'Activa' : 'Inactiva'"
            >
            </AppBadge>
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
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
