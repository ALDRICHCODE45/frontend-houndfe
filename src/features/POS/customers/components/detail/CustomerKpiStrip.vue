<script setup lang="ts">
/**
 * The KPI strip of the customer page (artboard 02): one surface with hairline cells, scrolled
 * sideways at phone width (05 direction A). Values come ready from `buildCustomerKpis`.
 */
import type { CustomerKpi } from '../../utils/customerKpis'

defineProps<{ kpis: readonly CustomerKpi[] | null; loading?: boolean }>()
</script>

<template>
  <div v-if="loading && !kpis" class="customer-kpis" aria-hidden="true" data-testid="customer-kpis-skeleton">
    <div v-for="index in 5" :key="index" class="customer-kpi">
      <USkeleton class="h-3 w-20 !rounded" />
      <USkeleton class="h-5 w-24 !rounded" />
    </div>
  </div>
  <dl v-else-if="kpis" class="customer-kpis" aria-label="Resumen del cliente" data-testid="customer-kpis">
    <div
      v-for="kpi in kpis"
      :key="kpi.key"
      class="customer-kpi"
      :data-tone="kpi.tone"
      :data-testid="`customer-kpi-${kpi.key}`"
    >
      <dt>{{ kpi.label }}</dt>
      <dd class="min-w-0">
        <span class="hf-figure customer-kpi-value">{{ kpi.value }}</span>
        <small v-if="kpi.note" class="hf-figure customer-kpi-note">{{ kpi.note }}</small>
      </dd>
    </div>
  </dl>
</template>
