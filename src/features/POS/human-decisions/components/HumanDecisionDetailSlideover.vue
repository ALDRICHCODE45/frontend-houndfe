<script setup lang="ts">
import { computed } from 'vue'
import AppResponsiveDrawer from '@/core/shared/components/AppResponsiveDrawer.vue'
import type { HumanDecision, ResolvedHumanDecision } from '../interfaces/human-decision.types'
import type { HumanDecisionResolutionInput } from '../utils/humanDecisionResolutionAttempt'
import HumanDecisionResolutionControls from './HumanDecisionResolutionControls.vue'
import {
  branchPresentationLabel,
  createdAtPresentationLabel,
  requestedQuantityPresentationLabel,
  skuPresentationLabel,
  variantPresentationLabel,
} from '../utils/humanDecisionPresentation'

const props = withDefaults(
  defineProps<{
    decision: HumanDecision | null
    loading?: boolean
    error?: boolean
    errorMessage?: string
    canUpdate?: boolean
    resolving?: boolean
    conflict?: boolean
    resolutionErrorMessage?: string | null
  }>(),
  {
    loading: false,
    error: false,
    errorMessage: 'No se pudo cargar el detalle. Reintenta.',
    canUpdate: false,
    resolving: false,
    conflict: false,
    resolutionErrorMessage: null,
  },
)
const emit = defineEmits<{
  retry: []
  resolve: [input: HumanDecisionResolutionInput]
}>()
const open = defineModel<boolean>('open', { default: false })
const drawerTitle = computed(() => props.decision?.title ?? 'Detalle de decisión')

function unitsLabel(value: number | null): string {
  if (value === null) return 'No observado'
  return `${value} ${value === 1 ? 'unidad' : 'unidades'}`
}

function resolutionCopy(decision: ResolvedHumanDecision): string {
  if (decision.resolution.action === 'PROVIDE_RESTOCK_ESTIMATE') {
    return `Reposición estimada en ${decision.resolution.restockDays} días naturales.`
  }
  return 'Por ahora no tenemos una fecha estimada de reposición.'
}
</script>

<template>
  <AppResponsiveDrawer
    v-model:open="open"
    :title="drawerTitle"
    description="Detalle de la solicitud de reposición."
    close-aria-label="Cerrar detalle de decisión"
    :desktop-ui="{ content: 'sm:max-w-xl motion-reduce:transition-none' }"
  >
    <template #body>
      <div
        v-if="loading"
        role="status"
        aria-live="polite"
        class="flex min-h-48 items-center justify-center p-6 text-sm text-muted"
      >
        Cargando detalle…
      </div>

      <div
        v-else-if="error"
        role="alert"
        class="flex min-h-48 flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <UIcon name="i-lucide-alert-triangle" class="size-6 text-error" />
        <p class="text-sm text-error">{{ errorMessage }}</p>
        <UButton
          type="button"
          color="neutral"
          variant="outline"
          class="min-h-11"
          data-testid="human-decision-detail-retry"
          @click="emit('retry')"
        >
          Reintentar
        </UButton>
      </div>

      <div
        v-else-if="!decision"
        role="status"
        class="flex min-h-48 items-center justify-center p-6 text-center text-sm text-muted"
      >
        Selecciona una decisión para ver su detalle.
      </div>

      <article v-else class="space-y-6 p-4 sm:p-6" data-testid="human-decision-detail">
        <div class="space-y-2">
          <UBadge :color="decision.status === 'PENDING' ? 'warning' : 'success'" variant="subtle">
            {{ decision.status === 'PENDING' ? 'Pendiente' : 'Respondida' }}
          </UBadge>
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
                {{ skuPresentationLabel(decision.snapshot.sku) }} ·
                {{ variantPresentationLabel(decision.snapshot.variantId) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">Sucursal</dt>
              <dd class="text-sm text-highlighted">
                {{ branchPresentationLabel(decision.snapshot.branchName) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">Cantidad solicitada</dt>
              <dd class="text-sm text-highlighted">
                {{ requestedQuantityPresentationLabel(decision.snapshot.requestedQuantity) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted">Stock observado</dt>
              <dd class="text-sm text-highlighted">
                {{ unitsLabel(decision.snapshot.observedStockAtRequest) }}
              </dd>
            </div>
            <div>
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
          class="space-y-3 rounded-xl border border-success/30 bg-success/5 p-4"
        >
          <h2 id="human-decision-resolution-heading" class="text-sm font-semibold text-highlighted">
            Respuesta registrada
          </h2>
          <p class="text-sm text-highlighted">{{ resolutionCopy(decision) }}</p>
          <p class="text-xs text-muted">
            {{ decision.resolution.resolvedBy.displayName }} ·
            {{ createdAtPresentationLabel(decision.resolution.resolvedAt) }}
          </p>
        </section>

        <template v-else>
          <p
            v-if="resolutionErrorMessage"
            role="alert"
            class="rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error"
          >
            {{ resolutionErrorMessage }}
          </p>

          <HumanDecisionResolutionControls
            v-if="canUpdate || conflict"
            :decision="decision"
            :can-update="canUpdate"
            :resolving="resolving"
            :conflict="conflict"
            @resolve="emit('resolve', $event)"
          />
        </template>
      </article>
    </template>
  </AppResponsiveDrawer>
</template>
