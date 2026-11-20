<script setup lang="ts">
/**
 * BackorderDetailView — `/pos/pedidos-reposicion/:id` (ODD restock-backorder T1, S3-S5).
 *
 * Every field of the order, a timeline of the dates it has, and the links to the chatbot request
 * and the sale. «Cancelar pedido» is the only action: it needs `update:Backorder` and a WAITING or
 * RESERVED order, sends the `version` the page loaded, and on a 409 refetches (the composable
 * refreshes the tenant prefix) and tells the person to review before trying again.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DetailPageFrame from '@/core/shared/components/DetailPageFrame.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import BackorderCancelDialog from '../components/BackorderCancelDialog.vue'
import BackorderProductThumb from '../components/BackorderProductThumb.vue'
import { BACKORDERS_PATH } from '../constants'
import { useBackorderAccess } from '../composables/useBackorderAccess'
import { useBackorderDetail } from '../composables/useBackorderDetail'
import { useCancelBackorder } from '../composables/useCancelBackorder'
import type { BackorderSaleStatus } from '../interfaces/backorder.types'
import {
  backorderPrice,
  backorderStatusInfo,
  backorderStatusLabel,
  backorderStatusTone,
  backorderTimeline,
  canCancelBackorder,
  chatbotRequestPath,
  productLabel,
} from '../utils/backorderView'
import '../styles/backorders.css'

const SALE_STATUS_LABEL: Record<BackorderSaleStatus, string> = {
  DRAFT: 'Venta en borrador',
  CONFIRMED: 'Venta confirmada',
  CANCELED: 'Venta cancelada',
}

const route = useRoute()
const router = useRouter()
const { canRead, canUpdate } = useBackorderAccess()

const backorderId = computed(() => String(route.params.id ?? ''))
const { backorder, isLoading, isNotFound, isError, refetch } = useBackorderDetail(backorderId)
const { cancel, isPending } = useCancelBackorder(backorderId)

const info = computed(() => (backorder.value ? backorderStatusInfo(backorder.value) : null))
const price = computed(() => (backorder.value ? backorderPrice(backorder.value) : null))
const timeline = computed(() => (backorder.value ? backorderTimeline(backorder.value) : []))
const product = computed(() => (backorder.value ? productLabel(backorder.value) : null))
const requestPath = computed(() => (backorder.value ? chatbotRequestPath(backorder.value) : null))
const etaDays = computed(() => {
  const days = backorder.value?.estimatedArrivalDays
  return typeof days === 'number' ? `${days} ${days === 1 ? 'día' : 'días'} desde que se agendó` : null
})
const showCancel = computed(() => canUpdate.value && backorder.value !== undefined && canCancelBackorder(backorder.value))

type PageState = 'forbidden' | 'loading' | 'not-found' | 'error' | 'content'
const pageState = computed<PageState>(() => {
  if (!canRead.value) return 'forbidden'
  if (backorder.value) return 'content'
  if (isLoading.value) return 'loading'
  if (isNotFound.value) return 'not-found'
  if (isError.value) return 'error'
  return 'loading'
})

// ── Cancel ───────────────────────────────────────────────────────────────────
const dialogOpen = ref(false)
const dialogError = ref<string | null>(null)
/** What the last attempt left the person to know; cleared when the dialog opens again. */
const notice = ref<{ tone: 'success' | 'warning'; message: string } | null>(null)

function openDialog() {
  notice.value = null
  dialogError.value = null
  dialogOpen.value = true
}

async function confirmCancel(reason: string | undefined) {
  const current = backorder.value
  if (!current) return
  // The page may have refetched while the dialog was open: never send for an order that is no longer cancellable.
  if (!canUpdate.value || !canCancelBackorder(current)) {
    dialogOpen.value = false
    return
  }
  dialogError.value = null
  const outcome = await cancel({ version: current.version, reason })
  if (outcome.status === 'cancelled') {
    dialogOpen.value = false
    notice.value = { tone: 'success', message: 'Pedido cancelado.' }
  } else if (outcome.status === 'failed') {
    if (outcome.error.refetch || outcome.error.notFound) {
      // The order changed under the person: the page already shows the refreshed data.
      dialogOpen.value = false
      notice.value = { tone: 'warning', message: outcome.error.message }
    } else {
      dialogError.value = outcome.error.message
    }
  }
}

const goToList = () => void router.push(BACKORDERS_PATH)
</script>

