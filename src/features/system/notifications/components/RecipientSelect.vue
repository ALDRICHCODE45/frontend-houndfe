<script setup lang="ts">
/**
 * RecipientSelect — multi-select for assigning notification recipients.
 *
 * Behaviour (per spec REQ-5):
 *   - USelectMenu :multiple driven by `assignable` users (id/name).
 *   - v-model emits the selected ids as `string[]`.
 *   - Stale ids (selected but NOT in assignable) render as a chip with
 *     the "Usuario no disponible" copy. They are NEVER auto-removed —
 *     the user explicitly removes them via the chip's close button.
 *   - Renders a "N seleccionados" summary below the trigger.
 *   - Surfaces an inline field error via the `error` prop.
 *
 * All option derivation / label resolution / stale detection lives in the
 * pure `recipientSelectState.ts` module; the SFC just composes them.
 */
import { computed } from 'vue'
import type { AssignableUser } from '@/features/POS/users/interfaces/user.types'
import {
  computeRecipientOptions,
  resolveSelectedRows,
} from './recipientSelectState'
import { NOTIFICATION_CONFIG_COPY } from '../copy'

const props = withDefaults(
  defineProps<{
    modelValue: readonly string[]
    assignable: readonly AssignableUser[]
    disabled?: boolean
    error?: string
    placeholder?: string
  }>(),
  {
    disabled: false,
    error: '',
    placeholder: 'Buscar usuarios...',
  },
)

const emit = defineEmits<{
  'update:modelValue': [next: string[]]
}>()

const options = computed(() => computeRecipientOptions(props.assignable))
const rows = computed(() => resolveSelectedRows(props.modelValue, props.assignable))

/**
 * Resolved selected options shaped as USelectMenu's `model-value` expects
 * when used in value-key mode (an array of items whose value-key matches).
 * We rely on USelectMenu's "selectedIcon + value-key" path: pass the
 * selected ids array and USelectMenu matches them against the items list
 * via the `value-key` attribute.
 */
function onUpdate(next: unknown) {
  if (Array.isArray(next)) {
    emit(
      'update:modelValue',
      next.map((v) => String(v)),
    )
    return
  }
  emit('update:modelValue', [])
}

function removeChip(id: string) {
  emit(
    'update:modelValue',
    props.modelValue.filter((existing) => existing !== id),
  )
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <USelectMenu
      :model-value="[...modelValue]"
      :items="options"
      value-key="value"
      :search-input="{ placeholder }"
      :disabled="disabled"
      :placeholder="placeholder"
      multiple
      ignore-filter
      class="w-full"
      data-testid="recipient-select-trigger"
      @update:model-value="onUpdate"
    />

    <!-- Selection summary + chips. -->
    <div class="flex flex-col gap-2">
      <p class="text-xs text-muted" data-testid="recipient-summary">
        {{ modelValue.length }} seleccionados
      </p>

      <div
        v-if="rows.length > 0"
        class="flex flex-wrap gap-2"
        data-testid="recipient-chips"
      >
        <span
          v-for="row in rows"
          :key="row.id"
          class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs"
          :class="
            row.isStale
              ? 'border border-warning/40 bg-warning/10 text-warning'
              : 'border border-default bg-elevated/50 text-default'
          "
          :data-testid="`recipient-chip-${row.id}`"
        >
          <span>{{ row.label }}</span>
          <button
            type="button"
            :aria-label="`Quitar ${row.label}`"
            class="inline-flex size-4 items-center justify-center rounded-full hover:bg-elevated"
            :data-testid="`recipient-chip-remove-${row.id}`"
            @click="removeChip(row.id)"
          >
            <UIcon name="i-lucide-x" class="size-3" />
          </button>
        </span>
      </div>
    </div>

    <!-- Inline field error. -->
    <p
      v-if="error"
      class="text-xs text-error"
      data-testid="recipient-error"
    >
      {{ error }}
    </p>

    <!-- Hidden screen-reader copy used for stale messages, so the
         Spanish string is reachable by tests / a11y tools. -->
    <span class="sr-only">{{ NOTIFICATION_CONFIG_COPY.staleRecipient }}</span>
  </div>
</template>