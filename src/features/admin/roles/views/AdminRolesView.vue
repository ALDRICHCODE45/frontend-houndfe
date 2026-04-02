<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { adminRoleQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { rolesApi } from '../api/roles.api'
import { usersApi } from '@/features/admin/users/api/users.api'
import { useRoleColumns } from '../composables/useRoleColumns'
import type { RoleFormValues } from '../composables/useRoleForm'
import type { RoleTableRow } from '../interfaces/role.types'
import RoleUpsertSlideover from '../components/RoleUpsertSlideover.vue'
import RolePermissionsSlideover from '../components/RolePermissionsSlideover.vue'

const queryClient = useQueryClient()
const authStore = useAuthStore()
const { columns } = useRoleColumns()

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
} = useServerTable<RoleTableRow>({
  queryKey: adminRoleQueryKeys.paginated(),
  queryFn: (params) => rolesApi.getPaginated(params),
  defaultPageSize: 10,
  persistKey: 'admin-roles',
  defaultSorting: [{ id: 'name', desc: false }],
  defaultPinning: { left: [], right: ['actions'] },
})

const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const isPermissionsOpen = ref(false)
const selectedRole = ref<RoleTableRow | null>(null)

const createMutation = useMutation({
  mutationFn: rolesApi.create,
  onSuccess: async () => {
    isCreateOpen.value = false
    usersApi.clearRolesCache()
    await queryClient.invalidateQueries({ queryKey: adminRoleQueryKeys.paginated() })
  },
})

const editMutation = useMutation({
  mutationFn: (payload: { roleId: string; values: RoleFormValues }) =>
    rolesApi.update(payload.roleId, payload.values),
  onSuccess: async () => {
    isEditOpen.value = false
    selectedRole.value = null
    usersApi.clearRolesCache()
    await queryClient.invalidateQueries({ queryKey: adminRoleQueryKeys.paginated() })
  },
})

const deleteMutation = useMutation({
  mutationFn: rolesApi.remove,
  onSuccess: async () => {
    usersApi.clearRolesCache()
    await queryClient.invalidateQueries({ queryKey: adminRoleQueryKeys.paginated() })
  },
})

const permissionsMutation = useMutation({
  mutationFn: (payload: { roleId: string; permissionIds: string[] }) =>
    rolesApi.assignPermissions(payload.roleId, { permissionIds: payload.permissionIds }),
  onSuccess: async () => {
    isPermissionsOpen.value = false
    selectedRole.value = null
    usersApi.clearRolesCache()
    await queryClient.invalidateQueries({ queryKey: adminRoleQueryKeys.paginated() })
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

  const confirmed = window.confirm(`¿Querés eliminar el rol ${role.name}?`)
  if (!confirmed) return

  await deleteMutation.mutateAsync(role.id)
}

function getRowItems(role: RoleTableRow) {
  const mainActions = (canUpdateRole.value
      ? [
          { label: 'Editar', onSelect: () => openEdit(role) },
          { label: 'Permisos', onSelect: () => openPermissions(role) },
        ]
      : [])

  const destructiveActions = (canDeleteRole.value
      ? [
          {
            label: 'Eliminar',
            color: 'error' as const,
            onSelect: () => handleDelete(role),
          },
        ]
      : [])

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

    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <div>
          <h2 class="text-2xl font-semibold">Gestión de roles y permisos</h2>
          <p class="text-sm text-muted">Administrá los roles y permisos de tu organización</p>
        </div>
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
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          search-placeholder="Buscar rol..."
          :show-add-button="canCreateRole"
          add-button-text="Crear Rol"
          add-button-icon="i-lucide-user-plus"
          empty="No se encontraron roles"
          @add="isCreateOpen = true"
          @refresh="refresh"
        >
          <template #name-header="{ column }">
            <SortableHeader :column="column" label="Nombre" />
          </template>

          <template #createdAt-header="{ column }">
            <SortableHeader :column="column" label="Creación" />
          </template>

          <template #permissionCount-cell="{ row }">
            <UBadge color="neutral" variant="soft">{{ row.original.permissionCount }}</UBadge>
          </template>

          <template #userCount-cell="{ row }">
            <UBadge color="neutral" variant="outline">{{ row.original.userCount }}</UBadge>
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
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
