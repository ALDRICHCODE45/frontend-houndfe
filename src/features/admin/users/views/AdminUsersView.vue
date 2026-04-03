<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { adminUserQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { usersApi } from '../api/users.api'
import { useUserColumns } from '../composables/useUserColumns'
import type { UserTableRow } from '../interfaces/user.types'
import UserUpsertSlideover from '../components/UserUpsertSlideover.vue'
import UserAssignRolesSlideover from '../components/UserAssignRolesSlideover.vue'

const queryClient = useQueryClient()
const authStore = useAuthStore()
const { columns } = useUserColumns()

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
} = useServerTable<UserTableRow>({
  queryKey: adminUserQueryKeys.paginated(),
  queryFn: (params) => usersApi.getPaginated(params),
  defaultPageSize: 10,
  persistKey: 'admin-users',
  defaultSorting: [{ id: 'name', desc: false }],
  defaultPinning: { left: [], right: ['actions'] },
})

const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const isAssignRolesOpen = ref(false)
const selectedUser = ref<UserTableRow | null>(null)
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
  mutationFn: usersApi.create,
  onSuccess: async () => {
    isCreateOpen.value = false
    usersApi.clearRolesCache()
    await queryClient.invalidateQueries({ queryKey: adminUserQueryKeys.paginated() })
  },
})

const editMutation = useMutation({
  mutationFn: (payload: { userId: string; name: string }) =>
    usersApi.update(payload.userId, { name: payload.name }),
  onSuccess: async () => {
    isEditOpen.value = false
    selectedUser.value = null
    usersApi.clearRolesCache()
    await queryClient.invalidateQueries({ queryKey: adminUserQueryKeys.paginated() })
  },
})

const assignRolesMutation = useMutation({
  mutationFn: (payload: { userId: string; roleIds: string[] }) =>
    usersApi.assignRoles(payload.userId, { roleIds: payload.roleIds }),
  onSuccess: async () => {
    isAssignRolesOpen.value = false
    selectedUser.value = null
    usersApi.clearRolesCache()
    await queryClient.invalidateQueries({ queryKey: adminUserQueryKeys.paginated() })
  },
})

const deleteMutation = useMutation({
  mutationFn: usersApi.remove,
  onSuccess: async () => {
    usersApi.clearRolesCache()
    await queryClient.invalidateQueries({ queryKey: adminUserQueryKeys.paginated() })
  },
})

const isSubmitting = computed(
  () =>
    createMutation.isPending.value ||
    editMutation.isPending.value ||
    assignRolesMutation.isPending.value ||
    deleteMutation.isPending.value,
)

const canCreateUser = computed(() => authStore.userCan('create', 'User'))
const canUpdateUser = computed(() => authStore.userCan('update', 'User'))
const canDeleteUser = computed(() => authStore.userCan('delete', 'User'))
const canManageUserActions = computed(() => canUpdateUser.value || canDeleteUser.value)

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function getInitials(name: string) {
  const parts = name.trim().split(' ').filter(Boolean)
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '')
  return initials.join('') || 'U'
}

function openEdit(user: UserTableRow) {
  if (!canUpdateUser.value) return
  selectedUser.value = user
  isEditOpen.value = true
}

function openAssignRoles(user: UserTableRow) {
  if (!canUpdateUser.value) return
  selectedUser.value = user
  isAssignRolesOpen.value = true
}

async function handleDelete(user: UserTableRow) {
  if (!canDeleteUser.value) return
  openConfirm(`¿Querés desactivar al usuario ${user.name}?`, () => {
    void deleteMutation.mutateAsync(user.id)
  })
}

function getRowItems(user: UserTableRow) {
  const mainActions = canUpdateUser.value
    ? [
        { label: 'Editar', onSelect: () => openEdit(user) },
        { label: 'Roles', onSelect: () => openAssignRoles(user) },
      ]
    : []

  const destructiveActions = canDeleteUser.value
    ? [
        {
          label: 'Eliminar',
          color: 'error' as const,
          onSelect: () => handleDelete(user),
        },
      ]
    : []

  return [mainActions, destructiveActions].filter((section) => section.length > 0)
}
</script>

<template>
  <div class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
    <UserUpsertSlideover
      v-model:open="isCreateOpen"
      mode="create"
      :loading="isSubmitting"
      @create="createMutation.mutate"
    />

    <UserUpsertSlideover
      v-model:open="isEditOpen"
      mode="edit"
      :user="selectedUser"
      :loading="isSubmitting"
      @edit="
        (payload) =>
          selectedUser && editMutation.mutate({ userId: selectedUser.id, name: payload.name })
      "
    />

    <UserAssignRolesSlideover
      v-model:open="isAssignRolesOpen"
      :user="selectedUser"
      :loading="isSubmitting"
      @save="assignRolesMutation.mutate"
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
        <div>
          <h2 class="text-2xl font-semibold">Gestión de usuarios</h2>
          <p class="text-sm text-muted">Administrá los usuarios de tu organización</p>
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
          search-placeholder="Buscar por email..."
          :show-add-button="canCreateUser"
          add-button-text="Crear Usuario"
          add-button-icon="i-lucide-user-plus"
          empty="No se encontraron usuarios"
          @add="isCreateOpen = true"
          @refresh="refresh"
        >
          <template #name-header="{ column }">
            <SortableHeader :column="column" label="Usuario" />
          </template>

          <template #createdAt-header="{ column }">
            <SortableHeader :column="column" label="Creación" />
          </template>

          <template #name-cell="{ row }">
            <div class="flex items-center gap-3">
              <UAvatar :alt="row.original.name" :text="getInitials(row.original.name)" />
              <div>
                <p class="font-medium">{{ row.original.name }}</p>
                <p class="text-sm text-muted">{{ row.original.email }}</p>
              </div>
            </div>
          </template>

          <template #roles-cell="{ row }">
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="role in row.original.roles"
                :key="role.id"
                color="neutral"
                variant="soft"
                size="sm"
              >
                {{ role.name }}
              </UBadge>
              <span v-if="row.original.roles.length === 0" class="text-sm text-muted"
                >Sin roles</span
              >
            </div>
          </template>

          <template #createdAt-cell="{ row }">
            <span>{{ dateFormatter.format(new Date(row.original.createdAt)) }}</span>
          </template>

          <template #actions-cell="{ row }">
            <UDropdownMenu
              v-if="canManageUserActions"
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
