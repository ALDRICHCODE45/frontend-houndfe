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
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { resolvePromotionCapacityState } from '../utils/promotionSummary.utils'

const props = withDefaults(
  defineProps<{
    maxProductUnits?: number | null
    consumedProductUnits?: number | null
    remainingProductUnits?: number | null
    /** Reduces surrounding spacing for dense list/table cells. */
    compact?: boolean
    /** An unlimited cap is the default and says nothing: show a dash (list rows). */
    hideUnlimited?: boolean
  }>(),
  {
    hideUnlimited: false,
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

// In list rows the dash already means "no limit", so an unlimited cap with consumption says only
// the consumption, short enough that the Cupo column does not push the table past its card.
const label = computed(() => {
  const { state, consumed } = descriptor.value
  if (props.hideUnlimited && state === 'unlimited_consumed' && consumed != null) {
    return `${consumed} ${consumed === 1 ? 'consumida' : 'consumidas'}`
  }
  return descriptor.value.label
})

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
  <span v-if="hideUnlimited && descriptor.state === 'unlimited'" class="text-muted" data-testid="promotion-capacity-none">—</span>
  <span
    v-else
    data-testid="promotion-capacity-status"
    class="inline-flex max-w-full"
    :class="compact ? '' : 'py-0.5'"
    :data-state="descriptor.state"
    :aria-label="accessibleLabel"
    role="status"
  >
    <StatusBadge :label="label" :tone="descriptor.tone" :aria-label="label" />
  </span>
</template>
