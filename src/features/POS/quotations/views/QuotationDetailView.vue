<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import StatusDotBadge from '@/core/shared/components/StatusDotBadge.vue'
import AssignCustomerSlideover from '@/features/POS/sales/components/AssignCustomerSlideover.vue'
import PriceListSelector from '@/features/POS/sales/components/PriceListSelector.vue'
import ProductSearchPanel from '@/features/POS/sales/components/ProductSearchPanel.vue'
import ConfirmModal from '@/core/shared/components/ConfirmModal.vue'
import {
  QUOTATION_STATUS_LABEL,
  QUOTATION_STATUS_TONE,
} from '../constants/quotation.constants'
import { useQuotationDetail } from '../composables/useQuotationDetail'
import { useQuotationDraft } from '../composables/useQuotationDraft'
import QuotationItemRow from '../components/QuotationItemRow.vue'

const route = useRoute()
const router = useRouter()
const isAssignCustomerOpen = ref(false)
const isCreating = ref(false)
const createError = ref<unknown>(null)

const isCreateRoute = computed(() => route.path === '/pos/cotizaciones/nueva')
const quotationId = computed(() => {
  if (isCreateRoute.value) return null
  const value = route.params.id
  return typeof value === 'string' && value ? value : null
})

const {
  quotation,
  isLoading,
  isError,
  error,
  createDraft,
  assignCustomer,
  changePriceList,
} = useQuotationDetail(quotationId)

// `useQuotationDraft` is only safe to instantiate when we have a real
// quotation id. `createDraft` lives on `useQuotationDetail` because it
// drives the route replace; the other 15 mutations live here (S5).
const draft = useQuotationDraft(quotationId)

const isDraft = computed(() => quotation.value?.status === 'DRAFT')
const folio = computed(() => quotation.value?.id.slice(0, 8) ?? 'Nueva')
const customerName = computed(() => {
  const customer = quotation.value?.customer
  if (!customer) return ''
  return [customer.firstName, customer.lastName].filter(Boolean).join(' ')
})

const dateFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value))
}

function goBack(): void {
  void router.push('/pos/cotizaciones')
}

async function handleCustomerSelected(customerId: string): Promise<void> {
  await assignCustomer(customerId)
  isAssignCustomerOpen.value = false
}

async function handlePriceListChange(globalPriceListId: string | null): Promise<void> {
  await changePriceList(globalPriceListId)
}

// ── S5: item management ──────────────────────────────────────────────────────

const items = computed(() => quotation.value?.items ?? [])

const isProductSearchOpen = ref(false)

async function handleAddProduct(
  productId: string,
  variantId: string | null,
): Promise<void> {
  await draft.addItem(productId, 1, variantId ?? undefined)
}

async function handleUpdateQuantity(
  itemId: string,
  quantity: number,
): Promise<void> {
  await draft.updateQuantity(itemId, quantity)
}

// ── Remove confirmation flow ─────────────────────────────────────────────────
// The row never deletes state directly — it emits `request-remove`, we
// pop the ConfirmModal, and only after the user confirms do we hit the
// backend (`quotationApi.removeItem` returns the updated quotation; the
// composable mutates the cache).

const pendingRemoveItemId = ref<string | null>(null)
const isRemoveConfirmOpen = computed(() => pendingRemoveItemId.value !== null)

function handleRequestRemove(itemId: string): void {
  pendingRemoveItemId.value = itemId
}

function handleRemoveCancel(): void {
  pendingRemoveItemId.value = null
}

async function handleRemoveConfirm(): Promise<void> {
  const itemId = pendingRemoveItemId.value
  pendingRemoveItemId.value = null
  if (!itemId) return
  await draft.removeItem(itemId)
}

async function handleOverridePrice(
  itemId: string,
  unitPriceCents: number,
): Promise<void> {
  // Slice 5 commits the override value as-is (the row passes back the
  // current unit price when the cashier clicks the pencil). Slice 8/9 can
  // upgrade this to a dedicated modal without changing the public contract.
  await draft.overridePrice(itemId, unitPriceCents)
}

onMounted(async () => {
  if (!isCreateRoute.value) return
  const rawCustomerId = route.query.customerId
  const customerId = typeof rawCustomerId === 'string' && rawCustomerId
    ? rawCustomerId
    : undefined

  isCreating.value = true
  createError.value = null
  try {
    await createDraft(customerId)
  } catch (caught) {
    createError.value = caught
  } finally {
    isCreating.value = false
  }
})
</script>

