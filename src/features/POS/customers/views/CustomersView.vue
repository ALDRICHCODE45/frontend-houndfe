<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { AppDataTable, SortableHeader, SelectColumn } from '@/core/shared/components/DataTable'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { customerQueryKeys, productQueryKeys } from '@/core/shared/constants/query-keys'
import type { BulkAction } from '@/core/shared/types/table.types'
import TableHeaderDescription from '@/core/shared/components/DataTable/TableHeaderDescription.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import type { DomainApiError } from '@/core/shared/utils/error.utils'
import { productApi } from '@/features/POS/products/api/product.api'
import { customerApi } from '../api/customer.api'
import CustomerUpsertSlideover from '../components/CustomerUpsertSlideover.vue'
import { useCustomerColumns } from '../composables/useCustomerColumns'
import type {
  CreateCustomerPayload,
  Customer,
  CustomerDetail,
  UpdateCustomerPayload,
} from '../interfaces/customer.types'

// TODO: implement customer permissions
// const canCreateCustomer = computed(() => authStore.userCan('create', 'Customer'))
// const canUpdateCustomer = computed(() => authStore.userCan('update', 'Customer'))
// const canDeleteCustomer = computed(() => authStore.userCan('delete', 'Customer'))

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const queryClient = useQueryClient()
const toast = useToast()
const { columns } = useCustomerColumns()

const {
  pagination,
  sorting,
  globalFilter,
  rowSelection,
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
} = useServerTable<Customer>({
  queryKey: customerQueryKeys.paginated(),
  queryFn: (params) => customerApi.getPaginated(params),
  defaultPageSize: 10,
  persistKey: 'pos-customers',
  defaultSorting: [{ id: 'fullName', desc: false }],
  defaultPinning: { left: [], right: ['actions'] },
})

// Reuse globalPriceLists from products endpoint (same endpoint)
const { data: globalPriceLists = [] } = useQuery({
  queryKey: productQueryKeys.globalPriceLists(),
  queryFn: productApi.getGlobalPriceLists,
  refetchOnWindowFocus: false,
})

const isCreateOpen = ref(false)
const isEditOpen = ref(false)
const selectedCustomer = ref<CustomerDetail | null>(null)
const selectedCustomerId = ref<string | null>(null)
const formErrors = ref<Partial<Record<string, string>>>({})

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

function clearFormContext() {
  selectedCustomer.value = null
  selectedCustomerId.value = null
  formErrors.value = {}
}

function mapDomainError(error: AxiosError<DomainApiError>): {
  message: string
  fields: Partial<Record<string, string>>
} {
  const response = error.response?.data
  const fallback = 'No pudimos guardar el cliente. Reintentá en unos segundos.'

  if (!response) {
    return { message: fallback, fields: {} }
  }

  const message = response.message ?? fallback
  const fields: Partial<Record<string, string>> = {}
  const normalized = (message ?? '').toLowerCase()

  if (normalized.includes('email')) {
    fields.email = 'Ya existe un cliente con ese email.'
  }

  if (normalized.includes('rfc')) {
    fields.rfc = 'Ya existe un cliente con ese RFC.'
  }

  return { message, fields }
}

const createMutation = useMutation({
  mutationFn: (payload: CreateCustomerPayload) => customerApi.create(payload),
  onSuccess: async () => {
    isCreateOpen.value = false
    clearFormContext()
    toast.add({
      title: 'Cliente creado',
      description: 'El cliente se creó correctamente.',
      color: 'success',
    })

    await queryClient.invalidateQueries({ queryKey: customerQueryKeys.paginated() })
    await queryClient.refetchQueries({ queryKey: customerQueryKeys.paginated(), type: 'active' })
  },
  onError: (error) => {
    const { message, fields } = mapDomainError(error as AxiosError<DomainApiError>)
    formErrors.value = fields
    toast.add({ title: 'Error al crear cliente', description: message, color: 'error' })
  },
})

const updateMutation = useMutation({
  mutationFn: (payload: { customerId: string; values: UpdateCustomerPayload }) =>
    customerApi.update(payload.customerId, payload.values),
  onSuccess: async (_, variables) => {
    isEditOpen.value = false
    clearFormContext()
    toast.add({
      title: 'Cliente actualizado',
      description: 'Los cambios se guardaron correctamente.',
      color: 'success',
    })

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.paginated() }),
      queryClient.invalidateQueries({
        queryKey: customerQueryKeys.detail(variables.customerId),
      }),
    ])
  },
  onError: (error) => {
    const { message, fields } = mapDomainError(error as AxiosError<DomainApiError>)
    formErrors.value = fields
    toast.add({ title: 'Error al actualizar cliente', description: message, color: 'error' })
  },
})

