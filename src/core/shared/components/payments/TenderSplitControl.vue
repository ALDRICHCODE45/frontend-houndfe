<script setup lang="ts">
/**
 * TenderSplitControl — split what is due across the chosen payment methods (payment-split S3, S4).
 *
 * Shown with 2+ tenders: «Repartir en partes iguales» (leftover cent on the last) and «Por
 * porcentaje» (inline % per method, applied only when they add up to 100%). It never edits the
 * tenders itself: it emits `apply` with one amount in cents per tender, in order, and the owner
 * writes them through the same path as typing (so previews, gates and idempotency stay its own).
 * The math lives in `@/core/shared/payments/tenderSplit`.
 */
import { computed, ref, useId, watch } from 'vue'
import {
  equalSplitCents,
  parsePercentInput,
  percentSplitCents,
} from '@/core/shared/payments/tenderSplit'
import type { SplitControlTender } from './splitControl.types'
import './tender-split.css'

const props = withDefaults(
  defineProps<{
    tenders: ReadonlyArray<SplitControlTender>
    /** What the split must cover exactly, in cents. */
    targetCents: number
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{ apply: [amounts: number[]] }>()

const panelId = `tender-split-percent-${useId()}`
const percentOpen = ref(false)
const percentText = ref<Record<string, string>>({})

const visible = computed(() => props.tenders.length >= 2)

// Forget the percents of removed tenders; close the panel below 2 tenders.
watch(
  () => props.tenders.map((tender) => tender.key),
  (keys) => {
    const live = new Set(keys)
    percentText.value = Object.fromEntries(
      Object.entries(percentText.value).filter(([key]) => live.has(key)),
    )
    if (keys.length < 2) percentOpen.value = false
  },
)

const percents = computed(() =>
  props.tenders.map((tender) => parsePercentInput(percentText.value[tender.key] ?? '')),
)
const percentResult = computed(() => percentSplitCents(props.targetCents, percents.value))
// The total in integer hundredths of a percent (33.33 → 3333): float sums drift (100.00000000000001).
// `parsePercentInput` only lets through percents with at most 2 decimals, so rounding is exact.
const percentTotalPoints = computed(() =>
  percents.value.reduce<number>((acc, value) => acc + Math.round((value ?? 0) * 100), 0),
)
const percentTotalLabel = computed(() => {
  const points = percentTotalPoints.value
  return points % 100 === 0 ? String(points / 100) : (points / 100).toFixed(2)
})
const percentMessage = computed(() => {
  const result = percentResult.value
  if (result.ok) return null
  if (result.error === 'invalid')
    return 'Escribe un porcentaje de 0 a 100 en cada método (hasta 2 decimales).'
  return 'Los porcentajes deben sumar 100%.'
})

function splitEqually() {
  if (props.disabled || !visible.value) return
  emit('apply', equalSplitCents(props.targetCents, props.tenders.length))
}

function setPercent(key: string, value: string | number | null | undefined) {
  percentText.value = { ...percentText.value, [key]: value == null ? '' : String(value) }
}

function applyPercents() {
  const result = percentResult.value
  if (props.disabled || !result.ok) return
  emit('apply', result.amounts)
}
</script>

<template>
  <div v-if="visible" class="hf-tender-split" role="group" aria-label="Repartir el monto">
    <div class="hf-tender-split__actions">
      <UButton
        data-testid="tender-split-equal"
        type="button"
        color="neutral"
        variant="outline"
        icon="i-lucide-equal"
        class="hf-tender-split__button"
        :disabled="disabled"
        @click="splitEqually"
      >
        Repartir en partes iguales
      </UButton>
      <UButton
        data-testid="tender-split-percent-toggle"
        type="button"
        color="neutral"
        :variant="percentOpen ? 'soft' : 'outline'"
        icon="i-lucide-percent"
        class="hf-tender-split__button"
        :aria-expanded="percentOpen"
        :aria-controls="panelId"
        :disabled="disabled"
        @click="percentOpen = !percentOpen"
      >
        Por porcentaje
      </UButton>
    </div>

    <div v-if="percentOpen" :id="panelId" class="hf-tender-split__percent">
      <div v-for="(tender, index) in tenders" :key="tender.key" class="hf-tender-split__row">
        <label :for="`${panelId}-${index}`" class="hf-tender-split__label">
          {{ tender.label }}
        </label>
        <UInput
          :id="`${panelId}-${index}`"
          :data-testid="`tender-split-percent-${index}`"
          :model-value="percentText[tender.key] ?? ''"
          :aria-label="`Porcentaje para ${tender.label}`"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          placeholder="0"
          :disabled="disabled"
          class="hf-tender-split__input"
          @update:model-value="setPercent(tender.key, $event)"
        >
          <template #trailing>
            <span class="text-sm text-dimmed" aria-hidden="true">%</span>
          </template>
        </UInput>
      </div>
      <div class="hf-tender-split__footer">
        <p
          data-testid="tender-split-percent-total"
          class="hf-tender-split__total"
          :data-tone="percentResult.ok ? undefined : 'error'"
          aria-live="polite"
        >
          Total {{ percentTotalLabel }}%
          <template v-if="percentMessage"> · {{ percentMessage }}</template>
        </p>
        <UButton
          data-testid="tender-split-percent-apply"
          type="button"
          color="neutral"
          variant="soft"
          class="hf-tender-split__button"
          :disabled="disabled || !percentResult.ok"
          @click="applyPercents"
        >
          Aplicar porcentajes
        </UButton>
      </div>
    </div>
  </div>
</template>
