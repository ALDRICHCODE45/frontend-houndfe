<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { useCatalogStore } from '../composables/useCatalogStore'
import { useCatalogCart } from '../composables/useCatalogCart'
import { getProductColor } from '../data/mock-catalog'
import type { PublicVariantDto, PublicStockStatus } from '../interfaces/catalog.types'

const catalog = useCatalogStore()
const cart = useCatalogCart()

const product = computed(() => catalog.selectedProduct)
const selectedVariant = ref<PublicVariantDto | null>(null)
const quantity = ref(1)

// Reset variant selection when product changes
watch(
  () => product.value,
  (p) => {
    if (p && p.hasVariants && p.variants.length > 0) {
      selectedVariant.value = p.variants[0]!
    } else {
      selectedVariant.value = null
    }
    quantity.value = 1
  },
  { immediate: true },
)

const currentPrice = computed(() => {
  if (selectedVariant.value) {
    return selectedVariant.value.price
  }
  return product.value?.price ?? { priceCents: null, hidden: true }
})

const currentAvailability = computed((): PublicStockStatus => {
  if (selectedVariant.value) {
    const selectedBranchAvailability = selectedVariant.value.availabilityByBranch.find(
      (a) => a.branchSlug === catalog.selectedBranch?.slug,
    )
    return selectedBranchAvailability?.availability ?? 'out_of_stock'
  }
  return product.value?.availability ?? 'out_of_stock'
})

const canAddToCart = computed(
  () => currentAvailability.value !== 'out_of_stock' && quantity.value > 0,
)

const availabilityConfig = {
  available: { label: 'Disponible', dot: 'bg-emerald-400', text: 'text-emerald-600' },
  low_stock: { label: 'Pocas piezas', dot: 'bg-amber-400', text: 'text-amber-600' },
  out_of_stock: { label: 'Agotado', dot: 'bg-red-400', text: 'text-red-600' },
} as const

/** Format price without decimals when they are .00, otherwise with 2 decimals */
function formatPriceClean(cents: number): string {
  const value = cents / 100
  if (value % 1 === 0) {
    return `$${new Intl.NumberFormat('es-MX').format(value)}`
  }
  return formatCentsMXN(cents)
}

function getVariantAvailability(variant: PublicVariantDto): PublicStockStatus {
  const branchAvail = variant.availabilityByBranch.find(
    (a) => a.branchSlug === catalog.selectedBranch?.slug,
  )
  return branchAvail?.availability ?? 'out_of_stock'
}

/** Shorten branch name: "Sucursal Centro" -> "Centro" */
function shortBranchName(name: string): string {
  return name.replace(/^Sucursal\s+/i, '')
}

function selectVariant(variant: PublicVariantDto) {
  selectedVariant.value = variant
  quantity.value = 1
}

function incrementQuantity() {
  quantity.value++
}

function decrementQuantity() {
  if (quantity.value > 1) quantity.value--
}

function handleAddToCart() {
  if (!product.value || !canAddToCart.value) return

  const p = product.value
  const colorIdx = catalog.products.findIndex((prod) => prod.id === p.id)

  const existing = cart.items.find(
    (i) => i.productId === p.id && i.variantId === (selectedVariant.value?.id ?? null),
  )

  if (existing) {
    cart.updateQuantity(p.id, selectedVariant.value?.id ?? null, existing.quantity + quantity.value)
  } else {
    const item = {
      productId: p.id,
      variantId: selectedVariant.value?.id ?? null,
      productName: p.name,
      brandName: p.brand?.name ?? null,
      variantName: selectedVariant.value?.name ?? null,
      unitPriceCents: currentPrice.value.priceCents,
      priceHidden: currentPrice.value.hidden,
      availability: currentAvailability.value,
      colorKey: getProductColor(colorIdx >= 0 ? colorIdx : 0),
    }
    cart.items.push({ ...item, quantity: quantity.value })
  }

  quantity.value = 1
  catalog.closeProductDetail()
  cart.openCart()
}
</script>

