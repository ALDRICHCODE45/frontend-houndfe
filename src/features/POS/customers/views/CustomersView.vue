<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { AppDataTable, SortableHeader } from '@/core/shared/components/DataTable'
import { useServerTable } from '@/core/shared/composables/useServerTable'
import { customerQueryKeys, productQueryKeys } from '@/core/shared/constants/query-keys'
import '../styles/clients-visual.css'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import { productApi } from '@/features/POS/products/api/product.api'
import { customerApi } from '../api/customer.api'
import CustomerMobileCard from '../components/CustomerMobileCard.vue'
import CustomerPetsSlideover from '../components/CustomerPetsSlideover.vue'
import CustomerUpsertSlideover from '../components/CustomerUpsertSlideover.vue'
import { formatPetMatchHint, useCustomerColumns } from '../composables/useCustomerColumns'
import { useCustomerEditor } from '../composables/useCustomerEditor'
import { useCustomerDelete } from '../composables/useCustomerDelete'
import { mapCustomerDomainError } from '../utils/customerFormError'
import { formatCustomerPhone } from '../utils/customerPhone.utils'
import type {
  CreateCustomerPayload,
  Customer,
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
const router = useRouter()
const authStore = useAuthStore()
const tenantId = computed(() => authStore.currentTenantId)
const { columns } = useCustomerColumns()

// ── Permission helpers ────────────────────────────────────────────────────────
const canCreate = computed(() => authStore.userCan('create', 'Customer'))
const canUpdate = computed(() => authStore.userCan('update', 'Customer'))
const canDelete = computed(() => authStore.userCan('delete', 'Customer'))
const canReadCustomer = computed(() => authStore.userCan('read', 'Customer'))
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

// customers-module T4: the edit session and the delete flow are shared with the customer page.
const editor = useCustomerEditor()
const { isEditOpen, selectedCustomer, selectedCustomerId, formErrors } = editor
const customerDelete = useCustomerDelete()
const { confirmState } = customerDelete
const isDeleting = customerDelete.isDeleting

const isCreateOpen = ref(false)

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
    if (editor.isSession(session) && isCreateOpen.value) {
      isCreateOpen.value = false
      editor.clearFormContext()
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
    if (!editor.isSession(session) || !isCreateOpen.value) return
    const { message, fields } = mapCustomerDomainError(error)
    formErrors.value = fields
    toast.add({ title: 'Error al crear cliente', description: message, color: 'error' })
  },
})

const isSubmitting = computed(
  () => createMutation.isPending.value || isDeleting.value || editor.isPending.value,
)

function handleAdd() {
  if (!canCreate.value) return
  editor.beginSession()
  isCreateOpen.value = true
}

function handleSlideoverClose() {
  editor.onClosed(isCreateOpen.value)
}

async function handleOpenEdit(customer: Customer) {
  if (!canUpdate.value) return
  isCreateOpen.value = false
  await editor.openEdit(customer.id)
}

function handleDelete(customer: Customer) {
  customerDelete.requestDelete(customer)
}

function handleConfirm() {
  customerDelete.confirm()
}

function handleEditSubmit(values: UpdateCustomerPayload) {
  if (!selectedCustomerId.value || !isEditOpen.value) return
  editor.submitEdit(values)
}
const handleCreateAddress = editor.createAddress
const handleUpdateAddress = editor.updateAddress
const handleRemoveAddress = editor.removeAddress

function handleCreateSubmit(values: CreateCustomerPayload) {
  if (!isCreateOpen.value) return
  createMutation.mutate({ values, session: editor.currentSession() })
}

// ── customers-module T4: the customer page (row click, name, «Ver historial de ventas») ──
function openCustomer(customer: Customer, tab?: 'ventas') {
  void router.push({
    name: 'pos-customer-detail',
    params: { id: customer.id },
    ...(tab ? { query: { tab } } : {}),
  })
}

// ── Pets entry (handoff 27): listing needs read:Customer ────────────────────────
const petsCustomer = shallowRef<Customer | null>(null)
const isPetsOpen = shallowRef(false)

function handleOpenPets(customer: Customer) {
  if (!canReadCustomer.value) return
  petsCustomer.value = customer
  isPetsOpen.value = true
}

// ── Row actions (⋮ menu in the table, same menu on the mobile card) ──────────
function actionsFor(): RowAction[] {
  return [
    ...(canUpdate.value ? [{ key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' }] : []),
    ...(canReadCustomer.value
      ? [{ key: 'pets', label: 'Mascotas', icon: 'i-lucide-paw-print' }]
      : []),
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
  else if (key === 'pets') handleOpenPets(customer)
  else if (key === 'history') openCustomer(customer, 'ventas')
  else if (key === 'delete') handleDelete(customer)
}

// S3 (owner): the whole row (or card) opens the customer page, like Ventas and Productos; the
// name button stays the single tab stop. «Editar» lives in the ⋮ menu and on the page.
function openRow(customer: Customer) {
  openCustomer(customer)
}
const rowOpen = openRow

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
      :show-pets="true"
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
      :loading="isDeleting"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay clients-form-portal' }"
      @update:open="customerDelete.setConfirmOpen"
      @confirm="handleConfirm"
    />

    <CustomerPetsSlideover v-model:open="isPetsOpen" :customer="petsCustomer" />

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
                <div class="flex min-w-0 flex-col items-start">
                  <button
                    type="button"
                    class="hf-row-primary text-left"
                    data-testid="customer-name"
                    @click="openCustomer(row.original)"
                  >
                    {{ row.original.fullName }}
                  </button>
                  <span
                    v-if="formatPetMatchHint(row.original)"
                    class="text-[13px] text-muted"
                    data-testid="customer-pet-match"
                    >{{ formatPetMatchHint(row.original) }}</span
                  >
                </div>
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
                openable
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
