<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import RowActionsMenu from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { adminTenantMembershipQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { membershipsApi, mapMembershipError } from '../api/memberships.api'
import { useMembershipColumns } from '../composables/useMembershipColumns'
import type { MembershipTableRow } from '../interfaces/membership.types'
import type {
  CreateMembershipFormValues,
  UpdateMembershipFormValues,
} from '../composables/useMembershipForm'
import MembershipUpsertSlideover from '../components/MembershipUpsertSlideover.vue'
import AdminMobileCard from '../../../shared/components/AdminMobileCard.vue'
import { noMatchTitleFor, resolveListErrorMessage } from '../../../shared/utils/list-state.utils'
import { buildMembershipRowActions } from '../utils/membership-actions.utils'
import '../../styles/tenants-visual.css'
import { useTenantSummary } from '@/features/admin/tenants/composables/useTenantSummary'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const route = useRoute()
const queryClient = useQueryClient()
const toast = useToast()
const authStore = useAuthStore()
const { columns } = useMembershipColumns()

const canReadMemberships = computed(() => authStore.userCan('read', 'TenantMembership'))
const canCreateMembership = computed(() => authStore.userCan('create', 'TenantMembership'))
const canUpdateMembership = computed(() => authStore.userCan('update', 'TenantMembership'))
const canDeleteMembership = computed(() => authStore.userCan('delete', 'TenantMembership'))
const tenantId = computed(() => route.params.tenantId as string)
const { tenantName, isLoadingTenantName } = useTenantSummary(tenantId)
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
} = useServerTable<MembershipTableRow>({
  queryKey: () => adminTenantMembershipQueryKeys.list(tenantId.value),
  queryFn: (params) => membershipsApi.getPaginated(tenantId.value, params),
  defaultPageSize: 10,
  persistKey: `admin-tenant-members-${tenantId.value}`,
  defaultSorting: [{ id: 'userName', desc: false }],
})

const membershipsErrorMessage = computed(() =>
  resolveListErrorMessage(error.value, 'No se pudieron cargar los miembros. Reintenta.'),
)

const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const selectedMembership = ref<MembershipTableRow | null>(null)
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
  mutationFn: (payload: CreateMembershipFormValues) =>
    membershipsApi.create(tenantId.value, payload),
  onSuccess: async () => {
    isCreateOpen.value = false
    toast.add({
      title: 'Miembro agregado',
      description: 'El usuario se agregó al tenant correctamente.',
      color: 'success',
    })
    await queryClient.invalidateQueries({
      queryKey: adminTenantMembershipQueryKeys.list(tenantId.value),
    })
    await queryClient.invalidateQueries({
      queryKey: ['admin', 'tenant-memberships', tenantId.value, 'eligible'],
    })
  },
  onError: (error: AxiosError<{ message?: string }>) => {
    const message = mapMembershipError(error.response?.data?.message || error.message || '')
    toast.add({ title: 'Error al agregar miembro', description: message, color: 'error' })
  },
})

const editMutation = useMutation({
  mutationFn: (payload: { membershipId: string; data: UpdateMembershipFormValues }) =>
    membershipsApi.updateRole(tenantId.value, payload.membershipId, payload.data),
  onSuccess: async () => {
    isEditOpen.value = false
    selectedMembership.value = null
    toast.add({
      title: 'Rol actualizado',
      description: 'El rol del miembro se actualizó correctamente.',
      color: 'success',
    })
    await queryClient.invalidateQueries({
      queryKey: adminTenantMembershipQueryKeys.list(tenantId.value),
    })
  },
  onError: (error: AxiosError<{ message?: string }>) => {
    const message = mapMembershipError(error.response?.data?.message || error.message || '')
    toast.add({ title: 'Error al actualizar rol', description: message, color: 'error' })
  },
})

