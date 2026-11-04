<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import type { PaginationState } from '@/core/shared/types/table.types'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import HumanDecisionDetailSlideover from '../components/HumanDecisionDetailSlideover.vue'
import HumanDecisionsListPanel from '../components/HumanDecisionsListPanel.vue'
import type {
  HumanDecision,
  HumanDecisionListFilter,
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
const decisions = ref<HumanDecision[]>([createDemoDecision(props.tenantName)])
const statusFilter = shallowRef<HumanDecisionListFilter>('ALL')
const selection = shallowRef<Pick<HumanDecision, 'id' | 'status'> | null>(null)
const canResolveSelection = computed(
  () =>
    props.canUpdate &&
    selection.value?.status === 'PENDING' &&
    selectedDecision.value?.status === 'PENDING' &&
    selectedDecision.value?.type === 'RESTOCK',
)

const filteredDecisions = computed(() => {
  const search = globalFilter.value
    .normalize('NFC')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLocaleLowerCase('es-MX')
  return decisions.value.filter(
    (decision) =>
      (statusFilter.value === 'ALL' || decision.status === statusFilter.value) &&
      decision.snapshot.productName.normalize('NFC').toLocaleLowerCase('es-MX').includes(search),
  )
})
const visibleDecisions = computed(() => {
  const start = pagination.value.pageIndex * pagination.value.pageSize
  return filteredDecisions.value.slice(start, start + pagination.value.pageSize)
})
const totalCount = computed(() => filteredDecisions.value.length)
const showingFrom = computed(() =>
  totalCount.value ? pagination.value.pageIndex * pagination.value.pageSize + 1 : 0,
)
const showingTo = computed(() =>
  Math.min(
    pagination.value.pageIndex * pagination.value.pageSize + pagination.value.pageSize,
    totalCount.value,
  ),
)

function setStatusFilter(status: HumanDecisionListFilter) {
  pagination.value = { ...pagination.value, pageIndex: 0 }
  statusFilter.value = status
}
watch(globalFilter, () => {
  pagination.value = { ...pagination.value, pageIndex: 0 }
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

function openDetail(row: Pick<HumanDecision, 'id' | 'status'>): void {
  selection.value = { id: row.id, status: row.status }
  selectedDecision.value = decisions.value.find(({ id }) => id === row.id) ?? null
  detailOpen.value = selectedDecision.value !== null
}

function resolveInMemory(input: HumanDecisionResolutionInput): void {
  const pending = selectedDecision.value
  if (
    !canResolveSelection.value ||
    pending?.status !== 'PENDING' ||
    pending.type !== 'RESTOCK' ||
    input.expectedVersion !== pending.version
  )
    return

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
  const resolved = selectedDecision.value
  decisions.value = decisions.value.map((decision) =>
    decision.id === resolved.id ? resolved : decision,
  )
  resolutionRecorded.value = true
}
</script>

<template>
  <section class="flex flex-col gap-6 md:px-10" data-testid="human-decisions-offline-demo">
    <header class="space-y-2">
      <StatusBadge
        data-testid="offline-demo-label"
        tone="warning"
        label="SIMULACIÓN · datos sintéticos · sin HTTP"
        aria-prefix=""
      />
      <p class="text-sm text-muted">
        Sucursal de la simulación: {{ tenantName }}. No contiene conversaciones del cliente ni
        datos del proveedor.
      </p>
    </header>

    <p
      v-if="resolutionRecorded"
      role="status"
      class="flex items-start gap-2 rounded-lg border border-[var(--hf-border)] bg-[var(--hf-surface-muted)] p-3 text-sm text-[var(--hf-heading)]"
    >
      <UIcon
        name="i-lucide-circle-check"
        class="mt-0.5 size-4 shrink-0 text-[var(--hf-success)]"
        aria-hidden="true"
      />
      Respuesta registrada solo en esta simulación. No se envió a ningún sistema o canal.
    </p>

    <HumanDecisionsListPanel
      v-model:pagination="pagination"
      v-model:global-filter="globalFilter"
      :status-filter="statusFilter"
      :data="visibleDecisions"
      :page-count="Math.ceil(totalCount / pagination.pageSize)"
      :total-count="totalCount"
      :showing-from="showingFrom"
      :showing-to="showingTo"
      @update:status-filter="setStatusFilter"
      @open-detail="openDetail"
    />

    <HumanDecisionDetailSlideover
      v-model:open="detailOpen"
      :decision="selectedDecision"
      :can-update="canResolveSelection"
      @resolve="resolveInMemory"
    />
  </section>
</template>
