<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PosCatalogVariant } from '../interfaces/sale.types'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  open: boolean
  productId: string | null
  productName: string
  variants: PosCatalogVariant[]
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'update:open': [value: boolean]
  'add-variant': [productId: string, variantId: string]
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const filterQuery = ref('')
const brokenImages = ref<Set<string>>(new Set())

// ── Computed ──────────────────────────────────────────────────────────────────

const filteredVariants = computed(() => {
  if (!filterQuery.value) return props.variants

  const search = filterQuery.value.toLowerCase().trim()
  return props.variants.filter((v) => v.name.toLowerCase().includes(search))
})

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleVariantClick(variantId: string) {
  if (!props.productId) return
  emit('add-variant', props.productId, variantId)
}

function formatPrice(priceDecimal: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(priceDecimal)
}

function isLowStock(variant: PosCatalogVariant): boolean {
  return variant.stock != null && variant.stock.quantity <= variant.stock.minQuantity
}
</script>

<template>
  <UModal
    :open="open"
    :title="`Añadir ${productName}`"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <!-- Filter input -->
      <div class="mb-4">
        <UInput
          v-model="filterQuery"
          placeholder="Filtrar variantes"
          icon="i-lucide-search"
        />
      </div>

      <!-- Variant list (immediate render, no loading) -->
      <div v-if="filteredVariants.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
        <div
          v-for="variant in filteredVariants"
          :key="variant.id"
          :data-testid="`variant-row-${variant.id}`"
          class="flex items-center gap-3 p-3 rounded-lg border border-default hover:bg-elevated/60 hover:border-primary/30 cursor-pointer transition-all duration-150"
          @click="handleVariantClick(variant.id)"
        >
          <!-- Variant image or placeholder -->
          <div
            class="h-12 w-12 shrink-0 rounded-lg bg-elevated border border-default flex items-center justify-center overflow-hidden"
          >
            <UIcon
              v-if="!variant.mainImage || brokenImages.has(variant.id)"
              name="i-lucide-package"
              class="h-6 w-6 text-dimmed"
            />
            <img
              v-else
              :src="variant.mainImage"
              :alt="variant.name"
              class="h-full w-full object-cover rounded-lg"
              loading="lazy"
              @error="brokenImages.add(variant.id)"
            />
          </div>

          <!-- Variant info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-highlighted truncate mb-0.5">
              {{ variant.name }}
            </p>
            <p v-if="variant.sku" class="text-xs text-dimmed truncate mb-0.5">
              {{ variant.sku }}
            </p>
            <p class="text-sm text-toned">
              {{ variant.price ? formatPrice(variant.price.priceDecimal) : '—' }}
            </p>
          </div>

          <!-- Stock badge -->
          <div v-if="variant.stock != null" class="shrink-0">
            <UBadge
              :color="isLowStock(variant) ? 'warning' : 'success'"
              variant="subtle"
              size="xs"
              :label="`${variant.stock.quantity} unidades`"
            />
          </div>
        </div>
      </div>

      <!-- Empty state (no variants after filter) -->
      <div v-else class="flex flex-col items-center justify-center py-12">
        <div class="rounded-full bg-elevated p-4 mb-3">
          <UIcon name="i-lucide-package-x" class="h-8 w-8 text-dimmed" />
        </div>
        <p class="text-sm font-medium text-highlighted mb-1">Sin resultados</p>
        <p class="text-sm text-muted">No se encontraron variantes con ese filtro</p>
      </div>
    </template>
  </UModal>
</template>