const removeMutation = useMutation({
  mutationFn: (membershipId: string) => membershipsApi.remove(tenantId.value, membershipId),
  onSuccess: async () => {
    toast.add({
      title: 'Miembro eliminado',
      description: 'El usuario se eliminó del tenant correctamente.',
      color: 'success',
    })
    await queryClient.invalidateQueries({
      queryKey: adminTenantMembershipQueryKeys.list(tenantId.value),
    })
  },
  onError: (error: AxiosError<{ message?: string }>) => {
    const message = mapMembershipError(error.response?.data?.message || error.message || '')
    toast.add({ title: 'Error al eliminar miembro', description: message, color: 'error' })
  },
})

function handleCreate(payload: CreateMembershipFormValues) {
  createMutation.mutate(payload)
}

function handleEdit(data: UpdateMembershipFormValues) {
  if (!selectedMembership.value) return
  editMutation.mutate({
    membershipId: selectedMembership.value.id,
    data,
  })
}

function openEdit(membership: MembershipTableRow) {
  // Defense-in-depth: the row click bypasses the ⋮ menu gating, so guard here
  // so a click without update permission is a no-op (no slideover, no nav).
  if (!canUpdateMembership.value) return
  selectedMembership.value = membership
  isEditOpen.value = true
}

function openRemoveConfirm(membership: MembershipTableRow) {
  openConfirm(
    `¿Estás seguro de que deseas eliminar a ${membership.userEmail} de este tenant?`,
    () => removeMutation.mutate(membership.id),
  )
}

const rowActions = computed(() =>
  buildMembershipRowActions({
    canUpdate: canUpdateMembership.value,
    canDelete: canDeleteMembership.value,
  }),
)

function handleRowAction(key: string, membership: MembershipTableRow) {
  if (key === 'edit') openEdit(membership)
  else if (key === 'remove') openRemoveConfirm(membership)
}

const rowOpen = computed(() => (canUpdateMembership.value ? openEdit : undefined))

const searchTerm = computed(() => globalFilter.value.trim())
const noMatchTitle = computed(() => noMatchTitleFor(searchTerm.value))
const emptyState = computed(() => ({
  title: 'Aún no hay miembros',
  description: 'Aquí aparecerán los usuarios que agregues a esta sucursal.',
  ...(canCreateMembership.value
    ? { actionLabel: 'Agregar miembro', actionIcon: 'i-lucide-user-plus' }
    : {}),
}))

function clearFilters() {
  globalFilter.value = ''
}
</script>

