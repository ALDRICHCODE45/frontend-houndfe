<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
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
import AdminPageHeader from '@/features/admin/shared/components/AdminPageHeader.vue'
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
const dateFormatter = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function getInitials(name?: string | null) {
  if (!name) return 'U'
  const parts = name.trim().split(' ').filter(Boolean)
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '')
  return initials.join('') || 'U'
}

const tenantId = computed(() => route.params.tenantId as string)
const { tenantName, isLoadingTenantName } = useTenantSummary(tenantId)
const headerDescription = computed(
  () => `Administrá los usuarios que pertenecen a ${tenantName.value} y sus roles.`,
)

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
} = useServerTable<MembershipTableRow>({
  queryKey: () => adminTenantMembershipQueryKeys.list(tenantId.value),
  queryFn: (params) => membershipsApi.getPaginated(tenantId.value, params),
  defaultPageSize: 10,
  persistKey: `admin-tenant-members-${tenantId.value}`,
  defaultSorting: [{ id: 'userEmail', desc: false }],
  defaultPinning: { left: [], right: ['actions'] },
})

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
  selectedMembership.value = membership
  isEditOpen.value = true
}

function openRemoveConfirm(membership: MembershipTableRow) {
  openConfirm(
    `¿Estás seguro de que deseas eliminar a ${membership.userEmail} de este tenant?`,
    () => removeMutation.mutate(membership.id),
  )
}

function getRowItems(membership: MembershipTableRow) {
  const items: Array<{ label: string; color?: 'error'; onSelect: () => void }> = []
  if (canUpdateMembership.value) {
    items.push({ label: 'Editar rol', onSelect: () => openEdit(membership) })
  }
  if (canDeleteMembership.value) {
    items.push({
      label: 'Eliminar miembro',
      color: 'error' as const,
      onSelect: () => openRemoveConfirm(membership),
    })
  }
  return items.length > 0 ? [items] : []
}
</script>

<template>
  <div class="flex flex-col gap-6 px-4 sm:px-6 lg:px-10">
    <UCard :ui="{ body: 'p-0 sm:p-0' }">
      <template #header>
        <AdminPageHeader
          title="Miembros del tenant"
          :description="headerDescription"
          :loading="isLoadingTenantName"
        />
      </template>

      <div v-if="!canReadMemberships" class="px-6 py-10 text-center text-sm text-muted">
        No tenés acceso a esta sección.
      </div>

      <div v-else class="px-6 py-5">
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
          search-placeholder="Buscar por email, nombre o rol..."
          empty="No hay miembros en este tenant"
          :show-add-button="canCreateMembership"
          add-button-text="Agregar miembro"
          add-button-icon="i-lucide-user-plus"
          @add="isCreateOpen = true"
          @refresh="refresh"
        >
          <template #userName-header="{ column }">
            <SortableHeader :column="column" label="Usuario" />
          </template>

          <template #roleName-header="{ column }">
            <SortableHeader :column="column" label="Rol" />
          </template>

          <template #createdAt-header="{ column }">
            <SortableHeader :column="column" label="Fecha de ingreso" />
          </template>

          <template #userName-cell="{ row }">
            <div class="flex items-center gap-3">
              <UAvatar :alt="row.original.userName" :text="getInitials(row.original.userName)" />
              <div>
                <p class="font-medium">{{ row.original.userName }}</p>
                <p class="text-sm text-muted">{{ row.original.userEmail }}</p>
              </div>
            </div>
          </template>

          <template #roleName-cell="{ row }">
            <AppBadge tone="info" :label="row.original.roleName" />
          </template>

          <template #createdAt-cell="{ row }">
            <span>{{ row.original.createdAt ? dateFormatter.format(new Date(row.original.createdAt)) : '-' }}</span>
          </template>

          <template #actions-cell="{ row }">
            <UDropdownMenu
              v-if="getRowItems(row.original).length > 0"
              :items="getRowItems(row.original)"
              :content="{ align: 'end' }"
            >
              <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" class="size-7" />
            </UDropdownMenu>
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
      title="Confirmar eliminación"
      :description="confirmState.description"
      confirm-text="Eliminar"
      cancel-text="Cancelar"
      @confirm="handleConfirm"
    />
  </div>
</template>
