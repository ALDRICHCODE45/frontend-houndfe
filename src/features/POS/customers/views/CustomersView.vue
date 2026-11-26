<script setup lang="ts">
import { computed, ref, shallowRef, useId, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { AppDataTable, DataTableViews, SortableHeader } from '@/core/shared/components/DataTable'
import {
  DataTableFilters,
  useDataTableFilters,
  useFiltersUrlAdapter,
  type FilterOption,
} from '@/core/shared/data-table-filters'
import { customerQueryKeys, productQueryKeys } from '@/core/shared/constants/query-keys'
import type { TableColumnTotal } from '@/core/shared/types/table.types'
import '../styles/clients-visual.css'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { productApi } from '@/features/POS/products/api/product.api'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import { customerApi } from '../api/customer.api'
import CustomerMobileCard from '../components/CustomerMobileCard.vue'
import CustomerPetsSlideover from '../components/CustomerPetsSlideover.vue'
import CustomerUpsertSlideover from '../components/CustomerUpsertSlideover.vue'
import { createCustomersFiltersSchema } from '../config/customersFiltersSchema'
import { formatListingDay, formatListingInstant } from '../config/customersListingFormat'
import { formatPetMatchHint, useCustomerColumns } from '../composables/useCustomerColumns'
import { useCustomersListing } from '../composables/useCustomersListing'
import { useCustomersViews } from '../composables/useCustomersViews'
import { useCustomerEditor } from '../composables/useCustomerEditor'
import { useCustomerDelete } from '../composables/useCustomerDelete'
import { FISCAL_REGIMES } from '../composables/useCustomerForm'
import { mapCustomerDomainError } from '../utils/customerFormError'
import { formatCustomerPhone } from '../utils/customerPhone.utils'
import type {
  CreateCustomerPayload,
  Customer,
  UpdateCustomerPayload,
} from '../interfaces/customer.types'
import type {
  CustomerListingOption,
  CustomerListingOptionField,
  CustomerListingPetSpecies,
  CustomerListingRow,
} from '../interfaces/customer-listing.types'
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

// ── Permission helpers ────────────────────────────────────────────────────────
const canCreate = computed(() => authStore.userCan('create', 'Customer'))
const canUpdate = computed(() => authStore.userCan('update', 'Customer'))
const canDelete = computed(() => authStore.userCan('delete', 'Customer'))
const canReadCustomer = computed(() => authStore.userCan('read', 'Customer'))
const canReadSales = computed(() => authStore.userCan('read', 'Sale'))
// customers-module T6: without read:Sale the rows have no `metrics`, so the money columns, filters,
// sorts and views are not built at all (handoff 32 §2.6). Read once: the table is built from it.
const moneyAccess = canReadSales.value

const isMobile = useBreakpoints(breakpointsTailwind).smaller('md')

// ── Filter sources: price lists and the values of GET /customers/listing/options ─────────
// Reuse globalPriceLists from products endpoint (same endpoint)
const priceListsQuery = useQuery({
  queryKey: productQueryKeys.globalPriceLists(),
  queryFn: productApi.getGlobalPriceLists,
  refetchOnWindowFocus: false,
})
const globalPriceLists = computed(() => priceListsQuery.data.value ?? [])

const OPTION_FIELDS: CustomerListingOptionField[] = ['neighborhood', 'municipality', 'city', 'zipCode', 'fiscalRegime']
type ListingOptions = Partial<Record<CustomerListingOptionField, CustomerListingOption[]>>

// One request per field; a field that fails only leaves its own list empty.
const optionsQuery = useQuery({
  queryKey: computed(() => [...customerQueryKeys.paginated(tenantId.value ?? ''), 'listing-options']),
  queryFn: async (): Promise<ListingOptions> => {
    const settled = await Promise.allSettled(OPTION_FIELDS.map((field) => customerApi.listCustomerListingOptions(field)))
    return Object.fromEntries(
      OPTION_FIELDS.map((field, index) => {
        const result = settled[index]!
        return [field, result.status === 'fulfilled' ? result.value : []]
      }),
    )
  },
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false,
})

const fiscalRegimeLabel = (code: string) => FISCAL_REGIMES.find((regime) => regime.value === code)?.label ?? code
const toOptions = (field: CustomerListingOptionField): FilterOption[] =>
  (optionsQuery.data.value?.[field] ?? []).map(({ value }) => ({
    value,
    label: field === 'fiscalRegime' ? fiscalRegimeLabel(value) : value,
  }))

const filtersSchema = computed(() =>
  createCustomersFiltersSchema({
    canReadSales: moneyAccess,
    priceListOptions: globalPriceLists.value.map((list) => ({ value: list.id, label: list.name })),
    priceListLoading: Boolean(priceListsQuery.isLoading?.value),
    locationOptions: {
      neighborhood: toOptions('neighborhood'),
      municipality: toOptions('municipality'),
      city: toOptions('city'),
      zipCode: toOptions('zipCode'),
      fiscalRegime: toOptions('fiscalRegime'),
    },
    locationLoading: Boolean(optionsQuery.isLoading?.value),
  }),
)

// URL-synced filters, as in Ventas.
const filtersAdapter = useFiltersUrlAdapter(filtersSchema)
const filtersCtl = useDataTableFilters(filtersSchema, filtersAdapter)
const filtersState = computed({
  get: () => filtersCtl.state.value,
  set: (next) => {
    filtersCtl.state.value = next
  },
})
// The filters as GET /customers/listing params; writing them (a saved view) sets the sheet.
const filterParams = computed<Record<string, string>>({
  get: () => filtersCtl.backendParams.value,
  set: (next) => {
    filtersCtl.state.value = filtersSchema.value.deserialize(next)
  },
})

const listing = useCustomersListing({ filters: () => filtersCtl.backendParams.value, canReadSales: moneyAccess })
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
  filterTotals,
  filterErrors,
  listingErrorMessage,
} = listing

