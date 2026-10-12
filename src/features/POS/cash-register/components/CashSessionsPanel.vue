<script setup lang="ts">
/**
 * Scoped session list. Without `read:CashSessionAudit` the backend scopes the
 * list to the caller's own sessions, so the panel says so explicitly and never
 * offers a cashier filter it cannot honour.
 */
import { computed } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import type { CashSession, CashSessionStatus } from '../interfaces/cash.types'

const props = withDefaults(
  defineProps<{
    sessions?: CashSession[]
    selectedSessionId?: string | null
    loading?: boolean
    fetching?: boolean
    error?: boolean
    errorMessage?: string
    canFilterByCashier?: boolean
    page?: number
    total?: number
    limit?: number
  }>(),
  {
    sessions: () => [],
    selectedSessionId: null,
    loading: false,
    fetching: false,
    error: false,
    errorMessage: 'No se pudieron cargar las sesiones. Reintenta.',
    canFilterByCashier: false,
    page: 1,
    total: 0,
    limit: 25,
  },
)

const emit = defineEmits<{
  select: [sessionId: string]
  refresh: []
}>()

const STATUS_LABELS: Record<CashSessionStatus, string> = {
  OPEN: 'Abierta',
  COUNTING: 'Congelada',
  SUBMITTED: 'Declarada',
  CLOSED: 'Cerrada',
}

const showEmpty = computed(() => !props.loading && !props.error && props.sessions.length === 0)
</script>

<template>
  <UCard
    :ui="{
      root: 'bg-[var(--cash-surface)] dark:bg-[var(--cash-surface)]',
      body: 'p-4 sm:p-5',
    }"
    data-testid="cash-sessions-panel"
  >
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 class="text-base font-semibold text-highlighted">Sesiones de caja</h2>
          <p class="text-xs text-muted">
            <span v-if="canFilterByCashier">
              Con auditoría puedes ver sesiones de otras personas.
            </span>
            <span v-else data-testid="cash-sessions-scope-own">
              Ves solo tus propias sesiones: la auditoría no se otorga automáticamente.
            </span>
          </p>
        </div>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="min-h-11"
          :loading="fetching"
          data-testid="cash-sessions-refresh"
          @click="emit('refresh')"
        >
          Actualizar
        </UButton>
      </div>
    </template>

    <div class="flex flex-col gap-3">
      <div v-if="loading" aria-busy="true" data-testid="cash-sessions-loading">
        <USkeleton class="h-12 w-full" />
      </div>

      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        title="No se pudieron cargar las sesiones"
        :description="errorMessage"
        data-testid="cash-sessions-error"
      />

      <p v-else-if="showEmpty" class="text-sm text-muted" data-testid="cash-sessions-empty">
        No hay sesiones para mostrar.
      </p>

      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="session in sessions"
          :key="session.id"
          class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default p-3"
          :data-testid="`cash-session-item-${session.id}`"
        >
          <div class="min-w-0">
            <p class="text-sm font-medium text-highlighted">
              <span :data-testid="`cash-session-status-${session.id}`">
                {{ STATUS_LABELS[session.status] }}
              </span>
              · Fondo {{ formatCentsMXN(session.openingCents) }}
            </p>
            <p class="text-xs text-muted">
              <span :data-testid="`cash-session-blind-${session.id}`">
                {{ session.blind ? 'Ventana ciega' : 'Valores visibles' }}
              </span>
              ·
              <span :data-testid="`cash-session-drawer-${session.id}`">
                {{ session.drawerReleasedAt ? 'Cajón liberado' : 'Cajón sin liberar' }}
              </span>
            </p>
          </div>
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            class="min-h-11"
            :disabled="selectedSessionId === session.id"
            :data-testid="`cash-session-open-${session.id}`"
            @click="emit('select', session.id)"
          >
            {{ selectedSessionId === session.id ? 'Seleccionada' : 'Ver sesión' }}
          </UButton>
        </li>
      </ul>

      <p class="text-xs text-muted" data-testid="cash-sessions-total">
        Página {{ page }} · {{ total }} sesiones · hasta {{ limit }} por página
      </p>
    </div>
  </UCard>
</template>
