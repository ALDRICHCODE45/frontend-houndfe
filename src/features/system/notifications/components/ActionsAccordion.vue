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
 * The per-module count lives in the TRIGGER (right side of the pill),
 * not in the body. The count is computed in this component from the
 * pure `computeModuleActionCount` helper — single source of truth.
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
import { computeModuleActionCount } from './notificationRowState'
import ModuleAccordionItem from './ModuleAccordionItem.vue'

const props = defineProps<{
  modelValue: readonly string[]
  masterEnabled: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [next: string[]]
}>()

// Shape the registry into UAccordion items. `value` is the module key
// (UAccordion's item identity); `label` is the module name shown on the
// left of the trigger; `countLabel` is the "enabled/total" fraction that
// renders on the RIGHT of the trigger pill (next to the chevron). The
// trigger owns the count — the body stays focused on the action rows.
const accordionItems = computed(() =>
  ACTION_REGISTRY.map((module) => {
    const count = computeModuleActionCount(module, props.modelValue)
    return {
      value: module.moduleKey,
      label: module.moduleLabel,
      countLabel: count.label,
    }
  }),
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
    :ui="{
      root: 'space-y-2',
      item: 'border border-default rounded-lg overflow-hidden',
      header: 'flex',
      trigger:
        'group flex items-center justify-between gap-2 w-full px-4 py-3 font-medium text-sm cursor-pointer min-w-0 hover:bg-elevated/50 transition-colors',
      content:
        'border-t border-default data-[state=open]:animate-[accordion-down_200ms_ease-out] data-[state=closed]:animate-[accordion-up_200ms_ease-out] data-[state=closed]:overflow-hidden',
      body: 'px-4 pb-4 pt-3',
      label: 'text-start break-words min-w-0',
    }"
  >
    <!--
      Per-module count lives on the right of the trigger, alongside the
      chevron. The `trailing` slot REPLACES the default chevron, so we
      re-render the chevron here. The wrapper `ml-auto` + flex container
      pushes the count + chevron group to the right edge of the pill.
    -->
    <template #trailing="{ item }">
      <div class="flex items-center gap-2 ml-auto shrink-0">
        <span
          data-testid="module-count"
          class="text-xs font-medium text-muted tabular-nums"
        >{{ item.countLabel }}</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-4 text-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
        />
      </div>
    </template>

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
