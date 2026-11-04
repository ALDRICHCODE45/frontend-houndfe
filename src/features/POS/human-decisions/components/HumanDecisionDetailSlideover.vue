<script setup lang="ts">
import { computed } from 'vue'
import AppResponsiveDrawer from '@/core/shared/components/AppResponsiveDrawer.vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type { HumanDecision } from '../interfaces/human-decision.types'
import type { HumanDecisionResolutionInput } from '../utils/humanDecisionResolutionAttempt'
import type { ExpirationDecisionResolutionInput } from '../utils/expirationResolutionAttempt'
import HumanDecisionResolutionControls from './HumanDecisionResolutionControls.vue'
import ExpirationDecisionResolutionControls from './ExpirationDecisionResolutionControls.vue'
import {
  branchPresentationLabel,
  createdAtPresentationLabel,
  productMetaPresentationLabel,
  requestedQuantityPresentationLabel,
  resolvedResponseLabel,
} from '../utils/humanDecisionPresentation'
import '../styles/human-decisions-visual.css'

const props = withDefaults(
  defineProps<{
    decision: HumanDecision | null
    loading?: boolean
    error?: boolean
    errorMessage?: string
    canUpdate?: boolean
    resolving?: boolean
    conflict?: boolean
    requiresReauthentication?: boolean
    resolutionErrorMessage?: string | null
  }>(),
  {
    loading: false,
    error: false,
    errorMessage: 'No se pudo cargar el detalle. Reintenta.',
    canUpdate: false,
    resolving: false,
    conflict: false,
    requiresReauthentication: false,
    resolutionErrorMessage: null,
  },
)
const emit = defineEmits<{
  retry: []
  resolve: [input: HumanDecisionResolutionInput]
  resolveExpiration: [detailId: string, input: ExpirationDecisionResolutionInput]
}>()
const open = defineModel<boolean>('open', { default: false })
const drawerTitle = computed(() => props.decision?.title ?? 'Detalle de decisión')
const drawerDescription = computed(() =>
  props.decision?.type === 'EXPIRATION'
    ? 'Detalle de la solicitud de vencimiento.'
    : 'Detalle de la solicitud de reposición.',
)

function unitsLabel(value: number | null): string {
  if (value === null) return 'No observado'
  return `${value} ${value === 1 ? 'unidad' : 'unidades'}`
}
</script>

