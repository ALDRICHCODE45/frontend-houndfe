<script setup lang="ts">
import { computed } from 'vue'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import { formatCentsMXN } from '../utils/currency.utils'
import type { PriceSource } from '../interfaces/sale.types'

// Shared between draft items (SaleItem) and confirmed-sale items
// (SaleDetailItem). Both expose the same traceability fields, so a
// single presentational component covers both surfaces and guarantees
// visual consistency between the POS draft and the sale detail view.
//
// `promotionId` discriminates a line discount originated from a
// promotion (auto or manual apply) from a seller's manual free-form
// discount. When set, a distinct PROMO badge renders with the
// promotion's title. The remove control is gated behind `removable`
// because SaleDetailItem (confirmed-sale surface) has no remove
// affordance — that surface MUST render the badge but NOT the remove
// button. Only the draft context (SaleItemRow) sets `removable=true`.
//
// `rewardKind` (buy-x-get-y-promotion REQ-2): when the backend marks a
// confirmed-sale line as the FREE unit of a BXGY promo, this component
// renders a distinct reward badge labeled `GRATIS`. Null/absent means
// the line is a regular confirmed line and no reward badge renders.
// Prop-driven and pure: parent passes the value, this component only
// decides whether to render the badge.
const props = withDefaults(
  defineProps<{
    priceSource?: PriceSource | null
    originalPriceCents?: number | null
    unitPriceCents: number
    discountType?: 'amount' | 'percentage' | null
    discountValue?: number | null
    discountAmountCents?: number | null
    discountTitle?: string | null
    promotionId?: string | null
    removable?: boolean
    rewardKind?: 'buy_x_get_y' | null
  }>(),
  {
    removable: false,
  },
)

const emit = defineEmits<{
  'remove-promo': [promotionId: string]
}>()

const priceChanged = computed(
  () =>
    props.originalPriceCents != null &&
    props.originalPriceCents !== props.unitPriceCents,
)

const priceSourceBadge = computed(() => {
  if (props.priceSource === 'price_list' && priceChanged.value) {
    return {
      label: 'PRECIO LISTA',
      icon: 'i-lucide-tags',
      tone: 'info' as const,
    }
  }
  if (props.priceSource === 'custom' && priceChanged.value) {
    return {
      label: 'PRECIO MANUAL',
      icon: 'i-lucide-pencil-ruler',
      tone: 'warning' as const,
    }
  }
  return null
})

const discountBadgeLabel = computed(() => {
  if (props.discountType === 'percentage') {
    return `DESCUENTO -${props.discountValue ?? 0}%`
  }
  if (props.discountAmountCents) {
    return `DESCUENTO -${formatCentsMXN(props.discountAmountCents)}`
  }
  return 'DESCUENTO'
})

const hasPromotion = computed(() => props.promotionId != null)

const isReward = computed(() => props.rewardKind === 'buy_x_get_y')

const hasAnyBadge = computed(
  () =>
    priceSourceBadge.value !== null ||
    props.discountType != null ||
    hasPromotion.value ||
    isReward.value,
)

function handleRemovePromo() {
  if (props.promotionId == null) return
  emit('remove-promo', props.promotionId)
}
</script>

<template>
  <div
    v-if="hasAnyBadge"
    data-testid="sale-item-badge-group"
    class="flex flex-wrap items-center gap-1"
  >
    <AppBadge
      v-if="priceSourceBadge"
      :tone="priceSourceBadge.tone"
      :icon="priceSourceBadge.icon"
      :label="priceSourceBadge.label"
    />

    <span
      v-if="hasPromotion"
      class="inline-flex items-center gap-0.5"
      data-testid="sale-item-promo-badge"
    >
      <UTooltip v-if="discountTitle" :text="discountTitle">
        <AppBadge
          tone="info"
          icon="i-lucide-tag"
          :label="discountTitle"
        />
      </UTooltip>
      <AppBadge
        v-else
        tone="info"
        icon="i-lucide-tag"
        label="Promoción"
      />
      <UButton
        v-if="removable"
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-x"
        aria-label="Quitar promoción"
        data-testid="sale-item-remove-promo"
        @click.stop="handleRemovePromo"
      />
    </span>

    <UTooltip v-if="discountType && discountTitle" :text="discountTitle">
      <AppBadge
        tone="success"
        icon="i-lucide-badge-percent"
        :label="discountBadgeLabel"
      />
    </UTooltip>
    <AppBadge
      v-else-if="discountType"
      tone="success"
      icon="i-lucide-badge-percent"
      :label="discountBadgeLabel"
    />

    <AppBadge
      v-if="isReward"
      tone="success"
      icon="i-lucide-gift"
      label="GRATIS"
      data-testid="sale-item-reward-badge"
    />
  </div>
</template>
