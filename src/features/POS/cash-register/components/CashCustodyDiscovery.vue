<script setup lang="ts">
/**
 * Recipient custody discovery (`GET /cash-handovers/custody`).
 *
 * - Access state, never a silent empty page: without `read:CashHandover` the
 *   query does not run and the panel explains the missing grant.
 * - FLOAT and WITHDRAWAL are visually distinct, and the receipt action exists
 *   ONLY for the authenticated recipient (`receiverUserId === currentUserId`).
 *   A sender can never mark another person's receipt.
 * - `eligibleFloat` is a HINT, not a reservation: the received amount is shown
 *   (it is the opening fund, even when it differs from the declared amount), an
 *   unreleased source drawer is displayed, and the panel never marks anything
 *   as reserved.
 */
import { computed, ref } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { pesosToCents } from '../utils/cash-input'
import { canReceiveHandover, floatSourceDrawerAdvisory } from '../composables/cashRules'
import type { CashCustodyItem, CashEligibleFloatItem } from '../interfaces/cash.types'

const props = withDefaults(
  defineProps<{
    allowed?: boolean
    pendingHandovers?: CashCustodyItem[]
    eligibleFloat?: CashEligibleFloatItem[]
    currentUserId?: string | null
    canReceive?: boolean
    registerId?: string | null
    loading?: boolean
    error?: boolean
    errorMessage?: string
    receivingId?: string | null
  }>(),
  {
    allowed: false,
    pendingHandovers: () => [],
    eligibleFloat: () => [],
    currentUserId: null,
    canReceive: false,
    registerId: null,
    loading: false,
    error: false,
    errorMessage: 'No se pudo cargar tu custodia pendiente. Reintenta.',
    receivingId: null,
  },
)

const emit = defineEmits<{
  receive: [payload: { id: string; receivedCents: number; notes?: string }]
  refresh: []
}>()

const receivedInputs = ref<Record<string, string>>({})
const notesInputs = ref<Record<string, string>>({})
const localError = ref<string | null>(null)

function kindLabel(kind: CashCustodyItem['kind']): string {
  return kind === 'FLOAT' ? 'FLOAT (próximo fondo)' : 'WITHDRAWAL (retiro)'
}

const kindTone = (kind: CashCustodyItem['kind']) => (kind === 'FLOAT' ? 'info' : 'neutral')

/** Only the designated, still-unreceived recipient may act on the item. */
function isMine(item: CashCustodyItem): boolean {
  return canReceiveHandover(item, props.currentUserId)
}

function advisoryFor(item: CashEligibleFloatItem): string | null {
  const advisory = floatSourceDrawerAdvisory(item, props.registerId ?? null)
  if (!advisory) return null
  return advisory.message
}

const hasAny = computed(() => props.pendingHandovers.length > 0 || props.eligibleFloat.length > 0)

function submitReceive(item: CashCustodyItem) {
  const raw = (receivedInputs.value[item.id] ?? '').trim()
  let receivedCents: number
  try {
    receivedCents = pesosToCents(raw)
  } catch {
    localError.value = 'Ingresa el monto recibido en pesos (con hasta dos decimales).'
    return
  }
  const notes = (notesInputs.value[item.id] ?? '').trim()
  if (receivedCents !== item.declaredCents && notes === '') {
    localError.value =
      'El monto recibido difiere del declarado: agrega una nota que explique la diferencia.'
    return
  }
  localError.value = null
  emit('receive', {
    id: item.id,
    receivedCents,
    ...(notes ? { notes } : {}),
  })
}
</script>

