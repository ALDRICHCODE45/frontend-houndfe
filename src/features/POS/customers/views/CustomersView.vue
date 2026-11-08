<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { AxiosError } from 'axios'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { customerQueryKeys, productQueryKeys } from '@/core/shared/constants/query-keys'
import '../styles/clients-visual.css'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import type { DomainApiError } from '@/core/shared/utils/error.utils'
import { productApi } from '@/features/POS/products/api/product.api'
import { customerApi } from '../api/customer.api'
import CustomerMobileCard from '../components/CustomerMobileCard.vue'
import CustomerSalesHistorySlideover from '../components/CustomerSalesHistorySlideover.vue'
import CustomerUpsertSlideover from '../components/CustomerUpsertSlideover.vue'
import { useCustomerColumns } from '../composables/useCustomerColumns'
import { formatCustomerPhone } from '../utils/customerPhone.utils'
import type {
  CreateCustomerAddressPayload,
  CreateCustomerPayload,
  Customer,
  CustomerDetail,
  UpdateCustomerPayload,
} from '../interfaces/customer.types'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'

declare const useToast: () => {
  add: (options: {
    title: string
    description?: string
    color?: 'success' | 'error' | 'warning' | 'primary' | 'neutral'
  }) => void
}

const queryClient = useQueryClient()
const toast = useToast()
const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)
const { columns } = useCustomerColumns()

// ── Permission helpers ────────────────────────────────────────────────────────
const canCreate = computed(() => authStore.userCan('create', 'Customer'))
const canUpdate = computed(() => authStore.userCan('update', 'Customer'))
const canDelete = computed(() => authStore.userCan('delete', 'Customer'))
const canReadSales = computed(() => authStore.userCan('read', 'Sale'))

const {
  pagination,
  sorting,
  globalFilter,
  columnPinning,
  columnVisibility,
  columnOrder,
  columnSizing,
  density,
  resetLayout,
  data,
  totalCount,
  pageCount,
  isLoading,
  isFetching,
  isError,
  refresh,
  pageSizeOptions,
  showingFrom,
  showingTo,
} = useServerTable<Customer>({
  queryKey: () => customerQueryKeys.paginated(tenantId.value),
  queryFn: (params) => customerApi.getPaginated(params),
  defaultPageSize: 10,
  persistKey: 'pos-customers',
  defaultSorting: [{ id: 'fullName', desc: false }],
})

// Error title of the customers table: a human sentence, never the server message.
const customersErrorMessage = 'No se pudieron cargar los clientes'

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
let editSession = 0
let loadingEdit = false
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
  editSession++
  selectedCustomer.value = null
  selectedCustomerId.value = null
  formErrors.value = {}
}

function mapDomainError(error: AxiosError<DomainApiError>): {
  message: string
  fields: Partial<Record<string, string>>
} {
  const response = error.response?.data
  const fallback = 'No pudimos guardar el cliente. Reintenta en unos segundos.'

  if (!response) {
    return { message: fallback, fields: {} }
  }

  const message = response.message ?? fallback
  const fields: Partial<Record<string, string>> = {}
  const normalized = (message ?? '').toLowerCase()

  if (normalized.includes('email')) {
    fields.email = 'Ya existe un cliente con ese correo electrónico.'
  }

  if (normalized.includes('rfc')) {
    fields.rfc = 'Ya existe un cliente con ese RFC.'
  }

  return { message, fields }
}

function customerMatchesFilter(customer: Customer, filter: string): boolean {
  const normalizedFilter = filter.toLowerCase().trim()
  if (!normalizedFilter) return true

  return [
    customer.fullName,
    customer.email ?? '',
    customer.phone ?? '',
    customer.globalPriceListName ?? '',
  ]
    .join(' ')
    .toLowerCase()
    .includes(normalizedFilter)
}

function resetVisibilityContextAfterCreate(created: Customer) {
  if (pagination.value.pageIndex !== 0) {
    pagination.value = { ...pagination.value, pageIndex: 0 }
  }

  const activeFilter = globalFilter.value.trim()
  if (activeFilter && !customerMatchesFilter(created, activeFilter)) {
    globalFilter.value = ''
  }
}

const createMutation = useMutation({
  mutationFn: ({ values }: { values: CreateCustomerPayload; session: number }) =>
    customerApi.create(values),
  onSuccess: async (created: Customer, { session }) => {
    if (session === editSession && isCreateOpen.value) {
      isCreateOpen.value = false
      clearFormContext()
    }
    resetVisibilityContextAfterCreate(created)
    toast.add({
      title: 'Cliente creado',
      description: 'El cliente se creó correctamente.',
      color: 'success',
    })

    await queryClient.invalidateQueries({ queryKey: customerQueryKeys.paginated(tenantId.value) })
    await queryClient.refetchQueries({
      queryKey: customerQueryKeys.paginated(tenantId.value),
      type: 'active',
    })
  },
  onError: (error, { session }) => {
    if (session !== editSession || !isCreateOpen.value) return
    const { message, fields } = mapDomainError(error as AxiosError<DomainApiError>)
    formErrors.value = fields
    toast.add({ title: 'Error al crear cliente', description: message, color: 'error' })
  },
})

