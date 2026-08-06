<script setup lang="ts">
/**
 * `QuotationItemRow.vue` — S5 / S8.
 *
 * Single horizontal item card rendered inside the quotation detail view.
 * Mirrors the "compact card" layout that `SaleItemRow.vue` standardized
 * for the POS sales module but adapted to the quotation DTO shape:
 *   - product image · product name + SKU · variant chip · unit price ·
 *     line subtotal · status badges · qty stepper (DRAFT only).
 *   - DRAFT-only actions (price override, remove) live in a single
 *     `UDropdownMenu` at the end of the row.
 *
 * Read-only: when `readonly=true` (SENT/EXPIRED/CANCELLED), all editing
 * affordances disappear; the card becomes a pure read-only row.
 *
 * S8: stock badge. `useQuotationItemStock(item.productId)` is invoked
 * reactively here so each row hydrates its own stock chip; TanStack
 * de-dupes concurrent fetches for the same productId via the shared
 * `productQueryKeys.detail(tenantId, productId)` cache slot.
 *
 * The stock badge MUST stay purely informational — it never gates any
 * action (REQ-QTN-013).
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import { useQuotationItemStock } from '../composables/useQuotationItemStock'
import type { QuotationItemResponseDto } from '../interfaces/quotation.types'
import { formatCentsMXN, lineCents } from '../utils/currency.utils'
import AppBadge from '@/core/shared/components/AppBadge.vue'

const props = withDefaults(
  defineProps<{
    item: QuotationItemResponseDto
    readonly?: boolean
  }>(),
  { readonly: false },
)

const emit = defineEmits<{
  'update-quantity': [itemId: string, quantity: number]
  'request-price-override': [itemId: string]
  'request-remove': [itemId: string]
}>()

// Image fallback when the product has no URL OR the URL 404s — the parent's
// productApi/cache does not currently expose images explicitly so we render
// a generic package icon instead of breaking the row.
const imageBroken = ref(false)

// ── Local quantity state (mirrors SaleItemRow's stepper pattern) ────────────

const localQty = ref<number>(props.item.quantity)
const previousQty = ref<number>(props.item.quantity)

// ── Derived display helpers ──────────────────────────────────────────────────

const lineSubtotalCents = computed(() =>
  lineCents(props.item.unitPriceCents, props.item.quantity),
)

/** Compact `${formatted}` for the unit price — matches SaleItemRow. */
const unitPriceText = computed(() => formatCentsMXN(props.item.unitPriceCents))

/** Subtotal for the line (price × qty). Backend also returns this indirectly
 *  via quotation totals, but per-line is what the cashier mentally tracks. */
const lineSubtotalText = computed(() => formatCentsMXN(lineSubtotalCents.value))

/** Display label for the variant badge, if present. */
const variantName = computed(() => props.item.variantName ?? props.item.variant?.name ?? null)

const isCustomPrice = computed(() => props.item.priceSource === 'CUSTOM')

const isPromotionPriced = computed(() => props.item.priceSource === 'PROMOTION')

/** Discount line — only show when the backend actually applied one. */
const hasDiscount = computed(() => props.item.discountAmountCents > 0)
const discountLabel = computed(() => {
  const cents = formatCentsMXN(props.item.discountAmountCents)
  return props.item.discountTitle ? `${props.item.discountTitle} −${cents}` : `−${cents}`
})

// ── S8: stock badge (REQ-QTN-013) ──────────────────────────────────────────
// Each row calls `useQuotationItemStock(productId, variantId)` reactively.
// When a variant is selected the composable fetches variant-level stock via
// `GET /products/:id/variants` so the badge reflects the specific variant's
// quantity, not the product-level aggregate.
const { stock, isAvailable: isStockAvailable } = useQuotationItemStock(
  () => props.item.productId,
  () => props.item.variantId,
)

/** Stock badge tone ladder:
 *    isOut  → error   (zero quantity, "Agotado")
 *    isLow  → warning (below minQuantity but > 0)
 *    else   → neutral (informational, never gates actions)
 * Mirrors the `ProductSearchResultItem` stock chip from sales. */
