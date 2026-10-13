<script setup lang="ts">
/**
 * CashSaleSessionPicker — explicit Caja↔charge binding control (T6 / S3).
 *
 * Presentational only: it renders the eligible own/OPEN rows the parent hands it
 * and emits the explicit selection/page changes upward. Every rule (identity
 * scoping, own/OPEN/tenant filtering, paging, eligibility) lives in the single
 * `useCashSaleSession` instance owned by `PaymentModal`, so the picker can never
 * hold a second, disagreeing view of the same selection.
 *
 * Selecting a session is the ONLY way a charge becomes bound; clearing it
 * restores the legacy unbound charge. There is no automatic assignment of the
 * first, sole or previous session.
 */
import { computed } from 'vue'
import type { CashSession } from '@/features/POS/cash-register/interfaces/cash.types'

const props = defineProps<{
  /** The eligible rows of the CURRENT page (own + OPEN + current tenant). */
  sessions: CashSession[]
  /** The explicit selection held by the parent, or `null` when unbound. */
  selectedId: string | null
  /** Whether the selection is revalidated against the current rows. */
  isSelectionEligible: boolean
  isFetching: boolean
  isError: boolean
  page: number
  pageCount: number
  /** The unfiltered total (all statuses) — never claimed as a filtered total. */
  total: number
  /**
   * Optional teleport boundary marker forwarded to the installed Select's
   * `ui.content`. Absent by default, so the listbox keeps its native defaults.
   */
  portalClass?: string
}>()

const emit = defineEmits<{
  'update:selectedId': [id: string | null]
  'update:page': [page: number]
}>()

const selectValue = computed<string>({
  get: () => props.selectedId ?? '',
  set: (value) => {
    emit('update:selectedId', typeof value === 'string' && value !== '' ? value : null)
  },
})

const selectItems = computed(() =>
  props.sessions.map((session) => ({ label: session.id, value: session.id })),
)

/** A chosen id that the current rows cannot revalidate: warn, never fall back. */
const isStaleSelection = computed(() => props.selectedId !== null && !props.isSelectionEligible)

const selectedLabel = computed(
  () =>
    props.sessions.find((session) => session.id === props.selectedId)?.id ?? props.selectedId ?? '',
)

function clear() {
  emit('update:selectedId', null)
}
</script>

<template>
  <section data-testid="cash-session-binding" class="space-y-2 sales-pos-cash-session">
    <UFormField label="Sesión de caja">
      <div class="space-y-2">
        <USelect
          :model-value="selectValue"
          data-testid="cash-session-select"
          :items="selectItems"
          :disabled="isFetching"
          :ui="portalClass ? { content: portalClass } : undefined"
          placeholder="Sin caja (legacy)"
          @update:model-value="selectValue = $event"
        />

        <p v-if="isFetching" class="text-xs text-muted" data-testid="cash-session-loading">
          Cargando sesiones de caja…
        </p>
        <p v-else-if="isError" class="text-xs text-error" data-testid="cash-session-error">
          No se pudieron cargar las sesiones de caja. Reintentá o cobrá sin vincular.
        </p>
        <p
          v-else-if="sessions.length === 0"
          class="text-xs text-muted"
          data-testid="cash-session-empty"
        >
          No hay sesiones de caja abiertas propias para vincular.
        </p>

        <p v-if="isStaleSelection" class="text-xs text-warning" data-testid="cash-session-stale">
          La sesión elegida ({{ selectedLabel }}) ya no está disponible. Elegí otra o cobrá sin
          vincular.
        </p>

        <UButton
          v-if="selectedId !== null"
          data-testid="cash-session-clear"
          type="button"
          color="neutral"
          variant="ghost"
          size="xs"
          @click="clear"
        >
          Cobrar sin vincular (legacy)
        </UButton>
      </div>
    </UFormField>

    <div v-if="pageCount > 1" class="flex items-center justify-between gap-2 text-xs text-muted">
      <UButton
        data-testid="cash-session-prev-page"
        type="button"
        color="neutral"
        variant="ghost"
        size="xs"
        :disabled="page <= 1 || isFetching"
        @click="emit('update:page', page - 1)"
      >
        Anterior
      </UButton>
      <span data-testid="cash-session-page">
        Página {{ page }} de {{ pageCount }} · {{ total }} sesiones
      </span>
      <UButton
        data-testid="cash-session-next-page"
        type="button"
        color="neutral"
        variant="ghost"
        size="xs"
        :disabled="page >= pageCount || isFetching"
        @click="emit('update:page', page + 1)"
      >
        Siguiente
      </UButton>
    </div>
  </section>
</template>