const deleteMutation = useMutation({
  mutationFn: (customerId: string) => customerApi.remove(customerId),
  onSuccess: async () => {
    toast.add({
      title: 'Cliente eliminado',
      description: 'El cliente fue eliminado correctamente.',
      color: 'success',
    })

    await queryClient.invalidateQueries({ queryKey: customerQueryKeys.paginated() })
  },
  onError: (error) => {
    const { message } = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al eliminar cliente', description: message, color: 'error' })
  },
})

const isSubmitting = computed(
  () =>
    createMutation.isPending.value ||
    updateMutation.isPending.value ||
    deleteMutation.isPending.value,
)

function handleAdd() {
  // TODO: check canCreateCustomer permission when available
  formErrors.value = {}
  isCreateOpen.value = true
}

async function handleOpenEdit(customer: Customer) {
  // TODO: check canUpdateCustomer permission when available
  try {
    formErrors.value = {}
    selectedCustomer.value = await customerApi.getById(customer.id)
    selectedCustomerId.value = customer.id
    isEditOpen.value = true
  } catch {
    toast.add({
      title: 'No se pudo abrir el editor',
      description: 'No pudimos cargar el detalle del cliente.',
      color: 'error',
    })
  }
}

async function handleDelete(customer: Customer) {
  // TODO: check canDeleteCustomer permission when available
  openConfirm(
    `¿Querés eliminar al cliente ${customer.fullName}?`,
    () => {
      void deleteMutation.mutateAsync(customer.id)
    },
  )
}

function handleEditSubmit(values: UpdateCustomerPayload) {
  if (!selectedCustomerId.value) return
  updateMutation.mutate({ customerId: selectedCustomerId.value, values })
}

function getRowItems(customer: Customer) {
  const mainActions = [
    { label: 'Editar', onSelect: () => handleOpenEdit(customer) },
  ]

  const destructiveActions = [
    {
      label: 'Eliminar',
      color: 'error' as const,
      onSelect: () => handleDelete(customer),
    },
  ]

  return [mainActions, destructiveActions].filter((section) => section.length > 0)
}

const bulkActions = computed<BulkAction<Customer>[]>(() => [])
</script>

<template>
  <div class="flex flex-col gap-6 px-10">
    <CustomerUpsertSlideover
      v-model:open="isCreateOpen"
      mode="create"
      :global-price-lists="globalPriceLists"
      :loading="isSubmitting"
      :errors="formErrors"
      @create="createMutation.mutate"
      @close="clearFormContext"
    />

    <CustomerUpsertSlideover
      v-model:open="isEditOpen"
      mode="edit"
      :global-price-lists="globalPriceLists"
      :loading="isSubmitting"
      :errors="formErrors"
      :customer="selectedCustomer"
      @edit="handleEditSubmit"
      @close="clearFormContext"
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
        <TableHeaderDescription
          description="Gestión de clientes"
          title="Clientes"
        />
      </template>
      <div class="px-6 py-5">
        <AppDataTable
          v-model:sorting="sorting"
          v-model:pagination="pagination"
          v-model:global-filter="globalFilter"
          v-model:column-pinning="columnPinning"
          v-model:column-visibility="columnVisibility"
          v-model:row-selection="rowSelection"
          :columns="columns"
          :data="data"
          :loading="isLoading"
          :fetching="isFetching"
          :page-count="pageCount"
          :total-count="totalCount"
          :showing-from="showingFrom"
          :showing-to="showingTo"
          :page-size-options="pageSizeOptions"
          :bulk-actions="bulkActions"
          :show-add-button="true"
          search-placeholder="Buscar clientes..."
          add-button-text="Nuevo Cliente"
          add-button-icon="i-lucide-user-plus"
          enable-column-visibility
          :enable-row-selection="false"
          empty="No se encontraron clientes"
          @add="handleAdd"
          @refresh="refresh"
        >
          <template #select-header="{ table }">
            <SelectColumn mode="header" :table="table" />
          </template>

          <template #select-cell="{ row }">
            <SelectColumn mode="cell" :row="row" />
          </template>

          <template #fullName-header="{ column }">
            <SortableHeader :column="column" label="Nombre" />
          </template>

          <template #fullName-cell="{ row }">
            <span class="font-medium">{{ row.original.fullName }}</span>
          </template>

          <template #email-cell="{ row }">
            <span class="text-sm text-muted">{{ row.original.email ?? '—' }}</span>
          </template>

          <template #phone-cell="{ row }">
            <span class="font-mono text-sm">
              <template v-if="row.original.phone">
                {{ row.original.phoneCountryCode ? `${row.original.phoneCountryCode} ` : '' }}{{ row.original.phone }}
              </template>
              <template v-else>—</template>
            </span>
          </template>

          <template #globalPriceListName-cell="{ row }">
            <UBadge
              v-if="row.original.globalPriceListName"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              {{ row.original.globalPriceListName }}
            </UBadge>
            <span v-else class="text-sm text-muted">—</span>
          </template>

          <template #actions-cell="{ row }">
            <UDropdownMenu
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
