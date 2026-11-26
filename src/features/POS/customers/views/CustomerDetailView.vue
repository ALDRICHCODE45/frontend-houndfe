<script setup lang="ts">
/**
 * CustomerDetailView — `/pos/customers/:id` (customers-module T4, S4 «A · Ficha con pestañas»,
 * artboard 02 + 05 direction A).
 *
 * Header (crumb, meta line, 22px name, contact, one primary + ⋮), a KPI strip from the
 * customer-wide summary of `GET /sales?customerId=`, and URL-synced tabs (`?tab=`) that mount —
 * and so load — only when opened: Resumen · Ventas · Mascotas · Cotizaciones · Datos y direcciones.
 * «Cobros y recibos» waits for the backend contract (T5). Money writes are the existing ones
 * («Cobrar todo» sheet, the row «Cobrar» inside the history), unchanged.
 */
import { computed, shallowRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useQuery } from '@tanstack/vue-query'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import DetailPageFrame from '@/core/shared/components/DetailPageFrame.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import { productQueryKeys } from '@/core/shared/constants/query-keys'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { productApi } from '@/features/POS/products/api/product.api'
import { useCustomerSalesHistory } from '@/features/POS/sales/composables/useCustomerSalesHistory'
import { formatCentsMXN } from '@/features/POS/sales/utils/currency.utils'
import CustomerCollectionSlideover from '../components/CustomerCollectionSlideover.vue'
import CustomerPetsSection from '../components/CustomerPetsSection.vue'
import CustomerSalesHistoryBody from '../components/CustomerSalesHistoryBody.vue'
import CustomerSalesHistoryPager from '../components/CustomerSalesHistoryPager.vue'
import CustomerStatementDownload from '../components/CustomerStatementDownload.vue'
import CustomerUpsertSlideover from '../components/CustomerUpsertSlideover.vue'
import CustomerDataTab from '../components/detail/CustomerDataTab.vue'
import CustomerKpiStrip from '../components/detail/CustomerKpiStrip.vue'
import CustomerQuotationsTab from '../components/detail/CustomerQuotationsTab.vue'
import CustomerSummaryTab from '../components/detail/CustomerSummaryTab.vue'
import { useCustomerDelete } from '../composables/useCustomerDelete'
import { useCustomerDetail } from '../composables/useCustomerDetail'
import { useCustomerEditor } from '../composables/useCustomerEditor'
import { useCustomerSalesHistoryView } from '../composables/useCustomerSalesHistoryView'
import { CUSTOMER_TABS, useCustomerTab, type CustomerTab } from '../composables/useCustomerTab'
import { buildCustomerKpis, latestPurchase } from '../utils/customerKpis'
import {
  customerPhoneLink,
  customerWhatsAppHref,
  formatCustomerSince,
} from '../utils/customerHeader.utils'
import '../styles/clients-visual.css'
import '../styles/customer-detail.css'

const CUSTOMERS_ROUTE = { name: 'pos-customers' } as const

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const canUpdate = computed(() => authStore.userCan('update', 'Customer'))
const canDelete = computed(() => authStore.userCan('delete', 'Customer'))
const canReadSales = computed(() => authStore.userCan('read', 'Sale'))
const canCollect = computed(() => authStore.userCan('update', 'Sale'))
const canReadQuotations = computed(() => authStore.userCan('read', 'Quotation'))
const isPhone = useBreakpoints(breakpointsTailwind).smaller('md')

const customerId = computed(() => String(route.params.id ?? ''))
const { canRead, customer, isError, isNotFound, refetch } = useCustomerDetail(customerId)

// ── Tabs (URL-synced) ─────────────────────────────────────────────────────────
const TAB_LABELS: Record<CustomerTab, string> = {
  resumen: 'Resumen',
  ventas: 'Ventas',
  mascotas: 'Mascotas',
  cotizaciones: 'Cotizaciones',
  datos: 'Datos y direcciones',
}
const availableTabs = computed<CustomerTab[]>(() =>
  CUSTOMER_TABS.filter((tab) => {
    if (tab === 'ventas') return canReadSales.value
    if (tab === 'cotizaciones') return canReadQuotations.value
    return true
  }),
)
const { activeTab, setTab } = useCustomerTab(availableTabs)

