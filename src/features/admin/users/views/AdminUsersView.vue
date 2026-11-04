<script setup lang="ts">
import { computed, ref, watch, onScopeDispose } from 'vue'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { adminUserQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { usersApi } from '../api/users.api'
import { useUserColumns } from '../composables/useUserColumns'
import type { UserTableRow, UpdateUserRequest } from '../interfaces/user.types'
import type { UserWithRolesResponse } from '../../shared/interfaces/rbac.types'
import { editUserSchema, sameRoleIds } from '../composables/useUserForm'
import UserUpsertSlideover from '../components/UserUpsertSlideover.vue'
import AdminMobileCard from '../../shared/components/AdminMobileCard.vue'
import { noMatchTitleFor } from '../../shared/utils/list-state.utils'
import SellerSalesReportDrawer from '../seller-report/components/SellerSalesReportDrawer.vue'
import '../styles/users-visual.css'

const queryClient = useQueryClient()
const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)
const { columns } = useUserColumns()

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
} = useServerTable<UserTableRow>({
  queryKey: () => adminUserQueryKeys.paginated(tenantId.value),
  queryFn: (params) => usersApi.getPaginated(params),
  defaultPageSize: 10,
  persistKey: 'admin-users',
  defaultSorting: [{ id: 'name', desc: false }],
})

const usersErrorMessage = 'No se pudieron cargar los usuarios'

const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const selectedUser = ref<UserTableRow | null>(null)
const editSession = ref(0)
/** Seller sales report drawer: the selected row and its mount fence. */
const isReportOpen = ref(false)
const reportSeller = ref<UserTableRow | null>(null)
/** Tenant the open report belongs to: a tenant switch must not keep it on screen. */
const reportTenantId = ref<string | null>(null)
const reportSession = ref(0)
const editDetail = ref<UserWithRolesResponse | null>(null)
const detailLoading = ref(false)
const editError = ref('')
const saveNotice = ref('')
let disposed = false
onScopeDispose(() => {
  disposed = true
  editSession.value++
})

function editErrorMessage(error: unknown) {
  const err = error as { response?: { data?: { message?: unknown } }; message?: string }
  const message = err?.response?.data?.message
  if (typeof message === 'string' && message.trim()) return message
  if (Array.isArray(message)) {
    const messages = message.filter((item): item is string => typeof item === 'string')
    if (messages.length) return messages.join('. ')
  }
  return err?.message || 'No se pudo guardar el usuario. Reintenta.'
}

function isCurrentEdit(session: number) {
  return !disposed && isEditOpen.value && editSession.value === session
}

async function loadEditDetail() {
  const userId = selectedUser.value?.id
  const tenant = tenantId.value
  const session = editSession.value
  if (!userId || !tenant || !isEditOpen.value || !canUpdateUser.value || detailLoading.value) return
  detailLoading.value = true
  editError.value = ''
  try {
    const detail = await usersApi.getById(userId)
    if (!isCurrentEdit(session)) return
    if (detail.user.id !== userId) throw new Error('El usuario recibido no coincide. Reintenta.')
    editDetail.value = detail
    queryClient.setQueryData(adminUserQueryKeys.detail(tenant, userId), detail)
  } catch (error) {
    if (isCurrentEdit(session)) editError.value = editErrorMessage(error)
  } finally {
    if (isCurrentEdit(session)) detailLoading.value = false
  }
}
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
    await queryClient.invalidateQueries({ queryKey: adminUserQueryKeys.paginated(tenantId.value) })
  },
})

type EditSubmission = {
  userId: string
  tenant: string
  session: number
  data: UpdateUserRequest
}

