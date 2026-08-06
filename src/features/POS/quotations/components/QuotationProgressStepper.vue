<script setup lang="ts">
/**
 * `QuotationProgressStepper.vue` — T-UI-10 / REQ-UI-003.
 *
 * Horizontal 3-state progress stepper for the quotation detail view:
 *   BORRADOR  →  ENVIADA  →  EXPIRADA/CANCELADA
 *
 * The status→step index mapping is isolated in `stepperIndexFromStatus`
 * (see `../utils/quotation.utils.ts`) so this component owns only the
 * visual logic. It computes `currentIndex` once from the prop, then
 * derives per-step state (active | completed | future) and per-connector
 * state. CSS reacts to `data-state` attributes instead of an enum of
 * utility classes — keeps the SFC focused on shape and makes the styling
 * trivial to audit.
 *
 * Styling contract (Coco tokens, consumed via Tailwind arbitrary values):
 *   - active node    → filled with --coco-accent, dark label
 *   - completed node → filled with --coco-accent-50, accent label
 *   - future node    → white outline, muted label
 *   - connector      → 2px line; completed = accent, future = border
 *
 * Contract:
 *   - Props ↓: status: QuotationStatus
 *   - Events ↑: none (read-only display)
 *
 * Testids:
 *   - root:    quotation-stepper
 *   - steps:   stepper-step-{0|1|2}
 *   - lines:   stepper-connector-{0|1}
 */

import { computed } from 'vue'
import type { QuotationStatus } from '../interfaces/quotation.types'
import { stepperIndexFromStatus } from '../utils/quotation.utils'

type StepState = 'active' | 'completed' | 'future'
type ConnectorState = 'completed' | 'future'

interface StepDefinition {
  index: number
  label: string
}

const STEPS: readonly StepDefinition[] = [
  { index: 0, label: 'BORRADOR' },
  { index: 1, label: 'ENVIADA' },
  { index: 2, label: 'EXPIRADA/CANCELADA' },
] as const

const props = defineProps<{
  status: QuotationStatus
}>()

/**
 * -1 means "unknown status" (forward-compat for ACEPTADA/PEDIDO that
 * aren't part of this 3-state stepper). We render every node as future
 * so the cashier still sees the ladder but nothing is highlighted.
 */
const currentIndex = computed<number>(() => stepperIndexFromStatus(props.status))

function stepState(index: number): StepState {
  const current = currentIndex.value
  if (current < 0) return 'future'
  if (index < current) return 'completed'
  if (index === current) return 'active'
  return 'future'
}

/**
 * A connector sits between step N and step N+1. It is "completed" when
 * both endpoints sit at or before the active step (i.e. the active index
 * is past the connector). Otherwise it is "future".
 */
function connectorState(connectorIndex: number): ConnectorState {
  const current = currentIndex.value
  if (current < 0) return 'future'
  // Connector N links step N → step N+1. It's "completed" iff the
  // active step is at or after step N+1, i.e. connectorIndex < current.
  return connectorIndex < current ? 'completed' : 'future'
}
</script>

<template>
  <ol
    class="flex w-full items-center gap-2"
    data-testid="quotation-stepper"
    aria-label="Progreso de la cotización"
  >
    <li
      v-for="step in STEPS"
      :key="step.index"
      class="flex flex-1 items-center gap-2"
    >
      <!-- Node: filled accent when active, accent-tinted when completed,
           white outline when future. The dark/muted label color is
           driven by the same data-state attribute. -->
      <div
        class="flex flex-col items-center gap-1"
        :data-testid="`stepper-step-${step.index}`"
        :data-state="stepState(step.index)"
      >
        <span
          aria-hidden="true"
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors"
          :class="{
            'border-[var(--coco-accent)] bg-[var(--coco-accent)] text-[var(--coco-card)] shadow-sm': stepState(step.index) === 'active',
            'border-[var(--coco-accent)] bg-[var(--coco-accent-50)] text-[var(--coco-accent)]': stepState(step.index) === 'completed',
            'border-[var(--coco-border)] bg-[var(--coco-card)] text-[var(--coco-text-tertiary)]': stepState(step.index) === 'future',
          }"
        >
          {{ step.index + 1 }}
        </span>
        <span
          class="whitespace-nowrap text-xs font-semibold tracking-wide uppercase"
          :class="{
            'text-[var(--coco-text)]': stepState(step.index) === 'active',
            'text-[var(--coco-accent)]': stepState(step.index) === 'completed',
            'text-[var(--coco-text-tertiary)]': stepState(step.index) === 'future',
          }"
        >
          {{ step.label }}
        </span>
      </div>

      <!-- Connector line to the next step (skipped after the last node). -->
      <span
        v-if="step.index < STEPS.length - 1"
        aria-hidden="true"
        class="h-0.5 flex-1 transition-colors"
        :class="{
          'bg-[var(--coco-accent)]': connectorState(step.index) === 'completed',
          'bg-[var(--coco-border)]': connectorState(step.index) === 'future',
        }"
        :data-testid="`stepper-connector-${step.index}`"
        :data-state="connectorState(step.index)"
      />
    </li>
  </ol>
</template>
