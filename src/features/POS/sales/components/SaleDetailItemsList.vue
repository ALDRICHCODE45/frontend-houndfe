<script setup lang="ts">
import { computed } from 'vue'
import { formatCentsMXN } from '../utils/currency.utils'
import type { SaleDetailItem } from '../interfaces/sale.types'
import SaleItemBadges from './SaleItemBadges.vue'

const props = defineProps<{
  items: SaleDetailItem[]
}>()

// Per-item view model. Decoupling presentation logic from the template
// keeps the v-for body readable and makes the strikethrough rules
// explicit and unit-testable from outside (via item presence in DOM).
const itemsView = computed(() =>
  props.items.map((item) => {
    const priceOverridden =
      ['price_list', 'custom'].includes(item.priceSource ?? '') &&
      item.originalPriceCents != null &&
      item.originalPriceCents !== item.unitPriceCents

    const hasLineDiscount =
      item.discountType != null && item.prePriceCentsBeforeDiscount != null

    return {
      ...item,
      priceOverridden,
      hasLineDiscount,
    }
  }),
)
</script>

<template>
  <div class="space-y-3">
    <div
      v-for="(item, index) in itemsView"
      :key="`${item.productName}-${index}`"
      :data-testid="`item-card-${index}`"
      class="flex items-start gap-4 rounded-xl border border-default bg-default px-4 py-3"
    >
      <UAvatar
        v-if="item.imageUrl"
        :data-testid="`item-image-${index}`"
        :src="item.imageUrl"
        :alt="`${item.productName}${item.variantName ? ' - ' + item.variantName : ''}`"
        size="lg"
        :ui="{ rounded: 'rounded-lg' }"
      />
      <UAvatar
        v-else
        :data-testid="`item-image-${index}`"
        icon="i-lucide-image-off"
        alt="Sin imagen"
        size="lg"
        :ui="{ rounded: 'rounded-lg' }"
      />

      <div class="flex-1 min-w-0">
        <p
          :data-testid="`item-name-${index}`"
          class="text-base font-semibold text-highlighted"
        >
          {{ item.productName }}
        </p>
        <p
          :data-testid="`item-subtitle-${index}`"
          class="text-sm text-muted"
        >
          <span v-if="item.variantName">{{ item.variantName }} · </span>
          <span
            v-if="item.priceOverridden"
            :data-testid="`item-original-price-${index}`"
            class="line-through mr-1"
          >
            {{ formatCentsMXN(item.originalPriceCents ?? 0) }}
          </span>
          <span
            v-if="item.hasLineDiscount"
            :data-testid="`item-pre-discount-price-${index}`"
            class="line-through mr-1"
          >
            {{ formatCentsMXN(item.prePriceCentsBeforeDiscount ?? 0) }}
          </span>
          <span>{{ formatCentsMXN(item.unitPriceCents) }}</span>
        </p>
        <SaleItemBadges
          class="mt-1.5"
          :price-source="item.priceSource"
          :original-price-cents="item.originalPriceCents"
          :unit-price-cents="item.unitPriceCents"
          :discount-type="item.discountType"
          :discount-value="item.discountValue"
          :discount-amount-cents="item.discountAmountCents"
          :discount-title="item.discountTitle"
          :reward-kind="item.rewardKind"
          :promotion-id="item.promotionId"
        />
      </div>

      <span
        :data-testid="`item-quantity-${index}`"
        class="ml-auto self-center text-sm text-muted tabular-nums"
      >
        × {{ item.quantity }}
      </span>

      <div class="min-w-[88px] self-center">
        <p
          :data-testid="`item-subtotal-${index}`"
          class="text-right text-sm font-semibold tabular-nums text-default"
        >
          {{ formatCentsMXN(item.subtotalCents) }}
        </p>
        <p
          v-if="item.hasLineDiscount"
          :data-testid="`item-line-original-${index}`"
          class="text-right text-xs text-muted line-through tabular-nums"
        >
          {{ formatCentsMXN((item.prePriceCentsBeforeDiscount ?? 0) * item.quantity) }}
        </p>
      </div>
    </div>
  </div>
</template>
