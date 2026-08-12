<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import ViewToggle from '@/core/shared/components/ViewToggle.vue'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { adminRoleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { rolesApi } from '../api/roles.api'
import { usersApi } from '@/features/admin/users/api/users.api'
import { useRoleColumns } from '../composables/useRoleColumns'
import { useRoleViewMode, isRoleViewMode } from '../composables/useRoleViewMode'
import type { RoleFormValues } from '../composables/useRoleForm'
import type { RoleTableRow } from '../interfaces/role.types'
import RoleUpsertSlideover from '../components/RoleUpsertSlideover.vue'
import RolePermissionsSlideover from '../components/RolePermissionsSlideover.vue'
import RoleCardGrid from '../components/RoleCardGrid.vue'
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'

const queryClient = useQueryClient()
const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)
const headerDescription = computed(() => {
  const name = authStore.currentTenant?.name ?? '(Global)'
  return `Administrá los roles y permisos de ${name}`
})
const { columns } = useRoleColumns()

// ── View mode (table ↔ card) ──────────────────────────────────────────────────
const { viewMode, setMode: setViewMode, displayMode } = useRoleViewMode()

function handleViewModeChange(mode: string) {
  if (!isRoleViewMode(mode)) return
  setViewMode(mode)
}

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
} = useServerTable<RoleTableRow>({
  queryKey: () => adminRoleQueryKeys.paginated(tenantId.value),
  queryFn: (params) => rolesApi.getPaginated(params),
  defaultPageSize: 10,
  persistKey: 'admin-roles',
  defaultSorting: [{ id: 'name', desc: false }],
  defaultPinning: { left: [], right: ['actions'] },
})

// Human-readable error message for the admin roles table. Mirrors
// AdminUsersView: prefer backend `response.data.message`, then `error.message`,
// then the Spanish fallback. The error block in AppDataTable is rendered
// instead of "No se encontraron roles" whenever `isError` is true.
const rolesErrorMessage = computed(() => {
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
  return 'No se pudieron cargar los roles. Reintenta.'
})

const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const isPermissionsOpen = ref(false)
const selectedRole = ref<RoleTableRow | null>(null)
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
  mutationFn: rolesApi.create,
  onSuccess: async () => {
    isCreateOpen.value = false
    usersApi.clearRolesCache()
    await queryClient.invalidateQueries({ queryKey: adminRoleQueryKeys.paginated(tenantId.value) })
  },
})

const editMutation = useMutation({
  mutationFn: (payload: { roleId: string; values: RoleFormValues }) =>
    rolesApi.update(payload.roleId, payload.values),
  onSuccess: async () => {
    isEditOpen.value = false
    selectedRole.value = null
    usersApi.clearRolesCache()
    await queryClient.invalidateQueries({ queryKey: adminRoleQueryKeys.paginated(tenantId.value) })
  },
})

const deleteMutation = useMutation({
  mutationFn: rolesApi.remove,
  onSuccess: async () => {
    usersApi.clearRolesCache()
    await queryClient.invalidateQueries({ queryKey: adminRoleQueryKeys.paginated(tenantId.value) })
  },
})

const permissionsMutation = useMutation({
  mutationFn: (payload: { roleId: string; permissionIds: string[] }) =>
    rolesApi.assignPermissions(payload.roleId, { permissionIds: payload.permissionIds }),
  onSuccess: async () => {
    isPermissionsOpen.value = false
    selectedRole.value = null
    usersApi.clearRolesCache()
    await queryClient.invalidateQueries({ queryKey: adminRoleQueryKeys.paginated(tenantId.value) })
  },
})

const isSubmitting = computed(
  () =>
    createMutation.isPending.value ||
    editMutation.isPending.value ||
    deleteMutation.isPending.value ||
    permissionsMutation.isPending.value,
)

const canCreateRole = computed(() => authStore.userCan('create', 'Role'))
const canUpdateRole = computed(() => authStore.userCan('update', 'Role'))
const canDeleteRole = computed(() => authStore.userCan('delete', 'Role'))
const canManageRoleActions = computed(() => canUpdateRole.value || canDeleteRole.value)

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function openEdit(role: RoleTableRow) {
  if (!canUpdateRole.value) return
  selectedRole.value = role
  isEditOpen.value = true
}

