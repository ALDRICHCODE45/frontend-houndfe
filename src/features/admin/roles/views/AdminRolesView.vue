<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { adminRoleQueryKeys, usersQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { rolesApi } from '../api/roles.api'
import { useRoleColumns } from '../composables/useRoleColumns'
import type { RoleFormValues } from '../composables/useRoleForm'
import type { RoleTableRow } from '../interfaces/role.types'
import RoleUpsertSlideover from '../components/RoleUpsertSlideover.vue'
import RolePermissionsSlideover from '../components/RolePermissionsSlideover.vue'
import AdminMobileCard from '../../shared/components/AdminMobileCard.vue'
import { noMatchTitleFor, resolveListErrorMessage } from '../../shared/utils/list-state.utils'
import '../styles/roles-visual.css'

const queryClient = useQueryClient()
const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)
const { columns } = useRoleColumns()

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
})

const rolesErrorMessage = computed(() =>
  resolveListErrorMessage(error.value, 'No se pudieron cargar los roles. Reintenta.'),
)

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
    await queryClient.invalidateQueries({ queryKey: adminRoleQueryKeys.paginated(tenantId.value) })
  },
})

const editMutation = useMutation({
  mutationFn: (payload: { roleId: string; values: RoleFormValues }) =>
    rolesApi.update(payload.roleId, payload.values),
  onSuccess: async () => {
    isEditOpen.value = false
    selectedRole.value = null
    await queryClient.invalidateQueries({ queryKey: adminRoleQueryKeys.paginated(tenantId.value) })
  },
})

const deleteMutation = useMutation({
  mutationFn: rolesApi.remove,
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: adminRoleQueryKeys.paginated(tenantId.value) })
  },
})

const permissionsMutation = useMutation({
  mutationFn: (payload: { roleId: string; permissionIds: string[] }) =>
    rolesApi.assignPermissions(payload.roleId, { permissionIds: payload.permissionIds }),
  onSuccess: async () => {
    isPermissionsOpen.value = false
    selectedRole.value = null
    await queryClient.invalidateQueries({ queryKey: adminRoleQueryKeys.paginated(tenantId.value) })
    // Role permission changes alter who is an assignable driver (ADR-5) and who
    // is an assignable notification recipient. Invalidate both user slots so the
    // delivery-route DriverPicker and RecipientSelect pick up the new permissions
    // immediately (no page refresh needed).
    await queryClient.invalidateQueries({ queryKey: usersQueryKeys.assignableDrivers() })
    await queryClient.invalidateQueries({ queryKey: usersQueryKeys.assignable() })
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

  openConfirm(`¿Quieres eliminar el rol ${role.name}?`, () => {
    void deleteMutation.mutateAsync(role.id)
  })
}

// Defensive UX: the destructive entry is hidden for system roles. The
// window.alert block in handleDelete stays as the last line of defense, but
// the menu no longer advertises an action the user can never perform.
function actionsFor(role: RoleTableRow): RowAction[] {
  return [
    ...(canUpdateRole.value
      ? [
          { key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' },
          { key: 'permissions', label: 'Permisos', icon: 'i-lucide-shield-check' },
        ]
      : []),
    ...(canDeleteRole.value && !role.isSystem
      ? [{ key: 'delete', label: 'Eliminar…', icon: 'i-lucide-trash-2', destructive: true }]
      : []),
  ]
}

function handleRowAction(key: string, role: RoleTableRow) {
  if (key === 'edit') openEdit(role)
  else if (key === 'permissions') openPermissions(role)
  else if (key === 'delete') void handleDelete(role)
}

const rowOpen = computed(() => (canUpdateRole.value ? openEdit : undefined))

const searchTerm = computed(() => globalFilter.value.trim())
const noMatchTitle = computed(() => noMatchTitleFor(searchTerm.value))
const emptyState = computed(() => ({
  title: 'Aún no hay roles',
  description: 'Aquí aparecerán los roles que crees.',
  ...(canCreateRole.value ? { actionLabel: 'Crear rol', actionIcon: 'i-lucide-shield-plus' } : {}),
}))

function clearFilters() {
  globalFilter.value = ''
}
</script>

<template>
  <div class="hf-theme hf-ui roles-visual flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
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
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay roles-form-portal' }"
      @update:open="confirmState.open = $event"
      @confirm="handleConfirm"
    />

    <header class="hf-page-header">
      <h1 class="hf-page-title">Roles</h1>
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
          :error-message="rolesErrorMessage"
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
          search-placeholder="Buscar rol..."
          :show-add-button="canCreateRole"
          add-button-text="Crear rol"
          add-button-icon="i-lucide-shield-plus"
          empty="No se encontraron roles"
          class="hf-data-table"
          portal-class="hf-theme hf-ui roles-list-portal"
          pagination-portal-class="hf-theme hf-ui roles-list-portal"
          @add="isCreateOpen = true"
          @empty-action="isCreateOpen = true"
          @clear-filters="clearFilters"
          @refresh="refresh"
        >
          <template #name-header="{ column }">
            <SortableHeader :column="column" label="Rol" />
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

          <template #name-cell="{ row }">
            <button
              v-if="canUpdateRole"
              type="button"
              class="hf-row-primary text-left"
              data-testid="role-name"
              @click="openEdit(row.original)"
            >
              {{ row.original.name }}
            </button>
            <span v-else class="hf-row-primary" data-testid="role-name">{{
              row.original.name
            }}</span>
            <span v-if="row.original.description" class="hf-row-secondary">{{
              row.original.description
            }}</span>
          </template>

          <template #type-cell="{ row }">
            <StatusBadge
              :label="row.original.isSystem ? 'Sistema' : 'Personalizado'"
              :tone="row.original.isSystem ? 'info' : 'neutral'"
              aria-prefix="Tipo:"
            />
          </template>

          <template #permissionCount-cell="{ row }">
            <span class="hf-figure">{{ row.original.permissionCount }}</span>
          </template>

          <template #userCount-cell="{ row }">
            <span class="hf-figure">{{ row.original.userCount }}</span>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-sm text-muted">{{ formatShortDateTime(row.original.createdAt) }}</span>
          </template>

          <template #actions-header><span class="sr-only">Acciones</span></template>

          <template #actions-cell="{ row }">
            <RowActionsMenu
              :actions="actionsFor(row.original)"
              :row-label="row.original.name"
              portal-class="roles-list-portal"
              @select="handleRowAction($event, row.original)"
            />
          </template>

          <template #mobile-card="{ row }">
            <AdminMobileCard
              :item="row"
              :label="row.name"
              :actions="actionsFor(row)"
              :openable="canUpdateRole"
              portal-class="roles-list-portal"
              test-id="role-card"
              @open="openEdit"
              @action="handleRowAction"
            >
              <template v-if="row.description" #secondary>{{ row.description }}</template>
              <template #badges>
                <StatusBadge
                  :label="row.isSystem ? 'Sistema' : 'Personalizado'"
                  :tone="row.isSystem ? 'info' : 'neutral'"
                  aria-prefix="Tipo:"
                />
              </template>
              <template #footer>
                <span class="hf-figure">{{ row.permissionCount }} permisos · {{ row.userCount }} usuarios</span>
                <span>{{ formatShortDateTime(row.createdAt) }}</span>
              </template>
            </AdminMobileCard>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
