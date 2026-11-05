<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import CashCustodyDiscovery from '../components/CashCustodyDiscovery.vue'
import { useCashAccess } from '../composables/useCashAccess'
import { useCashCustody } from '../composables/useCashCustody'
import { useCashSessionCommands } from '../composables/useCashSessionCommands'
import { canReceiveHandover } from '../composables/cashRules'
import { CashIdentityError, cashErrorInfo } from '../composables/cashErrorCopy'
import '../styles/cash-visual.css'

// Recipient composition only: never instantiate register/session/audit reads.
const access = useCashAccess()
const custody = useCashCustody()
const commands = useCashSessionCommands()
const receivingId = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
let activeReceive: symbol | null = null
const identityScope = computed(() => JSON.stringify(access.identity.value))
watch(
  identityScope,
  () => {
    activeReceive = null
    receivingId.value = null
    errorMessage.value = null
  },
  { flush: 'sync' },
)

function canRead() {
  return access.canReadCustody.value && access.identityReady.value && access.permissionsLoaded.value
}

async function refresh() {
  if (canRead()) await custody.refetch()
}

async function receive(payload: { id: string; receivedCents: number; notes?: string }) {
  if (!canRead() || !access.canReceiveHandover.value || activeReceive || commands.isBusy.value)
    return
  const handover = custody.pendingHandovers.value.find((item) => item.id === payload.id)
  if (!canReceiveHandover(handover, access.currentUserId.value)) return
  const captured = access.captureIdentity()
  const operation = Symbol('receipt')
  activeReceive = operation
  receivingId.value = payload.id
  errorMessage.value = null
  try {
    await commands.receiveHandover(payload.id, {
      receivedCents: payload.receivedCents,
      ...(payload.notes ? { notes: payload.notes } : {}),
    })
    if (!access.isCurrentIdentity(captured)) return
    await custody.refetch()
  } catch (error) {
    if (!access.isCurrentIdentity(captured)) return
    if (error instanceof CashIdentityError && error.reason === 'changed') return
    errorMessage.value = cashErrorInfo(
      error,
      'No se pudo registrar la recepción.',
    ).message
  } finally {
    // An older actor's completion must not clear a newer actor's pending receipt.
    if (activeReceive === operation) {
      activeReceive = null
      receivingId.value = null
    }
  }
}

// Context summary: presentation derivations over the REAL recipient custody only
// (never fabricated dates, branches or amounts). The pending declared total is
// the only money aggregated; FLOAT stays a reference, never a reservation.
// Nothing is counted until the custody has loaded (and never after a failed read).
const loadingFacts = computed(() => custody.isLoading.value || custody.isError.value)
// Say each thing once: forbidden, failed and empty states already speak for the
// page, so the summary only accompanies a loading or non-empty custody.
const showContext = computed(
  () =>
    custody.allowed.value &&
    !custody.isError.value &&
    (custody.isLoading.value || pendingCount.value + floatCount.value > 0),
)
const pendingCount = computed(() => custody.pendingHandovers.value.length)
const floatCount = computed(() => custody.eligibleFloat.value.length)
const pendingDeclaredCents = computed(() =>
  custody.pendingHandovers.value.reduce((total, item) => total + item.declaredCents, 0),
)
</script>

<template>
  <section
    class="cash-visual cash-page flex flex-col gap-6 md:px-10"
    data-testid="cash-reception-view"
  >
    <header class="flex flex-col gap-1" data-testid="cash-reception-heading">
      <h1 class="cash-page-title">Recepciones de caja</h1>
    </header>

    <!-- The summary comes first in the DOM so a phone shows the total to receive
         before the list; from lg it sits in the right rail. -->
    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start">
      <!-- Contexto: esta pantalla es solo de recepción. Sin cajas ni auditoría. -->
      <aside
        v-if="showContext"
        class="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1"
        data-testid="cash-reception-context"
      >
        <dl class="cash-facts-grid cash-facts-panel cash-facts-rail">
          <div class="cash-fact">
            <dt>Entregas por recibir</dt>
            <dd class="cash-fact-value hf-figure" data-testid="cash-reception-context-pending">
              {{ loadingFacts ? '—' : pendingCount }}
            </dd>
          </div>
          <div class="cash-fact">
            <dt>Efectivo declarado por recibir</dt>
            <dd class="cash-fact-value hf-figure" data-testid="cash-reception-context-declared">
              {{ loadingFacts ? '—' : formatCentsMXN(pendingDeclaredCents) }}
            </dd>
          </div>
          <div class="cash-fact">
            <dt>Fondos disponibles</dt>
            <dd class="cash-fact-value hf-figure" data-testid="cash-reception-context-float">
              {{ loadingFacts ? '—' : floatCount }}
            </dd>
          </div>
        </dl>
      </aside>

      <div
        class="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1"
        data-testid="cash-reception-operation"
      >
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :title="errorMessage"
          data-testid="cash-reception-error"
        />
        <CashCustodyDiscovery
          :key="identityScope"
          :allowed="custody.allowed.value"
          :pending-handovers="custody.pendingHandovers.value"
          :eligible-float="custody.eligibleFloat.value"
          :current-user-id="access.currentUserId.value"
          :can-receive="access.canReceiveHandover.value"
          :loading="custody.isLoading.value"
          :error="custody.isError.value"
          :receiving-id="receivingId"
          :show-heading="false"
          @receive="receive"
          @refresh="refresh"
        />
      </div>
    </div>
  </section>
</template>