<template>
  <UModal
    :open="catalog.isProductModalOpen"
    :close="false"
    :ui="{
      overlay: 'bg-black/60 backdrop-blur-sm !z-50',
      content: 'sm:max-w-3xl overflow-hidden rounded-2xl bg-white !z-50',
    }"
    @update:open="(val: boolean) => { if (!val) catalog.closeProductDetail() }"
  >
    <template #content>
      <div v-if="product" class="flex flex-col sm:flex-row">
        <!-- Left: Image area with pastel color -->
        <div
          class="relative flex aspect-square items-center justify-center sm:w-[45%] sm:shrink-0"
          :class="getProductColor(catalog.products.findIndex((p) => p.id === product!.id))"
        >
          <UIcon
            name="i-lucide-package"
            class="size-20 text-gray-400/20"
          />

          <!-- Featured badge -->
          <div
            v-if="product.featuredLabel"
            class="absolute left-4 top-4 rounded-lg bg-gray-900 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white"
          >
            {{ product.featuredLabel }}
          </div>
        </div>

        <!-- Right: Content -->
        <div class="flex flex-1 flex-col bg-white sm:max-h-[80vh] sm:overflow-y-auto">
          <div class="flex flex-col gap-4 p-5 sm:p-6">
            <!-- Close button (top right of content area) -->
            <div class="flex justify-end sm:-mb-2 sm:-mt-1">
              <button
                class="flex size-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                @click="catalog.closeProductDetail()"
              >
                <UIcon name="i-lucide-x" class="size-5" />
              </button>
            </div>

            <!-- Brand + Name -->
            <div class="-mt-2">
              <p
                v-if="product.brand"
                class="text-[11px] font-semibold uppercase tracking-wider text-gray-400"
              >
                {{ product.brand.name }}
              </p>
              <h2 class="mt-1 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">
                {{ product.name }}
              </h2>
            </div>

            <!-- Rating + Category badge -->
            <div class="flex items-center gap-2.5">
              <span
                v-if="product.rating !== null"
                class="inline-flex items-center gap-1 text-sm"
              >
                <UIcon name="i-lucide-star" class="size-4 fill-amber-400 text-amber-400" />
                <span class="font-semibold text-gray-700">{{ product.rating.toFixed(1) }}</span>
              </span>
              <UBadge
                v-if="product.category"
                color="primary"
                variant="subtle"
                size="xs"
                class="rounded-full"
              >
                {{ product.category.name }}
              </UBadge>
            </div>

            <!-- Description -->
            <p v-if="product.description" class="text-sm leading-relaxed text-gray-500">
              {{ product.description }}
            </p>

            <!-- Variants as cards (reference design: label top, price bottom, stock dot top-right) -->
            <div v-if="product.hasVariants && product.variants.length > 0">
              <h4 class="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                Presentación
              </h4>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="variant in product.variants"
                  :key="variant.id"
                  class="relative flex min-w-[5rem] flex-col items-start rounded-xl px-3.5 py-2.5 text-left transition-all duration-150"
                  :class="
                    selectedVariant?.id === variant.id
                      ? 'bg-orange-50 ring-2 ring-orange-500'
                      : 'bg-gray-50 ring-1 ring-gray-200 hover:ring-gray-300'
                  "
                  @click="selectVariant(variant)"
                >
                  <!-- Stock dot (top-right corner) -->
                  <span
                    class="absolute right-2 top-2 size-2 rounded-full"
                    :class="availabilityConfig[getVariantAvailability(variant)].dot"
                  />
                  <!-- Label -->
                  <span
                    class="text-sm font-semibold"
                    :class="selectedVariant?.id === variant.id ? 'text-orange-700' : 'text-gray-800'"
                  >
                    {{ variant.name }}
                  </span>
                  <!-- Price below -->
                  <span
                    v-if="!variant.price.hidden"
                    class="mt-0.5 text-xs"
                    :class="selectedVariant?.id === variant.id ? 'text-orange-600' : 'text-gray-500'"
                  >
                    {{ formatPriceClean(variant.price.priceCents!) }}
                  </span>
                  <span v-else class="mt-0.5 text-xs text-gray-400 italic">Consultar</span>
                </button>
              </div>
            </div>

            <!-- Per-branch availability (with building icon and short name) -->
            <div>
              <h4 class="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                Disponibilidad por sucursal
              </h4>
              <div class="overflow-hidden rounded-xl ring-1 ring-gray-200">
                <div
                  v-for="(branch, idx) in (selectedVariant?.availabilityByBranch ?? [])"
                  :key="branch.branchId"
                  class="flex items-center justify-between px-3.5 py-2.5"
                  :class="[
                    branch.isSelected ? 'bg-orange-50/70' : 'bg-white',
                    idx > 0 ? 'border-t border-gray-100' : '',
                  ]"
                >
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-building-2" class="size-4 text-gray-400" />
                    <span class="text-sm font-medium text-gray-700">
                      {{ shortBranchName(branch.branchName) }}
                    </span>
                    <span
                      v-if="branch.isSelected"
                      class="rounded bg-orange-200/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700"
                    >
                      Tú
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span
                      class="size-1.5 rounded-full"
                      :class="availabilityConfig[branch.availability].dot"
                    />
                    <span
                      class="text-xs font-medium"
                      :class="availabilityConfig[branch.availability].text"
                    >
                      {{ availabilityConfig[branch.availability].label }}
                    </span>
                  </div>
                </div>

                <!-- Fallback for products without variants -->
                <div
                  v-if="!selectedVariant && catalog.selectedBranch"
                  class="flex items-center justify-between bg-orange-50/70 px-3.5 py-2.5"
                >
                  <div class="flex items-center gap-2">
                    <UIcon name="i-lucide-building-2" class="size-4 text-gray-400" />
                    <span class="text-sm font-medium text-gray-700">
                      {{ shortBranchName(catalog.selectedBranch.name) }}
                    </span>
                    <span class="rounded bg-orange-200/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-700">
                      Tú
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span
                      class="size-1.5 rounded-full"
                      :class="availabilityConfig[product.availability].dot"
                    />
                    <span
                      class="text-xs font-medium"
                      :class="availabilityConfig[product.availability].text"
                    >
                      {{ availabilityConfig[product.availability].label }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Price + Availability status -->
            <div class="flex items-center justify-between">
              <div>
                <p v-if="!currentPrice.hidden" class="text-3xl font-bold text-gray-900">
                  {{ formatPriceClean(currentPrice.priceCents!) }}
                </p>
                <p v-else class="text-lg font-medium text-gray-500 italic">
                  Consultar precio
                </p>
              </div>
              <div class="flex items-center gap-1.5">
                <span
                  class="size-2 rounded-full"
                  :class="availabilityConfig[currentAvailability].dot"
                />
                <span
                  class="text-sm font-medium"
                  :class="availabilityConfig[currentAvailability].text"
                >
                  {{ availabilityConfig[currentAvailability].label }}
                </span>
              </div>
            </div>

            <!-- Quantity + Add to cart -->
            <div class="flex items-center gap-3">
              <!-- Quantity selector -->
              <div
                v-if="canAddToCart"
                class="flex items-center rounded-xl ring-1 ring-gray-200"
              >
                <button
                  class="flex size-10 items-center justify-center text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
                  @click="decrementQuantity"
                >
                  <UIcon name="i-lucide-minus" class="size-4" />
                </button>
                <span class="min-w-[2.5rem] text-center text-sm font-semibold text-gray-900">
                  {{ quantity }}
                </span>
                <button
                  class="flex size-10 items-center justify-center text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
                  @click="incrementQuantity"
                >
                  <UIcon name="i-lucide-plus" class="size-4" />
                </button>
              </div>

              <!-- Add button -->
              <UButton
                :disabled="!canAddToCart"
                size="lg"
                class="flex-1 rounded-xl bg-orange-500 text-white hover:bg-orange-600"
                @click="handleAddToCart"
              >
                <template #leading>
                  <UIcon name="i-lucide-shopping-cart" class="size-4" />
                </template>
                {{ currentAvailability === 'out_of_stock' ? 'Agotado' : 'Agregar al pedido' }}
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