function handleCardClick(role: RoleTableRow) {
  openEdit(role)
}

function openPermissions(role: RoleTableRow) {
  if (!canUpdateRole.value) return
  selectedRole.value = role
  isPermissionsOpen.value = true
}

async function handleDelete(role: RoleTableRow) {
  if (!canDeleteRole.value) return

  if (role.isSystem) {
    window.alert('No se puede eliminar un rol del sistema.')
    return
  }

  openConfirm(`¿Quieres eliminar el rol ${role.name}?`, () => {
    void deleteMutation.mutateAsync(role.id)
  })
}

function getRowItems(role: RoleTableRow) {
  const mainActions = canUpdateRole.value
    ? [
        { label: 'Editar', onSelect: () => openEdit(role) },
        { label: 'Permisos', onSelect: () => openPermissions(role) },
      ]
    : []

  // Defensive UX: hide the destructive "Eliminar" entry for system roles.
  // The runtime window.alert block in handleDelete stays as a defensive
  // last line of defense, but the menu no longer advertises an action the
  // user can never perform.
  const destructiveActions =
    canDeleteRole.value && !role.isSystem
      ? [
          {
            label: 'Eliminar',
            color: 'error' as const,
            onSelect: () => handleDelete(role),
          },
        ]
      : []

  return [mainActions, destructiveActions].filter((section) => section.length > 0)
}
</script>

<template>
  <div class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
    <RoleUpsertSlideover
      v-model:open="isCreateOpen"
      mode="create"
      :loading="isSubmitting"
      @create="createMutation.mutate"
    />

    <RoleUpsertSlideover
      v-model:open="isEditOpen"
      mode="edit"
      :role="selectedRole"
      :loading="isSubmitting"
      @edit="(values) => selectedRole && editMutation.mutate({ roleId: selectedRole.id, values })"
    />

    <RolePermissionsSlideover
      v-model:open="isPermissionsOpen"
      :role="selectedRole"
      :loading="isSubmitting"
      @save="permissionsMutation.mutate"
    />

    <ConfirmModal
      :open="confirmState.open"
      :description="confirmState.description"
      confirm-label="Eliminar"
      confirm-color="error"
      :loading="deleteMutation.isPending.value"
      @update:open="confirmState.open = $event"
      @confirm="handleConfirm"
    />

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <AdminPageHeader title="Gestión de roles" :description="headerDescription" />
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
          :error-message="rolesErrorMessage"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :display-mode="displayMode"
          search-placeholder="Buscar rol..."
          :show-add-button="canCreateRole"
          add-button-text="Crear Rol"
          add-button-icon="i-lucide-user-plus"
          enable-column-visibility
          empty="No se encontraron roles"
          @add="isCreateOpen = true"
          @refresh="refresh"
        >
          <template #name-header="{ column }">
            <SortableHeader :column="column" label="Nombre" />
          </template>

          <template #description-header>
            <span class="text-xs font-semibold">Descripción</span>
          </template>

          <template #permissionCount-header="{ column }">
            <SortableHeader :column="column" label="Permisos" />
          </template>

          <template #userCount-header="{ column }">
            <SortableHeader :column="column" label="Usuarios" />
          </template>

          <template #createdAt-header="{ column }">
            <SortableHeader :column="column" label="Creación" />
          </template>

          <template #description-cell="{ row }">
            <span class="text-sm text-muted">{{ row.original.description ?? '—' }}</span>
          </template>

          <template #permissionCount-cell="{ row }">
            <AppBadge tone="info" :value="row.original.permissionCount" />
          </template>

          <template #userCount-cell="{ row }">
            <AppBadge tone="type" :value="row.original.userCount" variant="outline" />
          </template>

          <template #createdAt-cell="{ row }">
            <span>{{ dateFormatter.format(new Date(row.original.createdAt)) }}</span>
          </template>

          <template #actions-cell="{ row }">
            <UDropdownMenu
              v-if="canManageRoleActions"
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
              aria-label="Seleccionar vista de roles"
              @update:model-value="handleViewModeChange"
            />
          </template>

          <template #cards>
            <RoleCardGrid
              :roles="data"
              :loading="isLoading || isFetching"
              :empty="'No se encontraron roles'"
              @card-click="handleCardClick"
            />
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