const editMutation = useMutation({
  mutationFn: (submission: EditSubmission) => {
    if (
      !isCurrentEdit(submission.session) ||
      tenantId.value !== submission.tenant ||
      !canUpdateUser.value ||
      (submission.data.roleIds && !authStore.userCan('update', 'TenantMembership'))
    ) {
      throw new Error('El contexto o los permisos cambiaron. Vuelve a abrir el usuario.')
    }
    return usersApi.update(submission.userId, submission.data)
  },
  onSuccess: async (_result, submission) => {
    const current = isCurrentEdit(submission.session)
    if (current) {
      isEditOpen.value = false
      selectedUser.value = null
    }
    const refreshSession = editSession.value
    const sameTenant = tenantId.value === submission.tenant
    // A committed write stays successful even if one of these independent refreshes fails.
    const results = await Promise.allSettled([
      queryClient.invalidateQueries(
        {
          queryKey: adminUserQueryKeys.paginated(submission.tenant),
          refetchType: sameTenant ? 'active' : 'none',
        },
        { throwOnError: true },
      ),
      queryClient.invalidateQueries({
        queryKey: adminUserQueryKeys.detail(submission.tenant, submission.userId),
        refetchType: 'none',
      }),
      (async () => {
        if (!sameTenant || disposed || !canUpdateUser.value) return
        const detail = await usersApi.getById(submission.userId)
        if (detail.user.id !== submission.userId)
          throw new Error('El usuario recibido no coincide.')
        if (!disposed && editSession.value === refreshSession) {
          queryClient.setQueryData(
            adminUserQueryKeys.detail(submission.tenant, submission.userId),
            detail,
          )
        }
      })(),
    ])
    if (
      current &&
      !disposed &&
      editSession.value === refreshSession &&
      results.some((result) => result.status === 'rejected')
    ) {
      saveNotice.value =
        'Usuario guardado. No se pudieron actualizar todos los datos; vuelve a cargarlos.'
    }
  },
  onError: (error, submission) => {
    if (isCurrentEdit(submission.session)) editError.value = editErrorMessage(error)
  },
})

function handleEdit(payload: UpdateUserRequest, session: number) {
  const detail = editDetail.value
  if (
    !isCurrentEdit(session) ||
    !canUpdateUser.value ||
    detailLoading.value ||
    !detail ||
    detail.user.id !== selectedUser.value?.id ||
    editMutation.isPending.value
  )
    return
  const parsed = editUserSchema.safeParse(payload)
  if (!parsed.success) {
    editError.value = parsed.error.issues.map((issue) => issue.message).join('. ')
    return
  }
  const data = parsed.data
  if (data.roleIds) {
    if (!authStore.userCan('update', 'TenantMembership') || !authStore.userCan('read', 'Role')) {
      editError.value = 'No tienes permisos para modificar los roles.'
      return
    }
    if (
      sameRoleIds(
        data.roleIds,
        detail.roles.map((role) => role.id),
      )
    )
      delete data.roleIds
  }
  editError.value = ''
  editMutation.mutate({ userId: detail.user.id, tenant: tenantId.value, session, data })
}

const deleteMutation = useMutation({
  mutationFn: usersApi.remove,
  onSuccess: async () => {
    await queryClient.invalidateQueries({ queryKey: adminUserQueryKeys.paginated(tenantId.value) })
  },
})

const isSubmitting = computed(
  () =>
    createMutation.isPending.value ||
    editMutation.isPending.value ||
    deleteMutation.isPending.value,
)

const canCreateUser = computed(() => authStore.userCan('create', 'User'))
const canUpdateUser = computed(() => authStore.userCan('update', 'User'))
const canDeleteUser = computed(() => authStore.userCan('delete', 'User'))

/**
 * The seller report is a read-only cross-domain view: it needs the user's own
 * read permission PLUS both domains it reports on. It is deliberately NOT tied
 * to update/delete, so a read-only operator can consult it, and an inactive
 * seller is still reportable (their confirmed sales happened).
 */
const canReadSalesReport = computed(
  () =>
    authStore.userCan('read', 'User') &&
    authStore.userCan('read', 'Sale') &&
    authStore.userCan('read', 'Analytics'),
)

// Synchronous revision changes fence cancel/reopen and A→B→A before promises settle.
watch(
  [isEditOpen, () => selectedUser.value?.id, tenantId, canUpdateUser],
  () => {
    editSession.value++
    editDetail.value = null
    detailLoading.value = false
    editError.value = ''
    saveNotice.value = ''
    void loadEditDetail()
  },
  { flush: 'sync' },
)

