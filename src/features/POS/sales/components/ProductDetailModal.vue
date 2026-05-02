<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { saleApi } from '../api/sale.api'
import type { PosProductDetail } from '../interfaces/sale.types'

const props = defineProps<{
  open: boolean
  productId: string
  variantId: string | null
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const detail = ref<PosProductDetail | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)

// The variant currently being viewed in the modal
const activeVariantId = ref<string | null>(null)

const activeVariant = computed(() => {
  if (!detail.value || !activeVariantId.value) return null
  return detail.value.variants.find((v) => v.id === activeVariantId.value) ?? null
})

// Resolved data (variant-specific or product-level)
const displayImage = computed(() => activeVariant.value?.mainImage ?? detail.value?.mainImage ?? null)
const displayName = computed(() => detail.value?.name ?? '')
const displayVariantName = computed(() => activeVariant.value?.name ?? null)
const displaySku = computed(() => activeVariant.value?.sku ?? detail.value?.sku ?? null)
const displayBarcode = computed(() => activeVariant.value?.barcode ?? detail.value?.barcode ?? null)
const displayPrice = computed(() => activeVariant.value?.price ?? detail.value?.price ?? null)
const displayStock = computed(() => activeVariant.value?.stock ?? detail.value?.stock ?? null)

function formatPrice(priceDecimal: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceDecimal)
}

