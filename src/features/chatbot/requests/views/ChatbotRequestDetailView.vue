<script setup lang="ts">
/**
 * ChatbotRequestDetailView — `/chatbot/solicitudes/:id` (email deep link), read side (T2.U3).
 *
 * Composition surface: reads the request and its audit, decides which state to show (loading,
 * error, 404, forbidden or the page) and lays the parts out inside `DetailPageFrame`; the
 * customer, decision, audit and rail live in `RequestDetail*` components. Section gates use the
 * permission the backend documents (`read:CustomerPhone`, `read:ChatbotConversation`); the action
 * buttons only follow `allowedActions` / `deniedActions` — the view never decides them.
 *
 * Commands (claim, release, reassign, resolve, cancel, merge, link) are unit 4: `onAction` is the
 * placeholder it replaces.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DetailPageFrame from '@/core/shared/components/DetailPageFrame.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import RequestDetailActionPanel from '../components/RequestDetailActionPanel.vue'
import RequestDetailAudit from '../components/RequestDetailAudit.vue'
import RequestDetailClosedNotice from '../components/RequestDetailClosedNotice.vue'
import RequestDetailConversation from '../components/RequestDetailConversation.vue'
import RequestDetailCustomerCard from '../components/RequestDetailCustomerCard.vue'
import RequestDetailDecision from '../components/RequestDetailDecision.vue'
import RequestDetailDeliveries from '../components/RequestDetailDeliveries.vue'
import RequestDetailHeader from '../components/RequestDetailHeader.vue'
import RequestDetailNeeds from '../components/RequestDetailNeeds.vue'
import RequestDetailOtherOpen from '../components/RequestDetailOtherOpen.vue'
import RequestDetailSkeleton from '../components/RequestDetailSkeleton.vue'
import RequestDetailSlaPanel from '../components/RequestDetailSlaPanel.vue'
import { useRequestAccess } from '../composables/useRequestAccess'
import { useRequestAudit } from '../composables/useRequestAudit'
import { useRequestDetail } from '../composables/useRequestDetail'
import type { ChatbotRequestAction } from '../interfaces/chatbot-request.types'
import { readRequestError } from '../utils/requestErrors'
import '../styles/chatbot-request-detail.css'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { canRead } = useRequestAccess()

const requestId = computed(() => String(route.params.id ?? ''))
const currentUserId = computed(() => auth.user?.id ?? null)

const { detail, isError, isNotFound, error, refetch } = useRequestDetail(requestId)

// ─── Section gates ────────────────────────────────────────────────────────────
const canSeePhone = computed(() => auth.userCan('read', 'CustomerPhone'))
const canSeeConversation = computed(() => auth.userCan('read', 'ChatbotConversation'))
const limitedParts = computed(() => {
  const missing: string[] = []
  if (!canSeePhone.value) missing.push('teléfono completo')
  if (!canSeeConversation.value) missing.push('conversación')
  return missing
})

// ─── States ───────────────────────────────────────────────────────────────────
const isForbidden = computed(
  () => !canRead.value || (isError.value && readRequestError(error.value).status === 403),
)
type PageState = 'forbidden' | 'not-found' | 'content' | 'loading' | 'error'
const pageState = computed<PageState>(() => {
  if (isForbidden.value) return 'forbidden'
  if (isNotFound.value) return 'not-found'
  if (detail.value) return 'content'
  if (isError.value) return 'error'
  return 'loading'
})

function goToInbox(): void {
  void router.push({ name: 'chatbot-requests' })
}

// ─── Audit: the detail carries the latest events; «Ver más eventos» pages the rest ──
const auditExpanded = ref(false)
const audit = useRequestAudit(requestId, { enabled: auditExpanded })

const auditEvents = computed(() =>
  auditExpanded.value && audit.events.value.length > 0 ? audit.events.value : (detail.value?.audit ?? []),
)
const auditHasMore = computed(() =>
  auditExpanded.value
    ? audit.hasNextPage.value || audit.isLoading.value
    : (detail.value?.auditNextCursor ?? null) !== null,
)

function onMoreAudit(): void {
  if (!auditExpanded.value) auditExpanded.value = true
  else void audit.fetchNextPage()
}

// ─── Actions (placeholder for unit 4) ─────────────────────────────────────────
function onAction(action: ChatbotRequestAction): void {
  // Unit 4 opens the form or sends the command for `action`; unit 3 is read only.
  void action
}
</script>

<template>
  <DetailPageFrame class="hf-theme hf-ui chatbot-request-detail" scroll-testid="request-detail-scroll">
    <template #header>
      <RequestDetailHeader v-if="detail && pageState === 'content'" :request="detail" :current-user-id="currentUserId" />
      <header v-else class="rd-header">
        <nav class="rd-crumbs" aria-label="Ruta">
          <span>Chatbot</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Solicitud</span>
        </nav>
        <div class="rd-header__row">
          <RouterLink
            data-testid="back-to-inbox"
            class="rd-back"
            :to="{ name: 'chatbot-requests' }"
            aria-label="Volver a Solicitudes"
          >
            <UIcon name="i-lucide-arrow-left" aria-hidden="true" />
          </RouterLink>
          <h1 class="rd-title">Solicitud</h1>
        </div>
      </header>
    </template>

    <div class="rd-page">
      <RequestDetailSkeleton v-if="pageState === 'loading'" />

      <EmptyState
        v-else-if="pageState === 'forbidden'"
        kind="forbidden"
        title="No tienes permiso para ver esta solicitud"
        description="Pide a un administrador el permiso «Ver solicitudes del chatbot»."
      />

      <EmptyState
        v-else-if="pageState === 'not-found'"
        title="Esta solicitud ya no existe"
        description="Puede que el enlace esté mal o que sea de otra sucursal."
        action-label="Volver a Solicitudes"
        action-icon="i-lucide-arrow-left"
        action-test-id="detail-not-found-back"
        @action="goToInbox"
      />

      <EmptyState
        v-else-if="pageState === 'error'"
        kind="error"
        title="No pudimos cargar la solicitud"
        description="Aquí solo se lee, no se perdió nada. Revisa tu conexión e inténtalo de nuevo."
        action-label="Reintentar"
        action-test-id="detail-error-retry"
        @action="refetch()"
      />

      <div v-else-if="detail" class="rd-grid">
        <div class="rd-main">
          <RequestDetailClosedNotice :request="detail" :current-user-id="currentUserId" />

          <div v-if="limitedParts.length" class="rd-alert rd-alert--info" role="note" data-testid="limited-view">
            <UIcon name="i-lucide-lock" aria-hidden="true" />
            <div>
              <strong>Vista limitada por tu rol</strong>
              Sin {{ limitedParts.join(' ni ') }}. El resumen y las acciones permitidas siguen disponibles.
            </div>
          </div>

          <div class="rd-two">
            <RequestDetailCustomerCard :customer="detail.customer" :phone-restricted="!canSeePhone" />
            <RequestDetailNeeds :needs="detail.needs" :context="detail.context" />
          </div>

          <RequestDetailDecision v-if="detail.decision" :request="detail" />
          <RequestDetailConversation v-if="canSeeConversation" />
          <RequestDetailOtherOpen :requests="detail.otherOpenRequests" :current-user-id="currentUserId" />
          <RequestDetailDeliveries v-if="detail.deliveries.length > 0" :deliveries="detail.deliveries" />
          <RequestDetailAudit
            :events="auditEvents"
            :has-more="auditHasMore"
            :loading-more="audit.isLoading.value || audit.isFetchingNextPage.value"
            :current-user-id="currentUserId"
            @more="onMoreAudit"
          />
        </div>

        <aside class="rd-rail" aria-label="Tiempo y acciones">
          <RequestDetailSlaPanel :request="detail" :current-user-id="currentUserId" />
          <section class="rd-panel rd-rail__actions" aria-labelledby="rd-actions-title">
            <h2 id="rd-actions-title">Qué hacer</h2>
            <RequestDetailActionPanel
              :allowed="detail.allowedActions"
              :denied="detail.deniedActions"
              :assignee="detail.assignee"
              :status="detail.status"
              :version="detail.version"
              :current-user-id="currentUserId"
              @action="onAction"
            />
          </section>
        </aside>
      </div>
    </div>

    <template #footer>
      <div v-if="detail && pageState === 'content'" class="rd-footer">
        <RequestDetailActionPanel
          variant="bar"
          :allowed="detail.allowedActions"
          :denied="detail.deniedActions"
          :assignee="detail.assignee"
          :status="detail.status"
          :version="detail.version"
          :current-user-id="currentUserId"
          @action="onAction"
        />
      </div>
    </template>
  </DetailPageFrame>
</template>
