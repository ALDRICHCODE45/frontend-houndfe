<script setup lang="ts">
/**
 * «Siguiente paso» bar: ONE suggested action for the selected shift and role,
 * or what the shift is waiting for («En espera»). The alternative stays one
 * click away; nothing here dispatches a command — it only opens the task in
 * place, where the real command lives. Hidden when its own task is already open.
 */
import type { CashNextAction } from '../utils/cash-timeline'
import type { CashPanelId } from '../composables/useCashWorkspace'

defineProps<{
  action: CashNextAction
  /** The task currently open in place (the primary button is not repeated for it). */
  openId?: CashPanelId | null
}>()

const emit = defineEmits<{ open: [panelId: CashPanelId] }>()
</script>

<template>
  <section
    class="cash-next"
    :class="`cash-next--${action.kind}`"
    aria-labelledby="cash-next-title"
    data-testid="cash-next-action"
    :data-kind="action.kind"
  >
    <div class="cash-next-text">
      <p class="cash-next-kicker">{{ action.kind === 'primary' ? 'Siguiente paso' : 'En espera' }}</p>
      <h2 id="cash-next-title" class="cash-next-title" data-testid="cash-next-title">
        {{ action.label }}
      </h2>
      <p class="cash-next-why">{{ action.why }}</p>
    </div>
    <div class="cash-next-actions">
      <UButton
        v-if="action.alt"
        type="button"
        color="neutral"
        variant="outline"
        class="min-h-11"
        data-testid="cash-next-alt"
        @click="emit('open', action.alt.stepId)"
      >
        {{ action.alt.label }}
      </UButton>
      <UButton
        v-if="action.kind === 'primary' && action.stepId"
        type="button"
        class="min-h-11"
        :variant="openId ? 'outline' : 'solid'"
        :color="openId ? 'neutral' : 'primary'"
        data-testid="cash-next-primary"
        @click="emit('open', action.stepId)"
      >
        {{ action.label }}
      </UButton>
    </div>
  </section>
</template>
