<script setup lang="ts">
import { ref, computed } from 'vue'
import { useQuery } from '@tanstack/vue-query'
import { productApi } from '@/features/POS/products/api/product.api'
import { formatCentsMXN } from '../utils/currency.utils'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = defineProps<{
  open: boolean
  productId: string | null
  productName: string | null
}>()

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'update:open': [value: boolean]
  'add-variant': [productId: string, variantId: string]
}>()

// ── State ─────────────────────────────────────────────────────────────────────

const filterQuery = ref('')

// ── Query ─────────────────────────────────────────────────────────────────────

const { data: variants, isLoading } = useQuery({
  queryKey: computed(() => ['products', 'variants', props.productId]),
  queryFn: () => productApi.getVariants(props.productId!),
  enabled: computed(() => props.open && !!props.productId),
})

// ── Computed ──────────────────────────────────────────────────────────────────

const filteredVariants = computed(() => {
  if (!variants.value) return []
  if (!filterQuery.value) return variants.value

  const search = filterQuery.value.toLowerCase().trim()
  return variants.value.filter((v) => v.name.toLowerCase().includes(search))
})

// ── Handlers ──────────────────────────────────────────────────────────────────

function handleVariantClick(variantId: string) {
  if (!props.productId) return
  emit('add-variant', props.productId, variantId)
}
</script>

<template>
  <UModal
    :open="open"
    :title="`Añadir ${productName || 'producto'}`"
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

      <!-- Loading state -->
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <div class="flex flex-col items-center gap-3">
          <UIcon name="i-lucide-loader-2" class="h-10 w-10 text-primary animate-spin" />
          <p class="text-sm text-muted">Cargando variantes...</p>
        </div>
      </div>

      <!-- Variant list -->
      <div v-else-if="filteredVariants.length > 0" class="space-y-2 max-h-96 overflow-y-auto">
        <div
          v-for="variant in filteredVariants"
          :key="variant.id"
          :data-testid="`variant-row-${variant.id}`"
          class="flex items-center gap-3 p-3 rounded-lg border border-default hover:bg-elevated/60 hover:border-primary/30 cursor-pointer transition-all duration-150"
          @click="handleVariantClick(variant.id)"
        >
          <!-- Placeholder image -->
          <div class="h-12 w-12 shrink-0 rounded-lg bg-elevated border border-default flex items-center justify-center">
            <UIcon name="i-lucide-package" class="h-6 w-6 text-dimmed" />
          </div>

          <!-- Variant info -->
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-highlighted truncate mb-0.5">
              {{ variant.name }}
            </p>
            <p class="text-sm text-toned">
              {{ formatCentsMXN(variant.priceCents) }}
            </p>
          </div>

          <!-- Stock badge -->
          <div class="shrink-0">
            <UBadge
              color="success"
              variant="subtle"
              size="xs"
              :label="`${variant.quantity} unidades`"
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
