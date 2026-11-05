<script setup lang="ts">
/**
 * Session summary: status and drawer release are presented as two SEPARATE
 * facts, and a blind window never renders expected/difference values or
 * movements — even when a malformed or stale payload still carries them.
 *
 * It sits flat inside the shared shift card, which owns the surface. There
 * (`embedded`) the card already names the register and shows the status, so
 * the summary keeps only the drawer badge and the money facts.
 */
import { computed } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import {
  blindSafeDetail,
  cashSessionFacts,
  requiredChannelIdentities,
} from '../composables/cashRules'
import type { CashSessionDetail } from '../interfaces/cash.types'
import { CASH_SESSION_STATUS_LABELS, cashSessionStatusTone } from '../utils/cash-status'

const props = withDefaults(
  defineProps<{
    detail?: CashSessionDetail | null
    loading?: boolean
    error?: boolean
    errorMessage?: string
    /** Inside the shift card: no second status badge and no register fact. */
    embedded?: boolean
  }>(),
  {
    detail: null,
    loading: false,
    error: false,
    errorMessage: undefined,
    embedded: false,
  },
)

const emit = defineEmits<{ retry: [] }>()

const safeDetail = computed(() => blindSafeDetail(props.detail))
const facts = computed(() => cashSessionFacts(safeDetail.value?.session))
const channels = computed(() => requiredChannelIdentities(safeDetail.value))

const status = computed(() => facts.value.status)
const drawerLabel = computed(() =>
  facts.value.drawerReleasedAt ? 'Cajón liberado' : 'Cajón sin liberar',
)

function money(cents: number | null): string {
  return cents === null ? '—' : formatCentsMXN(cents)
}
</script>

<template>
  <section class="cash-session-summary" data-testid="cash-session-summary">
    <header class="cash-session-summary-header">
      <h3 class="cash-list-title">Detalle del turno</h3>
      <div v-if="status" class="cash-session-summary-badges">
        <StatusBadge
          v-if="!embedded"
          :label="CASH_SESSION_STATUS_LABELS[status]"
          :tone="cashSessionStatusTone(status)"
          data-testid="cash-session-status"
        />
        <StatusBadge
          :label="drawerLabel"
          :tone="facts.drawerReleasedAt ? 'success' : 'warning'"
          aria-prefix="Cajón:"
          data-testid="cash-session-drawer-state"
        />
      </div>
    </header>

    <div
      v-if="loading"
      class="hf-skeleton h-16 w-full animate-pulse rounded-lg"
      aria-busy="true"
      data-testid="cash-session-loading"
    />

    <EmptyState
      v-else-if="error"
      kind="error"
      title="No se pudo cargar la sesión"
      :description="errorMessage"
      action-label="Reintentar"
      data-testid="cash-session-error"
      @action="emit('retry')"
    />

    <template v-else-if="safeDetail">
      <!-- One grid: embedded it reads Fondo · Esperado · Diferencia on one row. -->
      <dl class="cash-facts-grid" :class="{ 'cash-facts-grid--3': embedded && !facts.blind }">
        <div class="cash-fact">
          <dt>Fondo inicial</dt>
          <dd class="cash-fact-value hf-figure" data-testid="cash-session-opening">
            {{ money(facts.openingCents) }}
          </dd>
        </div>
        <div v-if="!embedded" class="cash-fact">
          <dt>Caja</dt>
          <dd class="cash-fact-value" data-testid="cash-session-register">
            {{ safeDetail.register?.name ?? '—' }}
          </dd>
        </div>
        <template v-if="!facts.blind">
          <div class="cash-fact">
            <dt>Esperado en efectivo</dt>
            <dd class="cash-fact-value hf-figure" data-testid="cash-session-expected">
              {{ money(facts.expectedCashCents) }}
            </dd>
          </div>
          <div class="cash-fact">
            <dt>Diferencia (declarado − esperado)</dt>
            <dd class="cash-fact-value hf-figure" data-testid="cash-session-declaration-difference">
              {{ money(facts.differenceCents) }}
            </dd>
          </div>
        </template>
      </dl>

      <p v-if="facts.blind" class="cash-note cash-note--warning" data-testid="cash-session-blind">
        Conteo ciego: no se muestran el esperado, la diferencia ni los movimientos hasta enviar la
        declaración.
        <span v-if="channels.length"> Canales congelados a declarar: {{ channels.length }}. </span>
      </p>

      <p
        v-if="facts.drawerReleasedAt"
        class="cash-meta"
        data-testid="cash-session-drawer-released-at"
      >
        Cajón liberado el {{ formatShortDateTime(facts.drawerReleasedAt) }}
      </p>
    </template>
  </section>
</template>
