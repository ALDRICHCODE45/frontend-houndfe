<script setup lang="ts">
/**
 * RequestsListBoard — the inbox container: URL state (tab, search, chips, subtype), the
 * groups / history queries and the states (loading, empty, no match, error, stale key). The
 * rows themselves live in RequestsListGrouped and RequestsListHistory. Mounted only with
 * `read:ChatbotRequest`, so no request is made without it.
 */
import { computed, ref, watch } from 'vue'
import { useBreakpoints, breakpointsTailwind, watchDebounced } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { useRequestGroups } from '../composables/useRequestGroups'
import { useRequestHistory } from '../composables/useRequestHistory'
import type { ChatbotRequestCounts } from '../interfaces/chatbot-request.types'
import { emptyCopy, noMatchTitle } from '../utils/list-copy'
import { pausedResumeAt } from '../utils/list-group'
import {
  clearListFilters,
  groupsFiltersOf,
  hasActiveFilters,
  historyFiltersOf,
  mergeListQuery,
  parseListQuery,
  SEARCH_MAX_LENGTH,
  toggleListChip,
  type RequestsListChip,
  type RequestsListState,
  type RequestsListTab,
} from '../utils/list-query'
import type { ChatbotRequestSubtype } from '../interfaces/chatbot-request.types'
import RequestsListFilters from './RequestsListFilters.vue'
import RequestsListGrouped from './RequestsListGrouped.vue'
import RequestsListHistory from './RequestsListHistory.vue'
import RequestsListPausedBanner from './RequestsListPausedBanner.vue'
import RequestsListSkeleton from './RequestsListSkeleton.vue'

defineProps<{
  counts: ChatbotRequestCounts | null
  currentUserId?: string | null
}>()

const SEARCH_DEBOUNCE_MS = 300

const route = useRoute()
const router = useRouter()

// ── State: the URL is the single source of truth ──────────────────────────────
const state = computed<RequestsListState>(() => parseListQuery(route.query))

function update(next: RequestsListState) {
  void router.replace({ query: mergeListQuery(route.query, next) as Record<string, string> })
}

const search = ref(state.value.q)
watch(
  () => state.value.q,
  (q) => {
    if (q !== search.value.trim().slice(0, SEARCH_MAX_LENGTH)) search.value = q
  },
)
watchDebounced(
  search,
  (value) => {
    const q = value.trim().slice(0, SEARCH_MAX_LENGTH)
    if (q !== state.value.q) update({ ...state.value, q })
  },
  { debounce: SEARCH_DEBOUNCE_MS },
)

const setTab = (tab: RequestsListTab) => update({ ...state.value, tab })
const setSubtype = (subtype: ChatbotRequestSubtype | null) => update({ ...state.value, subtype })
const toggleChip = (chip: RequestsListChip) => update(toggleListChip(state.value, chip))
const clearFilters = () => update(clearListFilters(state.value))

// ── Data ──────────────────────────────────────────────────────────────────────
const isHistory = computed(() => state.value.tab === 'history')
const filtersActive = computed(() => hasActiveFilters(state.value))

const grouped = useRequestGroups({ filters: () => groupsFiltersOf(state.value) })
const history = useRequestHistory({
  filters: () => historyFiltersOf(state.value),
  active: () => isHistory.value,
})

const breakpoints = useBreakpoints(breakpointsTailwind)
const isMobile = breakpoints.smaller('md')
const layout = computed(() => (isMobile.value ? 'cards' : 'table'))

const paused = computed(() => pausedResumeAt(grouped.groups.value.flatMap((group) => group.requests)))
const showPausedBanner = computed(() => !isHistory.value && paused.value.paused)

// A customerKey that went stale inside a group (`400` on «Ver las N restantes»).
const groupStale = ref(false)
watch(
  () => [state.value.tab, grouped.groups.value] as const,
  () => {
    groupStale.value = false
  },
)
const needsReload = computed(() => grouped.needsReload.value || groupStale.value)

type GroupedView = 'stale' | 'loading' | 'error' | 'empty' | 'no-match' | 'list'
const groupedView = computed<GroupedView>(() => {
  if (needsReload.value) return 'stale'
  if (grouped.groups.value.length > 0) return 'list'
  if (grouped.isLoading.value) return 'loading'
  if (grouped.isError.value) return 'error'
  return filtersActive.value ? 'no-match' : 'empty'
})

const empty = computed(() => emptyCopy(state.value.tab))
const searchPlaceholder = 'Folio o nombre del cliente'

function reloadGroups() {
  groupStale.value = false
  void grouped.reload()
}
</script>

<template>
  <div class="chatbot-board">
    <RequestsListPausedBanner v-if="showPausedBanner" :resumes-at="paused.resumesAt" />

    <UCard :ui="{ body: 'p-0 sm:p-0' }" class="hf-table-surface chatbot-surface w-full min-w-0 max-w-full overflow-hidden shadow-sm">
      <RequestsListFilters
        :tab="state.tab"
        :search="search"
        :mine="state.mine"
        :unassigned="state.unassigned"
        :overdue="state.overdue"
        :window-closing-soon="state.windowClosingSoon"
        :subtype="state.subtype"
        :counts="counts"
        :search-placeholder="searchPlaceholder"
        @update:tab="setTab"
        @update:search="search = $event"
        @update:subtype="setSubtype"
        @toggle-chip="toggleChip"
      />

      <div id="chatbot-requests-results" class="chatbot-results" aria-live="polite">
        <RequestsListHistory
          v-if="isHistory"
          :rows="history.requests.value"
          :loading="history.isLoading.value"
          :error="history.isError.value"
          :has-next-page="history.hasNextPage.value"
          :is-fetching-next-page="history.isFetchingNextPage.value"
          :layout="layout"
          :filtered="state.subtype !== null"
          :current-user-id="currentUserId"
          @retry="history.reload()"
          @load-more="history.fetchNextPage()"
        />

        <template v-else>
          <EmptyState
            v-if="groupedView === 'stale'"
            kind="error"
            title="La lista cambió, recarga"
            description="Esta lista ya no está al día con el servidor. Recárgala para ver las solicitudes actuales."
            action-label="Recargar"
            @action="reloadGroups"
          />
          <RequestsListSkeleton v-else-if="groupedView === 'loading'" :layout="layout" />
          <EmptyState
            v-else-if="groupedView === 'error'"
            kind="error"
            title="No pudimos cargar las solicitudes"
            description="Aquí solo se lee: no se perdió nada. Revisa tu conexión e inténtalo de nuevo."
            action-label="Reintentar"
            @action="reloadGroups"
          />
          <EmptyState
            v-else-if="groupedView === 'no-match'"
            kind="no-match"
            :title="noMatchTitle(state.q)"
            description="Cambia o quita los filtros para ver más solicitudes."
            action-label="Quitar filtros"
            @action="clearFilters"
          />
          <EmptyState
            v-else-if="groupedView === 'empty'"
            kind="empty"
            :title="empty.title"
            :description="empty.description"
          />
          <RequestsListGrouped
            v-else
            :groups="grouped.groups.value"
            :tab="state.tab"
            :layout="layout"
            :has-next-page="grouped.hasNextPage.value"
            :is-fetching-next-page="grouped.isFetchingNextPage.value"
            :current-user-id="currentUserId"
            @load-more="grouped.fetchNextPage()"
            @stale="groupStale = true"
          />
        </template>
      </div>
    </UCard>
  </div>
</template>