<template>
  <section class="cash-list-section" data-testid="cash-custody-discovery">
    <header class="cash-list-header">
      <h2 class="cash-list-title">Mi custodia pendiente</h2>
    </header>

    <EmptyState
      v-if="!allowed"
      kind="forbidden"
      title="Sin acceso a tus entregas"
      description="Pide a la persona administradora el permiso para ver la custodia."
      data-testid="cash-custody-forbidden"
    />

    <template v-else>
      <div
        v-if="loading"
        class="flex flex-col gap-3"
        aria-busy="true"
        data-testid="cash-custody-loading"
      >
        <span class="sr-only">Cargando</span>
        <div
          v-for="index in 2"
          :key="`custody-skeleton-${index}`"
          class="h-28 animate-pulse rounded-lg border border-[var(--hf-border)] bg-[var(--hf-surface-muted)]"
          aria-hidden="true"
        />
      </div>

      <EmptyState
        v-else-if="error"
        kind="error"
        title="No se pudo cargar tu custodia"
        :description="errorMessage"
        action-label="Reintentar"
        data-testid="cash-custody-error"
        @action="emit('refresh')"
      />

      <EmptyState
        v-else-if="!hasAny"
        title="No hay entregas pendientes"
        description="Aquí aparecerán las entregas y el FLOAT que recibas."
        data-testid="cash-custody-empty"
      />

      <template v-else>
        <section class="flex flex-col gap-3" data-testid="cash-custody-pending">
          <h3 class="text-sm font-semibold text-highlighted">Entregas por recibir</h3>
          <p
            v-if="pendingHandovers.length === 0"
            class="cash-meta"
            data-testid="cash-custody-pending-empty"
          >
            No hay entregas pendientes para ti.
          </p>
          <article
            v-for="item in pendingHandovers"
            :key="item.id"
            class="cash-card"
            :data-testid="`cash-custody-pending-${item.id}`"
          >
            <div class="cash-card-heading">
              <StatusBadge
                :label="kindLabel(item.kind)"
                :tone="kindTone(item.kind)"
                aria-prefix="Tipo:"
                :data-testid="`cash-custody-kind-${item.id}`"
              />
              <dl>
                <dt class="sr-only">Declarado</dt>
                <dd
                  class="hf-figure text-sm font-semibold text-highlighted"
                  :data-testid="`cash-custody-declared-${item.id}`"
                >
                  {{ formatCentsMXN(item.declaredCents) }}
                </dd>
              </dl>
            </div>
            <p class="cash-meta mt-1">Declarado</p>

            <p
              v-if="!isMine(item)"
              class="cash-meta mt-3"
              :data-testid="`cash-custody-not-mine-${item.id}`"
            >
              Destinatario distinto: solo la persona destinataria puede recibir esta entrega.
            </p>

            <template v-else>
              <div class="cash-form-content mt-3 flex flex-wrap items-end gap-2">
                <UFormField label="Monto recibido (pesos)">
                  <UInput
                    v-model="receivedInputs[item.id]"
                    inputmode="decimal"
                    class="min-w-40"
                    :data-testid="`cash-custody-received-input-${item.id}`"
                  />
                </UFormField>
                <UFormField label="Notas de recepción">
                  <UInput
                    v-model="notesInputs[item.id]"
                    class="min-w-40"
                    :data-testid="`cash-custody-received-notes-${item.id}`"
                  />
                </UFormField>
                <UButton
                  v-if="canReceive"
                  type="button"
                  class="min-h-11"
                  :loading="receivingId === item.id"
                  :disabled="receivingId === item.id"
                  :data-testid="`cash-custody-receive-${item.id}`"
                  @click="submitReceive(item)"
                >
                  Recibir
                </UButton>
              </div>
              <p
                class="cash-meta mt-2"
                :data-testid="`cash-custody-received-note-hint-${item.id}`"
              >
                La nota es obligatoria si el monto difiere del declarado.
              </p>
              <p
                v-if="!canReceive"
                class="cash-meta mt-2"
                :data-testid="`cash-custody-receive-forbidden-${item.id}`"
              >
                No tienes permiso para confirmar la recepción.
              </p>
            </template>
          </article>
        </section>

        <section class="flex flex-col gap-3" data-testid="cash-custody-float">
          <h3 class="text-sm font-semibold text-highlighted">FLOAT disponibles</h3>
          <p v-if="eligibleFloat.length === 0" class="cash-meta" data-testid="cash-custody-float-empty">
            No tienes FLOAT sin usar.
          </p>
          <p v-else class="cash-meta">
            Cada FLOAT es una referencia, no una reserva: el fondo de apertura es el monto recibido.
          </p>
          <article
            v-for="item in eligibleFloat"
            :key="item.id"
            class="cash-card"
            :data-testid="`cash-custody-float-${item.id}`"
          >
            <div class="cash-card-heading">
              <span
                class="hf-figure text-sm font-semibold text-highlighted"
                :data-testid="`cash-custody-float-received-${item.id}`"
              >
                Recibido {{ formatCentsMXN(item.receivedCents ?? 0) }}
              </span>
              <span class="cash-meta">Declarado {{ formatCentsMXN(item.declaredCents) }}</span>
            </div>
            <p
              v-if="advisoryFor(item)"
              class="mt-2 text-xs text-warning"
              :data-testid="`cash-custody-float-drawer-${item.id}`"
            >
              {{ advisoryFor(item) }}
            </p>
          </article>
        </section>
      </template>

      <p v-if="localError" class="text-sm text-error" data-testid="cash-custody-local-error">
        {{ localError }}
      </p>
    </template>
  </section>
</template>
