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
 *   - The chips are the selection, so the trigger never repeats the names
 *     (it reads "Agregar usuarios") and there is no count summary.
 *   - While the users load, or when their read fails, no chip is drawn:
 *     an unresolved id is not an unavailable user. A failed read says so
 *     with Reintentar (`retry`).
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
import '../styles/notifications-visual.css'

const props = withDefaults(
  defineProps<{
    modelValue: readonly string[]
    assignable: readonly AssignableUser[]
    disabled?: boolean
    error?: string
    placeholder?: string
    loading?: boolean
    loadError?: boolean
  }>(),
  {
    disabled: false,
    error: '',
    placeholder: NOTIFICATION_CONFIG_COPY.searchRecipients,
    loading: false,
    loadError: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [next: string[]]
  retry: []
}>()

const options = computed(() => computeRecipientOptions(props.assignable))
const rows = computed(() =>
  props.loading || props.loadError ? [] : resolveSelectedRows(props.modelValue, props.assignable),
)

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
      :loading="loading"
      multiple
      class="w-full sm:max-w-md"
      :ui="{ content: 'hf-theme hf-ui hf-form-overlay' }"
      data-testid="recipient-select-trigger"
      @update:model-value="onUpdate"
    >
      <!-- The chips below are the selection; the trigger only invites to add. -->
      <span class="truncate text-dimmed">{{ NOTIFICATION_CONFIG_COPY.addRecipients }}</span>
      <template #empty="{ searchTerm }">
        <template v-if="searchTerm">Ningún usuario para «{{ searchTerm }}»</template>
        <template v-else>{{ NOTIFICATION_CONFIG_COPY.noAssignableUsers }}</template>
      </template>
    </USelectMenu>

    <p
      v-if="loadError"
      role="alert"
      class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-error"
      data-testid="recipient-load-error"
    >
      <span>{{ NOTIFICATION_CONFIG_COPY.usersLoadError }}</span>
      <UButton
        size="sm"
        variant="outline"
        color="neutral"
        icon="i-lucide-rotate-cw"
        data-testid="recipient-retry"
        @click="emit('retry')"
      >
        {{ NOTIFICATION_CONFIG_COPY.retry }}
      </UButton>
    </p>

    <!-- The selection. -->
    <div
      v-if="rows.length > 0"
      class="flex flex-wrap gap-2"
      data-testid="recipient-chips"
    >
      <span
        v-for="row in rows"
        :key="row.id"
        class="notifications-chip inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs"
        :data-stale="row.isStale ? 'true' : undefined"
        :data-testid="`recipient-chip-${row.id}`"
      >
        <span>{{ row.label }}</span>
        <button
          type="button"
          :aria-label="`Quitar ${row.label}`"
          class="-my-1 -mr-1.5 inline-flex size-6 items-center justify-center rounded-full hover:bg-muted"
          :data-testid="`recipient-chip-remove-${row.id}`"
          @click="removeChip(row.id)"
        >
          <UIcon name="i-lucide-x" class="size-3" />
        </button>
      </span>
    </div>

    <!-- Inline field error. -->
    <p
      v-if="error"
      class="text-xs text-error"
      data-testid="recipient-error"
    >
      {{ error }}
    </p>
  </div>
</template>