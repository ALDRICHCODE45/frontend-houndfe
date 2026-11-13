<script setup lang="ts">
/**
 * RequestGroupRow — one request of a customer group, as a table row (desktop) or a card (<768).
 * Design 01-tabla-agrupada `rowHTML` and 04-movil-y-estados `mcard`.
 *
 * The only action is opening the detail (summary link, chevron, the whole row/card). Quick
 * actions come later; `allowedActions` are deliberately not read here. The bot summary is plain
 * text. Open rows show the SLA light; closed ones show how and when they closed.
 */
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import type { ChatbotRequestRow } from '../interfaces/chatbot-request.types'
import { closedLine, formatAge } from '../utils/list-format'
import type { RequestsListTab } from '../utils/list-query'
import { SUBTYPE_ICONS, SUBTYPE_LABELS, windowClosingTag } from '../utils/requestLabels'
import RequestStatusBadge from './RequestStatusBadge.vue'
import SlaIndicator from './SlaIndicator.vue'
import SubtypeTag from './SubtypeTag.vue'

const props = withDefaults(
  defineProps<{
    row: ChatbotRequestRow
    layout: 'table' | 'cards'
    tab: RequestsListTab
    /** For the row's accessible name; the flat history has no customer name. */
    customerName?: string | null
    currentUserId?: string | null
    /** Injected "current" instant (tests); defaults to the real clock. */
    now?: Date
    /** IANA zone for the times; defaults to the runtime zone. */
    timeZone?: string
  }>(),
  { customerName: null, currentUserId: null, now: undefined, timeZone: undefined },
)

const router = useRouter()

const detailTo = computed(() => ({ name: 'chatbot-request-detail', params: { id: props.row.id } }))
const isOpen = computed(() => props.row.status === 'NEW' || props.row.status === 'IN_PROGRESS')
const subtypeLabel = computed(() => SUBTYPE_LABELS[props.row.subtype] ?? 'Solicitud')
const subtypeIcon = computed(() => SUBTYPE_ICONS[props.row.subtype] ?? 'i-lucide-inbox')
const age = computed(() => formatAge(props.row.createdAt, props.now))
/** Customer messages nobody has opened yet (the server resets the count when the conversation is read). */
const unread = computed(() => {
  const count = props.row.unreadCustomerMessages
  return typeof count === 'number' && count > 0 ? count : 0
})
const unreadText = computed(() => `${unread.value} ${unread.value === 1 ? 'nuevo' : 'nuevos'}`)
const unreadLabel = computed(
  () => `${unread.value} ${unread.value === 1 ? 'mensaje nuevo' : 'mensajes nuevos'} del cliente`,
)
const windowTag = computed(() =>
  isOpen.value ? windowClosingTag(props.row.whatsappWindowClosesAt, props.now, props.row.windowClosingSoon) : null,
)
/** Handoff 21: the branch hours changed under a booked time; staff must move it (nobody told the customer). */
const needsReschedule = computed(() => isOpen.value && props.row.needsReschedule === true)
const closed = computed(() =>
  isOpen.value ? null : closedLine(props.row, props.currentUserId, { now: props.now, timeZone: props.timeZone }),
)
const ariaLabel = computed(() =>
  [props.row.folio, subtypeLabel.value, props.customerName].filter(Boolean).join(', ') + '. Abrir detalle',
)

function openDetail(event: MouseEvent) {
  // Links, modified clicks and a text selection keep their own behavior.
  if ((event.target as HTMLElement | null)?.closest('a')) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button > 0) return
  if (window.getSelection?.()?.toString()) return
  void router.push(detailTo.value)
}

function openDetailFromKey(event: KeyboardEvent) {
  if (event.target !== event.currentTarget) return
  event.preventDefault()
  void router.push(detailTo.value)
}
</script>

