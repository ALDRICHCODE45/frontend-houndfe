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
  <table class="w-full text-sm" data-testid="items-table">
    <thead>
      <tr class="border-b border-default text-xs font-semibold uppercase tracking-wider text-muted">
        <th class="py-2 text-left">Producto</th>
        <th class="py-2 text-right">Cant</th>
        <th class="py-2 text-right">Precio Unit</th>
        <th class="py-2 text-right">Desc</th>
        <th class="py-2 text-right">Subtotal</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="(item, index) in itemsView"
        :key="`${item.productName}-${index}`"
        :data-testid="`item-row-${index}`"
        class="border-b border-default/50 align-top"
      >
        <td class="py-2">
          <p
            :data-testid="`item-name-${index}`"
            class="font-semibold text-highlighted"
          >
            {{ item.productName }}
          </p>
          <p
            v-if="item.variantName || item.priceOverridden || item.hasLineDiscount"
            :data-testid="`item-subtitle-${index}`"
            class="text-xs text-muted"
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
          </p>
          <SaleItemBadges
            class="mt-1"
            :price-source="item.priceSource"
            :original-price-cents="item.originalPriceCents"
            :unit-price-cents="item.unitPriceCents"
            :discount-type="item.discountType"
            :discount-value="item.discountValue"
            :discount-amount-cents="item.discountAmountCents"
            :discount-title="item.discountTitle"
            :reward-kind="item.rewardKind"
            :reward-discount-percent="item.rewardDiscountPercent"
            :promotion-id="item.promotionId"
          />
        </td>
        <td
          :data-testid="`item-quantity-${index}`"
          class="py-2 text-right text-muted tabular-nums"
        >
          × {{ item.quantity }}
        </td>
        <td class="py-2 text-right tabular-nums">
          {{ formatCentsMXN(item.unitPriceCents) }}
        </td>
        <td
          :data-testid="`item-discount-${index}`"
          class="py-2 text-right tabular-nums"
        >
          <span v-if="item.discountAmountCents" class="text-muted">
            -{{ formatCentsMXN(item.discountAmountCents) }}
          </span>
          <span v-else>—</span>
        </td>
        <td class="py-2 text-right">
          <p
            :data-testid="`item-subtotal-${index}`"
            class="font-semibold tabular-nums text-default"
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
        </td>
      </tr>
    </tbody>
  </table>
</template>