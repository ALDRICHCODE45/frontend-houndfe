<script setup lang="ts">
/**
 * Outgoing custody (FLOAT / WITHDRAWAL) and the separate physical drawer release.
 *
 * - FLOAT and WITHDRAWAL are explicit, distinct choices. FLOAT stays as the next
 *   opening fund and still requires an explicit receipt by its recipient.
 * - The recipient is either chosen from the EXISTING assignable-users selector
 *   (only when the identity already holds `read:User`) or entered as an explicit
 *   validated UUID. No new user-list permission is invented.
 * - A same-person WITHDRAWAL is blocked client-side
 *   (`CASH_HANDOVER_SELF_WITHDRAWAL`); a same-person FLOAT is allowed.
 * - Drawer release is a separate event from the session status and is blocked
 *   while any handover is still unreceived.
 */
import { computed, ref } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { pesosToCents } from '../utils/cash-input'
import type { AssignableUser } from '@/features/POS/users/interfaces/user.types'
import type { CashHandoverKind } from '../interfaces/cash.types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const props = withDefaults(
  defineProps<{
    sessionId?: string | null
    canDeclareHandover?: boolean
    canReleaseDrawer?: boolean
    drawerReleased?: boolean
    /** Unreceived handovers still blocking the drawer release. */
    pendingReceiveCount?: number
    /** The submitted declaration's counted cash, for the allocation hint. */
    countedCashCents?: number | null
    selectorEntitled?: boolean
    assignableUsers?: AssignableUser[]
    loadingRecipients?: boolean
    currentUserId?: string | null
    submitting?: boolean
    releasing?: boolean
    /** Another cash command is in flight: every control here is disabled. */
    busy?: boolean
    errorMessage?: string | null
  }>(),
  {
    sessionId: null,
    canDeclareHandover: false,
    canReleaseDrawer: false,
    drawerReleased: false,
    pendingReceiveCount: 0,
    countedCashCents: null,
    selectorEntitled: false,
    assignableUsers: () => [],
    loadingRecipients: false,
    currentUserId: null,
    submitting: false,
    releasing: false,
    busy: false,
    errorMessage: null,
  },
)

const emit = defineEmits<{
  declare: [
    payload: {
      handoverKind: CashHandoverKind
      recipientUserId: string
      declaredCents: number
      notes?: string
    },
  ]
  release: []
}>()

const handoverKind = ref<CashHandoverKind>('FLOAT')
const selectedRecipientId = ref<string | null>(null)
const recipientUuid = ref('')
const amountInput = ref('')
const notesInput = ref('')
const localError = ref<string | null>(null)

const recipientUserId = computed(() =>
  props.selectorEntitled ? (selectedRecipientId.value ?? '') : recipientUuid.value.trim(),
)

const selfWithdrawal = computed(
  () =>
    handoverKind.value === 'WITHDRAWAL' &&
    Boolean(props.currentUserId) &&
    recipientUserId.value === props.currentUserId,
)

const parsedAmount = computed<number | null>(() => {
  try {
    return pesosToCents(amountInput.value.trim(), {
      minCents: 1,
      ...(props.countedCashCents !== null ? { maxCents: props.countedCashCents } : {}),
    })
  } catch {
    return null
  }
})

const releaseBlockedReason = computed(() => {
  if (!props.canReleaseDrawer) return 'No tienes permiso para liberar el cajón.'
  if (props.drawerReleased) return 'El cajón ya fue liberado.'
  if (props.pendingReceiveCount > 0) {
    return 'Todavía hay entregas sin recibir: tienen que recibirse antes de liberar el cajón.'
  }
  return null
})

function submitDeclare() {
  if (!props.canDeclareHandover) {
    localError.value = 'No tienes permiso para declarar custodia.'
    return
  }
  const recipient = recipientUserId.value
  if (!UUID_PATTERN.test(recipient)) {
    localError.value = 'Ingresa el UUID válido de la persona destinataria.'
    return
  }
  if (selfWithdrawal.value) {
    localError.value = 'No puedes declarar un retiro para ti misma o ti mismo.'
    return
  }
  const declaredCents = parsedAmount.value
  if (declaredCents === null) {
    localError.value =
      'Ingresa el importe declarado en pesos (mayor a cero, con hasta dos decimales).'
    return
  }
  localError.value = null
  const notes = notesInput.value.trim()
  emit('declare', {
    handoverKind: handoverKind.value,
    recipientUserId: recipient,
    declaredCents,
    ...(notes ? { notes } : {}),
  })
  amountInput.value = ''
  notesInput.value = ''
}

