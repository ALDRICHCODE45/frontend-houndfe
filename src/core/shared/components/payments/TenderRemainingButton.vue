<script setup lang="ts">
/**
 * TenderRemainingButton — «Lo que falta» on one tender (payment-split S2).
 *
 * Rendered while the tender's own amount differs from what, with the other tenders as they are,
 * covers the target exactly: below it (something is pending) or, for a non-cash tender, above it
 * (cash 2,000 + card 5,000 vs 6,076.29 → card back to 4,076.29). Cash above it is left alone: it
 * is the only tender that may exceed what is due and gives change (S7). Emits `fill` with that
 * amount (never more than the target); the owner writes it like a typed amount. Hidden when that
 * amount would be $0.00 (the other tenders already cover the target).
 * Extra attributes (`data-testid`, …) go to the button.
 */
import { computed } from 'vue'
import { fillRemainingCents } from '@/core/shared/payments/tenderSplit'
import type { SplitTender } from '@/core/shared/payments/tenderSplit'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import './tender-split.css'

const props = withDefaults(
  defineProps<{
    tenders: ReadonlyArray<SplitTender>
    index: number
    targetCents: number
    /** Method name for the accessible label («Tarjeta de débito»). */
    label: string
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{ fill: [amountCents: number] }>()

/** The only tender that may exceed what is due (the difference is change). */
const CASH_METHOD = 'cash'

const fillCents = computed(() => fillRemainingCents(props.targetCents, props.tenders, props.index))
const visible = computed(() => {
  const tender = props.tenders[props.index]
  // Nothing left for this tender (the others already cover the target): filling would write
  // $0.00, which the screens reject; the cashier removes the tender instead.
  if (!tender || fillCents.value <= 0) return false
  const raw = tender.amountCents
  const own = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 0
  if (own < fillCents.value) return true
  return own > fillCents.value && tender.method !== CASH_METHOD
})

function fill() {
  if (props.disabled || !visible.value) return
  emit('fill', fillCents.value)
}
</script>

<template>
  <UButton
    v-if="visible"
    type="button"
    color="neutral"
    variant="ghost"
    size="sm"
    icon="i-lucide-arrow-down-to-line"
    class="hf-tender-split__fill"
    :aria-label="`Completar ${label} con lo que falta: ${formatCentsMXN(fillCents)}`"
    :disabled="disabled"
    @click="fill"
  >
    Lo que falta
  </UButton>
</template>
