<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PosCatalogItem } from '../interfaces/sale.types'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  item: PosCatalogItem
  /**
   * S12 Venta-only v0 card (image/name open the detail, the visible button
   * adds). Omitted by default, so quotations keep the whole-card select.
   */
  composition?: boolean
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  select: [item: PosCatalogItem]
  'view-detail': [item: PosCatalogItem]
}>()

// S12 composition facts: real catalog fields only, nothing invented.
const hasVariantList = computed(() => props.item.hasVariants && props.item.variants.length > 0)

const identityLine = computed(() =>
  [props.item.brand?.name, props.item.sku].filter((part) => part && part.trim() !== '').join(' · '),
)

const detailLine = computed(() => {
  if (hasVariantList.value) return `${props.item.variants.length} presentaciones`
  const description = props.item.description?.trim()
  return description ? description : null
})

const priceLabel = computed(() => {
  if (props.item.price) return formatPrice(props.item.price.priceDecimal)
  const prices = props.item.variants
    .map((variant) => variant.price?.priceDecimal)
    .filter((price): price is number => typeof price === 'number')
  if (prices.length > 0) return `Desde ${formatPrice(Math.min(...prices))}`
  return 'Sin precio'
})

// Stock is shown only under the existing `useStock` gate: product stock, or
// the sum of variant stock when the product row carries none.
const stockFacts = computed(() => {
  if (!props.item.useStock) return null
  if (props.item.stock) return props.item.stock
  const variantStocks = props.item.variants
    .map((variant) => variant.stock)
    .filter((stock): stock is NonNullable<typeof stock> => stock != null)
  if (variantStocks.length === 0) return null
  return {
    quantity: variantStocks.reduce((sum, stock) => sum + stock.quantity, 0),
    minQuantity: variantStocks.reduce((sum, stock) => sum + stock.minQuantity, 0),
  }
})

const isStockLow = computed(
  () => stockFacts.value != null && stockFacts.value.quantity <= stockFacts.value.minQuantity,
)

const stockLabel = computed(() => {
  if (!stockFacts.value) return null
  const { quantity } = stockFacts.value
  return isStockLow.value ? `Solo ${quantity} disponibles` : `${quantity} disponibles`
})

// ── Image Error Handling ──────────────────────────────────────────────────────

const imageError = ref(false)

function handleImageError() {
  imageError.value = true
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(priceDecimal: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceDecimal)
}

function isLowStock(item: PosCatalogItem): boolean {
  return item.stock != null && item.stock.quantity <= item.stock.minQuantity
}
</script>