const updateMutation = useMutation({
  mutationFn: (payload: { customerId: string; values: UpdateCustomerPayload; session: number }) =>
    customerApi.update(payload.customerId, payload.values),
  onSuccess: async (_, variables) => {
    if (isCurrentEdit(variables.customerId, variables.session)) {
      isEditOpen.value = false
      clearFormContext()
    }
    toast.add({
      title: 'Cliente actualizado',
      description: 'Los cambios se guardaron correctamente.',
      color: 'success',
    })

    await Promise.all([
      queryClient.invalidateQueries({ queryKey: customerQueryKeys.paginated(tenantId.value) }),
      queryClient.invalidateQueries({
        queryKey: customerQueryKeys.detail(tenantId.value, variables.customerId),
      }),
    ])
  },
  onError: (error, { customerId, session }) => {
    if (!isCurrentEdit(customerId, session)) return
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

    await queryClient.invalidateQueries({ queryKey: customerQueryKeys.paginated(tenantId.value) })
  },
  onError: (error) => {
    const { message } = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al eliminar cliente', description: message, color: 'error' })
  },
})

async function refreshAddressSelection(customerId: string, session: number) {
  if (!isCurrentEdit(customerId, session)) return
  try {
    const refreshed = await customerApi.getById(customerId)
    if (isCurrentEdit(customerId, session)) selectedCustomer.value = refreshed
  } catch {
    toast.add({
      title: 'Dirección guardada',
      description:
        'La dirección se guardó, pero no se pudo actualizar la vista. Reabre el cliente para verla.',
      color: 'warning',
    })
  }
}

async function invalidateAddressList() {
  try {
    await queryClient.invalidateQueries({ queryKey: customerQueryKeys.paginated(tenantId.value) })
  } catch {
    toast.add({
      title: 'Dirección guardada',
      description: 'La lista no se pudo actualizar. Recarga para ver los cambios.',
      color: 'warning',
    })
  }
}

function isCurrentEdit(customerId: string, session: number) {
  return session === editSession && isEditOpen.value && selectedCustomerId.value === customerId
}

const createAddressMutation = useMutation({
  mutationFn: ({
    customerId,
    payload,
  }: {
    customerId: string
    payload: CreateCustomerAddressPayload
    session: number
  }) => customerApi.createAddress(customerId, payload),
  onSuccess: async (_, { customerId, session }) => {
    toast.add({
      title: 'Dirección añadida',
      description: 'La dirección se añadió correctamente.',
      color: 'success',
    })

    await refreshAddressSelection(customerId, session)
    await invalidateAddressList()
  },
  onError: (error) => {
    const { message } = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al añadir dirección', description: message, color: 'error' })
  },
})

const updateAddressMutation = useMutation({
  mutationFn: ({
    customerId,
    addressId,
    payload,
  }: {
    customerId: string
    addressId: string
    payload: CreateCustomerAddressPayload
    session: number
  }) => customerApi.updateAddress(customerId, addressId, payload),
  onSuccess: async (_, { customerId, session }) => {
    toast.add({
      title: 'Dirección actualizada',
      description: 'La dirección se actualizó correctamente.',
      color: 'success',
    })

    await refreshAddressSelection(customerId, session)
    await invalidateAddressList()
  },
  onError: (error) => {
    const { message } = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al actualizar dirección', description: message, color: 'error' })
  },
})

const removeAddressMutation = useMutation({
  mutationFn: ({
    customerId,
    addressId,
  }: {
    customerId: string
    addressId: string
    session: number
  }) => customerApi.removeAddress(customerId, addressId),
  onSuccess: async (_, { customerId, session }) => {
    toast.add({
      title: 'Dirección eliminada',
      description: 'La dirección se eliminó correctamente.',
      color: 'success',
    })

    await refreshAddressSelection(customerId, session)
    await invalidateAddressList()
  },
  onError: (error) => {
    const { message } = mapDomainError(error as AxiosError<DomainApiError>)
    toast.add({ title: 'Error al eliminar dirección', description: message, color: 'error' })
  },
})

const isSubmitting = computed(
  () =>
    createMutation.isPending.value ||
    updateMutation.isPending.value ||
    deleteMutation.isPending.value ||
    createAddressMutation.isPending.value ||
    updateAddressMutation.isPending.value ||
    removeAddressMutation.isPending.value,
)