const stockBadgeTone = computed<'error' | 'warning' | 'neutral'>(() => {
  if (!stock.value) return 'neutral'
  if (stock.value.isOut) return 'error'
  if (stock.value.isLow) return 'warning'
  return 'neutral'
})

const stockBadgeLabel = computed<string | null>(() => {
  if (!stock.value) return null
  if (stock.value.isOut) return 'Agotado'
  return `Stock: ${stock.value.quantity}`
})

const stockBadgeIcon = computed<string | undefined>(() => {
  if (!stock.value) return undefined
  if (stock.value.isOut) return 'i-lucide-package-x'
  if (stock.value.isLow) return 'i-lucide-package-minus'
  return 'i-lucide-package'
})

// ── Quantity stepper handlers ────────────────────────────────────────────────

function emitQuantity(next: number): void {
  // Local guard so the input doesn't reset to NaN — the view's mutation
  // is still subject to its own client validation, this is purely about
  // keeping the input control sane.
  if (!Number.isFinite(next) || next < 1) {
    return
  }
  if (next === previousQty.value) return
  previousQty.value = next
  emit('update-quantity', props.item.id, next)
}

function handleIncrease(): void {
  emitQuantity(localQty.value + 1)
}

function handleDecrease(): void {
  if (localQty.value <= 1) return
  emitQuantity(localQty.value - 1)
}

function handleQtyCommit(): void {
  emitQuantity(localQty.value)
}

/** Mirror the typed value into local state during typing but DO NOT clamp
 *  to 1 silently — the parent's input is the source of truth; we keep
 *  the visible value exactly as typed so the user sees what they wrote,
 *  and let the commit handler decide whether to emit. */
function handleQtyInput(value: string): void {
  const parsed = Number(value)
  localQty.value = Number.isFinite(parsed) ? parsed : localQty.value
}

// Sync local qty when the parent pushes a new value (e.g. after a successful
// mutation or cache refresh from a different tab).
function syncFromProp() {
  localQty.value = props.item.quantity
  previousQty.value = props.item.quantity
}

// Vue 3 watch via effectScope: keep this simple — re-sync whenever the prop
// changes (the parent's value is the source of truth).
const unwatch = watch(
  () => props.item.quantity,
  () => syncFromProp(),
)
onBeforeUnmount(() => unwatch())

// ── Override / remove handlers ───────────────────────────────────────────────

function handleImageError(): void {
  imageBroken.value = true
}

function handleOverride(): void {
  emit('request-price-override', props.item.id)
}

function handleRemove(): void {
  emit('request-remove', props.item.id)
}

/** Loose draft-only actions consolidated into a single dropdown menu.
 *  Empty (no groups) when readonly so no trigger renders. Mirrors the
 *  `SaleItemRow` grouped-items pattern. */
const itemActions = computed<DropdownMenuItem[][]>(() => {
  if (props.readonly) return []
  return [
    [
      {
        label: 'Cambiar precio',
        icon: 'i-lucide-pencil',
        onSelect: () => handleOverride(),
      },
    ],
    [
      {
        label: 'Eliminar producto',
        icon: 'i-lucide-trash-2',
        color: 'error' as const,
        onSelect: () => handleRemove(),
      },
    ],
  ]
})

</script>

