<script setup lang="ts">
/**
 * The customer's sales history in a side panel. Its body and pager are shared with the «Ventas» tab
 * of the customer page (customers-module T4) through `useCustomerSalesHistoryView`.
 */
import { computed, shallowRef, watch } from 'vue'
import type { Customer } from '../interfaces/customer.types'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import AppResponsiveDrawer from '@/core/shared/components/AppResponsiveDrawer.vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import CustomerStatementDownload from './CustomerStatementDownload.vue'
import CustomerCollectionSlideover from './CustomerCollectionSlideover.vue'
import CustomerSalesHistoryBody from './CustomerSalesHistoryBody.vue'
import CustomerSalesHistoryPager from './CustomerSalesHistoryPager.vue'
import { hasUnresolvedCollection } from '../collection/useCustomerCollection'
import { useCustomerSalesHistoryView } from '../composables/useCustomerSalesHistoryView'
import { customerPhoneLink, formatCustomerSince } from '../utils/customerHeader.utils'

declare const useToast: () => {
  add: (options: { title: string; description?: string; color?: 'error' | 'warning' }) => void
}

const props = defineProps<{ open: boolean; customer: Customer | null }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

// Sales history redesign T1: the panel shares the seller report width (45vw ≈ 650px at 1440).
const DESKTOP_UI = {
  content: 'w-full !max-w-none sm:!max-w-[max(45vw,640px)]',
  body: 'p-0',
  header: 'border-b border-default px-4 py-4',
  footer: 'border-t border-default px-4 pb-4 pt-3',
}

const toast = useToast()
const authStore = useAuthStore()

// «Cobrar todo»: its own open state, so the sheet survives the refreshed history losing its debt.
// The collection itself refreshes the history, monthly chart, sales lists and sale details.
const collectionOpen = shallowRef(false)
watch(() => props.customer?.id, () => {
  collectionOpen.value = false
}, { flush: 'sync' })

const history = useCustomerSalesHistoryView({
  customer: () => props.customer,
  active: () => props.open,
  onForbidden: () => emit('update:open', false),
})
const { listLayout, showStatementDownload, showCollectAction, collectActionLabel } = history

const description = computed(() => props.customer
  ? `Historial de ventas confirmadas de ${props.customer.fullName}`
  : 'Historial de ventas confirmadas del cliente')
const phone = computed(() => customerPhoneLink(props.customer))
const customerSince = computed(() => formatCustomerSince(props.customer?.createdAt))

// The parent may switch customer under an unresolved collection; its key survives (module scope),
// so say whose collection to reopen to retry it with the same data.
watch(() => props.customer, (current, previous) => {
  if (!previous || previous.id === current?.id) return
  if (!hasUnresolvedCollection(authStore.currentTenantId, previous.id)) return
  toast.add({
    title: 'Cobro sin confirmar',
    description: `No sabemos si el cobro a ${previous.fullName} se registró. Vuelve a abrir «Cobrar todo» de ese cliente para reintentarlo con los mismos datos.`,
    color: 'warning',
  })
})
</script>

<template>
  <AppResponsiveDrawer
    :open="open"
    title="Historial de ventas"
    :description="description"
    close-aria-label="Cerrar historial de ventas"
    :desktop-ui="DESKTOP_UI"
    @update:open="emit('update:open', $event)"
  >
    <template #title>
      <div data-testid="history-header" class="flex min-w-0 items-start gap-3">
        <EntityAvatar
          v-if="customer"
          :name="customer.fullName"
          size="lg"
          class="hidden sm:inline-flex"
          aria-hidden="true"
        />
        <div class="grid min-w-0 gap-0.5">
          <p class="flex flex-wrap items-center gap-x-2 text-[13px] font-normal text-[var(--hf-muted)]">
            <span>Historial de ventas</span>
            <span v-if="customerSince">· cliente desde {{ customerSince }}</span>
          </p>
          <p
            data-testid="history-customer-name"
            class="break-words text-[17px] font-semibold leading-tight text-[var(--hf-heading)] sm:text-[22px]"
          >
            {{ customer?.fullName }}
          </p>
          <a
            v-if="phone"
            :href="phone.href"
            class="inline-flex w-fit items-center gap-1 text-[13px] font-normal text-[var(--hf-action)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--hf-focus)]"
          >
            <UIcon name="i-lucide-phone" class="size-3.5" aria-hidden="true" />
            <span class="hf-figure">{{ phone.label }}</span>
          </a>
        </div>
        <div
          v-if="(showStatementDownload || (showCollectAction && listLayout === 'table')) && customer"
          class="ml-auto flex shrink-0 items-center gap-2"
        >
          <UButton
            v-if="showCollectAction && listLayout === 'table'"
            data-testid="history-collect-all"
            icon="i-lucide-hand-coins"
            class="hf-primary-control"
            @click="collectionOpen = true"
          >
            {{ collectActionLabel }}
          </UButton>
          <CustomerStatementDownload v-if="showStatementDownload" :key="customer.id" :customer-id="customer.id" />
        </div>
      </div>
    </template>

    <template #description>
      <span class="sr-only">{{ description }}</span>
    </template>

    <template #body>
      <div class="p-4">
        <CustomerSalesHistoryBody :history="history" @collect="collectionOpen = true" />
      </div>

      <CustomerCollectionSlideover
        v-if="collectionOpen && customer"
        :key="customer.id"
        v-model:open="collectionOpen"
        :customer-id="customer.id"
        :customer-name="customer.fullName"
      />
    </template>

    <template #footer>
      <CustomerSalesHistoryPager :history="history" />
    </template>
  </AppResponsiveDrawer>
</template>