// Totals row: the count of the filter on Cliente and its debt on Deuda, both from the server
// (`filterSummary`). The debt is never summed from the page rows.
const CUSTOMER_TOTALS: Record<string, TableColumnTotal<CustomerListingRow>> = {
  name: { kind: 'count', label: (n) => `${n} ${n === 1 ? 'cliente' : 'clientes'}` },
  openDebt: { kind: 'custom', compute: () => '', format: formatCentsMXN },
}
const columns = useCustomerColumns({ canReadSales: moneyAccess }).columns.map((column) => {
  const total = CUSTOMER_TOTALS[column.id ?? '']
  return total ? { ...column, meta: { ...column.meta, total } } : column
})

// Error title of the customers table: a Spanish sentence for a listing 400, never the server message.
const customersErrorMessage = computed(() => listingErrorMessage.value ?? 'No se pudieron cargar los clientes')

// ── Saved views: Todos · Con deuda vencida · Inactivos +90 días · Mejores clientes · Nuevos este mes ──
const urlFilters = { ...filtersCtl.backendParams.value }
const customersViews = useCustomersViews({
  columnIds: columns.map((column) => column.id ?? ''),
  layout: { order: columnOrder, pinning: columnPinning, sizing: columnSizing, visibility: columnVisibility, density },
  sorting,
  filters: filterParams,
  canReadSales: moneyAccess,
  normalizeFilters: (params) => filtersSchema.value.serialize(filtersSchema.value.deserialize(params)),
})
// A link with filters wins over the view the list reopens on (the view then shows unsaved changes).
if (Object.keys(urlFilters).length > 0) filterParams.value = urlFilters
const VIEWS_PANEL_ID = 'customers-views-panel'
const VIEWS_TAB_PREFIX = 'customers-views'

// ── Sort select: the backend orderings (money ones only with read:Sale) ──────────
const SORT_OPTIONS = [
  ...(moneyAccess
    ? [
        { label: 'Vencido desde · más antiguo', value: 'oldestOverdue:asc' },
        { label: 'Deuda · mayor a menor', value: 'openDebt:desc' },
        { label: 'Última compra · más reciente', value: 'lastPurchaseAt:desc' },
        { label: 'Total comprado · mayor a menor', value: 'totalSold:desc' },
      ]
    : []),
  { label: 'Nombre · A–Z', value: 'name:asc' },
  { label: 'Alta · más reciente', value: 'createdAt:desc' },
]
// Without a sort the request orders by name, so the select says so instead of going blank.
const DEFAULT_SORT_VALUE = 'name:asc'
const CUSTOM_SORT_PLACEHOLDER = 'Orden personalizado'
const sortSelectId = useId()
const sortValue = computed({
  get: () => {
    const first = sorting.value[0]
    if (!first) return DEFAULT_SORT_VALUE
    const value = `${first.id}:${first.desc ? 'desc' : 'asc'}`
    return SORT_OPTIONS.some((option) => option.value === value) ? value : undefined
  },
  set: (value: string | undefined) => {
    if (!value) return
    const [id, order] = value.split(':')
    sorting.value = [{ id: id ?? 'name', desc: order === 'desc' }]
  },
})

