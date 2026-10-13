<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SaleItem } from '../interfaces/sale.types'
import type { ApplyItemDiscountPayload, OverrideItemPricePayload } from '../interfaces/sale.types'
import { formatCentsMXN, lineCents } from '../utils/currency.utils'
import { getRewardBadgeLabel } from '../utils/promotion.utils'
import AppBadge from '@/core/shared/components/AppBadge.vue'
import SaleItemBadges from './SaleItemBadges.vue'
import PriceOverrideModal from './PriceOverrideModal.vue'
import ItemDiscountModal from './ItemDiscountModal.vue'
import ProductDetailModal from './ProductDetailModal.vue'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    item: SaleItem
    imageUrl?: string | null
     isUpdating?: boolean
     isDraft?: boolean
     saleId: string
      onSubmitPriceOverride: (itemId: string, payload: OverrideItemPricePayload) => Promise<unknown>
      onApplyDiscount: (itemId: string, payload: ApplyItemDiscountPayload) => Promise<unknown>
      onRemoveDiscount: (itemId: string) => Promise<unknown>
      onRemoveItem?: (itemId: string) => Promise<unknown>
      /** Presentation-only density flag for the mobile cart sheet. */
      mobileSheet?: boolean
      /**
       * Presentation-only opt-in for the exact v0 cart composition (T11).
       * False by default, so the row keeps its previous nested-card paint and
       * its prior DOM for every other consumer.
       */
      composition?: boolean
      /**
       * Optional teleport boundary marker forwarded to the installed row menu
       * and to the owned item dialogs. Absent by default, so the row and its
       * dialogs keep their native defaults and prior paint.
       */
      portalClass?: string
     }>(),
  {
    imageUrl: null,
    isUpdating: false,
    isDraft: true,
    mobileSheet: false,
    composition: false,
    onSubmitPriceOverride: async () => undefined,
    onApplyDiscount: async () => undefined,
    onRemoveDiscount: async () => undefined,
    onRemoveItem: async () => undefined,
  },
)

const imageBroken = ref(false)

// T11 (unit B): the exact v0 cart composition drops the nested rounded card in
// favour of a divider-separated row. Omitting the opt-in reproduces the prior
// class string exactly, so no other consumer's paint moves.
const cardClass = computed(() => {
  if (props.composition) {
    return 'sales-pos-cart-row sales-pos-cart-row-composition transition-all duration-150'
  }
  return props.mobileSheet
    ? 'mx-3 border border-default transition-all duration-150 sales-pos-cart-row mb-3 rounded-2xl px-3.5 py-3'
    : 'mx-3 border border-default transition-all duration-150 sales-pos-cart-row mb-2 rounded-xl hover:bg-elevated/40 hover:border-default px-3 py-2'
})

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'update-qty': [itemId: string, quantity: number]
  'remove-promo': [promotionId: string]
}>()

// ── Local state ───────────────────────────────────────────────────────────────

const localQty = ref(props.item.quantity)
const previousQty = ref(props.item.quantity)
const isPriceModalOpen = ref(false)
const isDiscountModalOpen = ref(false)
const isDetailModalOpen = ref(false)
const itemActions = computed(() => {
  if (!props.isDraft) return []

  const hasDiscount = !!props.item.discountType
  const canAddDiscount = props.item.unitPriceCents > 0
  const discountAction = hasDiscount
    ? {
        label: 'Quitar descuento',
        icon: 'i-lucide-percent-circle',
        onSelect: () => {
          void props.onRemoveDiscount(props.item.id)
        },
      }
    : canAddDiscount
      ? {
          label: 'Agregar descuento',
          icon: 'i-lucide-percent',
          onSelect: () => {
            isDiscountModalOpen.value = true
          },
        }
      : null

  return [
    [
      {
        label: 'Ver detalles',
        icon: 'i-lucide-info',
        onSelect: () => {
          isDetailModalOpen.value = true
        },
      },
      {
        label: 'Cambiar precio',
        icon: 'i-lucide-badge-dollar-sign',
        onSelect: () => {
          isPriceModalOpen.value = true
        },
      },
      ...(discountAction ? [discountAction] : []),
      {
        label: 'Eliminar producto',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => {
          void props.onRemoveItem?.(props.item.id)
        },
      },
    ],
  ]
})

const showPriceOrigin = computed(
  () =>
    ['price_list', 'custom'].includes(props.item.priceSource ?? '') &&
    props.item.originalPriceCents != null &&
    props.item.originalPriceCents > props.item.unitPriceCents,
)
const showDiscountOrigin = computed(
  () =>
    props.item.discountType != null &&
    props.item.prePriceCentsBeforeDiscount != null &&
    props.item.prePriceCentsBeforeDiscount > props.item.unitPriceCents,
)

