<script setup lang="ts">
/**
 * TenderRemainingButton — «Lo que falta» on one tender (payment-split S2).
 *
 * Rendered only while the tenders do not cover the target. Emits `fill` with the amount that,
 * with the other tenders as they are, covers the target exactly (never more than the target, so a
 * non-cash tender never exceeds what is due). The owner writes it like a typed amount.
 * Extra attributes (`data-testid`, …) go to the button.
 */
import { computed } from 'vue'
import { fillRemainingCents, remainingDueCents } from '@/core/shared/payments/tenderSplit'
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

const pendingCents = computed(() =>
  remainingDueCents(
    props.targetCents,
    props.tenders.map((tender) => tender.amountCents),
  ),
)
const fillCents = computed(() => fillRemainingCents(props.targetCents, props.tenders, props.index))

function fill() {
  if (props.disabled || pendingCents.value <= 0) return
  emit('fill', fillCents.value)
}
</script>

<template>
  <UButton
    v-if="pendingCents > 0"
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
