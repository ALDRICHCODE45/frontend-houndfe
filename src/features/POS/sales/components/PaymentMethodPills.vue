<script setup lang="ts">
import { computed } from 'vue'
import type { SaleDetailPaymentMethod } from '../interfaces/sale.types'
import { getMethodMeta } from '../utils/paymentMethodMeta'

const props = withDefaults(
  defineProps<{
    methods: SaleDetailPaymentMethod[]
    maxVisible?: number
    compact?: boolean
  }>(),
  {
    maxVisible: 2,
    compact: false,
  },
)

const visible = computed(() => props.methods.slice(0, props.maxVisible))
const overflow = computed(() => props.methods.slice(props.maxVisible))
const overflowLabel = computed(() =>
  overflow.value.map((m) => getMethodMeta(m).label).join(', '),
)
</script>

<template>
  <div class="flex flex-nowrap items-center gap-1">
    <!-- Empty state -->
    <span v-if="methods.length === 0">—</span>

    <template v-else>
      <!-- Visible pills -->
      <UBadge
        v-for="method in visible"
        :key="method"
        variant="subtle"
        :color="getMethodMeta(method).color"
        size="sm"
        :icon="getMethodMeta(method).icon"
        :aria-label="getMethodMeta(method).label"
      >
        <span
          data-testid="pill-label"
          :class="compact ? 'hidden' : 'hidden md:inline-flex'"
        >{{ getMethodMeta(method).label }}</span>
      </UBadge>

      <!-- Overflow chip -->
      <UTooltip v-if="overflow.length > 0" :text="overflowLabel">
        <UBadge
          variant="subtle"
          color="neutral"
          size="sm"
          :aria-label="overflowLabel"
          tabindex="0"
          role="button"
        >+{{ overflow.length }}</UBadge>
      </UTooltip>
    </template>
  </div>
</template>