const lineDisplay = computed(() => {
  const grossPerUnit = props.item.prePriceCentsBeforeDiscount ?? props.item.unitPriceCents
  const grossLine = lineCents(grossPerUnit, props.item.quantity)
  const netLine = props.item.subtotalCents ?? grossLine
  const showStruckGross = netLine < grossLine
  return { grossPerUnit, grossLine, netLine, showStruckGross }
})

// Inline badge computed (phase 14b — draft surface renders badges inline instead of SaleItemBadges)

const inlinePriceSourceBadge = computed(() => {
  if (showPriceOrigin.value && props.item.priceSource === 'price_list') {
    return { label: 'PRECIO LISTA', icon: 'i-lucide-tags', tone: 'info' as const }
  }
  if (showPriceOrigin.value && props.item.priceSource === 'custom') {
    return { label: 'PRECIO MANUAL', icon: 'i-lucide-pencil-ruler', tone: 'warning' as const }
  }
  return null
})

const inlineDiscountLabel = computed(() => {
  if (props.item.discountType === 'percentage') {
    return `DESCUENTO -${props.item.discountValue ?? 0}%`
  }
  if (props.item.discountAmountCents) {
    return `DESCUENTO -${formatCentsMXN(props.item.discountAmountCents)}`
  }
  if (props.item.discountType) return 'DESCUENTO'
  return null
})

const inlinePromotionTitle = computed(() => {
  if (props.item.promotionId == null) return null
  return props.item.discountTitle || 'Promoción'
})

const inlineRewardLabel = computed(() =>
  getRewardBadgeLabel(props.item.rewardKind, props.item.rewardDiscountPercent),
)

const inlineHasAnyBadge = computed(
  () =>
    inlinePriceSourceBadge.value !== null ||
    props.item.discountType != null ||
    props.item.promotionId != null ||
    inlineRewardLabel.value != null,
)

function handleInlineRemovePromo() {
  if (props.item.promotionId == null) return
  emit('remove-promo', props.item.promotionId)
}

// Sync localQty when item.quantity changes from parent
watch(
  () => props.item.quantity,
  (newQty) => {
    localQty.value = newQty
    previousQty.value = newQty
  },
)

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleQtyCommit() {
  const newQty = localQty.value

  if (newQty === previousQty.value) {
    return
  }

  if (newQty < 1) {
    localQty.value = previousQty.value
    return
  }

  previousQty.value = newQty
  emit('update-qty', props.item.id, newQty)
}
</script>

