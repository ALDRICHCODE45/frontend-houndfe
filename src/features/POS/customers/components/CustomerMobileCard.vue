<script setup lang="ts">
/**
 * CustomerMobileCard — the mobile form of a customer row (Mobile cards rules).
 *
 * Name as the primary text (a real button when the card opens something) with
 * the ⋮ menu at the top-right, email as the secondary line, and a separated
 * footer with the phone and the price list. The whole card opens the customer
 * through `useClickableRow`; the ⋮ menu never does.
 */
import { computed } from 'vue'
import EntityAvatar from '@/core/shared/components/EntityAvatar.vue'
import RowActionsMenu, { type RowAction } from '@/core/shared/components/RowActionsMenu.vue'
import { useClickableRow } from '@/core/shared/composables/useClickableRow'
import { formatCustomerPhone } from '../utils/customerPhone.utils'
import type { Customer } from '../interfaces/customer.types'

const props = defineProps<{
  customer: Customer
  actions: RowAction[]
  /** The card (and its name) open the customer; false for read-only roles. */
  openable?: boolean
  portalClass?: string
}>()

const emit = defineEmits<{
  open: [customer: Customer]
  action: [key: string, customer: Customer]
}>()

const clickable = useClickableRow<Customer>((customer) => emit('open', customer), {
  focusable: false,
})
const rowProps = computed(() => (props.openable ? clickable.rowProps(props.customer) : {}))

const phone = computed(() =>
  formatCustomerPhone(props.customer.phoneCountryCode, props.customer.phone),
)
</script>

<template>
  <article v-bind="rowProps" class="customer-card" data-testid="customer-card">
    <div class="customer-card-heading">
      <EntityAvatar :name="customer.fullName" aria-hidden="true" />
      <div class="customer-card-title">
        <button
          v-if="openable"
          type="button"
          class="hf-row-primary customer-card-name"
          data-testid="customer-name"
          @click="emit('open', customer)"
        >
          {{ customer.fullName }}
        </button>
        <span v-else class="hf-row-primary customer-card-name" data-testid="customer-name">{{
          customer.fullName
        }}</span>
        <span v-if="customer.email" class="hf-row-secondary">{{ customer.email }}</span>
      </div>
      <RowActionsMenu
        class="customer-card-menu"
        :actions="actions"
        :row-label="customer.fullName"
        :portal-class="portalClass"
        @select="emit('action', $event, customer)"
      />
    </div>
    <div class="customer-card-footer">
      <span class="hf-figure">{{ phone }}</span>
      <span v-if="customer.globalPriceListName" class="customer-card-list">{{
        customer.globalPriceListName
      }}</span>
    </div>
  </article>
</template>

<style scoped>
.customer-card {
  min-width: 0;
  border: 1px solid var(--hf-border);
  border-radius: 12px;
  background: var(--hf-surface);
  padding: 16px;
}
.customer-card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.customer-card-title {
  display: grid;
  flex: 1;
  min-width: 0;
}
.customer-card-name {
  text-align: left;
}
.customer-card-menu {
  flex-shrink: 0;
  margin: -8px -8px 0 0;
}
.customer-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
  border-top: 1px solid var(--hf-border);
  padding-top: 12px;
  color: var(--hf-muted);
  font-size: 13px;
}
.customer-card-list {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
