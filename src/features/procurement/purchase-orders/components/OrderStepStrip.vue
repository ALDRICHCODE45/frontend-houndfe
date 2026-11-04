<script setup lang="ts">
import { computed } from 'vue'
import { confirmSteps } from '../utils/order-checklist'
const props = defineProps<{ pending: number; dirty: boolean; compact?: boolean }>()
const steps = computed(() => confirmSteps(props))
// Shows where the draft stands; it is not navigation and never blocks.
const countText = (count: number) => props.compact ? ` (${count})` : ` · ${count} ${count === 1 ? 'pendiente' : 'pendientes'}`
</script>

<template>
  <ol class="order-steps" :class="{ 'is-compact': compact }" aria-label="Pasos para confirmar">
    <li v-for="(step, index) in steps" :key="step.key" :data-step="step.key" :data-state="step.state" :aria-current="step.state === 'current' ? 'step' : undefined">
      <span class="order-step-mark" aria-hidden="true"><UIcon v-if="step.state === 'done'" name="i-lucide-check" />{{ step.state === 'done' ? '' : index + 1 }}</span>
      <span class="order-step-label">{{ step.label }}<span v-if="step.count > 0" class="order-step-count">{{ countText(step.count) }}</span></span>
    </li>
  </ol>
</template>
