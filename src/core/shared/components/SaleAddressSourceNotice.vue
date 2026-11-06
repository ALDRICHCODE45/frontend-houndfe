<script setup lang="ts">
/**
 * SaleAddressSourceNotice — warns that the customer changed or deleted the address after the
 * sale (odd/tasks/sale-address-change-notice.md S2). Non-blocking inline marker in warning ink;
 * renders nothing when unchanged, label-only, or without an address. `compact` is the short row
 * marker (`⚠ Dirección cambiada`) with the full message in `title` and for screen readers.
 */
import { computed } from 'vue'
import {
  SALE_ADDRESS_SOURCE_MESSAGES,
  SALE_ADDRESS_SOURCE_SHORT_LABELS,
  saleAddressSourceNotice,
  type SaleAddressSourceInput,
} from '@/core/shared/utils/saleAddressSource'

const props = defineProps<{
  address: SaleAddressSourceInput | null | undefined
  compact?: boolean
}>()

const notice = computed(() => saleAddressSourceNotice(props.address))
const message = computed(() => (notice.value ? SALE_ADDRESS_SOURCE_MESSAGES[notice.value] : ''))
</script>

<template>
  <span
    v-if="notice && compact"
    class="hf-sale-address-notice hf-sale-address-notice--compact"
    data-testid="sale-address-source-notice"
    :data-status="notice"
    :title="message"
  >
    <UIcon name="i-lucide-triangle-alert" class="hf-sale-address-notice__icon" aria-hidden="true" />
    <span aria-hidden="true">{{ SALE_ADDRESS_SOURCE_SHORT_LABELS[notice] }}</span>
    <span class="sr-only">{{ message }}</span>
  </span>
  <p
    v-else-if="notice"
    class="hf-sale-address-notice"
    data-testid="sale-address-source-notice"
    :data-status="notice"
  >
    <UIcon name="i-lucide-triangle-alert" class="hf-sale-address-notice__icon" aria-hidden="true" />{{ message }}
  </p>
</template>

<style scoped>
.hf-sale-address-notice { display: flex; align-items: flex-start; gap: 6px; margin: 0; color: var(--hf-warning); font-size: 12px; font-weight: 600; line-height: 1.4; }
.hf-sale-address-notice--compact { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.hf-sale-address-notice__icon { flex-shrink: 0; width: 14px; height: 14px; margin-top: 1px; }
.hf-sale-address-notice--compact .hf-sale-address-notice__icon { margin-top: 0; }
</style>
