<script setup lang="ts">
/**
 * RequestsListGrouped — the grouped inbox (design 01-tabla-agrupada): a custom table with one
 * `<tbody>` per customer, or sections of cards below 768 px (04-movil-y-estados). Not an
 * AppDataTable: groups collapse and each group pages on its own. Footer with «Cargar más
 * clientes» (next cursor) and, on the open tab, the SLA legend.
 */
import { computed } from 'vue'
import type { ChatbotRequestGroup } from '../interfaces/chatbot-request.types'
import type { RequestsListTab } from '../utils/list-query'
import RequestGroup from './RequestGroup.vue'
import RequestsListLegend from './RequestsListLegend.vue'

const props = withDefaults(
  defineProps<{
    groups: ChatbotRequestGroup[]
    tab: RequestsListTab
    layout: 'table' | 'cards'
    hasNextPage: boolean
    isFetchingNextPage: boolean
    currentUserId?: string | null
    /** Injected "current" instant (tests); defaults to the real clock. */
    now?: Date
    /** IANA zone for the times; defaults to the runtime zone. */
    timeZone?: string
  }>(),
  { currentUserId: null, now: undefined, timeZone: undefined },
)

const emit = defineEmits<{
  'load-more': []
  stale: []
}>()

const isClosedTab = computed(() => props.tab === 'resolved' || props.tab === 'cancelled')
const timeColumn = computed(() => (isClosedTab.value ? 'Cierre' : 'Tiempo'))
const footerText = computed(() => {
  const n = props.groups.length
  const loaded = `${n} ${n === 1 ? 'cliente cargado' : 'clientes cargados'}`
  return isClosedTab.value ? `${loaded} · los cierres más recientes primero` : `${loaded} · ordenados por la solicitud más urgente`
})
</script>

<template>
  <div class="chatbot-grouped">
    <table v-if="layout === 'table'" class="chatbot-table" aria-label="Solicitudes por cliente">
      <colgroup>
        <col />
        <col style="width: 240px" />
        <col style="width: 220px" />
        <col style="width: 96px" />
        <col style="width: 64px" />
      </colgroup>
      <thead>
        <tr>
          <th scope="col">Solicitud</th>
          <th scope="col">Estado</th>
          <th scope="col">{{ timeColumn }}</th>
          <th scope="col">Antigüedad</th>
          <th scope="col"><span class="sr-only">Abrir</span></th>
        </tr>
      </thead>
      <RequestGroup
        v-for="group in groups"
        :key="group.customerKey"
        :group="group"
        :tab="tab"
        layout="table"
        :current-user-id="currentUserId"
        :now="now"
        :time-zone="timeZone"
        @stale="emit('stale')"
      />
    </table>

    <div v-else class="chatbot-cards">
      <RequestGroup
        v-for="group in groups"
        :key="group.customerKey"
        :group="group"
        :tab="tab"
        layout="cards"
        :current-user-id="currentUserId"
        :now="now"
        :time-zone="timeZone"
        @stale="emit('stale')"
      />
    </div>

    <RequestsListLegend v-if="tab === 'open'" />

    <div class="chatbot-foot" data-testid="list-footer">
      <span class="chatbot-fig">{{ footerText }}</span>
      <button
        v-if="hasNextPage"
        type="button"
        class="chatbot-btn"
        data-testid="load-more-groups"
        :disabled="isFetchingNextPage"
        :aria-busy="isFetchingNextPage"
        @click="emit('load-more')"
      >
        Cargar más clientes
      </button>
    </div>
  </div>
</template>
