<script setup lang="ts">
/**
 * ActionsAccordion — module-grouped, data-driven accordion for selecting
 * which system actions generate notifications.
 *
 * First in-repo UAccordion contact. Built strictly from ACTION_REGISTRY
 * (no hardcoded module/action lists). Each row forwards its toggle up
 * via @update:modelValue so the parent owns the canonical state — this
 * component never mutates `modelValue` directly.
 *
 * Props ↓ / Events ↑:
 *   - modelValue:      ActionKey[] — currently-enabled actions
 *   - masterEnabled:   when false, all action rows render disabled
 *   - Emits @update:modelValue with the next enabledActions array
 *
 * Extension: add a new module/action to ACTION_REGISTRY and the view
 * renders it with NO changes here (spec REQ-10).
 */
import { computed } from 'vue'
import { ACTION_REGISTRY } from '../registry/action-registry'
import ModuleAccordionItem from './ModuleAccordionItem.vue'

const props = defineProps<{
  modelValue: readonly string[]
  masterEnabled: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [next: string[]]
}>()

// Shape the registry into UAccordion items. The label is shown in the
// trigger; the per-module count is rendered inside the body (so the
// registry stays the only source of truth).
const accordionItems = computed(() =>
  ACTION_REGISTRY.map((module) => ({
    value: module.moduleKey,
    label: module.moduleLabel,
  })),
)

function onModuleToggle(next: string[]) {
  emit('update:modelValue', next)
}
</script>

<template>
  <UAccordion
    :items="accordionItems"
    :unmount-on-hide="false"
    type="single"
    :default-value="accordionItems[0]?.value"
    data-testid="actions-accordion"
  >
    <template #body="{ item }">
      <ModuleAccordionItem
        :module="ACTION_REGISTRY.find((m) => m.moduleKey === item.value)!"
        :model-value="modelValue"
        :disabled="!masterEnabled"
        @toggle="onModuleToggle"
      />
    </template>
  </UAccordion>
</template>