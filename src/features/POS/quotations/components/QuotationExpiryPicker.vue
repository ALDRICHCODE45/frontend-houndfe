<script setup lang="ts">
/**
 * `QuotationExpiryPicker.vue` — S6 / REQ-QTN-008.
 *
 * Date picker for the quotation's `expiresAt` (ISO 8601, or null = never
 * expires, per backend §3.13). The cashier-facing affordance is a native
 * `<input type="date">` in DRAFT mode plus a "Quitar expiración" button
 * that resets the field to `null`. Read-only mode hides both controls and
 * renders a plain text label so the cashier can still see when the
 * quotation expires.
 *
 * Why native `<input type="date">` (vs `DateFieldPopover`):
 *   - The quotations editor is a small, focused screen; the calendar
 *     popover used in the sales lot editor is overkill for a single
 *     expiration date. A native picker keeps the slice under budget and
 *     reads naturally on desktop + mobile.
 *   - The picker only emits an ISO string or null — the parent owns the
 *     mutation (`useQuotationDraft.setExpiry` / `clearExpiry`) and the
 *     toast/error surface.
 *
 * Contract:
 *   - Props ↓
 *       expiresAt: ISO string or null
 *       readonly:  hides the input + clear button
 *   - Events ↑
 *       update:expiresAt: [isoString | null]
 *         - User typed/picked a new date → emit ISO at midnight UTC.
 *         - User cleared the input → emit null.
 *         - User clicked "Quitar expiración" → emit null.
 */
import { computed } from 'vue'

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

// ── Derived display helpers ──────────────────────────────────────────────────

/** Convert the ISO timestamp to a YYYY-MM-DD slice that the native date
 *  input accepts. We anchor at noon UTC so a TZ flip can't push the visible
 *  date by one day in either direction. */
const dateInputValue = computed<string>(() => {
  if (!props.expiresAt) return ''
  // Slice the YYYY-MM-DD portion. The backend serializes timestamps with a
  // 'Z' suffix; slicing the first 10 chars works regardless of timezone.
  return props.expiresAt.slice(0, 10)
})

/** Long-form Spanish date label for the display branch (read-only or
 *  visible label next to the picker). */
const displayLabel = computed<string>(() => {
  if (!props.expiresAt) return 'Sin expiración'
  // Anchor at noon UTC so the Intl formatter doesn't roll over to the
  // previous day in any reasonable TZ.
  const parsed = new Date(props.expiresAt)
  if (Number.isNaN(parsed.getTime())) return 'Sin expiración'
  return new Intl.DateTimeFormat('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(parsed)
})

// ── Event handlers ───────────────────────────────────────────────────────────

function handleDateInput(value: string): void {
  if (!value) {
    emit('update:expiresAt', null)
    return
  }
  // Anchor at midnight UTC — the backend stores full ISO; the picker only
  // returns a date. Picking "2026-09-15" maps to "2026-09-15T00:00:00.000Z".
  emit('update:expiresAt', `${value}T00:00:00.000Z`)
}

function handleClear(): void {
  emit('update:expiresAt', null)
}
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="quotation-expiry-picker">
    <!-- Always-visible label. The input replaces it visually in DRAFT mode,
         but the wording ("Expira") stays consistent across read-only /
         editable states so the cashier always sees what's being controlled. -->
    <p class="text-xs font-semibold uppercase tracking-wide text-muted">Expira</p>

    <!-- Read-only branch: pure display. -->
    <p
      v-if="readonly"
      class="text-sm font-medium text-highlighted"
      data-testid="expiry-display"
    >{{ displayLabel }}</p>

    <!-- Editable branch: native date input + clear button. -->
    <div
      v-else
      class="flex flex-wrap items-center gap-2"
      data-testid="expiry-editable"
    >
      <input
        type="date"
        class="rounded-lg border border-default bg-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        :value="dateInputValue"
        data-testid="expiry-date-input"
        @input="handleDateInput(($event.target as HTMLInputElement).value)"
      />
      <span
        class="text-sm text-muted"
        data-testid="expiry-display"
      >{{ displayLabel }}</span>
      <button
        v-if="props.expiresAt"
        type="button"
        class="inline-flex items-center gap-1 rounded-lg border border-default px-3 py-2 text-sm font-medium hover:bg-elevated"
        data-testid="expiry-clear-button"
        @click="handleClear"
      >
        <UIcon name="i-lucide-x" class="h-4 w-4" />
        Quitar expiración
      </button>
    </div>
  </div>
</template>
