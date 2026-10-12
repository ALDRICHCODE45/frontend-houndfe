<script setup lang="ts">
/**
 * Session summary: status and drawer release are presented as two SEPARATE
 * facts, and a blind window never renders expected/difference values or
 * movements — even when a malformed or stale payload still carries them.
 *
 * `variant="card"` (default) renders the standalone panel chrome; the shared
 * shift hero renders it flat inside its own surface.
 */
import { computed } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import {
  blindSafeDetail,
  cashSessionFacts,
  requiredChannelIdentities,
} from '../composables/cashRules'
import type { CashSessionDetail, CashSessionStatus } from '../interfaces/cash.types'

const props = withDefaults(
  defineProps<{
    detail?: CashSessionDetail | null
    loading?: boolean
    error?: boolean
    errorMessage?: string
    variant?: 'card' | 'flat'
  }>(),
  {
    detail: null,
    loading: false,
    error: false,
    errorMessage: 'No se pudo cargar la sesión. Reintenta.',
    variant: 'card',
  },
)

const STATUS_LABELS: Record<CashSessionStatus, string> = {
  OPEN: 'Abierta',
  COUNTING: 'Congelada',
  SUBMITTED: 'Declarada',
  CLOSED: 'Cerrada',
}

const safeDetail = computed(() => blindSafeDetail(props.detail))
const facts = computed(() => cashSessionFacts(safeDetail.value?.session))
const channels = computed(() => requiredChannelIdentities(safeDetail.value))

const statusLabel = computed(() => (facts.value.status ? STATUS_LABELS[facts.value.status] : null))
const drawerLabel = computed(() =>
  facts.value.drawerReleasedAt ? 'Cajón liberado' : 'Cajón sin liberar',
)

function money(cents: number | null): string {
  return cents === null ? '—' : formatCentsMXN(cents)
}
</script>

<template>
  <section
    class="cash-session-summary"
    :class="variant === 'card' ? 'cash-panel' : 'cash-session-summary--flat'"
    data-testid="cash-session-summary"
  >
    <header class="cash-panel-header">
      <span class="cash-icon-tile" aria-hidden="true"><UIcon name="i-lucide-receipt-text" /></span>
      <div class="cash-panel-header-text">
        <h2 class="cash-panel-title">Detalle del turno</h2>
        <p class="cash-panel-subtitle">Hechos del turno en foco, sin mezclar custodia ni cierre.</p>
      </div>
      <div class="cash-panel-header-actions">
        <UBadge
          v-if="statusLabel"
          color="primary"
          variant="subtle"
          data-testid="cash-session-status"
        >
          {{ statusLabel }}
        </UBadge>
        <UBadge
          v-if="facts.status"
          :color="facts.drawerReleasedAt ? 'success' : 'warning'"
          variant="subtle"
          data-testid="cash-session-drawer-state"
        >
          {{ drawerLabel }}
        </UBadge>
      </div>
    </header>

    <div class="cash-panel-body">
      <div v-if="loading" aria-busy="true" data-testid="cash-session-loading">
        <USkeleton class="h-16 w-full" />
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        title="No se pudo cargar la sesión"
        :description="errorMessage"
        data-testid="cash-session-error"
      />

      <template v-else-if="safeDetail">
        <dl class="cash-facts-grid">
          <div class="cash-fact">
            <dt>Fondo inicial</dt>
            <dd class="cash-fact-value" data-testid="cash-session-opening">
              {{ money(facts.openingCents) }}
            </dd>
          </div>
          <div class="cash-fact">
            <dt>Caja</dt>
            <dd class="cash-fact-value" data-testid="cash-session-register">
              {{ safeDetail.register?.name ?? '—' }}
            </dd>
          </div>
        </dl>

        <p v-if="facts.blind" class="cash-note cash-note--warning" data-testid="cash-session-blind">
          Conteo ciego: no se muestran el esperado, la diferencia ni los movimientos hasta enviar la
          declaración.
          <span v-if="channels.length">
            Canales congelados a declarar: {{ channels.length }}.
          </span>
        </p>

        <dl v-else class="cash-facts-grid">
          <div class="cash-fact">
            <dt>Esperado en efectivo</dt>
            <dd class="cash-fact-value" data-testid="cash-session-expected">
              {{ money(facts.expectedCashCents) }}
            </dd>
          </div>
          <div class="cash-fact">
            <dt>Diferencia de declaración (declarado − esperado)</dt>
            <dd class="cash-fact-value" data-testid="cash-session-declaration-difference">
              {{ money(facts.differenceCents) }}
            </dd>
          </div>
        </dl>

        <p
          v-if="facts.drawerReleasedAt"
          class="cash-note"
          data-testid="cash-session-drawer-released-at"
        >
          Cajón liberado el {{ facts.drawerReleasedAt }}.
        </p>
        <p v-else class="cash-note" data-testid="cash-session-drawer-open">
          Congelar la sesión NO libera el cajón: la liberación es un evento aparte.
        </p>
      </template>
    </div>
  </section>
</template>
