<script setup lang="ts">
import { computed } from 'vue'
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { formatCentsMXN } from '../utils/currency.utils'
import type { SaleDetailItem } from '../interfaces/sale.types'
import SaleItemBadges from './SaleItemBadges.vue'

const props = defineProps<{
  items: SaleDetailItem[]
  /** Forwarded only to the owned badge tooltips; absent by default. */
  portalClass?: string
}>()

// Below md the lines are compact rows: a 5-column table at 390px squeezes
// every cell to ~11px text.
const mobile = useBreakpoints(breakpointsTailwind).smaller('md')

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
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="sale-detail-section-title">
          <UIcon name="i-lucide-package" class="size-4" />
          Productos
        </h3>
        <span class="text-[13px] text-(--hf-muted)" data-testid="items-count">
          {{ items.length }} {{ items.length === 1 ? 'artículo' : 'artículos' }}
        </span>
      </div>
    </template>
    <ul v-if="mobile" class="divide-y divide-(--hf-border)" data-testid="items-compact">
      <li
        v-for="(item, index) in itemsView"
        :key="`${item.productName}-${index}`"
        :data-testid="`item-compact-${index}`"
        class="space-y-1 py-3 first:pt-0 last:pb-0"
      >
        <p class="line-clamp-2 text-sm font-semibold text-(--hf-heading)">{{ item.productName }}</p>
        <p v-if="item.variantName" class="text-[13px] text-(--hf-muted)">{{ item.variantName }}</p>
        <div class="flex items-baseline justify-between gap-3 text-sm">
          <span class="text-(--hf-muted) tabular-nums">
            {{ item.quantity }} × {{ formatCentsMXN(item.unitPriceCents) }}
            <span v-if="item.discountAmountCents"> · -{{ formatCentsMXN(item.discountAmountCents) }}</span>
          </span>
          <span class="hf-figure font-semibold text-(--hf-heading)">{{ formatCentsMXN(item.subtotalCents) }}</span>
        </div>
        <SaleItemBadges
          :portal-class="portalClass"
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
      </li>
    </ul>
    <table v-else class="hf-plain-table sale-detail-items-table w-full text-sm" data-testid="items-table">
      <thead>
        <tr>
          <th class="py-2 text-left">Producto</th>
          <th class="py-2 text-right">Cant.</th>
          <th class="py-2 text-right">Precio unit.</th>
          <th class="py-2 text-right">Desc.</th>
          <th class="py-2 text-right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(item, index) in itemsView"
          :key="`${item.productName}-${index}`"
          :data-testid="`item-row-${index}`"
          class="align-top"
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
              :portal-class="portalClass"
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
  </UCard>
</template>