<template>
  <article
    class="flex items-start gap-3 rounded-xl border border-default bg-default px-4 py-3 hover:border-default"
    :class="{ 'opacity-90': props.readonly }"
    data-testid="quotation-item-row"
    :data-item-id="props.item.id"
  >
    <!-- LEFT: thumbnail (48px square, package icon fallback) -->
    <div
      class="h-12 w-12 shrink-0 rounded-lg flex items-center justify-center overflow-hidden bg-elevated border border-default"
    >
      <UIcon
        v-if="!props.item.product?.imageUrl || imageBroken"
        name="i-lucide-package"
        class="h-6 w-6 text-muted"
        data-testid="product-fallback-icon"
      />
      <img
        v-else
        :src="props.item.product!.imageUrl!"
        :alt="props.item.productName || props.item.product!.name"
        class="h-full w-full object-cover"
        loading="lazy"
        data-testid="product-thumbnail"
        @error="handleImageError"
      />
    </div>

    <!-- CENTER: product info + stepper + badges (all stacked) -->
    <div class="flex-1 min-w-0 flex flex-col gap-1">
      <!-- Product name (bold, prominent) -->
      <p class="text-sm font-semibold text-highlighted truncate" data-testid="product-name">
        {{ props.item.productName }}
      </p>

      <!-- Variant + unit price meta -->
      <p class="text-xs text-muted truncate" data-testid="product-meta">
        <span
          v-if="variantName"
          class="uppercase tracking-wide"
          data-testid="variant-badge"
        >{{ variantName }} · </span>
        <span v-if="props.item.product?.sku" class="font-mono">{{ props.item.product.sku }} · </span>
        <span class="font-medium text-toned" data-testid="unit-price">
          {{ unitPriceText }} c/u
        </span>
      </p>

      <!-- Discount info -->
      <p
        v-if="hasDiscount"
        class="text-xs text-primary truncate"
        data-testid="discount-info"
      >
        {{ discountLabel }}
      </p>

      <!-- Stepper + subtotal (DRAFT only) -->
      <div
        v-if="!props.readonly"
        class="flex items-center gap-1.5 mt-1"
        data-testid="quantity-row"
      >
        <UButton
          icon="i-lucide-minus"
          size="sm"
          color="neutral"
          variant="ghost"
          aria-label="Disminuir cantidad"
          data-testid="quantity-decrease"
          @click="handleDecrease"
        />
        <UInput
          :model-value="String(localQty)"
          size="sm"
          type="number"
          :min="1"
          class="w-14"
          data-testid="quantity-input"
          @update:model-value="handleQtyInput"
          @blur="handleQtyCommit"
        />
        <UButton
          icon="i-lucide-plus"
          size="sm"
          color="neutral"
          variant="ghost"
          aria-label="Aumentar cantidad"
          data-testid="quantity-increase"
          @click="handleIncrease"
        />
        <span class="text-sm tabular-nums ml-auto" data-testid="line-subtotal">
          <span class="text-muted">× {{ unitPriceText }} = </span>
          <span class="font-bold text-highlighted">{{ lineSubtotalText }}</span>
        </span>
      </div>

      <!-- Badges row: stock, manual price, promotion -->
      <div
        v-if="isStockAvailable || isCustomPrice || (isPromotionPriced && props.item.discountTitle)"
        class="flex flex-wrap items-center gap-1 pt-0.5"
        data-testid="badges-row"
      >
        <AppBadge
          v-if="isStockAvailable && stockBadgeLabel"
          :tone="stockBadgeTone"
          :icon="stockBadgeIcon"
          :label="stockBadgeLabel"
          data-testid="stock-badge"
        />
        <AppBadge
          v-if="isCustomPrice"
          tone="warning"
          icon="i-lucide-pencil-ruler"
          label="PRECIO MANUAL"
          data-testid="manual-price-badge"
        />
        <AppBadge
          v-if="isPromotionPriced && props.item.discountTitle"
          tone="info"
          icon="i-lucide-tag"
          :label="props.item.discountTitle"
          data-testid="promotion-badge"
        />
      </div>
    </div>

    <!-- RIGHT: compact pricing (read-only or alongside stepper) -->
    <div
      v-if="props.readonly"
      class="shrink-0 text-right flex flex-col items-end min-w-[80px]"
    >
      <p class="text-xs text-muted tabular-nums">{{ unitPriceText }} c/u</p>
      <p v-if="hasDiscount" class="text-[10px] text-primary tabular-nums">{{ discountLabel }}</p>
      <p class="text-sm font-bold text-highlighted tabular-nums">{{ lineSubtotalText }}</p>
    </div>

    <!-- Item actions dropdown (DRAFT only, right-aligned) -->
    <UDropdownMenu
      v-if="!props.readonly"
      :items="itemActions"
      :content="{ align: 'end' }"
      data-testid="item-actions-menu"
    >
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-ellipsis-vertical"
        aria-label="Acciones del ítem"
        class="shrink-0"
        data-testid="item-actions-trigger"
      />
    </UDropdownMenu>
  </article>
</template>
