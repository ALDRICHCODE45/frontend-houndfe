<script setup lang="ts">
/**
 * `QuotationExpiryPicker.vue` — S6 / REQ-QTN-008.
 *
 * Wraps the project's `DateFieldPopover` (used across sales, employees,
 * and products) so the quotation expiry field matches the visual language
 * of the rest of the app. In read-only mode the component degrades to a
 * pure text label.
 *
 * Contract:
 *   - Props ↓
 *       expiresAt: ISO timestamp string or null
 *       readonly:  hides the picker + clear button
 *   - Events ↑
 *       update:expiresAt: [isoString | null]
 */
import { computed } from 'vue'
import DateFieldPopover from '@/features/POS/sales/components/DateFieldPopover.vue'

const props = withDefaults(
  defineProps<{
    expiresAt: string | null
    readonly?: boolean
  }>(),
  { readonly: false },
)

const emit = defineEmits<{
  'update:expiresAt': [value: string | null]
}>()

// DateFieldPopover works with YYYY-MM-DD strings. We slice the first
// 10 characters of the ISO timestamp; the parent (QuotationDetailView)
// converts the emitted date back to a full ISO before calling the API.
const dateIso = computed<string | null>(() => {
  if (!props.expiresAt) return null
  return props.expiresAt.slice(0, 10)
})

function handleDateUpdate(value: string | null): void {
  if (!value) {
    emit('update:expiresAt', null)
    return
  }
  // Anchor at midnight UTC so the backend stores a consistent timestamp.
  emit('update:expiresAt', `${value}T00:00:00.000Z`)
}

const displayLabel = computed<string>(() => {
  if (!props.expiresAt) return 'Sin expiración'
  const parsed = new Date(props.expiresAt)
  if (Number.isNaN(parsed.getTime())) return 'Sin expiración'
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parsed)
})
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="quotation-expiry-picker">
    <p class="text-xs font-semibold uppercase tracking-wide text-muted">Expira</p>

    <p
      v-if="readonly"
      class="text-sm font-medium text-highlighted"
      data-testid="expiry-display"
    >{{ displayLabel }}</p>

    <div v-else class="flex flex-wrap items-center gap-3" data-testid="expiry-editable">
      <DateFieldPopover
        :model-value="dateIso"
        :disabled="readonly"
        placeholder="Sin expiración"
        testid="expiry-date-field"
        @update:model-value="handleDateUpdate"
      />
      <span class="text-sm text-muted">{{ displayLabel }}</span>
      <button
        v-if="props.expiresAt"
        type="button"
        class="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-2 text-sm font-medium hover:bg-elevated"
        data-testid="expiry-clear-button"
        @click="emit('update:expiresAt', null)"
      >
        <UIcon name="i-lucide-x" class="h-4 w-4" />
        Quitar expiración
      </button>
    </div>
  </div>
</template>
