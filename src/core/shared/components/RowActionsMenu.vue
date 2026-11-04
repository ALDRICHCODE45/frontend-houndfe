<script setup lang="ts">
/**
 * RowActionsMenu — The ⋮ menu that holds a row's (or card's) actions, so a
 * table never shows two loose buttons in its Acciones column.
 *
 * Items keep the given order; destructive ones always go last, after a
 * separator, styled with `--hf-danger`. Selecting an action emits its `key`;
 * the owner decides what it does (and confirms destructive ones).
 *
 * Props:
 *   actions      — { key, label, icon?, destructive?, disabled? }[]; empty renders nothing
 *   rowLabel     — names the row in the trigger's aria-label ("Acciones de {rowLabel}")
 *   ariaLabel    — full aria-label override
 *   portalClass  — extra class for the teleported menu (feature theme hook)
 *
 * Events:
 *   select(key)  — an action was chosen
 */
import { computed } from 'vue'

export interface RowAction {
  key: string
  label: string
  icon?: string
  destructive?: boolean
  disabled?: boolean
}

const props = defineProps<{
  actions: RowAction[]
  rowLabel: string
  ariaLabel?: string
  portalClass?: string
}>()

const emit = defineEmits<{ select: [key: string] }>()

const triggerLabel = computed(() => props.ariaLabel ?? `Acciones de ${props.rowLabel}`)

// One group with an explicit separator, so the divider is a real
// `role="separator"` for assistive tech and not only a border between groups.
const menuItems = computed(() => {
  const toItem = (action: RowAction) => ({
    label: action.label,
    icon: action.icon,
    disabled: action.disabled,
    class: action.destructive ? 'hf-row-action-danger' : undefined,
    onSelect: () => emit('select', action.key),
  })
  const regular = props.actions.filter((action) => !action.destructive).map(toItem)
  const destructive = props.actions.filter((action) => action.destructive).map(toItem)
  return regular.length > 0 && destructive.length > 0
    ? [...regular, { type: 'separator' as const }, ...destructive]
    : [...regular, ...destructive]
})
</script>

<template>
  <span v-if="actions.length > 0" class="inline-flex" @click.stop @keydown.enter.stop @keydown.space.stop>
    <!-- Single root so class and attributes fall through. Stop clicks and the keys that activate a row, so a
         clickable parent row never opens from the menu; Escape and Tab still reach an enclosing dialog. -->
    <UDropdownMenu
      :items="menuItems"
      :content="{ align: 'end' }"
      :ui="{ content: ['hf-theme hf-ui', portalClass] }"
    >
      <UButton
        icon="i-lucide-ellipsis-vertical"
        color="neutral"
        variant="ghost"
        class="hf-row-actions-trigger"
        :aria-label="triggerLabel"
      />
    </UDropdownMenu>
  </span>
</template>