watch(
  () => filtersCtl.serializedState.value,
  () => {
    pagination.value = { ...pagination.value, pageIndex: 0 }
  },
)

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

    // The listing lives under the customers list key, so this prefix refreshes it too.
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

async function handleOpenEdit(customer: CustomerListingRow) {
  if (!canUpdate.value) return
  isCreateOpen.value = false
  await editor.openEdit(customer.id)
}

function handleDelete(customer: CustomerListingRow) {
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
function openCustomer(customer: CustomerListingRow, tab?: 'ventas') {
  void router.push({
    name: 'pos-customer-detail',
    params: { id: customer.id },
    ...(tab ? { query: { tab } } : {}),
  })
}

// ── Pets entry (handoff 27): listing needs read:Customer ────────────────────────
const petsCustomer = shallowRef<Customer | null>(null)
const isPetsOpen = shallowRef(false)

// The pets slideover only reads the id and the name of the customer.
function toCustomer(row: CustomerListingRow): Customer {
  return {
    id: row.id,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: row.fullName,
    phoneCountryCode: row.phoneCountryCode,
    phone: row.phone,
    email: row.email,
    globalPriceListId: row.globalPriceListId,
    globalPriceListName: row.globalPriceListName,
    comments: null,
    matchedPetName: row.matchedPetName,
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
  }
}

function handleOpenPets(customer: CustomerListingRow) {
  if (!canReadCustomer.value) return
  petsCustomer.value = toCustomer(customer)
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

function handleRowAction(key: string, customer: CustomerListingRow) {
  if (key === 'edit') void handleOpenEdit(customer)
  else if (key === 'pets') handleOpenPets(customer)
  else if (key === 'history') openCustomer(customer, 'ventas')
  else if (key === 'delete') handleDelete(customer)
}

// S3 (owner): the whole row (or card) opens the customer page, like Ventas and Productos; the
// name button stays the single tab stop. «Editar» lives in the ⋮ menu and on the page.
function openRow(customer: CustomerListingRow) {
  openCustomer(customer)
}
const rowOpen = openRow

// ── Cells ─────────────────────────────────────────────────────────────────────
const phoneOf = (row: CustomerListingRow) =>
  row.phone ? formatCustomerPhone(row.phoneCountryCode, row.phone) : null
const SPECIES_ICONS: Record<CustomerListingPetSpecies, { icon: string; label: string }> = {
  DOG: { icon: 'i-lucide-dog', label: 'Perro' },
  CAT: { icon: 'i-lucide-cat', label: 'Gato' },
  OTHER: { icon: 'i-lucide-paw-print', label: 'Otra especie' },
}
const speciesIcon = (species: CustomerListingPetSpecies) => SPECIES_ICONS[species] ?? SPECIES_ICONS.OTHER
const locationOf = (row: CustomerListingRow) => {
  const address = row.primaryAddress
  if (!address) return '—'
  return [address.neighborhood, address.city ?? address.municipality].filter(Boolean).join(', ') || '—'
}

// ── List states ───────────────────────────────────────────────────────────────
const searchTerm = computed(() => globalFilter.value.trim())
const hasActiveFilters = computed(() => searchTerm.value !== '' || filtersCtl.activeCount.value > 0)
const noMatchTitle = computed(() =>
  searchTerm.value ? `Ningún resultado para «${searchTerm.value}»` : 'Ningún cliente con estos filtros',
)
const emptyState = computed(() => ({
  title: 'Aún no hay clientes',
  description: 'Aquí aparecerán los clientes que registres.',
  ...(canCreate.value ? { actionLabel: 'Crear cliente', actionIcon: 'i-lucide-user-plus' } : {}),
}))

// Removable chips of the active filters, above the table (artboard 01 «Filtrando por»).
const activeChips = computed(() => filtersCtl.activeChips.value)

function clearFilters() {
  filtersCtl.clearAll()
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
        <DataTableViews
          :views="customersViews"
          :controls="VIEWS_PANEL_ID"
          :tab-id-prefix="VIEWS_TAB_PREFIX"
          portal-class="hf-theme hf-ui clients-list-portal"
        />
        <div
          :id="VIEWS_PANEL_ID"
          role="tabpanel"
          :aria-labelledby="`${VIEWS_TAB_PREFIX}-tab-${customersViews.activeId.value}`"
          class="hf-table-content w-full min-w-0 px-3 py-3 sm:px-4 sm:py-4"
        >
          <div
            v-if="activeChips.length > 0"
            class="clients-filter-chips"
            role="group"
            aria-label="Filtros activos"
            data-testid="customers-filter-chips"
          >
            <span class="clients-filter-chips-label">Filtrando por</span>
            <button
              v-for="chip in activeChips"
              :key="chip.filterId"
              type="button"
              class="clients-filter-chip"
              :aria-label="`Quitar filtro ${chip.label}: ${chip.displayValue}`"
              data-testid="customers-filter-chip"
              @click="filtersCtl.clearFilter(chip.filterId)"
            >
              <span>{{ chip.label }}: <strong>{{ chip.displayValue }}</strong></span>
              <UIcon name="i-lucide-x" class="clients-filter-chip-icon" aria-hidden="true" />
            </button>
            <button
              type="button"
              class="clients-filter-chips-clear"
              data-testid="customers-filter-chips-clear"
              @click="filtersCtl.clearAll()"
            >
              Limpiar todo
            </button>
          </div>

          <!-- No persist-layout: the views bar reports the layout state («Cambios sin guardar»), so the
               «Guardado en tu vista» pill would contradict it. The layout is still persisted. -->
          <AppDataTable
            v-model:sorting="sorting"
            v-model:pagination="pagination"
            v-model:global-filter="globalFilter"
            v-model:column-pinning="columnPinning"
            v-model:column-visibility="columnVisibility"
            v-model:column-order="columnOrder"
            v-model:column-sizing="columnSizing"
            v-model:density="density"
            :columns="columns"
            :data="data"
            :loading="isLoading"
            :fetching="isFetching"
            :error="isError"
            :error-message="customersErrorMessage"
            :empty-state="emptyState"
            :filtered="hasActiveFilters"
            :no-match-title="noMatchTitle"
            :active-filter-count="filtersCtl.activeCount.value"
            :page-count="pageCount"
            :total-count="totalCount"
            :totals="filterTotals"
            :showing-from="showingFrom"
            :showing-to="showingTo"
            :page-size-options="pageSizeOptions"
            :row-open="rowOpen"
            enable-column-visibility
            display-mode="auto"
            mobile-render="cards"
            :show-add-button="canCreate"
            search-placeholder="Buscar clientes o mascotas..."
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
            <template #filters>
              <!-- Filter · sort, as in Ventas: the sheet (embedded in the mobile bottom sheet) and the
                   predefined orderings over the same `sorting` the headers and the views write. -->
              <div class="flex w-full flex-wrap items-center gap-x-4 gap-y-3 md:flex-nowrap">
                <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                  <DataTableFilters
                    v-model:state="filtersState"
                    :schema="filtersSchema"
                    :errors="filterErrors"
                    :embedded="isMobile"
                    portal-class="hf-theme hf-ui clients-list-portal"
                  />
                </div>

                <div class="hidden h-5 w-px shrink-0 bg-default md:block" aria-hidden="true" />

                <div class="flex shrink-0 items-center gap-2">
                  <label :for="sortSelectId" class="clients-sort-label" data-testid="customers-sort-label">Ordenar:</label>
                  <USelect
                    :id="sortSelectId"
                    v-model="sortValue"
                    :items="SORT_OPTIONS"
                    :placeholder="CUSTOM_SORT_PLACEHOLDER"
                    aria-label="Ordenar clientes"
                    class="w-60"
                    data-testid="customers-sort-select"
                    :ui="{ content: 'hf-theme hf-ui clients-list-portal' }"
                  />
                </div>
              </div>
            </template>

            <!-- Sortable headers: only the columns GET /customers/listing can order by. -->
            <template #name-header="{ column }">
              <SortableHeader :column="column" label="Cliente" />
            </template>
            <template #openDebt-header="{ column }">
              <SortableHeader :column="column" label="Deuda" />
            </template>
            <template #oldestOverdue-header="{ column }">
              <SortableHeader :column="column" label="Vencido desde" />
            </template>
            <template #lastPurchaseAt-header="{ column }">
              <SortableHeader :column="column" label="Última compra" />
            </template>
            <template #totalSold-header="{ column }">
              <SortableHeader :column="column" label="Total comprado" />
            </template>
            <template #createdAt-header="{ column }">
              <SortableHeader :column="column" label="Alta" />
            </template>
            <template #salesCount-header="{ column }">
              <SortableHeader :column="column" label="Compras" />
            </template>
            <template #averageTicket-header="{ column }">
              <SortableHeader :column="column" label="Ticket promedio" />
            </template>

            <template #name-cell="{ row }">
              <div class="flex min-w-0 items-center gap-3">
                <EntityAvatar :name="row.original.fullName" aria-hidden="true" />
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
                    v-if="phoneOf(row.original)"
                    class="hf-figure clients-cell-secondary"
                    data-testid="customer-phone"
                  >{{ phoneOf(row.original) }}</span>
                  <span
                    v-if="formatPetMatchHint(row.original)"
                    class="clients-cell-secondary"
                    data-testid="customer-pet-match"
                  >{{ formatPetMatchHint(row.original) }}</span>
                </div>
              </div>
            </template>

            <template #openDebt-cell="{ row }">
              <div
                v-if="(row.original.metrics?.openDebtCents ?? 0) > 0"
                class="clients-debt-cell"
              >
                <span class="hf-figure clients-debt" data-testid="customer-debt">{{
                  formatCentsMXN(row.original.metrics!.openDebtCents)
                }}</span>
                <StatusBadge
                  v-if="(row.original.metrics?.overdueCount ?? 0) > 0"
                  data-testid="customer-overdue"
                  tone="danger"
                  label="Vencida"
                />
              </div>
              <span v-else class="hf-figure block text-right text-muted">—</span>
            </template>

            <template #oldestOverdue-cell="{ row }">
              <span class="clients-cell-date">{{ formatListingDay(row.original.metrics?.oldestOverdueDueDate) }}</span>
            </template>

            <template #lastPurchaseAt-cell="{ row }">
              <span class="clients-cell-date">{{ formatListingInstant(row.original.metrics?.lastPurchaseAt) }}</span>
            </template>

            <template #totalSold-cell="{ row }">
              <span class="hf-figure block text-right">{{
                row.original.metrics ? formatCentsMXN(row.original.metrics.totalSoldCents) : '—'
              }}</span>
            </template>

            <template #pets-cell="{ row }">
              <span v-if="row.original.activePetsCount > 0" class="clients-pets-cell">
                <span class="hf-figure">{{ row.original.activePetsCount }}</span>
                <UIcon
                  v-for="species in row.original.petSpecies"
                  :key="species"
                  :name="speciesIcon(species).icon"
                  :data-species="species"
                  :aria-label="speciesIcon(species).label"
                  role="img"
                  class="clients-pets-icon"
                />
              </span>
              <span v-else class="text-muted">—</span>
            </template>

            <template #priceList-cell="{ row }">
              <span class="text-sm" :class="row.original.globalPriceListName ? '' : 'text-muted'">{{
                row.original.globalPriceListName ?? '—'
              }}</span>
            </template>

            <template #email-cell="{ row }">
              <span class="text-sm text-muted">{{ row.original.email ?? '—' }}</span>
            </template>

            <template #location-cell="{ row }">
              <span class="text-sm">{{ locationOf(row.original) }}</span>
            </template>

            <template #rfc-cell="{ row }">
              <span class="hf-figure text-sm">{{ row.original.rfc ?? '—' }}</span>
            </template>

            <template #createdAt-cell="{ row }">
              <span class="clients-cell-date">{{ formatListingInstant(row.original.createdAt) }}</span>
            </template>

            <template #salesCount-cell="{ row }">
              <span class="hf-figure block text-right">{{ row.original.metrics?.salesCount ?? '—' }}</span>
            </template>

            <template #averageTicket-cell="{ row }">
              <span class="hf-figure block text-right">{{
                row.original.metrics?.averageTicketCents != null
                  ? formatCentsMXN(row.original.metrics.averageTicketCents)
                  : '—'
              }}</span>
            </template>

            <template #isTrusted-cell="{ row }">
              <StatusBadge v-if="row.original.isTrusted" tone="success" label="De confianza" />
              <span v-else class="text-muted">—</span>
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
