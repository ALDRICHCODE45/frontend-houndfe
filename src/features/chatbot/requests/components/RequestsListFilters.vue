<script setup lang="ts">
/**
 * RequestsListFilters — tabs, search, toggle chips and the subtype select of the inbox
 * (design 01-tabla-agrupada `filterBarHTML` / `filterRowHTML`). Presentational: the view owns
 * the state (it lives in the URL) and debounces the search; this only reports intent.
 *
 * No checkboxes: the tabs are a segmented control and the filters are toggle chips with
 * `aria-pressed`. «Historial» has no search and no chips (the endpoint takes only the subtype).
 */
import { computed, useId } from 'vue'
import type { ChatbotRequestCounts, ChatbotRequestSubtype } from '../interfaces/chatbot-request.types'
import {
  LIST_TABS,
  SEARCH_MAX_LENGTH,
  type RequestsListChip,
  type RequestsListTab,
} from '../utils/list-query'
import { SUBTYPE_LABELS } from '../utils/requestLabels'

const props = withDefaults(
  defineProps<{
    tab: RequestsListTab
    search: string
    mine: boolean
    unassigned: boolean
    overdue: boolean
    windowClosingSoon: boolean
    subtype: ChatbotRequestSubtype | null
    counts: ChatbotRequestCounts | null
    searchPlaceholder?: string
  }>(),
  { searchPlaceholder: 'Folio o nombre del cliente' },
)

const emit = defineEmits<{
  'update:tab': [tab: RequestsListTab]
  'update:search': [value: string]
  'update:subtype': [value: ChatbotRequestSubtype | null]
  'toggle-chip': [chip: RequestsListChip]
}>()

const searchId = useId()
const subtypeId = useId()

const isHistory = computed(() => props.tab === 'history')

function tabCount(tab: RequestsListTab): number | null {
  const counts = props.counts
  if (!counts) return null
  switch (tab) {
    case 'open':
      return counts.new + counts.inProgress
    case 'scheduled':
      return counts.scheduled
    case 'resolved':
      return counts.resolved7d
    case 'cancelled':
      return counts.cancelled7d
    default:
      return null
  }
}

const groupedTabs = computed(() =>
  LIST_TABS.filter((entry) => entry.id !== 'history').map((entry) => ({ ...entry, count: tabCount(entry.id) })),
)

const chips = computed<Array<{ id: RequestsListChip; label: string; pressed: boolean; count: number | null }>>(() => [
  { id: 'mine', label: 'Mías', pressed: props.mine, count: props.counts?.mine ?? null },
  { id: 'unassigned', label: 'Sin responsable', pressed: props.unassigned, count: null },
  { id: 'overdue', label: 'Vencidas', pressed: props.overdue, count: props.counts?.overdue ?? null },
  {
    id: 'windowClosingSoon',
    label: 'Ventana por cerrar',
    pressed: props.windowClosingSoon,
    count: props.counts?.windowClosingSoon ?? null,
  },
])

// The design leaves «Descuento» out of the filter.
const subtypeOptions = (Object.entries(SUBTYPE_LABELS) as Array<[ChatbotRequestSubtype, string]>).filter(
  ([id]) => id !== 'DISCOUNT',
)

function onSubtype(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  emit('update:subtype', value ? (value as ChatbotRequestSubtype) : null)
}
</script>

<template>
  <div class="chatbot-filters">
    <div class="chatbot-toolbar chatbot-toolbar--tabs">
      <div class="chatbot-tabs">
        <div class="chatbot-seg" role="group" aria-label="Estado de las solicitudes">
          <button
            v-for="entry in groupedTabs"
            :key="entry.id"
            type="button"
            data-testid="list-tab"
            :aria-pressed="tab === entry.id"
            @click="emit('update:tab', entry.id)"
          >
            {{ entry.label }}
            <span v-if="entry.count !== null" class="chatbot-fig">{{ entry.count }}</span>
          </button>
        </div>
        <button
          type="button"
          class="chatbot-btn chatbot-btn--ghost"
          data-testid="list-tab"
          :aria-pressed="tab === 'history'"
          @click="emit('update:tab', 'history')"
        >
          <UIcon name="i-lucide-history" aria-hidden="true" />
          Historial
        </button>
      </div>
    </div>

    <div class="chatbot-toolbar chatbot-toolbar--filters">
      <div v-if="!isHistory" class="chatbot-search">
        <label class="sr-only" :for="searchId">Buscar solicitudes</label>
        <UIcon name="i-lucide-search" class="chatbot-search__icon" aria-hidden="true" />
        <input
          :id="searchId"
          class="chatbot-ctl"
          type="search"
          autocomplete="off"
          :maxlength="SEARCH_MAX_LENGTH"
          :placeholder="searchPlaceholder"
          :value="search"
          @input="emit('update:search', ($event.target as HTMLInputElement).value)"
        />
      </div>

      <div v-if="!isHistory" class="chatbot-chips" role="group" aria-label="Filtros">
        <button
          v-for="chip in chips"
          :key="chip.id"
          type="button"
          class="chatbot-chip"
          :data-testid="`chip-${chip.id}`"
          :aria-pressed="chip.pressed"
          @click="emit('toggle-chip', chip.id)"
        >
          {{ chip.label }}
          <span v-if="chip.count !== null" class="chatbot-chip__n">{{ chip.count }}</span>
        </button>
      </div>

      <div class="chatbot-subtype">
        <label class="sr-only" :for="subtypeId">Tipo de solicitud</label>
        <select :id="subtypeId" class="chatbot-ctl" @change="onSubtype">
          <option value="" :selected="subtype === null">Tipo · Todos</option>
          <option v-for="[id, label] in subtypeOptions" :key="id" :value="id" :selected="subtype === id">
            {{ label }}
          </option>
        </select>
      </div>
    </div>
  </div>
</template>
