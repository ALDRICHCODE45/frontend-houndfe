<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { adminTenantMembershipQueryKeys } from '@/core/shared/constants/query-keys'
import { membershipsApi, mapMembershipError } from '../api/memberships.api'
import { useMembershipColumns } from '../composables/useMembershipColumns'
import type { MembershipTableRow } from '../interfaces/membership.types'
import type {
  CreateMembershipFormValues,
  UpdateMembershipFormValues,
} from '../composables/useMembershipForm'
import MembershipUpsertSlideover from '../components/MembershipUpsertSlideover.vue'

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
const { columns } = useMembershipColumns()

const tenantId = computed(() => route.params.tenantId as string)

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
      queryKey: ['admin', 'tenants', tenantId.value, 'memberships'],
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
      queryKey: ['admin', 'tenants', tenantId.value, 'memberships'],
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
      queryKey: ['admin', 'tenants', tenantId.value, 'memberships'],
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
  return [
    [
      { label: 'Editar rol', onSelect: () => openEdit(membership) },
      { label: 'Eliminar miembro', color: 'error' as const, onSelect: () => openRemoveConfirm(membership) },
    ],
  ]
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-gray-900">Miembros del Tenant</h1>
        <p class="mt-1 text-sm text-gray-500">
          Administra los usuarios que pertenecen a este tenant y sus roles.
        </p>
      </div>
      <button
        type="button"
        class="rounded-md bg-primary-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        @click="isCreateOpen = true"
      >
        Agregar Miembro
      </button>
    </div>

    <AppDataTable
      :data="data"
      :columns="columns"
      :pagination="pagination"
      :sorting="sorting"
      :global-filter="globalFilter"
      :column-pinning="columnPinning"
      :column-visibility="columnVisibility"
      :total-count="totalCount"
      :page-count="pageCount"
      :is-loading="isLoading"
      :is-fetching="isFetching"
      :page-size-options="pageSizeOptions"
      :showing-from="showingFrom"
      :showing-to="showingTo"
      :get-row-items="getRowItems"
      search-placeholder="Buscar por email, nombre o rol..."
      empty-title="No hay miembros"
      empty-description="No se encontraron miembros en este tenant. Agrega el primer miembro."
    >
      <template #userEmail-header="{ column }">
        <SortableHeader :column="column" label="Email" />
      </template>

      <template #userName-header="{ column }">
        <SortableHeader :column="column" label="Nombre" />
      </template>

      <template #roleName-header="{ column }">
        <SortableHeader :column="column" label="Rol" />
      </template>

      <template #id-header="{ column }">
        <SortableHeader :column="column" label="Fecha de ingreso" />
      </template>
    </AppDataTable>

    <MembershipUpsertSlideover
      v-model:open="isCreateOpen"
      mode="create"
      :is-loading="createMutation.isPending.value"
      @create="handleCreate"
    />

    <MembershipUpsertSlideover
      v-model:open="isEditOpen"
      mode="edit"
      :membership="selectedMembership"
      :is-loading="editMutation.isPending.value"
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
