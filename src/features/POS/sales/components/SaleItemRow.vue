<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SaleItem } from '../interfaces/sale.types'
import type { ApplyItemDiscountPayload, OverrideItemPricePayload } from '../interfaces/sale.types'
import { formatCentsMXN, lineCents } from '../utils/currency.utils'
import PriceOverrideModal from './PriceOverrideModal.vue'
import ItemDiscountModal from './ItemDiscountModal.vue'

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
     }>(),
  {
    imageUrl: null,
    isUpdating: false,
    isDraft: true,
    onSubmitPriceOverride: async () => undefined,
    onApplyDiscount: async () => undefined,
    onRemoveDiscount: async () => undefined,
    onRemoveItem: async () => undefined,
  },
)

const imageBroken = ref(false)

// ── Emits ─────────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'update-qty': [itemId: string, quantity: number]
}>()

// ── Local state ───────────────────────────────────────────────────────────────

const localQty = ref(props.item.quantity)
const previousQty = ref(props.item.quantity)
const isPriceModalOpen = ref(false)
const isDiscountModalOpen = ref(false)
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
  () => ['price_list', 'custom'].includes(props.item.priceSource ?? '') && !!props.item.originalPriceCents,
)
const showDiscountOrigin = computed(() => !!props.item.discountType && !!props.item.prePriceCentsBeforeDiscount)
const discountBadgeLabel = computed(() => {
  if (props.item.discountType === 'percentage') return `DESCUENTO -${props.item.discountValue ?? 0}%`
  if (props.item.discountAmountCents) return `DESCUENTO -${formatCentsMXN(props.item.discountAmountCents)}`
  return 'DESCUENTO'
})
const priceSourceBadge = computed(() => {
  if (props.item.priceSource === 'price_list') {
    return {
      label: 'PRECIO LISTA',
      icon: 'i-lucide-tags',
      color: 'primary' as const,
    }
  }

  if (props.item.priceSource === 'custom') {
    return {
      label: 'PRECIO MANUAL',
      icon: 'i-lucide-pencil-ruler',
      color: 'warning' as const,
    }
  }

  return null
})

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
      <!-- Image (56x56) -->
      <div class="h-14 w-14 shrink-0 rounded-lg bg-elevated border border-default flex items-center justify-center overflow-hidden">
        <UIcon
          v-if="!imageUrl || imageBroken"
          name="i-lucide-package"
          class="h-7 w-7 text-dimmed"
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

      <!-- Product info -->
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-highlighted truncate mb-0.5">
          {{ item.productName }}
        </p>
        <p v-if="item.variantName" class="text-xs text-muted truncate mb-1">
          {{ item.variantName }}
        </p>
        <p class="text-xs text-toned font-medium">
          <span v-if="showPriceOrigin" class="mr-2 line-through text-muted">
            {{ formatCentsMXN(item.originalPriceCents ?? 0) }}
          </span>
          <span v-if="showDiscountOrigin" class="mr-2 line-through text-muted">
            {{ formatCentsMXN(item.prePriceCentsBeforeDiscount ?? 0) }}
          </span>
          {{ formatCentsMXN(item.unitPriceCents) }} c/u
        </p>
        <div
          v-if="priceSourceBadge || item.discountType"
          data-testid="sale-item-badge-group"
          class="mt-1.5 flex flex-wrap items-center gap-1.5"
        >
          <UBadge
            v-if="priceSourceBadge"
            size="sm"
            :color="priceSourceBadge.color"
            variant="subtle"
            class="font-semibold"
          >
            <span class="inline-flex items-center gap-1 text-[11px] leading-none tracking-wide">
              <UIcon :name="priceSourceBadge.icon" class="h-3.5 w-3.5" />
              {{ priceSourceBadge.label }}
            </span>
          </UBadge>

          <UTooltip v-if="item.discountType && item.discountTitle" :text="item.discountTitle">
            <UBadge size="sm" color="success" variant="subtle" class="font-semibold">
              <span class="inline-flex items-center gap-1 text-[11px] leading-none tracking-wide">
                <UIcon name="i-lucide-badge-percent" class="h-3.5 w-3.5" />
                {{ discountBadgeLabel }}
              </span>
            </UBadge>
          </UTooltip>
          <UBadge v-else-if="item.discountType" size="sm" color="success" variant="subtle" class="font-semibold">
            <span class="inline-flex items-center gap-1 text-[11px] leading-none tracking-wide">
              <UIcon name="i-lucide-badge-percent" class="h-3.5 w-3.5" />
              {{ discountBadgeLabel }}
            </span>
          </UBadge>
        </div>
      </div>

      <UDropdownMenu v-if="isDraft" :items="itemActions">
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-ellipsis-vertical" />
      </UDropdownMenu>

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

    <PriceOverrideModal
      v-if="isPriceModalOpen"
      v-model:open="isPriceModalOpen"
      :sale-id="saleId"
      :item-id="item.id"
      :on-submit="onSubmitPriceOverride"
    />

    <ItemDiscountModal
      v-if="isDiscountModalOpen"
      v-model:open="isDiscountModalOpen"
      :item="item"
      :on-apply-discount="onApplyDiscount"
    />
  </div>
</template>
