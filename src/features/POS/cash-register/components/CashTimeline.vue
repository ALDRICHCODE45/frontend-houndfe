<script setup lang="ts">
/**
 * Shift timeline (direction A): an ordered list of the lifecycle steps. Each
 * step says who does it and its state (in words, never by color alone) and
 * opens its task IN PLACE. Nothing forces an order: every reachable step has
 * its own «Abrir» / «Ver»; the suggested one is only highlighted.
 *
 * Presentational: the view supplies the steps (utils/cash-timeline) and one
 * scoped slot per step (`panel-<id>`). Every panel stays mounted (`v-show`) so
 * a draft survives moving between steps; opening a step moves focus to its
 * heading so keyboard and screen-reader users land on the task.
 */
import { nextTick, useTemplateRef, watch } from 'vue'
import type { CashStepId, CashTimelineStep } from '../utils/cash-timeline'
import { CASH_PANEL_TITLES, type CashPanelId } from '../composables/useCashWorkspace'

const props = withDefaults(
  defineProps<{
    steps: CashTimelineStep[]
    openId?: CashPanelId | null
    /** Accessible name of the list, e.g. «Pasos del turno de Caja principal». */
    label?: string
  }>(),
  { openId: null, label: 'Pasos del turno' },
)

const emit = defineEmits<{ toggle: [stepId: CashStepId] }>()

defineSlots<Partial<Record<`panel-${CashStepId}`, () => unknown>>>()

const root = useTemplateRef<HTMLOListElement>('root')

const STEP_ICONS: Record<CashStepId, string> = {
  apertura: 'i-lucide-wallet',
  movimientos: 'i-lucide-arrow-up-down',
  conteo: 'i-lucide-calculator',
  declaracion: 'i-lucide-eye-off',
  entrega: 'i-lucide-hand-coins',
  verificacion: 'i-lucide-shield-check',
  liberar: 'i-lucide-lock-open',
  cierre: 'i-lucide-lock',
  corte: 'i-lucide-file-text',
}

function actionWord(step: CashTimelineStep): string {
  return step.state === 'done' ? 'Ver' : 'Abrir'
}

watch(
  () => props.openId,
  async (id, previous) => {
    if (!id || id === previous) return
    await nextTick()
    root.value?.querySelector<HTMLElement>(`[data-step-title="${id}"]`)?.focus()
  },
)
</script>

<template>
  <ol ref="root" class="cash-tl" :aria-label="label" data-testid="cash-timeline">
    <li
      v-for="step in steps"
      :key="step.id"
      class="cash-tl-item"
      :class="[
        `is-${step.state}`,
        { 'is-open': openId === step.id, 'is-highlighted': step.highlighted },
      ]"
      :data-testid="`cash-step-${step.id}`"
      :data-state="step.state"
    >
      <span class="cash-tl-dot" aria-hidden="true">
        <UIcon v-if="step.state === 'done'" name="i-lucide-check" class="size-3.5" />
        <UIcon v-else-if="step.state === 'blocked'" name="i-lucide-lock" class="size-3.5" />
      </span>
      <div class="cash-tl-body">
        <div class="cash-tl-head">
          <UIcon :name="STEP_ICONS[step.id]" class="cash-tl-icon" aria-hidden="true" />
          <div class="cash-tl-text">
            <h3 class="cash-tl-title">{{ step.label }}</h3>
            <p class="cash-tl-meta" :data-testid="`cash-step-detail-${step.id}`">
              {{ step.detail }}
            </p>
          </div>
          <span class="cash-tl-who" :data-testid="`cash-step-who-${step.id}`">{{
            step.actorLabel
          }}</span>
          <span class="sr-only" :data-testid="`cash-step-state-${step.id}`"
            >Estado: {{ step.stateLabel }}</span
          >
          <UButton
            v-if="openId === step.id"
            type="button"
            color="neutral"
            variant="ghost"
            class="cash-tl-toggle"
            :aria-expanded="true"
            :aria-controls="`cash-step-panel-${step.id}`"
            :data-testid="`cash-step-toggle-${step.id}`"
            @click="emit('toggle', step.id)"
          >
            Ocultar
          </UButton>
          <UButton
            v-else-if="step.reachable"
            type="button"
            color="neutral"
            variant="ghost"
            trailing-icon="i-lucide-chevron-right"
            class="cash-tl-toggle"
            :aria-expanded="false"
            :aria-controls="`cash-step-panel-${step.id}`"
            :aria-label="`${actionWord(step)}: ${step.label}`"
            :data-testid="`cash-step-toggle-${step.id}`"
            @click="emit('toggle', step.id)"
          >
            {{ actionWord(step) }}
          </UButton>
        </div>
        <div
          v-show="openId === step.id"
          :id="`cash-step-panel-${step.id}`"
          class="cash-tl-panel"
          :data-testid="`cash-task-${step.id}`"
        >
          <h3 class="sr-only" tabindex="-1" :data-step-title="step.id">
            {{ CASH_PANEL_TITLES[step.id] }}
          </h3>
          <slot :name="`panel-${step.id}`" />
        </div>
      </div>
    </li>
  </ol>
</template>
