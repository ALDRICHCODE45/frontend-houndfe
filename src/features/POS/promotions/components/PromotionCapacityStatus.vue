<script setup lang="ts">
/**
 * PromotionCapacityStatus — presentational badge for server-owned capacity.
 *
 * Single responsibility: turn the three backend counters into one honest,
 * non-interactive status. It never computes a remaining counter; the label
 * always echoes `remainingProductUnits` (or `consumedProductUnits` when the cap
 * is unlimited). Inconsistent/stale snapshots degrade to a warning instead of
 * throwing or showing a wrong number.
 */
import { computed } from 'vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import { resolvePromotionCapacityState } from '../utils/promotionSummary.utils'

const props = withDefaults(
  defineProps<{
    maxProductUnits?: number | null
    consumedProductUnits?: number | null
    remainingProductUnits?: number | null
    /** Reduces surrounding spacing for dense list/table cells. */
    compact?: boolean
  }>(),
  {
    // No counter defaults: a missing prop must stay `undefined` so the
    // resolver can treat it as absent (`stale`) instead of faking `null`/`0`.
    compact: false,
  },
)

const descriptor = computed(() =>
  resolvePromotionCapacityState({
    maxProductUnits: props.maxProductUnits,
    consumedProductUnits: props.consumedProductUnits,
    remainingProductUnits: props.remainingProductUnits,
  }),
)

const accessibleLabel = computed(() => {
  const { state, max, consumed, remaining } = descriptor.value
  if (state === 'stale') {
    return 'Cupo desactualizado · Consumidas: no disponible · Restantes: no disponible'
  }
  const maxLabel = max == null ? 'ilimitado' : `${max}`
  const consumedLabel = consumed == null ? 'no disponible' : `${consumed}`
  // Unlimited has no remaining count; say so honestly instead of 'desconocido'.
  const remainingLabel = remaining == null ? 'sin límite' : `${remaining}`
  return `Cupo: ${maxLabel} · Consumidas: ${consumedLabel} · Restantes: ${remainingLabel}`
})
</script>

<template>
  <span
    data-testid="promotion-capacity-status"
    class="inline-flex max-w-full"
    :class="compact ? '' : 'py-0.5'"
    :data-state="descriptor.state"
    :aria-label="accessibleLabel"
    role="status"
  >
    <AppBadge :label="descriptor.label" :tone="descriptor.tone" :icon="descriptor.icon" />
  </span>
</template>
