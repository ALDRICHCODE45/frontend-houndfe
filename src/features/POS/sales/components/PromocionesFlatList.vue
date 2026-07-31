<script setup lang="ts">
import { computed } from 'vue'
import type { ApplicablePromotion } from '../interfaces/sale.types'
import { buildBxgyHint } from '../utils/promotion.utils'

const props = withDefaults(
  defineProps<{
    promotions: ApplicablePromotion[]
    loading?: boolean
    appliedIds?: string[]
  }>(),
  {
    loading: false,
    appliedIds: () => [] as string[],
  },
)

const emit = defineEmits<{
  apply: [promotionId: string]
  remove: [promotionId: string]
}>()

const appliedSet = computed(() => new Set(props.appliedIds))

function isApplied(promotionId: string): boolean {
  return appliedSet.value.has(promotionId)
}

function handleApply(promotionId: string) {
  emit('apply', promotionId)
}

function handleRemove(promotionId: string) {
  emit('remove', promotionId)
}
</script>

<template>
  <div v-if="promotions.length > 0" data-testid="promociones-flat-list">
    <!-- Section header -->
    <p class="text-xs text-muted uppercase font-semibold px-4 pt-3 pb-1 tracking-wide">
      Promociones disponibles
      <span class="tabular-nums">({{ promotions.length }})</span>
    </p>

    <!-- Loading skeletons -->
    <div v-if="loading" data-testid="promociones-loading" class="flex flex-col gap-2 px-4 pb-2">
      <USkeleton class="h-10 w-full rounded" />
      <USkeleton class="h-10 w-full rounded" />
      <USkeleton class="h-10 w-full rounded" />
    </div>

    <!-- Card list -->
    <div v-else class="flex flex-col px-3 pb-2">
      <div
        v-for="promo in promotions"
        :key="promo.id"
        :data-testid="`promo-card-${promo.id}`"
        :class="[
          'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-default mb-1',
          isApplied(promo.id) ? 'border-l-2 border-l-success' : '',
        ]"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span :data-testid="`promo-title-${promo.id}`" class="text-xs font-medium truncate">
              {{ promo.title }}
            </span>
            <AppBadge
              tone="info"
              :label="promo.type === 'ORDER_DISCOUNT' ? 'Orden' : promo.type === 'BUY_X_GET_Y' ? '2x1' : 'Prod'"
            />
          </div>
          <p
            v-if="promo.unitsNeeded != null"
            :data-testid="`promo-hint-${promo.id}`"
            class="text-[11px] text-muted mt-0.5"
          >
            {{ buildBxgyHint(promo.unitsNeeded) }}
          </p>
        </div>

        <UButton
          v-if="!isApplied(promo.id)"
          :data-testid="`promo-apply-${promo.id}`"
          :disabled="promo.eligible === false"
          size="xs"
          color="primary"
          variant="solid"
          label="Aplicar"
          @click="handleApply(promo.id)"
        />
        <UButton
          v-else
          :data-testid="`promo-remove-${promo.id}`"
          size="xs"
          color="neutral"
          variant="ghost"
          label="Quitar"
          icon="i-lucide-x"
          :aria-label="`Quitar ${promo.title}`"
          @click="handleRemove(promo.id)"
        />
      </div>
    </div>
  </div>
</template>
