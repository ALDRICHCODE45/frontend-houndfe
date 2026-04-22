<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SaleItem } from '../interfaces/sale.types'
import { formatCentsMXN, lineCents } from '../utils/currency.utils'

// ── Props ─────────────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    item: SaleItem
    isUpdating?: boolean
  }>(),
  {
    isUpdating: false,
  },
)

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'update-qty': [itemId: string, quantity: number]
}>()

// ── Local state ───────────────────────────────────────────────────────────────

const localQty = ref(props.item.quantity)
const previousQty = ref(props.item.quantity)

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
    return // No change — also prevents double-fire from @change + @blur
  }

  if (newQty < 1) {
    localQty.value = previousQty.value
    return
  }

  // Update previousQty immediately to prevent the same commit
  // from firing twice (@change then @blur both call this)
  previousQty.value = newQty
  emit('update-qty', props.item.id, newQty)
}
</script>

<template>
  <div
    class="mx-3 mb-2 rounded-lg border border-default bg-elevated/40 hover:bg-elevated/60 hover:border-primary/30 transition-all duration-150"
  >
    <div class="flex items-center gap-4 px-4 py-3">
      <!-- Image placeholder (56x56) -->
      <div class="h-14 w-14 shrink-0 rounded-lg bg-elevated border border-default flex items-center justify-center overflow-hidden">
        <UIcon name="i-lucide-package" class="h-7 w-7 text-dimmed" />
      </div>

      <!-- Product info -->
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-highlighted truncate mb-0.5">
          {{ item.productName }}
        </p>
        <p v-if="item.variantName" class="text-xs text-muted truncate mb-1">
          {{ item.variantName }}
        </p>
        <p class="text-xs text-toned font-medium">
          {{ formatCentsMXN(item.unitPriceCents) }} c/u
        </p>
      </div>

      <!-- Quantity input -->
      <div class="w-24">
        <UInputNumber
          v-model="localQty"
          size="sm"
          :min="1"
          :disabled="isUpdating"
          @blur="handleQtyCommit"
          @change="handleQtyCommit"
        />
      </div>

      <!-- Line total -->
      <div class="w-28 text-right">
        <p class="text-base font-semibold text-highlighted">
          {{ formatCentsMXN(lineCents(item.unitPriceCents, item.quantity)) }}
        </p>
      </div>
    </div>
  </div>
</template>
