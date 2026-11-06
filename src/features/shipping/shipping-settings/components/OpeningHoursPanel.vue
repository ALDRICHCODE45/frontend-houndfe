<script setup lang="ts">
/**
 * OpeningHoursPanel — the Horario tab (handoff §7). Loading, error, not
 * configured («Configurar horario» for editors), and the week: the summary
 * line built on the FE, the fixed time zone as text (S7), then the editor for
 * update:ShippingSettings or a read-only list otherwise.
 */
import { computed, shallowRef, watch } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { WEEKDAYS, type Weekday } from '../interfaces/shipping-settings.types'
import { useOpeningHours } from '../composables/useOpeningHours'
import {
  DAY_LABELS,
  OPENING_HOURS_TIME_ZONE,
  closedWeek,
  mapOpeningHoursError,
  openingHoursSummary,
  weekFromDays,
  weekToBody,
  type Week,
} from '../utils/openingHours'
import OpeningHoursEditor from './OpeningHoursEditor.vue'

const props = defineProps<{ tenantId: string; canUpdate: boolean }>()
const emit = defineEmits<{ dirty: [dirty: boolean] }>()

const toast = useToast()
const { query, save } = useOpeningHours(() => props.tenantId, () => true)

const configuring = shallowRef(false)
const editorKey = shallowRef(0)
const dayErrors = shallowRef<Partial<Record<Weekday, string>>>({})
const message = shallowRef<string | null>(null)
const dirty = shallowRef(false)
watch(dirty, (value) => emit('dirty', value), { immediate: true })

const hours = computed(() => (query.data.value?.configured ? query.data.value.openingHours : null))
const showEditor = computed(() => props.canUpdate && (hours.value !== null || configuring.value))
const initial = computed<Week>(() => (hours.value ? weekFromDays(hours.value.days) : closedWeek()))
const summary = computed(() => (hours.value ? openingHoursSummary(hours.value.days) : ''))
const readDays = computed(() =>
  WEEKDAYS.map((day) => {
    const ranges = initial.value[day]
    return {
      day,
      label: DAY_LABELS[day].long,
      text: ranges.length === 0 ? 'Cerrado' : ranges.map((r) => `${r.open}–${r.close}`).join(', ').replace(/, ([^,]*)$/, ' y $1'),
    }
  }),
)

function configure() {
  configuring.value = true
  editorKey.value++
}

async function onSave(week: Week) {
  dayErrors.value = {}
  message.value = null
  try {
    await save.mutateAsync(weekToBody(week))
    configuring.value = false
    dirty.value = false
    editorKey.value++
    toast.add({ title: 'Horario guardado', color: 'success' })
  } catch (err) {
    const mapped = mapOpeningHoursError(err)
    dayErrors.value = mapped.days
    message.value = mapped.message ?? (Object.keys(mapped.days).length > 0 ? 'Revisa los días marcados.' : null)
  }
}

function onDiscard() {
  dayErrors.value = {}
  message.value = null
  if (!hours.value) configuring.value = false
}
</script>

<template>
  <section class="shipping-panel" aria-labelledby="shipping-hours-title">
    <div class="shipping-panel__head">
      <h2 id="shipping-hours-title" class="shipping-panel__title">Horario de la sucursal</h2>
      <p class="shipping-panel__meta">Zona horaria: Ciudad de México ({{ OPENING_HOURS_TIME_ZONE }})</p>
    </div>

    <div v-if="query.isLoading.value" data-testid="hours-loading" class="shipping-panel__surface" aria-busy="true">
      <USkeleton class="h-5 w-72 max-w-full" />
      <USkeleton v-for="n in 4" :key="n" class="h-11 w-full" />
    </div>

    <EmptyState
      v-else-if="query.isError.value"
      kind="error"
      title="No se pudo cargar el horario"
      action-label="Reintentar"
      action-test-id="hours-retry"
      :action-loading="query.isFetching.value"
      @action="query.refetch()"
    />

    <template v-else-if="hours || showEditor">
      <p v-if="hours" data-testid="hours-summary" class="hours-summary">{{ summary }}</p>
      <OpeningHoursEditor
        v-if="showEditor"
        :key="editorKey"
        :initial="initial"
        :creating="hours === null"
        :saving="save.isPending.value"
        :saved-at="hours?.updatedAt ?? null"
        :day-errors="dayErrors"
        :message="message"
        @save="onSave"
        @discard="onDiscard"
        @dirty="dirty = $event"
      />
      <dl v-else data-testid="hours-read" class="shipping-panel__surface hours-read">
        <div v-for="row in readDays" :key="row.day" class="hours-read__row">
          <dt>{{ row.label }}</dt>
          <dd class="hf-figure" :class="{ 'hours-read__closed': row.text === 'Cerrado' }">{{ row.text }}</dd>
        </div>
      </dl>
    </template>

    <EmptyState
      v-else
      title="Aún no hay horario"
      description="El bot lo muestra a quien elige recoger en tienda."
      :action-label="canUpdate ? 'Configurar horario' : undefined"
      action-test-id="hours-configure"
      action-variant="solid"
      @action="configure"
    />
  </section>
</template>

<style scoped>
.shipping-panel { display: grid; gap: 16px; min-width: 0; }
.shipping-panel__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 16px; min-height: 44px; }
.shipping-panel__title { color: var(--hf-heading); font-size: 16px; font-weight: 600; }
.shipping-panel__meta { color: var(--hf-muted); font-size: 13px; }
.shipping-panel__surface { display: grid; gap: 12px; border: 1px solid var(--hf-border); border-radius: 12px; background: var(--hf-surface); padding: 24px; }
.hours-summary { color: var(--hf-ink); font-size: 14px; font-weight: 500; font-variant-numeric: tabular-nums; }
.hours-read { gap: 0; padding-block: 8px; }
.hours-read__row { display: grid; grid-template-columns: 8rem minmax(0, 1fr); gap: 12px; border-top: 1px solid var(--hf-border); padding: 12px 0; }
.hours-read__row:first-child { border-top: 0; }
.hours-read dt { color: var(--hf-heading); font-size: 14px; font-weight: 600; }
.hours-read dd { color: var(--hf-ink); font-size: 14px; }
.hours-read dd.hours-read__closed { color: var(--hf-muted); }
@media (max-width: 767px) {
  .shipping-panel__surface { padding: 16px; }
}
</style>
