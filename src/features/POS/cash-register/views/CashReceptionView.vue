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
      'No se pudo registrar la recepción. Reintenta.',
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
    <header class="flex flex-col gap-2" data-testid="cash-reception-heading">
      <span
        class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"
        data-testid="cash-reception-task-label"
      >
        <UIcon name="i-lucide-hand-coins" aria-hidden="true" class="size-4" />
        Recepción de caja
      </span>
      <h1 class="cash-page-title">Recibe tu custodia</h1>
      <p class="max-w-2xl text-sm text-muted">
        Consulta y recibe las entregas de efectivo destinadas a ti.
      </p>
    </header>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
      <div class="flex min-w-0 flex-col gap-6" data-testid="cash-reception-operation">
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
          @receive="receive"
          @refresh="refresh"
        />
      </div>

      <!-- Contexto: esta pantalla es solo de recepción. Sin cajas ni auditoría. -->
      <aside class="flex min-w-0 flex-col gap-4" data-testid="cash-reception-context">
        <section class="cash-panel">
          <header class="cash-panel-header">
            <span class="cash-icon-tile" aria-hidden="true">
              <UIcon name="i-lucide-shield-check" />
            </span>
            <div class="cash-panel-header-text">
              <h2 class="cash-panel-title">Solo recepción</h2>
              <p class="cash-panel-subtitle">
                Aquí solo se ven y se reciben las entregas destinadas a tu usuario. No se crean
                cajas ni sesiones y no se amplía la auditoría.
              </p>
            </div>
          </header>

          <div class="cash-panel-body">
            <dl class="cash-facts-grid">
              <div class="cash-fact">
                <dt>Entregas por recibir</dt>
                <dd class="cash-fact-value" data-testid="cash-reception-context-pending">
                  {{ pendingCount }}
                </dd>
              </div>
              <div class="cash-fact">
                <dt>Efectivo declarado por recibir</dt>
                <dd class="cash-fact-value" data-testid="cash-reception-context-declared">
                  {{ formatCentsMXN(pendingDeclaredCents) }}
                </dd>
              </div>
              <div class="cash-fact">
                <dt>FLOAT disponibles</dt>
                <dd class="cash-fact-value" data-testid="cash-reception-context-float">
                  {{ floatCount }}
                </dd>
              </div>
            </dl>

            <p class="cash-note">
              Solo la persona destinataria puede confirmar la recepción. El FLOAT listado es una
              referencia, no una reserva.
            </p>
          </div>
        </section>
      </aside>
    </div>
  </section>
</template>