<template>
  <article
    v-if="composition"
    data-testid="result-card"
    class="flex sm:flex-col overflow-hidden sales-pos-product-card sales-pos-product-card-composition"
  >
    <!-- S12: v0 catalog card (Venta opt-in). The media and the name open the
         product detail; the visible button is the only add / variants action.
         The comment lives inside the root so the component keeps one root. -->
    <button
      type="button"
      data-testid="card-view-detail-media"
      class="relative shrink-0 flex items-center justify-center overflow-hidden sales-pos-product-media"
      :aria-label="`Ver detalle de ${item.name}`"
      @click="emit('view-detail', item)"
    >
      <UIcon
        v-if="!item.mainImage || imageError"
        name="i-lucide-package"
        class="h-10 w-10 text-primary/25"
        data-testid="placeholder-icon"
      />
      <img
        v-else
        :src="item.mainImage"
        :alt="item.name"
        class="absolute inset-0 h-full w-full sales-pos-product-image"
        loading="lazy"
        @error="handleImageError"
      />
      <span
        v-if="hasVariantList"
        data-testid="variant-count-badge"
        class="sales-pos-product-image-badge"
      >{{ item.variants.length }} variantes</span>
    </button>

    <div class="flex-1 min-w-0 flex flex-col sales-pos-product-body">
      <p v-if="identityLine" class="truncate sales-pos-product-brand">{{ identityLine }}</p>
      <button
        type="button"
        data-testid="card-view-detail-name"
        class="line-clamp-2 sales-pos-product-name"
        @click="emit('view-detail', item)"
      >{{ item.name }}</button>
      <p v-if="detailLine" data-testid="card-detail-line" class="line-clamp-1 sales-pos-product-detail">{{ detailLine }}</p>
      <p class="tabular-nums sales-pos-product-price">{{ priceLabel }}</p>
      <p
        v-if="stockLabel"
        data-testid="card-stock-line"
        class="sales-pos-product-stock-line"
        :data-sales-pos-stock="isStockLow ? 'low' : 'ok'"
      ><span class="sales-pos-product-stock-dot" aria-hidden="true" />{{ stockLabel }}</p>
      <button
        type="button"
        data-testid="add-action"
        class="sales-pos-product-add"
        :class="{ 'sales-pos-product-add-variants': hasVariantList }"
        @click="emit('select', item)"
      >
        <UIcon :name="hasVariantList ? 'i-lucide-sliders-horizontal' : 'i-lucide-plus'" class="h-4 w-4" />{{ hasVariantList ? 'Ver variantes' : 'Agregar' }}
      </button>
    </div>
  </article>

  <div
    v-else
    data-testid="result-card"
    class="group rounded-2xl border border-default bg-elevated overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-md dark:hover:shadow-none transition-all duration-200 flex sm:flex-col sales-pos-product-card"
    @click="emit('select', item)"
  >
    <!-- Image area — fixed height (not aspect-ratio) so cards stay uniform
         with or without image; aspect-ratio + flex content let the no-image
         branch collapse to the 40px icon height. -->
    <div
      data-testid="image-area"
      class="relative w-[43%] min-h-28 sm:h-32 sm:w-full shrink-0 flex items-center justify-center overflow-hidden bg-muted/30 sales-pos-product-media"
    >
      <UIcon
        v-if="!item.mainImage || imageError"
        name="i-lucide-package"
        class="h-10 w-10 text-primary/25"
        data-testid="placeholder-icon"
      />
      <img
        v-else
        :src="item.mainImage"
        :alt="item.name"
        class="absolute inset-0 h-full w-full object-cover sales-pos-product-image"
        loading="lazy"
        @error="handleImageError"
      />

      <!-- 14a.2 (sales-screen-redesign — R7): stock badge reads `#N` (e.g.
           `#11`) and is gated on BOTH `useStock === true` AND `stock != null`.
           Old `N u` format is replaced; the unit suffix is implied by the
           #N convention used across the catalog UI. -->
      <span
        v-if="item.useStock && item.stock != null"
        :class="[
          'absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md sales-pos-product-stock',
          isLowStock(item)
            ? 'bg-(--brand-danger)/15 text-(--brand-danger)'
            : 'bg-default/80 text-muted',
        ]"
        data-testid="stock-badge"
      >
        #{{ item.stock.quantity }}
      </span>
    </div>

    <!-- Card body: right column on mobile, bottom band from sm. -->
    <div class="flex-1 min-w-0 flex flex-col px-3 py-3 space-y-1.5 sm:border-t sm:border-default/50 sales-pos-product-body">
      <!-- Brand -->
      <p v-if="item.brand" class="text-[10px] text-dimmed uppercase tracking-wider font-medium truncate sales-pos-product-brand">
        {{ item.brand.name }}
      </p>
      <p v-else-if="item.sku" class="text-[11px] text-muted uppercase tracking-wider font-medium truncate sales-pos-product-brand" data-testid="sku-subtitle">
        {{ item.sku }}
      </p>

      <!-- Product name -->
      <p class="text-[13px] font-medium text-highlighted leading-snug line-clamp-2 sales-pos-product-name">
        {{ item.name }}
      </p>

      <!-- Price row + action -->
      <div class="flex items-center justify-between pt-1">
        <div>
          <p v-if="item.price" class="text-sm font-bold text-primary dark:text-(--brand-accent) tabular-nums sales-pos-product-price">
            {{ formatPrice(item.price.priceDecimal) }}
          </p>
          <p v-else class="text-xs text-toned flex items-center gap-0.5">
            Ver variantes
            <UIcon name="i-lucide-chevron-right" class="h-3 w-3" data-testid="chevron-icon" />
          </p>
        </div>

        <!-- Compact hover affordance from sm; mobile uses the full-width action below. -->
        <span
          data-testid="add-hint"
          class="text-xs font-semibold text-primary hidden sm:flex items-center gap-0.5 sales-pos-product-add-hint
                 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150"
        >
          <UIcon name="i-lucide-plus" class="h-3 w-3" />
          Agregar
        </span>
      </div>

      <!-- Variant count badge -->
      <p v-if="item.hasVariants && item.variants.length > 0" class="text-[11px] text-(--brand-primary) dark:text-(--brand-accent) font-medium">
        {{ item.variants.length }} variantes
      </p>

      <button
        type="button"
        data-testid="add-action"
        class="mt-1 w-full flex items-center justify-center gap-1 rounded-xl bg-primary/10 text-primary text-xs font-semibold py-2 hover:bg-primary/20 active:bg-primary/20 transition-colors duration-150 sm:hidden dark:bg-primary dark:text-white dark:hover:bg-primary/90 dark:active:bg-primary/90 sales-pos-product-add"
        @click.stop="emit('select', item)"
      >
        <UIcon name="i-lucide-plus" class="h-3.5 w-3.5" />
        Agregar
      </button>
    </div>
  </div>
</template>