<template>
  <tr
    v-if="layout === 'table'"
    class="chatbot-row"
    data-testid="request-row"
    tabindex="0"
    :aria-label="ariaLabel"
    @click="openDetail"
    @keydown.enter="openDetailFromKey"
    @keydown.space="openDetailFromKey"
  >
    <td class="chatbot-row__main">
      <div class="chatbot-row__primary">
        <UIcon :name="subtypeIcon" class="chatbot-row__icon" aria-hidden="true" />
        <RouterLink :to="detailTo" class="chatbot-row__link">{{ row.summary }}</RouterLink>
      </div>
      <div class="chatbot-row__secondary">
        <span class="chatbot-row__folio">{{ row.folio }}</span>
        <span>{{ subtypeLabel }}</span>
        <span v-if="unread" class="chatbot-unread" data-testid="unread-badge" :aria-label="unreadLabel">{{ unreadText }}</span>
        <span v-if="needsReschedule" class="chatbot-reschedule-tag" data-testid="reschedule-tag" aria-label="Por reagendar: la hora agendada quedó fuera del horario de atención">
          <UIcon name="i-lucide-calendar-clock" class="chatbot-window-tag__icon" aria-hidden="true" />Reagendar
        </span>
        <span v-if="windowTag" class="chatbot-window-tag" data-testid="window-tag">
          <UIcon name="i-lucide-clock" class="chatbot-window-tag__icon" aria-hidden="true" />{{ windowTag }}
        </span>
      </div>
    </td>
    <td><RequestStatusBadge :row="row" :current-user-id="currentUserId" /></td>
    <td>
      <SlaIndicator v-if="isOpen" :row="row" :now="now" :time-zone="timeZone" />
      <div v-else-if="closed" class="chatbot-closed" :data-tone="closed.tone" data-testid="closed-line">
        <b>{{ closed.title }}</b>
        <small v-if="closed.detail">{{ closed.detail }}</small>
      </div>
    </td>
    <td class="chatbot-row__age" data-testid="request-age">{{ age }}</td>
    <td class="chatbot-row__go">
      <RouterLink :to="detailTo" class="chatbot-row__chevron" :aria-label="`Abrir ${row.folio}`">
        <UIcon name="i-lucide-chevron-right" aria-hidden="true" />
      </RouterLink>
    </td>
  </tr>

  <article v-else class="chatbot-card" data-testid="request-card">
    <RouterLink :to="detailTo" class="chatbot-card__link">{{ row.summary }}</RouterLink>
    <div class="chatbot-card__tags">
      <RequestStatusBadge :row="row" :current-user-id="currentUserId" />
      <span class="chatbot-row__folio">{{ row.folio }}</span>
      <SubtypeTag :subtype="row.subtype" />
      <span v-if="unread" class="chatbot-unread" data-testid="unread-badge" :aria-label="unreadLabel">{{ unreadText }}</span>
      <span v-if="needsReschedule" class="chatbot-reschedule-tag" data-testid="reschedule-tag" aria-label="Por reagendar: la hora agendada quedó fuera del horario de atención">
          <UIcon name="i-lucide-calendar-clock" class="chatbot-window-tag__icon" aria-hidden="true" />Reagendar
        </span>
    </div>
    <div v-if="windowTag" class="chatbot-card__window">
      <span class="chatbot-window-tag" data-testid="window-tag">
        <UIcon name="i-lucide-clock" class="chatbot-window-tag__icon" aria-hidden="true" />{{ windowTag }}
      </span>
    </div>
    <div class="chatbot-card__foot" data-testid="card-foot">
      <SlaIndicator v-if="isOpen" :row="row" compact :now="now" :time-zone="timeZone" />
      <div v-else-if="closed" class="chatbot-closed" :data-tone="closed.tone" data-testid="closed-line">
        <b>{{ closed.title }}</b>
        <small v-if="closed.detail">{{ closed.detail }}</small>
      </div>
      <span class="chatbot-card__age" data-testid="request-age">{{ age }}</span>
    </div>
  </article>
</template>