<template>
  <div class="hf-theme hf-ui tenants-visual flex w-full min-w-0 flex-col gap-6 md:px-6 lg:px-10">
    <!-- The subtitle names the branch and shows a skeleton while the name loads. -->
    <header class="hf-page-header">
      <h1 class="hf-page-title">Miembros</h1>
      <div v-if="isLoadingTenantName" data-testid="tenant-members-subtitle-loading" class="mt-1">
        <USkeleton class="h-4 w-48" />
      </div>
      <p v-else class="hf-page-subtitle">{{ tenantName }}</p>
    </header>

    <UCard
      :ui="{ body: 'p-0 sm:p-0' }"
      class="hf-table-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm"
    >
      <EmptyState
        v-if="!canReadMemberships"
        kind="forbidden"
        title="No tienes acceso a los miembros"
        description="Tu rol no permite ver esta sección."
      />

      <div v-else class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4">
        <AppDataTable
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          :columns="columns"
          :data="data"
          :loading="isLoading"
          :fetching="isFetching"
          :error="isError"
          :error-message="membershipsErrorMessage"
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
          search-placeholder="Buscar por email, nombre o rol..."
          empty="No hay miembros en este tenant"
          class="hf-data-table"
          portal-class="hf-theme hf-ui tenants-list-portal"
          pagination-portal-class="hf-theme hf-ui tenants-list-portal"
          :show-add-button="canCreateMembership"
          add-button-text="Agregar miembro"
          add-button-icon="i-lucide-user-plus"
          @add="isCreateOpen = true"
          @empty-action="isCreateOpen = true"
          @clear-filters="clearFilters"
          @refresh="refresh"
        >
          <template #userName-header="{ column }">
            <SortableHeader :column="column" label="Usuario" />
          </template>

          <template #roleName-header="{ column }">
            <SortableHeader :column="column" label="Rol" />
          </template>

          <template #createdAt-header="{ column }">
            <SortableHeader :column="column" label="Ingreso" />
          </template>

          <template #userName-cell="{ row }">
            <div class="flex min-w-0 items-center gap-3">
              <EntityAvatar
                :name="row.original.userName"
                :seed="row.original.userId || row.original.id"
                aria-hidden="true"
              />
              <div class="min-w-0">
                <button
                  v-if="canUpdateMembership"
                  type="button"
                  class="hf-row-primary text-left"
                  data-testid="member-name"
                  @click="openEdit(row.original)"
                >
                  {{ row.original.userName }}
                </button>
                <span v-else class="hf-row-primary" data-testid="member-name">{{
                  row.original.userName
                }}</span>
                <span class="hf-row-secondary">{{ row.original.userEmail }}</span>
              </div>
            </div>
          </template>

          <template #status-cell="{ row }">
            <StatusBadge
              v-if="row.original.userIsActive !== undefined"
              :label="row.original.userIsActive ? 'Activo' : 'Inactivo'"
              :tone="row.original.userIsActive ? 'success' : 'neutral'"
            />
            <span v-else class="text-sm text-muted">—</span>
          </template>

          <template #roleName-cell="{ row }">
            <span class="text-sm font-medium">{{ row.original.roleName }}</span>
          </template>

          <template #createdAt-cell="{ row }">
            <span class="text-sm text-muted">{{ formatShortDateTime(row.original.createdAt) }}</span>
          </template>

          <template #actions-header><span class="sr-only">Acciones</span></template>

          <template #actions-cell="{ row }">
            <RowActionsMenu
              :actions="rowActions"
              :row-label="row.original.userName"
              portal-class="tenants-list-portal"
              @select="handleRowAction($event, row.original)"
            />
          </template>

          <template #mobile-card="{ row }">
            <AdminMobileCard
              :item="row"
              :label="row.userName"
              :actions="rowActions"
              :openable="canUpdateMembership"
              portal-class="tenants-list-portal"
              test-id="member-card"
              @open="openEdit"
              @action="handleRowAction"
            >
              <template #leading>
                <EntityAvatar
                  :name="row.userName"
                  :seed="row.userId || row.id"
                  aria-hidden="true"
                />
              </template>
              <template #secondary>{{ row.userEmail }}</template>
              <template v-if="row.userIsActive !== undefined" #badges>
                <StatusBadge
                  :label="row.userIsActive ? 'Activo' : 'Inactivo'"
                  :tone="row.userIsActive ? 'success' : 'neutral'"
                />
              </template>
              <template #footer>
                <span class="min-w-0 truncate font-medium">{{ row.roleName }}</span>
                <span class="shrink-0">{{ formatShortDateTime(row.createdAt) }}</span>
              </template>
            </AdminMobileCard>
          </template>
        </AppDataTable>
      </div>
    </UCard>

    <MembershipUpsertSlideover
      v-model:open="isCreateOpen"
      mode="create"
      :tenant-id="tenantId"
      :loading="createMutation.isPending.value"
      @create="handleCreate"
    />

    <MembershipUpsertSlideover
      v-model:open="isEditOpen"
      mode="edit"
      :tenant-id="tenantId"
      :membership="selectedMembership"
      :loading="editMutation.isPending.value"
      @edit="handleEdit"
    />

    <ConfirmModal
      v-model:open="confirmState.open"
      title="Eliminar miembro"
      :description="confirmState.description"
      confirm-label="Eliminar"
      confirm-color="error"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay tenants-form-portal' }"
      @confirm="handleConfirm"
    />
  </div>
</template>
