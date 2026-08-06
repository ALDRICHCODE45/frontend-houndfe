<script setup lang="ts">
/**
 * `QuotationExpiryPicker.vue` — S6 / REQ-QTN-008 / REQ-UI-006 (T-UI-17/18/19).
 *
 * Wraps the project's `DateFieldPopover` (used across sales, employees,
 * and products) so the quotation expiry field matches the visual language
 * of the rest of the app. In read-only mode the component degrades to a
 * pure text label.
 *
 * Phase 3 added shortcut chips below the date input — "7 días", "15 días",
 * "30 días", "Sin expiración" — so the cashier can apply common presets
 * with one click instead of opening the calendar. The chips mirror the
 * Coco reference (`docs/redesign/quotations-detail-comparison.md` §1.5).
 *
 * Contract:
 *   - Props ↓
 *       expiresAt: ISO timestamp string or null
 *       readonly:  hides the picker + clear button + shortcut chips
 *   - Events ↑
 *       update:expiresAt: [isoString | null]
 *
 * Testids (Phase 3 additions):
 *   - chip container: expiry-chips
 *   - day chips:      expiry-chip-7 | expiry-chip-15 | expiry-chip-30
 *   - clear chip:     expiry-chip-none
 *   - active state:   data-active="true|false" on each chip
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

// ── T-UI-17/18/19 — shortcut chips (REQ-UI-006) ─────────────────────────────
// Each day chip emits `update:expiresAt` with `now + N days` at midnight
// UTC. "Sin expiración" emits `null`. The `activeChip` computed compares
// each chip's logical value against the current `expiresAt` so the right
// pill gets the accent-50 background.

interface ShortcutChip {
  id: '7' | '15' | '30' | 'none'
  label: string
  /** Logical value — either an ISO string at midnight UTC, or null for none. */
  value: string | null
}

const DAY_CHIPS: readonly ShortcutChip[] = [
  { id: '7', label: '7 días', value: '' },
  { id: '15', label: '15 días', value: '' },
  { id: '30', label: '30 días', value: '' },
  { id: 'none', label: 'Sin expiración', value: null },
]

/**
 * Build the ISO string for "now + N days" at midnight UTC. The chip value
 * mirrors what `handleDateUpdate` would produce if the cashier picked the
 * same date manually via the calendar — this keeps the emit semantics
 * consistent so the parent can treat both code paths identically.
 */
function chipValue(days: number): string {
  const target = new Date()
  target.setUTCDate(target.getUTCDate() + days)
  // Normalize to midnight UTC — strip time so the comparison
  // `chipValue(N) === currentExpiresAt` is reliable regardless of the
  // time the user opened the picker.
  target.setUTCHours(0, 0, 0, 0)
  return target.toISOString()
}

/**
 * The active chip matches the current `expiresAt`. We compare day-N
 * anchors (chip value) to the current value to decide which pill is
 * highlighted. When no chip matches (e.g. cashier typed a custom date),
 * every chip is inactive.
 */
const activeChipId = computed<string | null>(() => {
  if (!props.expiresAt) return 'none'
  const value = props.expiresAt
  for (const days of [7, 15, 30] as const) {
    if (chipValue(days) === value) return String(days)
  }
  return null
})

function isChipActive(id: ShortcutChip['id']): boolean {
  return activeChipId.value === id
}

function handleChipClick(chip: ShortcutChip): void {
  if (chip.id === 'none') {
    emit('update:expiresAt', null)
    return
  }
  emit('update:expiresAt', chipValue(Number(chip.id)))
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="quotation-expiry-picker">
    <p class="text-xs font-semibold uppercase tracking-wide text-muted">Expira</p>

    <p
      v-if="readonly"
      class="text-sm font-medium text-highlighted"
      data-testid="expiry-display"
    >{{ displayLabel }}</p>

    <div v-else class="flex flex-col gap-3" data-testid="expiry-editable">
      <div class="flex flex-wrap items-center gap-3">
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

      <!-- T-UI-17/18/19 — shortcut chips. Inactive = white outlined pill;
           active = accent-50 background with accent text. The
           data-active attribute drives the visual state via Tailwind
           arbitrary-value utilities. -->
      <div
        class="flex flex-wrap items-center gap-2"
        data-testid="expiry-chips"
      >
        <button
          v-for="chip in DAY_CHIPS"
          :key="chip.id"
          type="button"
          class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors"
          :class="isChipActive(chip.id)
            ? 'border-[var(--coco-accent)] bg-[var(--coco-accent-50)] text-[var(--coco-accent)]'
            : 'border-default bg-default text-muted hover:bg-elevated'"
          :data-testid="`expiry-chip-${chip.id}`"
          :data-active="isChipActive(chip.id) ? 'true' : 'false'"
          @click="handleChipClick(chip)"
        >
          {{ chip.label }}
        </button>
      </div>
    </div>
  </div>
</template>
