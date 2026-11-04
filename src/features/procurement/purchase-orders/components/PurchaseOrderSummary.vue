<script setup lang="ts">
import { computed } from 'vue'
import type { PurchaseOrder } from '../interfaces/purchase-order.types'
import { describeLines, locationLabel } from '../utils/order-lines'
const props = defineProps<{ order: PurchaseOrder }>()
const LIMIT = 5
const lines = computed(() => describeLines(props.order))
const shown = computed(() => lines.value.slice(0, LIMIT))
const rest = computed(() => lines.value.length - shown.value.length)
</script>

<template>
  <dl data-testid="order-summary" class="order-summary">
    <dt>Proveedor</dt><dd>{{ order.supplierDisplaySnapshot?.displayName || 'Sin proveedor' }}</dd>
    <dt>Ubicación</dt><dd>{{ locationLabel(order) }}</dd>
    <dt>Renglones</dt><dd>{{ lines.length }}</dd>
    <dd v-if="!lines.length" class="order-summary-lines">Sin renglones</dd>
    <dd v-else class="order-summary-lines">
      <ul><li v-for="line in shown" :key="line.lineId">{{ line.product }}<template v-if="line.variant"> · {{ line.variant }}</template> — {{ line.quantity }} {{ line.unit }}</li></ul>
      <p v-if="rest > 0">y {{ rest }} {{ rest === 1 ? 'renglón' : 'renglones' }} más</p>
    </dd>
  </dl>
</template>