<template>
  <DetailPageFrame scroll-testid="backorder-detail-scroll">
    <template #header>
      <header class="bo-detail-header">
        <RouterLink class="bo-back" :to="BACKORDERS_PATH" aria-label="Volver a Pedidos por reposición">
          <UIcon name="i-lucide-arrow-left" aria-hidden="true" />
        </RouterLink>
        <h1 class="bo-detail-title">{{ pageState === 'content' && backorder ? backorder.folio : 'Pedido por reposición' }}</h1>
        <StatusBadge
          v-if="pageState === 'content' && backorder"
          :label="backorderStatusLabel(backorder.status)"
          :tone="backorderStatusTone(backorder.status)"
        />
        <UButton
          v-if="pageState === 'content' && showCancel"
          label="Cancelar pedido"
          icon="i-lucide-ban"
          color="error"
          variant="outline"
          class="bo-detail-action min-h-11"
          data-testid="backorder-cancel"
          @click="openDialog"
        />
      </header>
    </template>

    <div class="bo-detail hf-theme hf-ui">
      <div v-if="pageState === 'loading'" class="bo-skeleton" aria-busy="true" aria-label="Cargando el pedido">
        <span v-for="n in 4" :key="n" class="bo-skel" />
      </div>

      <EmptyState
        v-else-if="pageState === 'forbidden'"
        kind="forbidden"
        title="No tienes permiso para ver este pedido"
        description="Pide a un administrador el permiso «Ver pedidos por reposición» (read:Backorder)."
      />

      <EmptyState
        v-else-if="pageState === 'not-found'"
        title="Este pedido ya no existe"
        description="Puede que el enlace esté mal o que sea de otra sucursal."
        action-label="Volver a Pedidos por reposición"
        action-icon="i-lucide-arrow-left"
        @action="goToList"
      />

      <EmptyState
        v-else-if="pageState === 'error'"
        kind="error"
        title="No pudimos cargar el pedido"
        description="Aquí solo se lee, no se perdió nada. Revisa tu conexión e inténtalo de nuevo."
        action-label="Reintentar"
        @action="refetch()"
      />

      <template v-else-if="backorder && info && price && product">
        <p
          v-if="notice"
          class="bo-notice"
          :class="notice.tone === 'warning' ? 'bo-notice--warning' : ''"
          :role="notice.tone === 'warning' ? 'alert' : 'status'"
          data-testid="backorder-notice"
        >{{ notice.message }}</p>

        <section class="bo-card-section" aria-labelledby="bo-product-title">
          <h2 id="bo-product-title" class="bo-section-title">Producto</h2>
          <div class="bo-product bo-product--lg">
            <BackorderProductThumb :src="backorder.productImageUrl" :alt="backorder.productName" size="lg" />
            <div class="bo-stack">
              <span class="hf-row-primary bo-product-name">{{ product.name }}</span>
              <span v-if="product.variant" class="hf-row-secondary">{{ product.variant }}</span>
            </div>
          </div>
          <dl class="bo-dl">
            <div><dt>Cantidad</dt><dd class="hf-figure">{{ backorder.quantity }}</dd></div>
            <div>
              <dt>{{ price.reserved ? 'Precio final' : 'Precio' }}</dt>
              <dd>
                <span class="hf-figure bo-final">{{ price.final }}</span>
                <span v-for="note in price.notes" :key="note" class="hf-row-secondary hf-figure">{{ note }}</span>
              </dd>
            </div>
          </dl>
        </section>

        <section class="bo-card-section" aria-labelledby="bo-status-title">
          <h2 id="bo-status-title" class="bo-section-title">Seguimiento</h2>
          <dl class="bo-dl">
            <div>
              <dt>Estado</dt>
              <dd>
                <span v-for="line in info.lines" :key="line" class="bo-info__line">{{ line }}</span>
                <span v-if="!info.lines.length" class="bo-info__line">{{ backorderStatusLabel(backorder.status) }}</span>
                <span v-if="info.warning" class="bo-warning" data-testid="backorder-info-warning">{{ info.warning }}</span>
              </dd>
            </div>
          </dl>
          <ol class="bo-timeline" data-testid="backorder-timeline" aria-label="Fechas del pedido">
            <li v-for="entry in timeline" :key="entry.key">
              <span class="bo-timeline__label">{{ entry.label }}</span>
              <span class="bo-stack bo-stack--end">
                <span class="hf-figure">{{ entry.text }}</span>
                <template v-if="entry.key === 'estimatedAt'">
                  <span v-if="etaDays" class="hf-row-secondary">{{ etaDays }}</span>
                  <span v-if="backorder.etaOverdue" class="bo-warning" data-testid="backorder-eta-overdue">Atrasado</span>
                </template>
              </span>
            </li>
          </ol>
        </section>

        <section class="bo-card-section" aria-labelledby="bo-customer-title">
          <h2 id="bo-customer-title" class="bo-section-title">Cliente</h2>
          <dl class="bo-dl">
            <div><dt>Nombre</dt><dd>{{ backorder.customer.name }}</dd></div>
            <div v-if="backorder.customer.phone"><dt>Teléfono</dt><dd class="hf-figure">{{ backorder.customer.phone }}</dd></div>
            <div><dt>Sucursal</dt><dd>{{ backorder.branchName }}</dd></div>
            <div><dt>Origen</dt><dd>Chatbot</dd></div>
          </dl>
        </section>

        <nav class="bo-links" aria-label="Enlaces del pedido">
          <RouterLink v-if="requestPath" :to="requestPath" class="bo-link">Ver solicitud del chatbot</RouterLink>
          <span v-if="backorder.saleId" class="bo-sale-link">
            <RouterLink :to="`/pos/ventas/${backorder.saleId}`" class="bo-link">Ver venta</RouterLink>
            <span v-if="backorder.saleStatus" class="hf-row-secondary">{{ SALE_STATUS_LABEL[backorder.saleStatus] }}</span>
          </span>
        </nav>
      </template>
    </div>

    <BackorderCancelDialog
      v-if="backorder"
      :open="dialogOpen"
      :folio="backorder.folio"
      :status="backorder.status"
      :pending="isPending"
      :error="dialogError"
      @confirm="confirmCancel"
      @close="dialogOpen = false"
    />
  </DetailPageFrame>
</template>
