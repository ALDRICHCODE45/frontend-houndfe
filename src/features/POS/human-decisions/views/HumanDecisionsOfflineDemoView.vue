<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PaginationState } from '@/core/shared/types/table.types'
import HumanDecisionDetailSlideover from '../components/HumanDecisionDetailSlideover.vue'
import HumanDecisionsListPanel from '../components/HumanDecisionsListPanel.vue'
import type {
  HumanDecision,
  HumanDecisionResolution,
  PendingHumanDecision,
} from '../interfaces/human-decision.types'
import type { HumanDecisionResolutionInput } from '../utils/humanDecisionResolutionAttempt'

const props = defineProps<{
  canUpdate: boolean
  tenantName: string
  resolverName: string
}>()

const DEMO_RESOLVED_AT = '2026-09-25T12:00:00.000Z'
const globalFilter = ref('')
const pagination = ref<PaginationState>({ pageIndex: 0, pageSize: 20 })
const detailOpen = ref(false)
const selectedDecision = ref<HumanDecision | null>(null)
const resolutionRecorded = ref(false)
const pendingDecisions = ref<PendingHumanDecision[]>([createDemoDecision(props.tenantName)])

const visibleDecisions = computed(() => {
  const search = globalFilter.value.normalize('NFC').trim().toLocaleLowerCase('es-MX')
  if (!search) return pendingDecisions.value
  return pendingDecisions.value.filter((decision) =>
    [decision.snapshot.productName, decision.snapshot.sku ?? '', decision.snapshot.branchName ?? '']
      .join(' ')
      .toLocaleLowerCase('es-MX')
      .includes(search),
  )
})

function createDemoDecision(branchName: string): PendingHumanDecision {
  return {
    id: 'demo-restock-decision-1',
    type: 'RESTOCK',
    title: 'Solicitud de reposición',
    sanitizedSummary: 'Se requiere una decisión humana sobre la reposición.',
    createdAt: '2026-09-25T11:30:00.000Z',
    status: 'PENDING',
    version: 1,
    resolution: null,
    allowedActions: ['PROVIDE_RESTOCK_ESTIMATE', 'REPORT_RESTOCK_ESTIMATE_UNAVAILABLE'],
    snapshot: {
      branchId: 'demo-branch-1',
      branchName,
      productId: 'demo-product-1',
      productName: 'Alimento seco 15 kg',
      variantId: null,
      sku: 'ALIM-15KG-DEMO',
      requestedQuantity: 2,
      observedStockAtRequest: 0,
      stockObservedAt: '2026-09-25T11:25:00.000Z',
    },
  }
}

function openDetail(decisionId: string): void {
  selectedDecision.value = pendingDecisions.value.find(({ id }) => id === decisionId) ?? null
  detailOpen.value = selectedDecision.value !== null
}

function resolveInMemory(input: HumanDecisionResolutionInput): void {
  const pending = selectedDecision.value
  if (pending?.status !== 'PENDING' || input.expectedVersion !== pending.version) return

  const resolvedBy = { id: 'demo-reviewer', displayName: props.resolverName }
  const resolution: HumanDecisionResolution =
    input.action === 'PROVIDE_RESTOCK_ESTIMATE'
      ? {
          action: input.action,
          restockDays: input.restockDays,
          resolvedAt: DEMO_RESOLVED_AT,
          resolvedBy,
        }
      : {
          action: input.action,
          resolvedAt: DEMO_RESOLVED_AT,
          resolvedBy,
        }

  selectedDecision.value = {
    ...pending,
    status: 'RESOLVED',
    version: 2,
    resolution,
    allowedActions: [],
  }
  pendingDecisions.value = []
  resolutionRecorded.value = true
}
</script>

<template>
  <section class="w-full space-y-5 p-4 sm:p-6" data-testid="human-decisions-offline-demo">
    <header class="space-y-2">
      <p
        data-testid="offline-demo-label"
        class="inline-flex rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-xs font-semibold tracking-wide text-warning"
      >
        SIMULACIÓN · datos sintéticos · sin HTTP
      </p>
      <div>
        <h1 class="text-2xl font-semibold text-highlighted">Decisiones pendientes</h1>
        <p class="text-sm text-muted">Sucursal de la simulación: {{ tenantName }}</p>
      </div>
      <p class="max-w-3xl text-sm text-muted">
        No contiene una conversación del cliente ni información del proveedor. La persona
        responsable usa su conocimiento operativo para registrar una estimación o indicar que aún no
        hay fecha.
      </p>
    </header>

    <p
      v-if="resolutionRecorded"
      role="status"
      class="rounded-lg border border-success/30 bg-success/5 p-3 text-sm text-success"
    >
      Respuesta registrada solo en esta simulación. No se envió a ningún sistema o canal.
    </p>

    <HumanDecisionsListPanel
      v-model:pagination="pagination"
      v-model:global-filter="globalFilter"
      :data="visibleDecisions"
      :page-count="visibleDecisions.length ? 1 : 0"
      :total-count="visibleDecisions.length"
      :showing-from="visibleDecisions.length ? 1 : 0"
      :showing-to="visibleDecisions.length"
      @open-detail="openDetail"
    />

    <HumanDecisionDetailSlideover
      v-model:open="detailOpen"
      :decision="selectedDecision"
      :can-update="canUpdate"
      @resolve="resolveInMemory"
    />
  </section>
</template>