function handleAdd() {
  // TODO: check canCreateCustomer permission when available
  editSession++
  loadingEdit = false
  isEditOpen.value = false
  selectedCustomer.value = null
  selectedCustomerId.value = null
  formErrors.value = {}
  isCreateOpen.value = true
}

function handleSlideoverClose() {
  if (!loadingEdit && !isCreateOpen.value && !isEditOpen.value) clearFormContext()
}

async function handleOpenEdit(customer: Customer) {
  // TODO: check canUpdateCustomer permission when available
  const session = ++editSession
  loadingEdit = true
  isEditOpen.value = false
  isCreateOpen.value = false
  selectedCustomer.value = null
  selectedCustomerId.value = null
  try {
    formErrors.value = {}
    const detail = await customerApi.getById(customer.id)
    if (session !== editSession) return
    loadingEdit = false
    selectedCustomer.value = detail
    selectedCustomerId.value = customer.id
    isEditOpen.value = true
  } catch {
    if (session !== editSession) return
    loadingEdit = false
    toast.add({
      title: 'No se pudo abrir el editor',
      description: 'No pudimos cargar el detalle del cliente.',
      color: 'error',
    })
  }
}

async function handleDelete(customer: Customer) {
  // TODO: check canDeleteCustomer permission when available
  openConfirm(`¿Quieres eliminar al cliente ${customer.fullName}?`, () => {
    void deleteMutation.mutateAsync(customer.id)
  })
}

function handleCreateSubmit(values: CreateCustomerPayload) {
  if (!isCreateOpen.value) return
  createMutation.mutate({ values, session: editSession })
}

function handleEditSubmit(values: UpdateCustomerPayload) {
  if (!selectedCustomerId.value || !isEditOpen.value) return
  updateMutation.mutate({ customerId: selectedCustomerId.value, values, session: editSession })
}

async function handleCreateAddress(
  customerId: string,
  payload: CreateCustomerAddressPayload,
  acknowledge?: (saved: boolean) => void,
) {
  if (!isCurrentEdit(customerId, editSession)) return
  const session = editSession
  try {
    await createAddressMutation.mutateAsync({ customerId, payload, session })
    acknowledge?.(true)
  } catch {
    acknowledge?.(false)
  }
}

async function handleUpdateAddress(
  customerId: string,
  addressId: string,
  payload: CreateCustomerAddressPayload,
  acknowledge?: (saved: boolean) => void,
) {
  if (!isCurrentEdit(customerId, editSession)) return
  const session = editSession
  try {
    await updateAddressMutation.mutateAsync({ customerId, addressId, payload, session })
    acknowledge?.(true)
  } catch {
    acknowledge?.(false)
  }
}

function handleRemoveAddress(customerId: string, addressId: string) {
  if (!isCurrentEdit(customerId, editSession)) return
  removeAddressMutation.mutate({ customerId, addressId, session: editSession })
}

// ── S4: Sales history entry ──────────────────────────────────────────────────
const historyCustomer = shallowRef<Customer | null>(null)
const isHistoryOpen = shallowRef(false)

function handleOpenHistory(customer: Customer) {
  historyCustomer.value = customer
  isHistoryOpen.value = true
}

