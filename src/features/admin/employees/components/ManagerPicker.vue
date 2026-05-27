<script setup lang="ts">
/**
 * ManagerPicker — WU-04B
 *
 * Async manager search picker built on Nuxt UI's USelectMenu.
 *
 * Behaviour:
 * - Wraps useManagerPicker composable (debounced 300ms, staleTime 60s).
 * - Search is driven externally via USelectMenu's update:searchTerm event.
 * - Query enabled when picker is open OR search length ≥ 1.
 * - Emits update:modelValue with the selected manager's UUID (or null to clear).
 * - Shows manager name + position + department as option items via #item-label slot.
 *
 * Edit mode:
 * - Pass excludeId to prevent an employee from selecting themselves as manager.
 *
 * CAUTION — Reka UI focus trap:
 *   If this component is embedded in a USlideover, the Reka UI focus trap can freeze
 *   the UI (https://github.com/nuxt/ui/issues/3408). If that happens, replace
 *   USelectMenu with a plain CategorySelect-style implementation.
 *   For now, this component is tested as a standalone picker.
 */
import { watch } from 'vue'
import { useManagerPicker } from '../composables/useManagerPicker'
import type { ManagerPickerOption } from '../composables/useManagerPicker'

// ─── Props & emits ────────────────────────────────────────────────────────────

const props = withDefaults(
  defineProps<{
    /** Selected manager UUID, or null when no manager is selected */
    modelValue: string | null
    /** In edit mode: the employee's own id to exclude from results */
    excludeId?: string | null
    /** Optional placeholder text */
    placeholder?: string
    /** Whether the picker is disabled */
    disabled?: boolean
  }>(),
  {
    excludeId: null,
    placeholder: 'Buscar jefe directo...',
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

// ─── Composable ───────────────────────────────────────────────────────────────

const { search, isOpen, managers, isLoading } = useManagerPicker({
  excludeId: props.excludeId,
})

// ─── v-model bridging ─────────────────────────────────────────────────────────

/**
 * The currently selected option object (needed by USelectMenu value-key approach).
 * We keep it as the full option object internally, but emit only the id.
 */
function findSelectedOption(id: string | null): ManagerPickerOption | null {
  if (!id) return null
  return managers.value.find((m) => m.id === id) ?? null
}

function onUpdate(option: ManagerPickerOption | null) {
  emit('update:modelValue', option?.id ?? null)
}

// When isOpen changes, update the composable's isOpen ref
watch(
  () => props.modelValue,
  () => {
    // no-op: we only read the prop to compute selectedOption below
  },
)
</script>

<template>
  <USelectMenu
    :model-value="findSelectedOption(props.modelValue)"
    :items="managers"
    value-key="id"
    label-key="label"
    :loading="isLoading"
    :disabled="disabled"
    :placeholder="placeholder"
    :search-input="{ placeholder: 'Buscar...' }"
    ignore-filter
    class="w-full"
    @update:model-value="onUpdate"
    @update:search-term="search = $event"
    @update:open="isOpen = $event"
  >
    <template #item-label="{ item }">
      <div class="flex flex-col gap-0.5 py-0.5">
        <span class="font-medium text-default">{{ item.label }}</span>
        <span class="text-xs text-muted">
          {{ item.position }}
          <template v-if="item.department !== '—'"> · {{ item.department }}</template>
        </span>
      </div>
    </template>

    <template #empty>
      <p class="p-2 text-center text-sm text-muted">
        {{ isLoading ? 'Buscando...' : 'Sin resultados' }}
      </p>
    </template>
  </USelectMenu>
</template>