function submitRelease() {
  if (releaseBlockedReason.value) {
    localError.value = releaseBlockedReason.value
    return
  }
  localError.value = null
  emit('release')
}
</script>

<template>
  <section class="cash-panel" data-testid="cash-custody-actions">
    <header class="cash-panel-header">
      <span class="cash-icon-tile" aria-hidden="true">
        <UIcon name="i-lucide-handshake" />
      </span>
      <div class="cash-panel-header-text">
        <h2 class="cash-panel-title">Custodia y liberación de cajón</h2>
        <p class="cash-panel-subtitle">
          Las entregas deben sumar exactamente el efectivo contado; todas se reciben antes de
          liberar el cajón.
        </p>
      </div>
    </header>

    <div class="cash-panel-body">
      <p v-if="!sessionId" class="text-sm text-muted" data-testid="cash-custody-actions-no-session">
        Selecciona una sesión para declarar custodia.
      </p>

      <template v-else>
        <p
          v-if="countedCashCents !== null"
          class="text-xs text-muted"
          data-testid="cash-custody-actions-counted"
        >
          Efectivo contado disponible para asignar: {{ formatCentsMXN(countedCashCents) }}.
        </p>

        <form
          v-if="canDeclareHandover"
          class="flex flex-col gap-3"
          data-testid="cash-handover-form"
          @submit.prevent="submitDeclare"
        >
          <fieldset class="flex flex-col gap-2">
            <legend class="text-xs font-medium text-muted">Tipo de entrega</legend>
            <div class="grid gap-2 sm:grid-cols-2">
              <label class="handover-kind" :class="{ 'is-selected': handoverKind === 'FLOAT' }">
                <input
                  v-model="handoverKind"
                  type="radio"
                  value="FLOAT"
                  class="sr-only"
                  data-testid="cash-handover-kind-float"
                />
                <span class="handover-kind-tile text-primary">
                  <UIcon name="i-lucide-package-plus" aria-hidden="true" class="size-5" />
                </span>
                <span class="handover-kind-copy">
                  <strong>FLOAT (fondo)</strong>
                  <small>Queda como fondo de la próxima apertura</small>
                </span>
              </label>
              <label
                class="handover-kind"
                :class="{ 'is-selected': handoverKind === 'WITHDRAWAL' }"
              >
                <input
                  v-model="handoverKind"
                  type="radio"
                  value="WITHDRAWAL"
                  class="sr-only"
                  data-testid="cash-handover-kind-withdrawal"
                />
                <span class="handover-kind-tile text-warning">
                  <UIcon name="i-lucide-arrow-up-right" aria-hidden="true" class="size-5" />
                </span>
                <span class="handover-kind-copy">
                  <strong>WITHDRAWAL (retiro)</strong>
                  <small>Sale del cajón hacia otra persona</small>
                </span>
              </label>
            </div>
          </fieldset>

          <UFormField v-if="selectorEntitled" label="Persona destinataria">
            <USelectMenu
              v-model="selectedRecipientId"
              :items="assignableUsers"
              value-key="id"
              label-key="name"
              :loading="loadingRecipients"
              class="w-full"
              data-testid="cash-handover-recipient-select"
            />
          </UFormField>
          <UFormField v-else label="UUID de la persona destinataria">
            <UInput
              v-model="recipientUuid"
              class="w-full"
              placeholder="00000000-0000-4000-8000-000000000000"
              data-testid="cash-handover-recipient-uuid"
            />
          </UFormField>
          <p
            v-if="!selectorEntitled"
            class="text-xs text-muted"
            data-testid="cash-handover-recipient-copy"
          >
            No tienes permiso para listar personas: ingresa el UUID de la persona destinataria. La
            recepción la hace esa persona desde su propia sesión.
          </p>

          <p
            v-if="handoverKind === 'FLOAT'"
            class="text-xs text-muted"
            data-testid="cash-handover-float-copy"
          >
            El FLOAT declarado requiere una recepción explícita de la persona destinataria antes de
            usarse como fondo de apertura.
          </p>

          <UFormField label="Importe declarado (pesos)">
            <UInput
              v-model="amountInput"
              inputmode="decimal"
              class="cash-control w-full"
              placeholder="350.00"
              data-testid="cash-handover-amount"
            />
          </UFormField>
          <UFormField label="Notas (opcional)">
            <UInput
              v-model="notesInput"
              class="cash-control w-full"
              data-testid="cash-handover-notes"
            />
          </UFormField>

          <p
            v-if="selfWithdrawal"
            class="text-sm text-error"
            data-testid="cash-handover-self-withdrawal"
          >
            No puedes declarar un retiro para ti misma o ti mismo.
          </p>

          <UButton
            type="submit"
            class="min-h-11 self-start"
            :loading="submitting"
            :disabled="busy || submitting"
            data-testid="cash-handover-submit"
          >
            Declarar entrega
          </UButton>
        </form>

        <p v-else class="text-sm text-muted" data-testid="cash-handover-forbidden">
          Necesitas permiso para declarar entregas de custodia (create:CashHandover).
        </p>

        <div class="cash-note flex flex-col gap-2">
          <header class="flex items-center gap-2">
            <span class="cash-icon-tile cash-icon-tile-sm" aria-hidden="true">
              <UIcon name="i-lucide-lock-keyhole" />
            </span>
            <p class="cash-panel-title">Liberar cajón físico</p>
          </header>
          <p>
            Congelar la sesión no libera el cajón: es un evento aparte y no cambia el estado de la
            sesión.
          </p>
          <p
            v-if="releaseBlockedReason"
            class="text-xs text-muted"
            data-testid="cash-drawer-release-blocked"
          >
            {{ releaseBlockedReason }}
          </p>
          <p v-if="drawerReleased" class="text-sm text-success" data-testid="cash-drawer-released">
            Cajón liberado.
          </p>
          <UButton
            type="button"
            color="neutral"
            variant="outline"
            class="cash-control min-h-11 self-start"
            :loading="releasing"
            :disabled="Boolean(releaseBlockedReason) || releasing || busy"
            data-testid="cash-drawer-release"
            @click="submitRelease"
          >
            Liberar cajón
          </UButton>
        </div>

        <p v-if="errorMessage" class="text-sm text-error" data-testid="cash-custody-actions-error">
          {{ errorMessage }}
        </p>
        <p
          v-if="localError"
          class="text-sm text-error"
          data-testid="cash-custody-actions-local-error"
        >
          {{ localError }}
        </p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.handover-kind {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  cursor: pointer;
  border: 1px solid var(--cash-border, var(--ui-border));
  border-radius: var(--cash-radius-control, 0.5rem);
  background-color: var(--cash-surface, var(--ui-bg));
  transition:
    border-color 150ms ease,
    background-color 150ms ease;
}

.handover-kind:hover {
  border-color: var(--cash-primary, var(--ui-primary));
}

.handover-kind.is-selected {
  border-color: var(--cash-primary, var(--ui-primary));
  background-color: color-mix(
    in srgb,
    var(--cash-primary, var(--ui-primary)) 8%,
    var(--cash-surface, var(--ui-bg))
  );
}

.handover-kind:focus-within {
  outline: 2px solid var(--cash-primary, var(--ui-primary));
  outline-offset: 2px;
}

.handover-kind-tile {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.5rem;
  border: 1px solid var(--cash-border, var(--ui-border));
  background-color: var(--cash-surface-muted, var(--ui-bg-elevated));
}

.handover-kind-copy {
  min-width: 0;
}

.handover-kind-copy strong {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--cash-ink, var(--ui-text-highlighted));
}

.handover-kind-copy small {
  display: block;
  margin-top: 0.125rem;
  font-size: 0.6875rem;
  color: var(--cash-muted, var(--ui-text-muted));
}
</style>
