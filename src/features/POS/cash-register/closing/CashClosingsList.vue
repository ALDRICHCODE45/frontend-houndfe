<script setup lang="ts">
/**
 * «Cortes» inside Caja (T4, S5/S7): paginated GET /cash-closings with register,
 * cashier (the closed session's cashier, §3) and date filters.
 *
 * The list items are identity-only `{ id, sessionId, folio, createdAt }`; caja,
 * cajero and diferencia come from each row's corte (cached, immutable, shared
 * with the detail). The parent supplies the filter options it already has; a
 * filter without options is hidden. A row opens the detail (`open`).
 */
import { computed, ref, useId, watch } from 'vue'
import { CalendarDate } from '@internationalized/date'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { CashClosingListParams } from '../interfaces/cash.types'
import { cashErrorInfo } from '../composables/cashErrorCopy'
import { closingDateRange } from './closingView'
import { useCashClosingSummaries, useCashClosingsList } from './useCashClosing'

const props = withDefaults(
  defineProps<{
    registers?: Array<{ id: string; name: string }>
    cashiers?: Array<{ userId: string; displayName: string }>
    pageSize?: number
  }>(),
  { registers: () => [], cashiers: () => [], pageSize: 10 },
)

const emit = defineEmits<{ open: [closingId: string] }>()

const uid = useId()
const ids = {
  register: `cc-register-${uid}`,
  cashier: `cc-cashier-${uid}`,
  from: `cc-from-${uid}`,
  to: `cc-to-${uid}`,
}

const page = ref(1)
const registerId = ref('')
const cashierUserId = ref('')
const fromDate = ref('')
const toDate = ref('')

/** Reka selects cannot hold an empty value: «all» is a sentinel, never sent. */
const ALL = 'all'
const registerItems = computed(() => [
  { label: 'Todas las cajas', value: ALL },
  ...props.registers.map((register) => ({ label: register.name, value: register.id })),
])
const cashierItems = computed(() => [
  { label: 'Todas las personas', value: ALL },
  ...props.cashiers.map((cashier) => ({ label: cashier.displayName, value: cashier.userId })),
])
const registerModel = computed({
  get: () => registerId.value || ALL,
  set: (value: string) => {
    registerId.value = value === ALL ? '' : value
  },
})
const cashierModel = computed({
  get: () => cashierUserId.value || ALL,
  set: (value: string) => {
    cashierUserId.value = value === ALL ? '' : value
  },
})

/** `AAAA-MM-DD` ↔ calendar date (never a JS Date, so no timezone drift). */
function toCalendarDate(value: string): CalendarDate | undefined {
  const [year, month, day] = value.split('-').map(Number)
  return year && month && day ? new CalendarDate(year, month, day) : undefined
}