// Every open/close/seller change remounts the report drawer, so its query, its
// window and its print state never leak from one seller to another.
watch(
  [isReportOpen, () => reportSeller.value?.id, reportTenantId],
  () => {
    reportSession.value++
  },
  { flush: 'sync' },
)

// The report is only readable while the identity that opened it still holds the
// read authority for the SAME tenant: a revoke or a tenant switch closes it (and
// unmounts its query) instead of leaving another tenant's numbers on screen.
watch(
  [canReadSalesReport, tenantId],
  () => {
    if (!isReportOpen.value) return
    if (
      !canReadSalesReport.value ||
      !reportSeller.value ||
      tenantId.value !== reportTenantId.value
    ) {
      closeReport()
    }
  },
  { flush: 'sync' },
)

function openEdit(user: UserTableRow) {
  if (!canUpdateUser.value) return
  selectedUser.value = user
  isEditOpen.value = true
}

function openReport(user: UserTableRow) {
  if (!canReadSalesReport.value) return
  reportTenantId.value = tenantId.value
  reportSeller.value = user
  isReportOpen.value = true
}

function closeReport() {
  isReportOpen.value = false
  reportSeller.value = null
  reportTenantId.value = null
}

async function handleDelete(user: UserTableRow) {
  if (!canDeleteUser.value) return
  openConfirm(`¿Quieres desactivar al usuario ${user.name}?`, () => {
    void deleteMutation.mutateAsync(user.id)
  })
}

