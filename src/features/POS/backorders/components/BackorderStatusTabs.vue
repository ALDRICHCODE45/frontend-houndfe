<script setup lang="ts">
/**
 * Status tabs of «Pedidos por reposición» (S1): a segmented control with the count of each status
 * (`counts` honour the search and dates but not the tab). No checkboxes: `aria-pressed` buttons.
 */
import type { BackorderCounts, BackorderStatus } from '../interfaces/backorder.types'
import { BACKORDER_TABS } from '../utils/backorderView'

defineProps<{ tab: BackorderStatus; counts: BackorderCounts | null }>()
const emit = defineEmits<{ 'update:tab': [tab: BackorderStatus] }>()
</script>

<template>
  <div class="bo-tabs" role="group" aria-label="Estado de los pedidos">
    <button
      v-for="entry in BACKORDER_TABS"
      :key="entry.status"
      type="button"
      data-testid="backorder-tab"
      :data-status="entry.status"
      :aria-pressed="tab === entry.status"
      @click="emit('update:tab', entry.status)"
    >
      {{ entry.label }}
      <span v-if="counts" class="bo-tab-count hf-figure">{{ counts[entry.status] }}</span>
    </button>
  </div>
</template>
