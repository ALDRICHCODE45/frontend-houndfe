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
 * Step strip (design system): a 22px circle plus a 13px/600 label, joined by a
 * hairline.
 *   - completed → --hf-success fill with a check
 *   - active    → --hf-action fill
 *   - future    → outline, muted label
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
  { index: 0, label: 'Borrador' },
  { index: 1, label: 'Enviada' },
  { index: 2, label: 'Expirada o cancelada' },
] as const

const props = defineProps<{
  status: QuotationStatus
  /** Render smaller nodes and text for use in tighter header layouts. */
  compact?: boolean
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
    class="quotation-stepper"
    :class="{ 'is-compact': props.compact }"
    data-testid="quotation-stepper"
    aria-label="Progreso de la cotización"
  >
    <li v-for="step in STEPS" :key="step.index" class="quotation-stepper-item">
      <div
        class="quotation-stepper-step"
        :data-testid="`stepper-step-${step.index}`"
        :data-state="stepState(step.index)"
      >
        <span aria-hidden="true" class="quotations-stepper-node">
          <UIcon v-if="stepState(step.index) === 'completed'" name="i-lucide-check" class="size-3.5" />
          <template v-else>{{ step.index + 1 }}</template>
        </span>
        <span class="quotations-stepper-label">{{ step.label }}</span>
      </div>

      <!-- Connector line to the next step (skipped after the last node). -->
      <span
        v-if="step.index < STEPS.length - 1"
        aria-hidden="true"
        class="quotations-stepper-connector"
        :data-testid="`stepper-connector-${step.index}`"
        :data-state="connectorState(step.index)"
      />
    </li>
  </ol>
</template>

<style scoped>
.quotation-stepper { display: flex; width: 100%; align-items: center; gap: 8px; margin: 0; padding: 0; list-style: none; }
.quotation-stepper-item { display: flex; flex: 1; align-items: center; gap: 8px; min-width: 0; }
.quotation-stepper-item:last-child { flex: none; }
.quotation-stepper-step { display: flex; align-items: center; gap: 8px; }

.quotations-stepper-node {
  display: inline-flex;
  width: 22px;
  height: 22px;
  flex: none;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--hf-border);
  border-radius: 9999px;
  background: var(--hf-surface);
  color: var(--hf-muted);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.is-compact .quotations-stepper-node { width: 20px; height: 20px; font-size: 11px; }

.quotations-stepper-label { color: var(--hf-muted); font-size: 13px; font-weight: 600; white-space: nowrap; }

.quotation-stepper-step[data-state='completed'] .quotations-stepper-node { border-color: var(--hf-success); background: var(--hf-success); color: var(--hf-on-action); }
.quotation-stepper-step[data-state='active'] .quotations-stepper-node { border-color: var(--hf-action); background: var(--hf-action); color: var(--hf-on-action); }
.quotation-stepper-step[data-state='active'] .quotations-stepper-label { color: var(--hf-heading); }
.quotation-stepper-step[data-state='completed'] .quotations-stepper-label { color: var(--hf-ink); }

.quotations-stepper-connector { height: 1px; min-width: 24px; flex: 1; background: var(--hf-border); }
.quotations-stepper-connector[data-state='completed'] { background: var(--hf-success); }

@media (max-width: 639px) {
  .quotation-stepper-step[data-state='future'] .quotations-stepper-label,
  .quotation-stepper-step[data-state='completed'] .quotations-stepper-label { display: none; }
}
</style>
