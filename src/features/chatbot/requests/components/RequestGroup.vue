<script setup lang="ts">
/**
 * RequestGroup — one customer of the inbox: a collapsible header (tone of the most urgent row,
 * name, «De confianza», phone as the server sent it, counts) and its rows. A group with
 * `moreRequests` offers «Ver las N restantes», which loads the rest of that customer inline with
 * `useCustomerRequests`. As a `<tbody>` in the desktop table and a `<section>` of cards on mobile
 * (design 01-tabla-agrupada `groupHTML`, 04-movil-y-estados `mgroup`).
 */
import { computed, ref, watch } from 'vue'
import { useCustomerRequests } from '../composables/useCustomerRequests'
import type { ChatbotRequestGroup } from '../interfaces/chatbot-request.types'
import {
  groupCountLabel,
  groupDisplayName,
  groupPhone,
  groupTone,
  mergeGroupRows,
  overdueCount,
} from '../utils/list-group'
import { customerStatusOf, type RequestsListTab } from '../utils/list-query'
import RequestGroupRow from './RequestGroupRow.vue'

const props = withDefaults(
  defineProps<{
    group: ChatbotRequestGroup
    tab: RequestsListTab
    layout: 'table' | 'cards'
    currentUserId?: string | null
    /** Injected "current" instant (tests); defaults to the real clock. */
    now?: Date
    /** IANA zone for the times; defaults to the runtime zone. */
    timeZone?: string
  }>(),
  { currentUserId: null, now: undefined, timeZone: undefined },
)

const emit = defineEmits<{
  /** The customerKey of this group is stale (`400`): the list must be reloaded. */
  stale: []
}>()

const isTable = computed(() => props.layout === 'table')
const expanded = ref(true)
const showAll = ref(false)

const more = useCustomerRequests({
  customerKey: () => (showAll.value ? props.group.customerKey : null),
  status: () => customerStatusOf(props.tab),
})

const rows = computed(() =>
  showAll.value ? mergeGroupRows(props.group.requests, more.requests.value) : props.group.requests,
)
const name = computed(() => groupDisplayName(props.group.customer))
const phone = computed(() => groupPhone(props.group.customer))
const tone = computed(() => groupTone(rows.value, props.now))
const overdue = computed(() => overdueCount(rows.value))
const countLabel = computed(() => groupCountLabel(props.group, props.tab, props.group.requests.length))
const overdueLabel = computed(() => `${overdue.value} ${overdue.value === 1 ? 'vencida' : 'vencidas'}`)

const showMoreButton = computed(
  () => props.group.moreRequests > 0 && (!showAll.value || more.isLoading.value),
)
const showError = computed(() => showAll.value && more.isError.value && !more.needsReload.value)
const showNextPage = computed(() => showAll.value && more.hasNextPage.value && !more.isLoading.value)

watch(more.needsReload, (stale) => {
  if (stale) emit('stale')
})
</script>

<template>
  <component :is="isTable ? 'tbody' : 'section'" class="chatbot-group" data-testid="request-group" :data-layout="layout" :aria-label="isTable ? undefined : name">
    <component :is="isTable ? 'tr' : 'div'" :class="isTable ? 'chatbot-ghead' : 'chatbot-mgh'">
      <component :is="isTable ? 'td' : 'div'" :colspan="isTable ? 5 : undefined" class="chatbot-ghead__cell">
        <div class="chatbot-gh" data-testid="group-header">
          <button
            type="button"
            class="chatbot-gh__toggle"
            data-testid="group-toggle"
            :aria-expanded="expanded"
            :aria-label="`${expanded ? 'Contraer' : 'Expandir'} solicitudes de ${name}`"
            @click="expanded = !expanded"
          >
            <UIcon name="i-lucide-chevron-down" class="chatbot-gh__chevron" aria-hidden="true" />
          </button>
          <span class="chatbot-gh__tone" data-testid="group-tone" :data-tone="tone" title="Urgencia del grupo" aria-hidden="true" />
          <span class="chatbot-gh__name">{{ name }}</span>
          <span v-if="group.customer.isTrusted" class="chatbot-trusted">De confianza</span>
          <span class="chatbot-gh__phone" data-testid="group-phone">{{ phone }}</span>
          <span class="chatbot-gh__counts">
            <span>{{ countLabel }}</span>
            <span v-if="overdue > 0" class="chatbot-gh__overdue" data-testid="group-overdue">
              <UIcon name="i-lucide-triangle-alert" class="chatbot-gh__overdue-icon" aria-hidden="true" />{{ overdueLabel }}
            </span>
          </span>
        </div>
      </component>
    </component>

    <template v-if="expanded">
      <RequestGroupRow
        v-for="row in rows"
        :key="row.id"
        :row="row"
        :layout="layout"
        :tab="tab"
        :customer-name="name"
        :current-user-id="currentUserId"
        :now="now"
        :time-zone="timeZone"
      />

      <component :is="isTable ? 'tr' : 'div'" v-if="showMoreButton" class="chatbot-more" data-testid="group-more">
        <component :is="isTable ? 'td' : 'div'" :colspan="isTable ? 5 : undefined" class="chatbot-more__cell">
          <button
            type="button"
            class="chatbot-btn"
            :disabled="more.isLoading.value"
            :aria-busy="more.isLoading.value"
            @click="showAll = true"
          >
            <UIcon
              :name="more.isLoading.value ? 'i-lucide-loader-circle' : 'i-lucide-chevron-down'"
              :class="{ 'chatbot-spin': more.isLoading.value }"
              aria-hidden="true"
            />
            Ver las {{ group.moreRequests }} restantes
          </button>
        </component>
      </component>

      <component :is="isTable ? 'tr' : 'div'" v-if="showError" class="chatbot-more" data-testid="group-more-error" role="alert">
        <component :is="isTable ? 'td' : 'div'" :colspan="isTable ? 5 : undefined" class="chatbot-more__cell">
          <span class="chatbot-more__error">No se pudieron cargar las solicitudes restantes.</span>
          <button type="button" class="chatbot-btn" @click="more.reload()">Reintentar</button>
        </component>
      </component>

      <component :is="isTable ? 'tr' : 'div'" v-if="showNextPage" class="chatbot-more" data-testid="group-more-page">
        <component :is="isTable ? 'td' : 'div'" :colspan="isTable ? 5 : undefined" class="chatbot-more__cell">
          <button
            type="button"
            class="chatbot-btn"
            :disabled="more.isFetchingNextPage.value"
            :aria-busy="more.isFetchingNextPage.value"
            @click="more.fetchNextPage()"
          >
            Cargar más solicitudes
          </button>
        </component>
      </component>
    </template>
  </component>
</template>