// ── Sales: customer-wide summary/counts and the newest sales (page 1, no filters) ──
// Same query key as the «Ventas» tab's first page, so both share one request.
const overview = useCustomerSalesHistory({
  customerId,
  page: 1,
  open: () => canReadSales.value && !!customer.value,
})
const overviewSales = computed(() => overview.response.value?.data)
const kpis = computed(() => {
  const summary = overview.customerSummary.value
  if (!summary) return null
  return buildCustomerKpis(summary, overview.customerCounts.value, latestPurchase(overviewSales.value))
})
const debtCents = computed(() => overview.customerSummary.value?.outstandingDebtCents ?? 0)

// The «Ventas» tab: the same history the slideover shows, at full width.
const salesHistory = useCustomerSalesHistoryView({
  customer: () => customer.value ?? null,
  active: () => canReadSales.value && activeTab.value === 'ventas' && !!customer.value,
})

// The pets section reports its live ACTIVE count; until then the detail's `activePetsCount`.
const activePetsCount = shallowRef<number | null>(null)
watch(customerId, () => {
  activePetsCount.value = null
})
const tabCounts = computed<Partial<Record<CustomerTab, number>>>(() => ({
  ventas: overview.customerCounts.value?.all,
  mascotas: activePetsCount.value ?? customer.value?.activePetsCount,
}))

// ── Header ────────────────────────────────────────────────────────────────────
const phone = computed(() => customerPhoneLink(customer.value))
const whatsAppHref = computed(() => customerWhatsAppHref(customer.value))
const customerSince = computed(() => formatCustomerSince(customer.value?.createdAt))
const metaParts = computed(() => [
  customerSince.value ? `Cliente desde ${customerSince.value}` : null,
  customer.value?.globalPriceListName ? `Lista ${customer.value.globalPriceListName}` : null,
].filter((part): part is string => !!part))

// «Cobrar todo» (handoff 30 §1): same gating as the history — update:Sale and open debt. An
// unresolved collection stays reachable through the history's own label.
const collectionOpen = shallowRef(false)
const showCollect = computed(
  () => canCollect.value && !!customer.value &&
    (debtCents.value > 0 || salesHistory.collectionUnresolved.value),
)
const collectLabel = computed(() =>
  salesHistory.collectionUnresolved.value
    ? 'Cobro sin confirmar'
    : `Cobrar todo ${formatCentsMXN(debtCents.value)}`,
)
watch(customerId, () => {
  collectionOpen.value = false
})

// ── ⋮ menu: Editar, WhatsApp, Eliminar… ──────────────────────────────────────
const editor = useCustomerEditor()
const { isEditOpen, selectedCustomer, formErrors } = editor
const { data: globalPriceLists } = useQuery({
  queryKey: productQueryKeys.globalPriceLists(),
  queryFn: productApi.getGlobalPriceLists,
  refetchOnWindowFocus: false,
  enabled: computed(() => isEditOpen.value),
})
const customerDelete = useCustomerDelete({
  onDeleted: () => void router.push(CUSTOMERS_ROUTE),
})
const { confirmState, isDeleting } = customerDelete

const menuActions = computed<RowAction[]>(() => [
  ...(canUpdate.value ? [{ key: 'edit', label: 'Editar', icon: 'i-lucide-pencil' }] : []),
  ...(whatsAppHref.value
    ? [{ key: 'whatsapp', label: 'Escribir por WhatsApp', icon: 'i-lucide-message-circle' }]
    : []),
  ...(canDelete.value
    ? [{ key: 'delete', label: 'Eliminar…', icon: 'i-lucide-trash-2', destructive: true }]
    : []),
])

function openEditor() {
  if (customer.value) void editor.openEdit(customer.value.id)
}

function onMenu(key: string) {
  const current = customer.value
  if (!current) return
  if (key === 'edit') openEditor()
  else if (key === 'whatsapp' && whatsAppHref.value) window.open(whatsAppHref.value, '_blank', 'noopener')
  else if (key === 'delete') customerDelete.requestDelete(current)
}

// ── Page state ────────────────────────────────────────────────────────────────
type PageState = 'forbidden' | 'loading' | 'not-found' | 'error' | 'content'
const pageState = computed<PageState>(() => {
  if (!canRead.value) return 'forbidden'
  if (customer.value) return 'content'
  if (isNotFound.value) return 'not-found'
  if (isError.value) return 'error'
  return 'loading'
})

