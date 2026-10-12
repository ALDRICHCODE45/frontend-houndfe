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
  <section class="cash-panel" data-testid="cash-custody-discovery">
    <header class="cash-panel-header">
      <span class="cash-icon-tile" aria-hidden="true">
        <UIcon name="i-lucide-hand-coins" />
      </span>
      <div class="cash-panel-header-text">
        <h2 class="cash-panel-title">Mi custodia pendiente</h2>
        <p class="cash-panel-subtitle">
          Solo la persona destinataria puede recibir; el FLOAT listado es una referencia, no una
          reserva.
        </p>
      </div>
      <div class="cash-panel-header-actions">
        <UButton
          v-if="allowed"
          type="button"
          color="neutral"
          variant="ghost"
          class="cash-control"
          data-testid="cash-custody-refresh"
          @click="emit('refresh')"
        >
          Actualizar
        </UButton>
      </div>
    </header>

    <div class="cash-panel-body">
      <p
        v-if="!allowed"
        class="rounded-lg border border-default p-3 text-sm text-muted"
        data-testid="cash-custody-forbidden"
      >
        Necesitas el permiso para ver tus entregas de custodia (read:CashHandover). No lo otorgamos
        automáticamente.
      </p>

      <template v-else>
        <div v-if="loading" aria-busy="true" data-testid="cash-custody-loading">
          <USkeleton class="h-16 w-full" />
        </div>

        <UAlert
          v-else-if="error"
          color="error"
          variant="subtle"
          title="No se pudo cargar tu custodia"
          :description="errorMessage"
          data-testid="cash-custody-error"
        />

        <p v-else-if="!hasAny" class="text-sm text-muted" data-testid="cash-custody-empty">
          No tienes entregas pendientes ni FLOAT recibidos disponibles.
        </p>

        <template v-else>
          <section class="flex flex-col gap-2" data-testid="cash-custody-pending">
            <h3 class="text-sm font-medium text-highlighted">Entregas por recibir</h3>
            <p
              v-if="pendingHandovers.length === 0"
              class="text-xs text-muted"
              data-testid="cash-custody-pending-empty"
            >
              No hay entregas pendientes para ti.
            </p>
            <article
              v-for="item in pendingHandovers"
              :key="item.id"
              class="flex flex-col gap-3 rounded-lg border border-default p-3"
              :data-testid="`cash-custody-pending-${item.id}`"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <UBadge
                  :color="item.kind === 'FLOAT' ? 'primary' : 'neutral'"
                  variant="subtle"
                  :data-testid="`cash-custody-kind-${item.id}`"
                >
                  {{ kindLabel(item.kind) }}
                </UBadge>
                <span class="text-xs text-muted">Entrega {{ item.id.slice(0, 8) }}</span>
              </div>

              <!-- Declared vs actually received: two separate, explicit facts. -->
              <dl class="grid grid-cols-2 gap-x-4 gap-y-1">
                <div class="min-w-0">
                  <dt class="text-xs text-muted">Declarado</dt>
                  <dd
                    class="text-sm font-semibold text-highlighted"
                    :data-testid="`cash-custody-declared-${item.id}`"
                  >
                    {{ formatCentsMXN(item.declaredCents) }}
                  </dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-xs text-muted">Recibido</dt>
                  <dd class="text-xs text-muted">Se confirma al recibir</dd>
                </div>
              </dl>

              <p
                v-if="!isMine(item)"
                class="text-xs text-muted"
                :data-testid="`cash-custody-not-mine-${item.id}`"
              >
                Destinatario distinto: solo la persona destinataria puede recibir esta entrega.
              </p>

              <template v-else>
                <div class="cash-form-content flex flex-wrap items-end gap-2">
                  <UFormField label="Monto recibido (pesos)">
                    <UInput
                      v-model="receivedInputs[item.id]"
                      inputmode="decimal"
                      class="cash-control"
                      :data-testid="`cash-custody-received-input-${item.id}`"
                    />
                  </UFormField>
                  <UFormField label="Notas de recepción">
                    <UInput
                      v-model="notesInputs[item.id]"
                      class="cash-control"
                      :data-testid="`cash-custody-received-notes-${item.id}`"
                    />
                  </UFormField>
                  <UButton
                    v-if="canReceive"
                    type="button"
                    class="cash-control min-h-11"
                    :loading="receivingId === item.id"
                    :disabled="receivingId === item.id"
                    :data-testid="`cash-custody-receive-${item.id}`"
                    @click="submitReceive(item)"
                  >
                    Recibir
                  </UButton>
                </div>
                <p
                  class="text-xs text-muted"
                  :data-testid="`cash-custody-received-note-hint-${item.id}`"
                >
                  Si el monto difiere del declarado, la nota es obligatoria.
                </p>
                <p
                  v-if="!canReceive"
                  class="text-xs text-muted"
                  :data-testid="`cash-custody-receive-forbidden-${item.id}`"
                >
                  Necesitas permiso para confirmar la recepción (update:CashHandover).
                </p>
              </template>
            </article>
          </section>

          <section class="flex flex-col gap-2" data-testid="cash-custody-float">
            <h3 class="text-sm font-medium text-highlighted">FLOAT recibidos disponibles</h3>
            <p
              v-if="eligibleFloat.length === 0"
              class="text-xs text-muted"
              data-testid="cash-custody-float-empty"
            >
              No tienes FLOAT sin usar.
            </p>
            <article
              v-for="item in eligibleFloat"
              :key="item.id"
              class="flex flex-col gap-1 rounded-lg border border-default p-3"
              :data-testid="`cash-custody-float-${item.id}`"
            >
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span
                  class="text-sm font-medium text-highlighted"
                  :data-testid="`cash-custody-float-received-${item.id}`"
                >
                  Recibido {{ formatCentsMXN(item.receivedCents ?? 0) }}
                </span>
                <span class="text-xs text-muted"
                  >Declarado {{ formatCentsMXN(item.declaredCents) }}</span
                >
              </div>
              <p class="text-xs text-muted">
                El fondo de apertura es el monto RECIBIDO; puede diferir del declarado y sigue
                siendo válido.
              </p>
              <p
                v-if="advisoryFor(item)"
                class="text-xs text-warning"
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
    </div>
  </section>
</template>