<template>
  <AppResponsiveDrawer
    v-model:open="open"
    :title="drawerTitle"
    :description="drawerDescription"
    close-aria-label="Cerrar detalle de decisión"
    :desktop-ui="{ content: 'sm:max-w-xl motion-reduce:transition-none' }"
    portal-class="hf-theme hf-ui hf-form-overlay human-decisions-form-portal"
  >
    <template #body>
      <div
        v-if="loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
        data-testid="human-decision-detail-skeleton"
        class="space-y-6 p-4 sm:p-6"
      >
        <span class="sr-only">Cargando detalle…</span>
        <div class="space-y-2" aria-hidden="true">
          <USkeleton class="h-6 w-24 !rounded-md" />
          <USkeleton class="h-4 w-3/4 !rounded" />
        </div>
        <div class="space-y-3" aria-hidden="true">
          <USkeleton class="h-4 w-20 !rounded" />
          <USkeleton class="h-40 w-full !rounded-xl" />
        </div>
        <USkeleton class="h-11 w-full !rounded-lg" aria-hidden="true" />
      </div>

      <EmptyState
        v-else-if="error"
        kind="error"
        :title="errorMessage"
        action-label="Reintentar"
        action-test-id="human-decision-detail-retry"
        @action="emit('retry')"
      />

      <EmptyState
        v-else-if="!decision"
        title="Selecciona una decisión para ver su detalle."
      />

      <article v-else class="space-y-6 p-4 sm:p-6" data-testid="human-decision-detail">
        <div class="space-y-2">
          <StatusBadge
            :label="decision.status === 'PENDING' ? 'Pendiente' : 'Respondida'"
            :tone="decision.status === 'PENDING' ? 'warning' : 'success'"
          />
          <p class="text-sm text-muted">{{ decision.sanitizedSummary }}</p>
        </div>

        <section aria-labelledby="human-decision-request-heading" class="space-y-3">
          <h2 id="human-decision-request-heading" class="text-sm font-semibold text-highlighted">
            Solicitud
          </h2>
          <dl class="grid gap-4 rounded-xl border border-default bg-elevated/30 p-4 sm:grid-cols-2">
            <div class="sm:col-span-2">
              <dt class="text-xs text-muted">Producto</dt>
              <dd class="text-sm font-medium text-highlighted">
                {{ decision.snapshot.productName }}
              </dd>
              <dd class="text-xs text-muted">
                {{ productMetaPresentationLabel(decision) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">Sucursal</dt>
              <dd class="text-sm text-highlighted">
                {{ branchPresentationLabel(decision.snapshot.branchName) }}
              </dd>
            </div>
            <div v-if="decision.type === 'RESTOCK'">
              <dt class="text-xs text-muted">Cantidad solicitada</dt>
              <dd class="text-sm text-highlighted">
                {{ requestedQuantityPresentationLabel(decision.snapshot.requestedQuantity) }}
              </dd>
            </div>
            <div v-if="decision.type === 'RESTOCK'">
              <dt class="text-xs text-muted">Stock observado</dt>
              <dd class="text-sm text-highlighted">
                {{ unitsLabel(decision.snapshot.observedStockAtRequest) }}
              </dd>
            </div>
            <div v-if="decision.type === 'RESTOCK'">
              <dt class="text-xs text-muted">Observado el</dt>
              <dd class="text-sm text-highlighted">
                {{
                  decision.snapshot.stockObservedAt
                    ? createdAtPresentationLabel(decision.snapshot.stockObservedAt)
                    : 'Sin fecha de observación'
                }}
              </dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-xs text-muted">Solicitada el</dt>
              <dd class="text-sm text-highlighted">
                {{ createdAtPresentationLabel(decision.createdAt) }}
              </dd>
            </div>
          </dl>
        </section>

        <section
          v-if="decision.status === 'RESOLVED'"
          aria-labelledby="human-decision-resolution-heading"
          class="space-y-3 rounded-xl border border-[var(--hf-border)] bg-[var(--hf-surface-muted)] p-4"
        >
          <h2 id="human-decision-resolution-heading" class="text-sm font-semibold text-highlighted">
            Respuesta registrada
          </h2>
          <p class="text-sm text-highlighted">{{ resolvedResponseLabel(decision.resolution) }}</p>
          <p class="text-xs text-muted">
            {{ decision.resolution.resolvedBy.displayName }} ·
            {{ createdAtPresentationLabel(decision.resolution.resolvedAt) }}
          </p>
        </section>

        <template v-else>
          <p
            v-if="resolutionErrorMessage"
            role="alert"
            class="rounded-lg border border-[var(--hf-danger-border)] bg-[var(--hf-danger-soft)] p-3 text-sm text-[var(--hf-danger)]"
          >
            {{ resolutionErrorMessage }}
          </p>

          <HumanDecisionResolutionControls
            v-if="decision.type === 'RESTOCK' && (canUpdate || conflict)"
            :decision="decision"
            :can-update="canUpdate"
            :resolving="resolving"
            :conflict="conflict"
            @resolve="emit('resolve', $event)"
          />
          <ExpirationDecisionResolutionControls
            v-else-if="decision.type === 'EXPIRATION' && !requiresReauthentication"
            :decision="decision"
            :can-update="canUpdate"
            :resolving="resolving"
            :conflict="conflict"
            @resolve="emit('resolveExpiration', decision.id, $event)"
          />
        </template>
      </article>
    </template>
  </AppResponsiveDrawer>
</template>