const goToList = () => void router.push(CUSTOMERS_ROUTE)
const showMobileBar = computed(() => pageState.value === 'content' && isPhone.value && showCollect.value)
</script>

<template>
  <DetailPageFrame class="hf-theme hf-ui clients-visual" scroll-testid="customer-detail-scroll">
    <template #header>
      <header class="customer-detail-header" data-testid="customer-detail-header">
        <div class="mx-auto grid w-full max-w-7xl gap-1 px-4 py-3 sm:px-6">
          <nav class="customer-detail-crumb" aria-label="Ruta" data-testid="customer-detail-crumb">
            <UIcon name="i-lucide-arrow-left" class="size-3.5 md:hidden" aria-hidden="true" />
            <RouterLink to="/pos/customers">Clientes</RouterLink>
            <template v-if="customer">
              <UIcon name="i-lucide-chevron-right" class="size-3.5" aria-hidden="true" />
              <span aria-current="page" class="min-w-0 truncate">{{ customer.fullName }}</span>
            </template>
          </nav>

          <div v-if="pageState === 'content' && customer" class="flex min-w-0 items-start gap-3">
            <EntityAvatar :name="customer.fullName" size="lg" class="hidden sm:inline-flex" aria-hidden="true" />
            <div class="grid min-w-0 flex-1 gap-0.5">
              <p v-if="metaParts.length" class="customer-detail-meta" data-testid="customer-detail-meta">
                {{ metaParts.join(' · ') }}
              </p>
              <h1 class="customer-detail-title" data-testid="customer-detail-name">{{ customer.fullName }}</h1>
              <p class="customer-detail-contact flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <a
                  v-if="phone"
                  :href="phone.href"
                  class="inline-flex items-center gap-1"
                  data-testid="customer-detail-phone"
                >
                  <UIcon name="i-lucide-phone" class="size-3.5" aria-hidden="true" />
                  <span class="hf-figure">{{ phone.label }}</span>
                </a>
                <span v-if="phone && customer.email" aria-hidden="true">·</span>
                <span v-if="customer.email" class="min-w-0 truncate">{{ customer.email }}</span>
              </p>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <UButton
                v-if="showCollect && !isPhone"
                data-testid="customer-detail-collect"
                icon="i-lucide-hand-coins"
                class="hf-primary-control"
                @click="collectionOpen = true"
              >
                <span class="hf-figure">{{ collectLabel }}</span>
              </UButton>
              <CustomerStatementDownload
                v-if="canReadSales"
                :key="customer.id"
                :customer-id="customer.id"
              />
              <RowActionsMenu
                v-if="menuActions.length"
                :actions="menuActions"
                aria-label="Más acciones del cliente"
                :row-label="customer.fullName"
                portal-class="clients-list-portal"
                @select="onMenu"
              />
            </div>
          </div>
          <div v-else-if="pageState === 'loading'" class="grid gap-2 py-1" aria-hidden="true">
            <USkeleton class="h-3.5 w-48 !rounded" />
            <USkeleton class="h-6 w-64 !rounded" />
          </div>
        </div>
      </header>
    </template>

    <div class="mx-auto grid w-full min-w-0 max-w-7xl gap-4 px-4 py-4 sm:px-6 sm:py-6">
      <div v-if="pageState === 'loading'" class="grid gap-4" aria-busy="true">
        <span class="sr-only" role="status">Cargando el cliente…</span>
        <CustomerKpiStrip :kpis="null" loading />
        <USkeleton class="h-11 w-full !rounded" />
        <USkeleton v-for="index in 3" :key="index" class="h-16 w-full !rounded" />
      </div>

      <EmptyState
        v-else-if="pageState === 'forbidden'"
        kind="forbidden"
        title="Tu rol no puede ver clientes"
        description="Pide acceso a quien administra tu cuenta."
      />

      <div v-else-if="pageState === 'not-found'" data-testid="customer-detail-not-found">
        <EmptyState
          title="Cliente no encontrado"
          description="Puede que se haya eliminado o que el enlace no sea correcto."
          action-label="Volver a clientes"
          action-icon="i-lucide-arrow-left"
          @action="goToList"
        />
      </div>

      <div v-else-if="pageState === 'error'" data-testid="customer-detail-error">
        <EmptyState
          kind="error"
          title="No se pudo cargar el cliente"
          description="Puede ser un problema temporal de conexión."
          action-label="Reintentar"
          @action="refetch()"
        />
      </div>

      <template v-else-if="customer">
        <CustomerKpiStrip
          v-if="canReadSales && (kpis || overview.isLoading.value)"
          :kpis="kpis"
          :loading="overview.isLoading.value"
        />

        <div class="customer-tabs-scroll">
          <div class="customer-tabs" role="tablist" aria-label="Secciones del cliente">
            <button
              v-for="tab in availableTabs"
              :id="`customer-tab-${tab}-trigger`"
              :key="tab"
              type="button"
              role="tab"
              class="customer-tab"
              :aria-selected="activeTab === tab"
              :aria-controls="`customer-tab-${tab}-panel`"
              :tabindex="activeTab === tab ? 0 : -1"
              @click="setTab(tab)"
            >
              {{ TAB_LABELS[tab] }}
              <span
                v-if="typeof tabCounts[tab] === 'number'"
                class="hf-figure customer-tab-count"
              >{{ tabCounts[tab] }}</span>
            </button>
          </div>
        </div>

        <div
          :id="`customer-tab-${activeTab}-panel`"
          role="tabpanel"
          class="min-w-0"
          :aria-labelledby="`customer-tab-${activeTab}-trigger`"
        >
          <CustomerSummaryTab
            v-if="activeTab === 'resumen'"
            :customer="customer"
            :can-read-sales="canReadSales"
            :summary="overview.customerSummary.value"
            :counts="overview.customerCounts.value"
            :sales="overviewSales"
            :sales-loading="overview.isLoading.value"
            @go="setTab"
          />

          <div v-else-if="activeTab === 'ventas'" class="grid gap-3" data-testid="customer-tab-ventas">
            <CustomerSalesHistoryBody
              :history="salesHistory"
              :show-metrics="false"
              @collect="collectionOpen = true"
            />
            <CustomerSalesHistoryPager :history="salesHistory" variant="page" />
          </div>

          <CustomerPetsSection
            v-else-if="activeTab === 'mascotas'"
            :customer-id="customer.id"
            :active-pets-count="activePetsCount ?? customer.activePetsCount ?? null"
            @update:active-count="activePetsCount = $event"
          />

          <CustomerQuotationsTab v-else-if="activeTab === 'cotizaciones'" :customer-id="customer.id" />

          <CustomerDataTab
            v-else-if="activeTab === 'datos'"
            :customer="customer"
            :can-edit="canUpdate"
            @edit="openEditor"
          />
        </div>
      </template>
    </div>

    <template #footer>
      <div v-if="showMobileBar" class="customer-detail-mobile-bar" data-testid="customer-detail-mobile-bar">
        <UButton
          block
          icon="i-lucide-hand-coins"
          class="hf-primary-control"
          data-testid="customer-detail-collect-mobile"
          @click="collectionOpen = true"
        >
          <span class="hf-figure">{{ collectLabel }}</span>
        </UButton>
      </div>
    </template>

    <CustomerCollectionSlideover
      v-if="collectionOpen && customer"
      :key="customer.id"
      v-model:open="collectionOpen"
      :customer-id="customer.id"
      :customer-name="customer.fullName"
    />

    <CustomerUpsertSlideover
      v-model:open="isEditOpen"
      mode="edit"
      :global-price-lists="globalPriceLists ?? []"
      :loading="editor.isPending.value"
      :errors="formErrors"
      :customer="selectedCustomer"
      :show-pets="true"
      @edit="editor.submitEdit"
      @create-address="editor.createAddress"
      @update-address="editor.updateAddress"
      @remove-address="editor.removeAddress"
      @close="editor.onClosed()"
    />

    <ConfirmModal
      :open="confirmState.open"
      :description="confirmState.description"
      confirm-label="Eliminar"
      confirm-color="error"
      :loading="isDeleting"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay clients-form-portal' }"
      @update:open="customerDelete.setConfirmOpen"
      @confirm="customerDelete.confirm"
    />
  </DetailPageFrame>
</template>