// ── Row actions (⋮ menu in the table, same menu on the mobile card) ──────────
function actionsFor(): RowAction[] {
  return [
    ...(canUpdate.value ? [{ key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' }] : []),
    ...(canReadSales.value
      ? [{ key: 'history', label: 'Ver historial de ventas', icon: 'i-lucide-receipt-text' }]
      : []),
    ...(canDelete.value
      ? [{ key: 'delete', label: 'Eliminar…', icon: 'i-lucide-trash-2', destructive: true }]
      : []),
  ]
}

function handleRowAction(key: string, customer: Customer) {
  if (key === 'edit') void handleOpenEdit(customer)
  else if (key === 'history') handleOpenHistory(customer)
  else if (key === 'delete') void handleDelete(customer)
}

// The whole row (or card) opens the editor for roles that can update; the name
// button stays the single tab stop.
function openRow(customer: Customer) {
  if (canUpdate.value) void handleOpenEdit(customer)
}
const rowOpen = computed(() => (canUpdate.value ? openRow : undefined))

// ── List states ───────────────────────────────────────────────────────────────
const searchTerm = computed(() => globalFilter.value.trim())
const noMatchTitle = computed(() =>
  searchTerm.value ? `Ningún resultado para «${searchTerm.value}»` : 'Ningún resultado',
)
const emptyState = computed(() => ({
  title: 'Aún no hay clientes',
  description: 'Aquí aparecerán los clientes que registres.',
  ...(canCreate.value ? { actionLabel: 'Crear cliente', actionIcon: 'i-lucide-user-plus' } : {}),
}))

function clearFilters() {
  globalFilter.value = ''
  pagination.value = { ...pagination.value, pageIndex: 0 }
}
</script>

<template>
  <div class="flex w-full min-w-0 flex-col gap-6 md:px-10">
    <CustomerUpsertSlideover
      v-model:open="isCreateOpen"
      mode="create"
      :global-price-lists="globalPriceLists"
      :loading="isSubmitting"
      :errors="formErrors"
      @create="handleCreateSubmit"
      @close="handleSlideoverClose"
    />

    <CustomerUpsertSlideover
      v-model:open="isEditOpen"
      mode="edit"
      :global-price-lists="globalPriceLists"
      :loading="isSubmitting"
      :errors="formErrors"
      :customer="selectedCustomer"
      @edit="handleEditSubmit"
      @create-address="handleCreateAddress"
      @update-address="handleUpdateAddress"
      @remove-address="handleRemoveAddress"
      @close="handleSlideoverClose"
    />

    <ConfirmModal
      :open="confirmState.open"
      :description="confirmState.description"
      confirm-label="Eliminar"
      confirm-color="error"
      :loading="deleteMutation.isPending.value"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay clients-form-portal' }"
      @update:open="confirmState.open = $event"
      @confirm="handleConfirm"
    />

    <CustomerSalesHistorySlideover v-model:open="isHistoryOpen" :customer="historyCustomer" />

    <section
      class="hf-theme hf-ui clients-visual flex w-full min-w-0 flex-col gap-6"
      aria-labelledby="clients-title"
    >
      <header class="hf-page-header">
        <h1 id="clients-title" class="hf-page-title">Clientes</h1>
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
            v-model:column-pinning="columnPinning"
            v-model:column-visibility="columnVisibility"
            v-model:column-order="columnOrder"
            v-model:column-sizing="columnSizing"
            v-model:density="density"
            :persist-layout="true"
            :columns="columns"
            :data="data"
            :loading="isLoading"
            :fetching="isFetching"
            :error="isError"
            :error-message="customersErrorMessage"
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
            :show-add-button="canCreate"
            search-placeholder="Buscar clientes..."
            add-button-text="Crear cliente"
            add-button-icon="i-lucide-user-plus"
            empty="No se encontraron clientes"
            class="hf-data-table"
            portal-class="hf-theme hf-ui clients-list-portal"
            pagination-portal-class="hf-theme hf-ui clients-list-portal"
            @add="handleAdd"
            @empty-action="handleAdd"
            @clear-filters="clearFilters"
            @refresh="refresh"
            @reset-columns="resetLayout"
          >
            <template #fullName-header="{ column }">
              <SortableHeader :column="column" label="Nombre" />
            </template>

            <template #fullName-cell="{ row }">
              <div class="flex min-w-0 items-center gap-3">
                <EntityAvatar
                  :name="row.original.fullName"
                  aria-hidden="true"
                />
                <button
                  v-if="canUpdate"
                  type="button"
                  class="hf-row-primary text-left"
                  data-testid="customer-name"
                  @click="handleOpenEdit(row.original)"
                >
                  {{ row.original.fullName }}
                </button>
                <span v-else class="hf-row-primary" data-testid="customer-name">{{
                  row.original.fullName
                }}</span>
              </div>
            </template>

            <template #email-header="{ column }">
              <SortableHeader :column="column" label="Correo electrónico" />
            </template>

            <template #email-cell="{ row }">
              <span class="text-sm text-muted">{{ row.original.email ?? '—' }}</span>
            </template>

            <template #phone-header="{ column }">
              <SortableHeader :column="column" label="Teléfono" />
            </template>

            <template #phone-cell="{ row }">
              <span class="hf-figure text-sm" data-testid="customer-phone">
                {{ formatCustomerPhone(row.original.phoneCountryCode, row.original.phone) }}
              </span>
            </template>

            <template #globalPriceListName-header="{ column }">
              <SortableHeader :column="column" label="Lista de precios" />
            </template>

            <template #globalPriceListName-cell="{ row }">
              <span class="text-sm" :class="row.original.globalPriceListName ? '' : 'text-muted'">{{
                row.original.globalPriceListName ?? '—'
              }}</span>
            </template>

            <template #actions-header><span class="sr-only">Acciones</span></template>

            <template #actions-cell="{ row }">
              <RowActionsMenu
                :actions="actionsFor()"
                :row-label="row.original.fullName"
                portal-class="clients-list-portal"
                @select="handleRowAction($event, row.original)"
              />
            </template>

            <template #mobile-card="{ row }">
              <CustomerMobileCard
                :customer="row"
                :actions="actionsFor()"
                :openable="canUpdate"
                portal-class="clients-list-portal"
                @open="openRow"
                @action="handleRowAction"
              />
            </template>
          </AppDataTable>
        </div>
      </UCard>
    </section>
  </div>
</template>