// Opening the row already edits, so a menu whose only item would be "Editar"
// is not shown (no ⋮). The destructive entry always goes last.
function actionsFor(): RowAction[] {
  const extras: RowAction[] = [
    ...(canReadSalesReport.value
      ? [{ key: 'report', label: 'Ver reporte de ventas', icon: 'i-lucide-chart-no-axes-column' }]
      : []),
    ...(canDeleteUser.value
      ? [{ key: 'delete', label: 'Eliminar…', icon: 'i-lucide-trash-2', destructive: true }]
      : []),
  ]
  if (extras.length === 0) return []
  return [...(canUpdateUser.value ? [{ key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' }] : []), ...extras]
}

const rowActions = computed(() => actionsFor())

function handleRowAction(key: string, user: UserTableRow) {
  if (key === 'edit') openEdit(user)
  else if (key === 'report') openReport(user)
  else if (key === 'delete') void handleDelete(user)
}

const rowOpen = computed(() => (canUpdateUser.value ? openEdit : undefined))

function rolesLabel(user: UserTableRow) {
  return user.roles.map((role) => role.name).join(', ')
}

const searchTerm = computed(() => globalFilter.value.trim())
const noMatchTitle = computed(() => noMatchTitleFor(searchTerm.value))
const emptyState = computed(() => ({
  title: 'Aún no hay usuarios',
  description: 'Aquí aparecerán los usuarios que crees.',
  ...(canCreateUser.value ? { actionLabel: 'Crear usuario', actionIcon: 'i-lucide-user-plus' } : {}),
}))

function clearFilters() {
  globalFilter.value = ''
}
</script>

<template>
  <div class="hf-theme hf-ui users-visual flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
    <UserUpsertSlideover
      v-model:open="isCreateOpen"
      mode="create"
      :loading="isSubmitting"
      @create="createMutation.mutate"
    />

    <p v-if="saveNotice" role="status" class="users-notice">{{ saveNotice }}</p>

    <UserUpsertSlideover
      :key="editSession"
      v-model:open="isEditOpen"
      mode="edit"
      :user="selectedUser"
      :detail="editDetail"
      :detail-loading="detailLoading"
      :error-message="editError"
      :session="editSession"
      :loading="isSubmitting"
      @edit="handleEdit"
      @retry="loadEditDetail"
    />

    <ConfirmModal
      :open="confirmState.open"
      :description="confirmState.description"
      confirm-label="Eliminar"
      confirm-color="error"
      :loading="deleteMutation.isPending.value"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay users-form-portal' }"
      @update:open="confirmState.open = $event"
      @confirm="handleConfirm"
    />

    <!--
      Seller sales report. `reportSession` fences the instance: a new seller or a
      reopen gets a fresh query/print state, and the drawer is only ever mounted
      for the identity that opened it.
    -->
    <SellerSalesReportDrawer
      :key="reportSession"
      v-model:open="isReportOpen"
      :tenant-id="tenantId"
      :seller="reportSeller"
      :can-read="canReadSalesReport"
    />

    <header class="hf-page-header">
      <h1 class="hf-page-title">Usuarios</h1>
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
          :error-message="usersErrorMessage"
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
          search-placeholder="Buscar por email..."
          :show-add-button="canCreateUser"
          add-button-text="Crear usuario"
          add-button-icon="i-lucide-user-plus"
          empty="No se encontraron usuarios"
          class="hf-data-table"
          portal-class="hf-theme hf-ui users-list-portal"
          pagination-portal-class="hf-theme hf-ui users-list-portal"
          @add="isCreateOpen = true"
          @empty-action="isCreateOpen = true"
          @clear-filters="clearFilters"
          @refresh="refresh"
        >
          <template #name-header="{ column }">
            <SortableHeader :column="column" label="Usuario" />
          </template>

          <template #createdAt-header="{ column }">
            <SortableHeader :column="column" label="Creación" />
          </template>

          <template #name-cell="{ row }">
            <div class="flex min-w-0 items-center gap-3">
              <EntityAvatar
                :name="row.original.name"
                aria-hidden="true"
              />
              <div class="min-w-0">
                <button
                  v-if="canUpdateUser"
                  type="button"
                  class="hf-row-primary text-left"
                  data-testid="user-name"
                  @click="openEdit(row.original)"
                >
                  {{ row.original.name }}
                </button>
                <span v-else class="hf-row-primary" data-testid="user-name">{{
                  row.original.name
                }}</span>
                <span class="hf-row-secondary">{{ row.original.email }}</span>
              </div>
            </div>
          </template>

          <template #status-cell="{ row }">
            <StatusBadge
              :label="row.original.isActive ? 'Activo' : 'Inactivo'"
              :tone="row.original.isActive ? 'success' : 'neutral'"
            />
          </template>

          <template #roles-cell="{ row }">
            <span
              v-if="row.original.roles.length"
              class="block max-w-64 truncate text-sm"
              :title="rolesLabel(row.original)"
              >{{ rolesLabel(row.original) }}</span
            >
            <span v-else class="text-sm text-muted">Sin roles</span>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-sm text-muted">{{ formatShortDateTime(row.original.createdAt) }}</span>
          </template>

          <template #actions-header><span class="sr-only">Acciones</span></template>

          <template #actions-cell="{ row }">
            <RowActionsMenu
              :actions="rowActions"
              :row-label="row.original.name"
              portal-class="users-list-portal"
              @select="handleRowAction($event, row.original)"
            />
          </template>

          <template #mobile-card="{ row }">
            <AdminMobileCard
              :item="row"
              :label="row.name"
              :actions="rowActions"
              :openable="canUpdateUser"
              portal-class="users-list-portal"
              test-id="user-card"
              @open="openEdit"
              @action="handleRowAction"
            >
              <template #leading>
                <EntityAvatar :name="row.name" aria-hidden="true" />
              </template>
              <template #secondary>{{ row.email }}</template>
              <template #badges>
                <StatusBadge
                  :label="row.isActive ? 'Activo' : 'Inactivo'"
                  :tone="row.isActive ? 'success' : 'neutral'"
                />
              </template>
              <template #footer>
                <span class="min-w-0 truncate font-medium">{{
                  row.roles.length ? rolesLabel(row) : 'Sin roles'
                }}</span>
                <span class="shrink-0">{{ formatShortDateTime(row.createdAt) }}</span>
              </template>
            </AdminMobileCard>
          </template>
        </AppDataTable>
      </div>
    </UCard>
  </div>
</template>