function isLowStock(qty: number, min: number): boolean {
  return qty <= min
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      detail.value = null
      error.value = null
      activeVariantId.value = null
      return
    }

    isLoading.value = true
    error.value = null
    activeVariantId.value = props.variantId

    try {
      detail.value = await saleApi.getProductDetail(props.productId)
    } catch {
      error.value = 'No se pudieron cargar los detalles del producto.'
    } finally {
      isLoading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <UModal :open="open" title="Detalle del producto" :content="{ class: 'sm:max-w-2xl' }" @update:open="emit('update:open', $event)">
    <template #body>
      <!-- Loading state -->
      <div v-if="isLoading" class="space-y-4 py-4">
        <div class="flex gap-4">
          <USkeleton class="h-40 w-40 rounded-xl shrink-0" />
          <div class="flex-1 space-y-3">
            <USkeleton class="h-3 w-24" />
            <USkeleton class="h-5 w-3/4" />
            <USkeleton class="h-3 w-full" />
            <div class="flex gap-6 mt-4">
              <USkeleton class="h-10 w-24" />
              <USkeleton class="h-10 w-24" />
              <USkeleton class="h-10 w-24" />
            </div>
          </div>
        </div>
      </div>

      <!-- Error state -->
      <div v-else-if="error" class="py-8 text-center">
        <UIcon name="i-lucide-alert-circle" class="h-10 w-10 text-muted mx-auto mb-3" />
        <p class="text-sm text-muted">{{ error }}</p>
      </div>

      <!-- Detail content -->
      <div v-else-if="detail" class="space-y-5">
        <!-- Top section: Image + Info -->
        <div class="flex gap-5">
          <!-- Product image -->
          <div class="h-40 w-40 shrink-0 rounded-xl border border-default overflow-hidden flex items-center justify-center"
            :class="displayImage ? 'bg-elevated/30' : 'bg-primary/5'"
          >
            <img
              v-if="displayImage"
              :src="displayImage"
              :alt="displayName"
              class="h-full w-full object-contain p-2"
            />
            <UIcon v-else name="i-lucide-package" class="h-12 w-12 text-primary/25" />
          </div>

          <!-- Product info -->
          <div class="flex-1 min-w-0 space-y-2">
            <!-- Category + Brand -->
            <div class="flex items-center gap-2">
              <UBadge v-if="detail.category" size="sm" color="neutral" variant="subtle" :label="detail.category.name" />
              <span v-if="detail.brand" class="text-xs text-muted">{{ detail.brand.name }}</span>
            </div>

            <!-- Name -->
            <h3 class="text-lg font-semibold text-highlighted leading-snug">
              {{ displayName }}
              <span v-if="displayVariantName" class="text-muted font-normal text-base"> — {{ displayVariantName }}</span>
            </h3>

            <!-- Description -->
            <p v-if="detail.description" class="text-xs text-muted leading-relaxed line-clamp-3">
              {{ detail.description }}
            </p>

            <!-- SKU / Barcode -->
            <div class="flex items-center gap-4 text-xs text-muted">
              <span v-if="displaySku" class="flex items-center gap-1">
                <UIcon name="i-lucide-hash" class="h-3 w-3" />
                {{ displaySku }}
              </span>
              <span v-if="displayBarcode" class="flex items-center gap-1">
                <UIcon name="i-lucide-scan-barcode" class="h-3 w-3" />
                {{ displayBarcode }}
              </span>
            </div>
          </div>
        </div>

        <!-- Stats row -->
        <div class="grid grid-cols-3 gap-3">
          <!-- Price -->
          <div class="rounded-lg border border-default p-3 space-y-1">
            <p class="text-[11px] text-muted uppercase tracking-wider font-medium">Precio</p>
            <p v-if="displayPrice" class="text-lg font-bold text-highlighted tabular-nums">
              {{ formatPrice(displayPrice.priceDecimal) }}
            </p>
            <p v-else class="text-sm text-muted">Sin precio</p>
            <p v-if="displayPrice" class="text-[11px] text-muted">{{ displayPrice.priceListName }}</p>
          </div>

          <!-- Stock -->
          <div class="rounded-lg border border-default p-3 space-y-1">
            <p class="text-[11px] text-muted uppercase tracking-wider font-medium">Existencias</p>
            <p v-if="displayStock" class="text-lg font-bold tabular-nums" :class="isLowStock(displayStock.quantity, displayStock.minQuantity) ? 'text-warning' : 'text-highlighted'">
              {{ displayStock.quantity }}
            </p>
            <p v-else class="text-sm text-muted">N/A</p>
            <p v-if="displayStock" class="text-[11px] text-muted">Unidades</p>
          </div>

          <!-- Location -->
          <div class="rounded-lg border border-default p-3 space-y-1">
            <p class="text-[11px] text-muted uppercase tracking-wider font-medium">Ubicación</p>
            <p v-if="displayStock?.location" class="text-sm font-semibold text-highlighted">
              {{ displayStock.location }}
            </p>
            <p v-else class="text-sm text-muted">Sin ubicación</p>
          </div>
        </div>

        <!-- Variants table (if has variants) -->
        <div v-if="detail.variants.length > 0" class="rounded-lg border border-default overflow-hidden">
          <div class="px-3 py-2 bg-elevated/30 border-b border-default">
            <p class="text-xs font-semibold text-highlighted">Variantes ({{ detail.variants.length }})</p>
          </div>
          <div class="divide-y divide-default">
            <div
              v-for="variant in detail.variants"
              :key="variant.id"
              :class="[
                'flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-150',
                activeVariantId === variant.id ? 'bg-primary/5' : 'hover:bg-elevated/30',
              ]"
              @click="activeVariantId = variant.id"
            >
              <!-- Variant image -->
              <div class="h-8 w-8 shrink-0 rounded-md overflow-hidden flex items-center justify-center"
                :class="variant.mainImage ? 'bg-elevated border border-default' : 'bg-primary/5'"
              >
                <img v-if="variant.mainImage" :src="variant.mainImage" :alt="variant.name" class="h-full w-full object-contain" />
                <UIcon v-else name="i-lucide-package" class="h-4 w-4 text-primary/30" />
              </div>

              <!-- Name -->
              <div class="flex-1 min-w-0">
                <p class="text-[13px] font-medium text-highlighted truncate">{{ variant.name }}</p>
                <p v-if="variant.sku" class="text-[11px] text-muted">{{ variant.sku }}</p>
              </div>

              <!-- Stock -->
              <div class="text-right shrink-0">
                <p v-if="variant.stock" class="text-xs tabular-nums" :class="isLowStock(variant.stock.quantity, variant.stock.minQuantity) ? 'text-warning font-semibold' : 'text-muted'">
                  {{ variant.stock.quantity }} u
                </p>
              </div>

              <!-- Price -->
              <div class="text-right shrink-0 w-24">
                <p v-if="variant.price" class="text-[13px] font-semibold text-highlighted tabular-nums">
                  {{ formatPrice(variant.price.priceDecimal) }}
                </p>
                <p v-else class="text-xs text-muted">Sin precio</p>
              </div>

              <!-- Active indicator -->
              <UIcon
                v-if="activeVariantId === variant.id"
                name="i-lucide-check-circle"
                class="h-4 w-4 text-primary shrink-0"
              />
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton type="button" color="neutral" variant="soft" label="Cerrar" @click="emit('update:open', false)" />
        <UButton
          v-if="detail"
          color="primary"
          label="Ir al producto"
          icon="i-lucide-external-link"
          :to="{ name: 'pos-product-detail', params: { id: detail.id } }"
          @click="emit('update:open', false)"
        />
      </div>
    </template>
  </UModal>
</template>