<template>
  <section class="quotation-detail-view flex flex-col gap-6 px-4 sm:px-8 lg:px-10" data-testid="quotation-detail-view">
    <header class="flex flex-col gap-4 border-b border-default pb-5">
      <button
        type="button"
        class="inline-flex w-fit items-center gap-2 text-sm font-medium text-muted hover:text-highlighted"
        data-testid="back-button"
        @click="goBack"
      >
        <span aria-hidden="true">←</span>
        Cotizaciones
      </button>

      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-highlighted">
            Cotización #{{ folio }}
          </h1>
          <div v-if="quotation" class="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
            <StatusDotBadge
              :label="QUOTATION_STATUS_LABEL[quotation.status]"
              :tone="QUOTATION_STATUS_TONE[quotation.status]"
              compact
            />
            <span v-if="quotation.expiresAt">Expira {{ formatDate(quotation.expiresAt) }}</span>
            <span v-else>Sin fecha de expiración</span>
            <span>Creada {{ formatDate(quotation.createdAt) }}</span>
          </div>
        </div>
      </div>
    </header>

    <div
      v-if="isCreating"
      class="flex min-h-56 items-center justify-center gap-3 text-muted"
      data-testid="create-loading"
    >
      <span class="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      Creando cotización…
    </div>

    <div
      v-else-if="isLoading"
      class="flex min-h-56 items-center justify-center gap-3 text-muted"
      data-testid="detail-loading"
    >
      <span class="size-5 animate-spin rounded-full border-2 border-current border-r-transparent" />
      Cargando cotización…
    </div>

    <div
      v-else-if="isError || createError"
      class="rounded-lg border border-error/30 bg-error/5 p-6 text-error"
      data-testid="detail-error"
    >
      No se pudo cargar la cotización.
      <span class="sr-only">{{ String(error ?? createError) }}</span>
    </div>

    <template v-else-if="quotation">
      <div class="grid gap-4 lg:grid-cols-2">
        <section class="rounded-xl border border-default bg-default p-5" data-testid="customer-section">
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-xs font-semibold uppercase tracking-wide text-muted">Cliente</p>
              <template v-if="quotation.customer">
                <p class="mt-2 font-semibold text-highlighted">{{ customerName }}</p>
                <p class="mt-1 text-sm text-muted">{{ quotation.customer.email ?? 'Sin email' }}</p>
              </template>
              <p v-else-if="!isDraft" class="mt-2 text-sm text-muted">Sin cliente</p>
              <p v-else class="mt-2 text-sm text-muted">Todavía no hay un cliente asignado.</p>
            </div>
            <button
              v-if="isDraft && !quotation.customer"
              type="button"
              class="rounded-lg border border-default px-3 py-2 text-sm font-medium hover:bg-elevated"
              data-testid="assign-customer-button"
              @click="isAssignCustomerOpen = true"
            >
              Asignar cliente
            </button>
          </div>
        </section>

        <section class="rounded-xl border border-default bg-default p-5" data-testid="price-list-section">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">Lista de precios</p>
          <PriceListSelector
            v-if="isDraft"
            class="mt-3"
            :active-draft="quotation"
            :is-mutating="false"
            @change-price-list="handlePriceListChange"
            @request-confirm="handlePriceListChange"
          />
          <p v-else class="mt-2 text-sm font-medium text-highlighted">
            {{ quotation.globalPriceListId ?? 'PUBLICO' }}
          </p>
        </section>
      </div>

      <!-- S5 — items section. List + add-product affordance in DRAFT;
           read-only list for every other status. -->
      <section
        v-if="isDraft"
        class="flex flex-col gap-4"
        data-testid="draft-edit-controls"
      >
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold text-highlighted">Agregar productos</h2>
          <button
            v-if="isDraft"
            type="button"
            class="inline-flex items-center gap-2 rounded-lg border border-default px-3 py-2 text-sm font-medium hover:bg-elevated"
            data-testid="add-product-button"
            @click="isProductSearchOpen = true"
          >
            <span aria-hidden="true">＋</span>
            Agregar producto
          </button>
        </div>
      </section>

      <section class="flex flex-col gap-4" data-testid="items-section">
        <p
          v-if="items.length === 0"
          class="rounded-lg border border-dashed border-default px-4 py-8 text-center text-sm text-muted"
          data-testid="items-empty-state"
        >
          No hay productos en esta cotización.
        </p>

        <ul
          v-else
          class="flex flex-col gap-2"
          data-testid="items-list"
        >
          <li v-for="item in items" :key="item.id">
            <QuotationItemRow
              :item="item"
              :readonly="!isDraft"
              @update-quantity="handleUpdateQuantity"
              @override-price="handleOverridePrice"
              @request-remove="handleRequestRemove"
            />
          </li>
        </ul>

        <ProductSearchPanel
          v-if="isProductSearchOpen && isDraft"
          data-testid="product-search-panel"
          @add-product="handleAddProduct"
        />
      </section>

      <section
        v-if="!isDraft"
        class="rounded-xl border border-default bg-elevated p-5 text-sm text-muted"
        data-testid="read-only-notice"
      >
        Solo lectura. Esta cotización ya no admite cambios.
      </section>

      <AssignCustomerSlideover
        v-model:open="isAssignCustomerOpen"
        @customer-selected="handleCustomerSelected"
      />

      <ConfirmModal
        :open="isRemoveConfirmOpen"
        title="Quitar producto"
        description="¿Quitar este producto de la cotización? Esta acción no se puede deshacer."
        confirm-label="Quitar"
        confirm-color="error"
        @update:open="(value) => { if (!value) handleRemoveCancel() }"
        @confirm="handleRemoveConfirm"
      />
    </template>
  </section>
</template>
