<script setup lang="ts">
/**
 * `QuotationPromotionCard.vue` — T-UI-18/19 / REQ-UI-008.
 *
 * Renders a single applied promotion as a Coco-style card:
 *   - 4px left accent border in `--coco-accent` (mustard)
 *   - Title (bold) + optional description (muted)
 *   - AUTOMÁTICA / MANUAL method badge
 *   - Discount in `--coco-info` blue
 *   - Outlined removal button: "Vetar" for AUTOMATIC, "Quitar" for MANUAL
 *
 * The component emits `veto` (AUTOMATIC) or `remove` (MANUAL) so the
 * parent can route through the correct mutation endpoint (vetoPromotion
 * vs removeManualPromotion on `useQuotationDraft`). It does NOT call
 * any API directly — that's the parent's responsibility.
 *
 * Props:
 *   promotion: AppliedPromotion — the snapshot from the quotation response
 *   method:    'MANUAL' | 'AUTOMATIC' — how the promotion was applied
 *   readonly:  boolean              — hide the removal button
 *
 * Emits:
 *   veto:   [promotionId]  (when method='AUTOMATIC')
 *   remove: [promotionId]  (when method='MANUAL')
 *
 * Testids:
 *   root:        quotation-promotion-card
 *   title:       promo-title
 *   discount:    promo-discount
 *   method:      promo-method-badge
 *   remove btn:  promo-remove-btn
 *   description: promo-description
 */
import { computed } from 'vue'
import type { AppliedPromotion } from '../interfaces/quotation.types'
import { formatCentsMXN } from '../utils/currency.utils'

const props = withDefaults(
  defineProps<{
    promotion: AppliedPromotion & { description?: string | null }
    method: 'MANUAL' | 'AUTOMATIC'
    readonly?: boolean
  }>(),
  { readonly: false },
)

const emit = defineEmits<{
  remove: [promotionId: string]
  veto: [promotionId: string]
}>()

const discountFormatted = computed<string>(() =>
  formatCentsMXN(props.promotion.discountCents),
)

const buttonLabel = computed<string>(() =>
  props.method === 'MANUAL' ? 'Quitar' : 'Vetar',
)

const badgeLabel = computed<string>(() =>
  props.method === 'MANUAL' ? 'Manual' : 'Automática',
)

function handleRemoveClick(): void {
  if (props.method === 'MANUAL') {
    emit('remove', props.promotion.promotionId)
  } else {
    emit('veto', props.promotion.promotionId)
  }
}

const hasDescription = computed<boolean>(() => {
  const description = props.promotion.description
  return typeof description === 'string' && description.trim().length > 0
})
</script>

<template>
  <article
    class="flex items-start justify-between gap-3 rounded-lg border border-default bg-default px-3 py-2 border-l-4 border-l-[var(--coco-accent)]"
    data-testid="quotation-promotion-card"
    :data-promotion-id="props.promotion.promotionId"
  >
    <div class="flex-1 min-w-0 flex flex-col gap-1">
      <p
        class="text-sm font-semibold text-highlighted truncate"
        data-testid="promo-title"
      >{{ props.promotion.title }}</p>
      <p
        v-if="hasDescription"
        class="text-xs text-muted"
        data-testid="promo-description"
      >{{ props.promotion.description }}</p>
      <div class="flex items-center gap-2">
        <span
          class="inline-flex items-center rounded-full border border-default px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted"
          data-testid="promo-method-badge"
        >{{ badgeLabel }}</span>
        <span
          class="text-xs font-medium tabular-nums text-[var(--coco-info)]"
          data-testid="promo-discount"
        >−${{ discountFormatted }}</span>
      </div>
    </div>
    <button
      v-if="!readonly"
      type="button"
      class="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-1.5 text-xs font-medium hover:bg-eleved shrink-0"
      data-testid="promo-remove-btn"
      @click="handleRemoveClick"
    >
      <UIcon name="i-lucide-x" class="h-3.5 w-3.5" />
      {{ buttonLabel }}
    </button>
  </article>
</template>