<template>
  <!-- Phase 14b — horizontal compact card layout.
       Left: thumbnail · Center: name/specs/qty · Right: pricing stack.
       All props, emits, computed, and data-testid attrs preserved. -->
  <div data-testid="sale-item-card" :class="cardClass">
    <div class="flex items-start gap-3">
      <!-- LEFT — Thumbnail (48px square) -->
      <div
        data-testid="sale-item-thumbnail"
        class="shrink-0 rounded-lg flex items-center justify-center overflow-hidden sales-pos-cart-row-media"
        :class="[
          mobileSheet ? 'h-14 w-14' : 'h-12 w-12',
          !imageUrl || imageBroken ? 'bg-primary/8 border border-primary/15' : 'bg-elevated border border-default',
        ]"
      >
        <UIcon
          v-if="!imageUrl || imageBroken"
          name="i-lucide-package"
          class="h-6 w-6 text-primary/60"
        />
        <img
          v-else
          :src="imageUrl"
          :alt="item.productName"
          class="h-full w-full object-cover"
          loading="lazy"
          @error="imageBroken = true"
        />
      </div>

      <!-- CENTER — stacked info (name → specs → qty row → inline badges) -->
      <div class="flex-1 min-w-0 flex flex-col sales-pos-cart-row-content" :class="mobileSheet ? 'gap-1' : 'gap-0.5'">
        <!-- Composition head: clean name + item menu on the same line. -->
        <div
          v-if="composition"
          data-testid="sale-item-head"
          class="min-w-0 flex items-start justify-between gap-2 sales-pos-cart-row-head"
        >
          <p
            data-testid="sale-item-name"
            class="font-medium text-highlighted truncate sales-pos-cart-row-name"
            :class="mobileSheet ? 'text-base' : 'text-sm'"
          >
            {{ item.productName }}
          </p>
          <UDropdownMenu
            v-if="isDraft"
            :items="itemActions"
            :ui="portalClass ? { content: portalClass } : undefined"
          >
            <UButton
              data-testid="sale-item-menu"
              :size="mobileSheet ? 'sm' : 'xs'"
              :class="mobileSheet ? 'min-h-[44px] min-w-[44px]' : undefined"
              color="neutral"
              variant="ghost"
              icon="i-lucide-ellipsis-vertical"
              :aria-label="`Opciones de ${item.productName}`"
            />
          </UDropdownMenu>
        </div>
        <p
          v-else
          data-testid="sale-item-name"
          class="font-medium text-highlighted truncate sales-pos-cart-row-name"
          :class="mobileSheet ? 'text-base' : 'text-sm'"
        >
          {{ item.productName }}
        </p>

        <!-- Composition detail line: the available identity only. -->
        <p
          v-if="composition && item.variantName"
          data-testid="sale-item-detail"
          class="sales-pos-cart-row-detail"
        >
          {{ item.variantName }}
        </p>

        <!-- Specs line (prior paint): variant + unit price context. -->
        <p v-if="!composition" class="text-[11px] text-muted truncate">
          <span v-if="item.variantName" class="uppercase tracking-wide">{{ item.variantName }}</span>
          <span v-if="item.variantName"> · </span>
          <span
            v-if="showPriceOrigin"
            data-testid="sale-item-unit-strike-original"
            class="line-through mr-1"
          >{{ formatCentsMXN(item.originalPriceCents ?? 0) }}</span>
          <span
            v-if="showDiscountOrigin"
            data-testid="sale-item-unit-strike-pre-discount"
            class="line-through mr-1"
          >{{ formatCentsMXN(item.prePriceCentsBeforeDiscount ?? 0) }}</span>
          <span class="font-medium text-toned">{{ formatCentsMXN(item.unitPriceCents) }} c/u</span>
        </p>

        <!-- Composition unit-price line: original/current price context. -->
        <p v-else data-testid="sale-item-unit" class="sales-pos-cart-row-unit">
          <span
            v-if="showPriceOrigin"
            data-testid="sale-item-unit-strike-original"
            class="line-through"
          >{{ formatCentsMXN(item.originalPriceCents ?? 0) }}</span>
          <span
            v-if="showDiscountOrigin"
            data-testid="sale-item-unit-strike-pre-discount"
            class="line-through"
          >{{ formatCentsMXN(item.prePriceCentsBeforeDiscount ?? 0) }}</span>
          <span class="sales-pos-cart-row-unit-current">{{ formatCentsMXN(item.unitPriceCents) }} c/u</span>
        </p>

        <!-- Qty row: stepper + trash + actions dropdown (draft only) -->
        <div
          v-if="isDraft"
          data-testid="sale-item-qty-row"
          class="flex items-center sales-pos-cart-row-qty"
          :class="mobileSheet ? 'gap-1.5 mt-1.5' : 'gap-1 mt-0.5'"
        >
          <UInputNumber
            v-model="localQty"
            :size="mobileSheet ? 'sm' : 'xs'"
            :min="1"
            :disabled="isUpdating"
            :class="mobileSheet ? 'w-24 shrink-0' : undefined"
            @blur="handleQtyCommit"
            @change="handleQtyCommit"
          />
          <UButton
            data-testid="sale-item-remove"
            icon="i-lucide-trash-2"
            :size="mobileSheet ? 'sm' : 'xs'"
            :class="mobileSheet ? 'min-h-[44px] min-w-[44px]' : undefined"
            color="neutral"
            variant="ghost"
            @click="void props.onRemoveItem?.(props.item.id)"
          />
          <UDropdownMenu
            v-if="!composition"
            :items="itemActions"
            :ui="portalClass ? { content: portalClass } : undefined"
          >
            <UButton
              :size="mobileSheet ? 'sm' : 'xs'"
              :class="mobileSheet ? 'min-h-[44px] min-w-[44px]' : undefined"
              color="neutral"
              variant="ghost"
              icon="i-lucide-ellipsis-vertical"
            />
          </UDropdownMenu>
          <strong
            v-if="composition"
            data-testid="sale-item-line-net"
            class="sales-pos-cart-row-line tabular-nums"
          >{{ formatCentsMXN(lineDisplay.netLine) }}</strong>
          <span
            v-if="composition && lineDisplay.showStruckGross"
            data-testid="sale-item-line-gross-strike"
            class="text-[10px] text-muted line-through tabular-nums"
          >{{ formatCentsMXN(lineDisplay.grossLine) }}</span>
        </div>

        <!-- Draft inline badges (phase 14b — promo/discount/reward rendered inline, NOT via SaleItemBadges) -->
        <div
          v-if="isDraft && inlineHasAnyBadge"
          data-testid="sale-item-badge-group"
          class="flex flex-wrap items-center gap-1 mt-0.5 sales-pos-cart-row-badges"
        >
          <AppBadge
            v-if="inlinePriceSourceBadge"
            :tone="inlinePriceSourceBadge.tone"
            :icon="inlinePriceSourceBadge.icon"
            :label="inlinePriceSourceBadge.label"
          />
          <span
            v-if="item.promotionId"
            data-testid="sale-item-promo-badge"
            class="inline-flex items-center gap-0.5"
          >
            <UTooltip
              v-if="inlinePromotionTitle"
              :text="inlinePromotionTitle"
              :ui="portalClass ? { content: portalClass } : undefined"
            >
              <AppBadge tone="info" icon="i-lucide-tag" :label="inlinePromotionTitle" />
            </UTooltip>
            <AppBadge v-else tone="info" icon="i-lucide-tag" label="Promoción" />
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-x"
              aria-label="Quitar promoción"
              data-testid="sale-item-remove-promo"
              @click.stop="handleInlineRemovePromo"
            />
          </span>
          <UTooltip
            v-if="item.discountType && item.discountTitle"
            :text="item.discountTitle"
            :ui="portalClass ? { content: portalClass } : undefined"
          >
            <AppBadge tone="success" icon="i-lucide-badge-percent" :label="inlineDiscountLabel ?? ''" />
          </UTooltip>
          <AppBadge
            v-else-if="item.discountType"
            tone="success"
            icon="i-lucide-badge-percent"
            :label="inlineDiscountLabel ?? ''"
          />
          <AppBadge
            v-if="inlineRewardLabel != null"
            tone="success"
            icon="i-lucide-gift"
            :label="inlineRewardLabel"
            data-testid="sale-item-reward-badge"
          />
        </div>
      </div>

      <!-- RIGHT — pricing stack (prior paint; the composition moves the unit
           price and the line total into the row body). -->
      <div
        v-if="!composition"
        class="shrink-0 text-right flex flex-col items-end min-w-[64px] sales-pos-cart-row-price"
      >
        <p class="text-xs text-muted tabular-nums leading-tight">
          {{ formatCentsMXN(item.unitPriceCents) }}
        </p>
        <p
          v-if="item.discountType"
          class="text-[10px] text-primary tabular-nums leading-tight"
        >
          {{ inlineDiscountLabel }}
        </p>
        <p
          data-testid="sale-item-line-net"
          class="font-bold text-highlighted tabular-nums leading-tight"
          :class="mobileSheet ? 'text-base' : 'text-sm'"
        >
          {{ formatCentsMXN(lineDisplay.netLine) }}
        </p>
        <p
          v-if="lineDisplay.showStruckGross"
          data-testid="sale-item-line-gross-strike"
          class="text-[10px] text-muted line-through tabular-nums"
        >
          {{ formatCentsMXN(lineDisplay.grossLine) }}
        </p>
      </div>
    </div>

    <!-- Non-draft (confirmed sale) — render SaleItemBadges as before -->
    <div v-if="!isDraft" class="flex items-center gap-3 mt-1">
      <div class="flex-1 min-w-0">
        <SaleItemBadges
          :portal-class="portalClass"
          :price-source="item.priceSource"
          :original-price-cents="item.originalPriceCents"
          :unit-price-cents="item.unitPriceCents"
          :discount-type="item.discountType"
          :discount-value="item.discountValue"
          :discount-amount-cents="item.discountAmountCents"
          :discount-title="item.discountTitle"
          :promotion-id="item.promotionId"
          :reward-kind="item.rewardKind"
          :reward-discount-percent="item.rewardDiscountPercent"
          :removable="false"
        />
      </div>
    </div>

    <PriceOverrideModal
      v-if="isPriceModalOpen"
      v-model:open="isPriceModalOpen"
      :sale-id="saleId"
      :item-id="item.id"
      :portal-class="portalClass"
      :on-submit="onSubmitPriceOverride"
    />

    <ItemDiscountModal
      v-if="isDiscountModalOpen"
      v-model:open="isDiscountModalOpen"
      :item="item"
      :portal-class="portalClass"
      :on-apply-discount="onApplyDiscount"
    />

    <ProductDetailModal
      v-if="isDetailModalOpen"
      v-model:open="isDetailModalOpen"
      :product-id="item.productId"
      :variant-id="item.variantId"
      :portal-class="portalClass"
    />
  </div>
</template>
