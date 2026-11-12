<script setup lang="ts">
/**
 * RequestsListHistory — «Historial»: requests closed more than 7 days ago, flat and newest
 * first, on the shared AppDataTable (cards on mobile). Cursor paging with «Cargar más»; the
 * table's own toolbar and pagination stay off (the filter bar above is the toolbar). The only
 * action is opening the detail.
 */
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'
import AppDataTable from '@/core/shared/components/DataTable/AppDataTable.vue'
import type { ChatbotRequestRow } from '../interfaces/chatbot-request.types'
import { closedLine, formatAge } from '../utils/list-format'
import { SUBTYPE_ICONS, SUBTYPE_LABELS } from '../utils/requestLabels'
import RequestGroupRow from './RequestGroupRow.vue'
import RequestStatusBadge from './RequestStatusBadge.vue'

const props = withDefaults(
  defineProps<{
    rows: ChatbotRequestRow[]
    loading: boolean
    error: boolean
    hasNextPage: boolean
    isFetchingNextPage: boolean
    layout: 'table' | 'cards'
    /** A subtype filter is active: an empty list reads as «no match». */
    filtered?: boolean
    currentUserId?: string | null
    /** Injected "current" instant (tests); defaults to the real clock. */
    now?: Date
    /** IANA zone for the times; defaults to the runtime zone. */
    timeZone?: string
  }>(),
  { filtered: false, currentUserId: null, now: undefined, timeZone: undefined },
)

const emit = defineEmits<{
  retry: []
  'load-more': []
}>()

const router = useRouter()

const columns: TableColumn<ChatbotRequestRow>[] = [
  { id: 'request', header: 'Solicitud' },
  { id: 'status', header: 'Estado', size: 160 },
  { id: 'closed', header: 'Cierre', size: 220 },
  { id: 'created', header: 'Creada', size: 120 },
  { id: 'open', header: 'Abrir', size: 64, meta: { class: { th: 'w-16', td: 'w-16 text-right' } } },
]

const detailTo = (row: ChatbotRequestRow) => ({ name: 'chatbot-request-detail', params: { id: row.id } })
const openRow = (row: ChatbotRequestRow) => void router.push(detailTo(row))
const closed = (row: ChatbotRequestRow) =>
  closedLine(row, props.currentUserId, { now: props.now, timeZone: props.timeZone })
const subtypeIcon = (row: ChatbotRequestRow) => SUBTYPE_ICONS[row.subtype] ?? 'i-lucide-inbox'
const subtypeLabel = (row: ChatbotRequestRow) => SUBTYPE_LABELS[row.subtype] ?? 'Solicitud'
const isCards = computed(() => props.layout === 'cards')
</script>

<template>
  <div class="chatbot-history">
    <AppDataTable
      :columns="columns"
      :data="rows"
      :loading="loading"
      :error="error"
      error-message="No se pudo cargar el historial"
      :empty-state="{
        title: 'Todavía no hay solicitudes en el historial',
        description: 'Aquí aparecen las solicitudes cerradas hace más de 7 días.',
      }"
      :filtered="filtered"
      :show-toolbar="false"
      :enable-density="false"
      :enable-column-visibility="false"
      :total-count="0"
      :display-mode="isCards ? 'cards' : 'table'"
      :row-open="openRow"
      class="hf-data-table"
      @refresh="emit('retry')"
      @clear-filters="emit('retry')"
    >
      <template #request-cell="{ row }">
        <span class="chatbot-row__primary">
          <UIcon :name="subtypeIcon(row.original)" class="chatbot-row__icon" aria-hidden="true" />
          <RouterLink :to="detailTo(row.original)" class="chatbot-row__link">{{ row.original.summary }}</RouterLink>
        </span>
        <span class="chatbot-row__secondary">
          <span class="chatbot-row__folio">{{ row.original.folio }}</span>
          <span>{{ subtypeLabel(row.original) }}</span>
        </span>
      </template>

      <template #status-cell="{ row }">
        <RequestStatusBadge :row="row.original" :current-user-id="currentUserId" />
      </template>

      <template #closed-cell="{ row }">
        <div class="chatbot-closed" :data-tone="closed(row.original).tone" data-testid="closed-line">
          <b>{{ closed(row.original).title }}</b>
          <small v-if="closed(row.original).detail">{{ closed(row.original).detail }}</small>
        </div>
      </template>

      <template #created-cell="{ row }">
        <span class="chatbot-row__age">hace {{ formatAge(row.original.createdAt, now) }}</span>
      </template>

      <template #open-cell="{ row }">
        <RouterLink :to="detailTo(row.original)" class="chatbot-row__chevron" :aria-label="`Abrir ${row.original.folio}`">
          <UIcon name="i-lucide-chevron-right" aria-hidden="true" />
        </RouterLink>
      </template>

      <template #mobile-card="{ row }">
        <RequestGroupRow
          :row="row"
          layout="cards"
          tab="history"
          :current-user-id="currentUserId"
          :now="now"
          :time-zone="timeZone"
        />
      </template>
    </AppDataTable>

    <div v-if="hasNextPage" class="chatbot-foot">
      <span />
      <button
        type="button"
        class="chatbot-btn"
        data-testid="load-more-history"
        :disabled="isFetchingNextPage"
        :aria-busy="isFetchingNextPage"
        @click="emit('load-more')"
      >
        Cargar más
      </button>
    </div>
  </div>
</template>
