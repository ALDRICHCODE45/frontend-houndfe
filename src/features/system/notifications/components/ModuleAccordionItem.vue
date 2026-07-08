<script setup lang="ts">
/**
 * ModuleAccordionItem — one accordion panel for a single registry module.
 *
 * Wraps UAccordion's items shape: provides a label (module name + "enabled/total"
 * badge), and a content slot pre-populated with the action rows.
 *
 * The UAccordion parent composes items from the registry; this component is
 * the *body* of a single item, so it does NOT wrap UAccordion itself.
 */
import { computed } from 'vue'
import type { ModuleDescriptor } from '../interfaces/notification-config.types'
import { computeModuleActionCount } from './notificationRowState'
import ActionRow from './ActionRow.vue'

const props = defineProps<{
  module: ModuleDescriptor
  modelValue: readonly string[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  toggle: [next: string[]]
}>()

const count = computed(() => computeModuleActionCount(props.module, props.modelValue))

function onToggle(next: string[]) {
  emit('toggle', next)
}
</script>

<template>
  <div class="space-y-3 py-2">
    <div class="flex items-center justify-between text-xs text-muted">
      <span class="font-medium uppercase tracking-wide">
        Acciones del módulo
      </span>
      <span data-testid="module-count">{{ count.label }}</span>
    </div>
    <div class="space-y-2">
      <ActionRow
        v-for="action in module.actions"
        :key="action.key"
        :action="action"
        :model-value="modelValue"
        :disabled="disabled"
        @toggle="onToggle"
      />
    </div>
  </div>
</template>