function fromCalendarDate(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const { year, month, day } = value as { year?: number; month?: number; day?: number }
  if (!year || !month || !day) return ''
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const hasFilters = computed(
  () => Boolean(registerId.value || cashierUserId.value || fromDate.value || toDate.value),
)

// Any filter change goes back to the first page.
watch([registerId, cashierUserId, fromDate, toDate], () => {
  page.value = 1
})

const params = computed<CashClosingListParams>(() => {
  const query: CashClosingListParams = { page: page.value, limit: props.pageSize }
  if (registerId.value) query.registerId = registerId.value
  if (cashierUserId.value) query.cashierUserId = cashierUserId.value
  return { ...query, ...closingDateRange(fromDate.value, toDate.value) }
})

const list = useCashClosingsList(params)
const rowIds = computed(() => list.items.value.map((item) => item.id))
const { byId } = useCashClosingSummaries(rowIds)

const totalPages = computed(() => Math.max(1, Math.ceil(list.total.value / props.pageSize)))
const errorMessage = computed(() =>
  list.isError.value ? cashErrorInfo(list.error.value, 'No pudimos cargar los cortes.').message : '',
)

const rows = computed(() =>
  list.items.value.map((item) => {
    const snapshot = byId.value.get(item.id)?.snapshot
    const difference = snapshot?.comparison.verifiedVsExpectedDifferenceCents ??
      snapshot?.comparison.declarationDifferenceCents
    return {
      id: item.id,
      folio: item.folio,
      register: snapshot?.registerName?.trim() || (snapshot ? '—' : ''),
      cashier: snapshot?.cashierName?.trim() || (snapshot ? '—' : ''),
      date: formatShortDateTime(item.createdAt),
      difference: typeof difference === 'number' ? difference : null,
      loaded: Boolean(snapshot),
    }
  }),
)

function differenceText(cents: number | null): string {
  if (cents === null) return '—'
  return formatCentsMXN(cents)
}

function goTo(next: number) {
  page.value = Math.min(Math.max(1, next), totalPages.value)
}

/** Enter opens without waiting for the native click (prevented, so it fires once). */
function onRowKeydown(event: KeyboardEvent, id: string) {
  if (event.key === 'Enter') {
    event.preventDefault()
    emit('open', id)
  }
}
</script>

<template>
  <section class="cl" data-testid="cash-closings-list" aria-labelledby="cash-closings-title">
    <h3 id="cash-closings-title" class="cl-title">Cortes</h3>

    <div class="cl-filters" role="group" aria-label="Filtrar cortes">
      <div v-if="registers.length" class="cl-field">
        <label :id="`${ids.register}-label`" :for="ids.register" class="cl-label">Caja</label>
        <USelect
          :id="ids.register"
          v-model="registerModel"
          :items="registerItems"
          :aria-labelledby="`${ids.register}-label`"
          class="w-full"
          :ui="{ base: 'min-h-11' }"
          data-testid="cash-closings-register"
        />
      </div>
      <div v-if="cashiers.length" class="cl-field">
        <label :id="`${ids.cashier}-label`" :for="ids.cashier" class="cl-label">Cajero(a)</label>
        <USelect
          :id="ids.cashier"
          v-model="cashierModel"
          :items="cashierItems"
          :aria-labelledby="`${ids.cashier}-label`"
          class="w-full"
          :ui="{ base: 'min-h-11' }"
          data-testid="cash-closings-cashier"
        />
      </div>
      <div class="cl-field">
        <label :id="`${ids.from}-label`" :for="ids.from" class="cl-label">Desde</label>
        <UInputDate
          :id="ids.from"
          :model-value="toCalendarDate(fromDate)"
          :max-value="toCalendarDate(toDate)"
          :aria-labelledby="`${ids.from}-label`"
          class="w-full"
          :ui="{ base: 'min-h-11' }"
          data-testid="cash-closings-from"
          @update:model-value="fromDate = fromCalendarDate($event)"
        />
      </div>
      <div class="cl-field">
        <label :id="`${ids.to}-label`" :for="ids.to" class="cl-label">Hasta</label>
        <UInputDate
          :id="ids.to"
          :model-value="toCalendarDate(toDate)"
          :min-value="toCalendarDate(fromDate)"
          :aria-labelledby="`${ids.to}-label`"
          class="w-full"
          :ui="{ base: 'min-h-11' }"
          data-testid="cash-closings-to"
          @update:model-value="toDate = fromCalendarDate($event)"
        />
      </div>
    </div>

    <div v-if="list.isLoading.value && !rows.length" class="cl-skeleton" aria-busy="true" aria-label="Cargando cortes">
      <span v-for="n in 4" :key="n" class="cl-skel" />
    </div>

    <EmptyState
      v-else-if="list.isError.value"
      kind="error"
      title="No se pudieron cargar los cortes"
      :description="errorMessage"
      action-label="Volver a cargar"
      @action="list.refetch()"
    />

    <EmptyState
      v-else-if="!rows.length && hasFilters"
      kind="no-match"
      title="Ningún corte coincide"
      description="Cambia la caja, la persona o las fechas."
    />

    <EmptyState
      v-else-if="!rows.length"
      title="Todavía no hay cortes"
      description="Cada cierre de caja genera un corte con folio. Aparecerá aquí."
    />

    <template v-else>
      <div class="cl-table-wrap">
        <table class="hf-plain-table cl-table">
          <caption class="sr-only">Cortes de caja, del más reciente al más antiguo</caption>
          <thead>
            <tr>
              <th scope="col">Folio</th>
              <th scope="col">Caja</th>
              <th scope="col">Cajero(a)</th>
              <th scope="col">Fecha</th>
              <th scope="col" class="cl-num">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in rows"
              :key="row.id"
              class="cl-row"
              data-testid="cash-closing-row"
              @click="emit('open', row.id)"
            >
              <td class="cl-folio">
                <button
                  type="button"
                  class="cl-open"
                  :aria-label="`Ver corte ${row.folio}`"
                  data-testid="cash-closing-row-open"
                  @click.stop="emit('open', row.id)"
                  @keydown="onRowKeydown($event, row.id)"
                >
                  {{ row.folio }}
                </button>
              </td>
              <td>
                <span v-if="row.loaded">{{ row.register }}</span>
                <span v-else class="cl-skel cl-skel--inline" aria-label="Cargando" />
              </td>
              <td>
                <span v-if="row.loaded">{{ row.cashier }}</span>
                <span v-else class="cl-skel cl-skel--inline" aria-label="Cargando" />
              </td>
              <td>{{ row.date }}</td>
              <td class="cl-num" :class="{ 'cl-diff--off': row.difference }">{{ differenceText(row.difference) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav class="cl-pager" aria-label="Páginas de cortes">
        <UButton
          color="neutral"
          variant="outline"
          class="min-h-11"
          icon="i-lucide-chevron-left"
          :disabled="page <= 1"
          data-testid="cash-closings-prev"
          @click="goTo(page - 1)"
        >
          Anterior
        </UButton>
        <span class="cl-meta" aria-live="polite" data-testid="cash-closings-page">
          Página {{ page }} de {{ totalPages }} · {{ list.total.value }} cortes
        </span>
        <UButton
          color="neutral"
          variant="outline"
          class="min-h-11"
          trailing-icon="i-lucide-chevron-right"
          :disabled="page >= totalPages"
          data-testid="cash-closings-next"
          @click="goTo(page + 1)"
        >
          Siguiente
        </UButton>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.cl {
  container-type: inline-size;
  display: grid;
  gap: 16px;
  color: var(--hf-ink);
  font-size: 14px;
}
.cl-title {
  color: var(--hf-heading);
  font-size: 15px;
  font-weight: 600;
}
.cl-meta {
  color: var(--hf-muted);
  font-size: 13px;
}
.cl-filters {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.cl-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}
.cl-label {
  font-size: 13px;
  font-weight: 500;
}
.cl-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--hf-border);
  border-radius: 12px;
  background: var(--hf-surface);
}
.cl-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.cl-table th,
.cl-table td {
  padding: 10px 12px;
  white-space: nowrap;
}
.cl-row {
  cursor: pointer;
}
.cl-row:hover td {
  background: color-mix(in srgb, var(--hf-surface-muted) 45%, var(--hf-surface));
}
.cl-folio {
  max-width: 16rem;
}
.cl-open {
  display: block;
  max-width: 100%;
  min-height: 44px;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 0;
  background: none;
  padding: 0;
  color: var(--hf-heading);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}
.cl-open:focus-visible {
  outline: 2px solid var(--hf-focus);
  outline-offset: 2px;
  border-radius: 4px;
}
.cl-num {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.cl-diff--off {
  color: var(--hf-warning);
  font-weight: 600;
}
.cl-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.cl-skeleton {
  display: grid;
  gap: 8px;
}
.cl-skel {
  display: block;
  height: 44px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--hf-ink) 16%, var(--hf-surface));
}
.cl-skel--inline {
  display: inline-block;
  width: 6rem;
  height: 12px;
}
@container (max-width: 720px) {
  .cl-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container (max-width: 480px) {
  .cl-filters {
    grid-template-columns: 1fr;
  }
  .cl-table th,
  .cl-table td {
    padding-inline: 8px;
    font-size: 13px;
  }
  .cl-pager > :not(span) {
    flex: 1 1 40%;
    justify-content: center;
  }
  .cl-pager > span {
    order: -1;
    flex: 1 1 100%;
    text-align: center;
  }
}
</style>
