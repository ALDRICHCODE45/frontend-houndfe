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
  <section class="cash-list-section" data-testid="cash-custody-actions">
    <header class="cash-list-header">
      <h2 class="cash-list-title">Custodia y liberación de cajón</h2>
    </header>

    <div class="flex flex-col gap-4">
      <p v-if="!sessionId" class="text-sm text-muted" data-testid="cash-custody-actions-no-session">
        Selecciona una sesión para declarar custodia.
      </p>

      <template v-else>
        <p
          v-if="countedCashCents !== null"
          class="cash-meta"
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
            <legend class="cash-meta">Tipo de entrega</legend>
            <div class="grid gap-2 sm:grid-cols-2">
              <label class="handover-kind" :class="{ 'is-selected': handoverKind === 'FLOAT' }">
                <input
                  v-model="handoverKind"
                  type="radio"
                  value="FLOAT"
                  class="sr-only"
                  data-testid="cash-handover-kind-float"
                />
                <span class="handover-kind-copy">FLOAT (fondo)</span>
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
                <span class="handover-kind-copy">WITHDRAWAL (retiro)</span>
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
              aria-label="Persona destinataria"
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
            class="cash-meta"
            data-testid="cash-handover-recipient-copy"
          >
            No tienes permiso para listar personas: ingresa el UUID de la persona destinataria.
          </p>

          <p
            v-if="handoverKind === 'FLOAT'"
            class="cash-meta"
            data-testid="cash-handover-float-copy"
          >
            Requiere recepción explícita de la persona destinataria.
          </p>

          <UFormField label="Importe declarado (pesos)">
            <UInput
              v-model="amountInput"
              inputmode="decimal"
              class="w-full"
              placeholder="350.00"
              data-testid="cash-handover-amount"
            />
          </UFormField>
          <UFormField label="Notas (opcional)">
            <UInput
              v-model="notesInput"
              class="w-full"
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

        <p v-else class="cash-meta" data-testid="cash-handover-forbidden">
          No tienes permiso para declarar entregas de custodia.
        </p>

        <div class="cash-note flex flex-col gap-2">
          <h3 class="cash-list-title">Liberar cajón físico</h3>
          <p
            v-if="releaseBlockedReason"
            class="cash-meta"
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
            class="min-h-11 self-start"
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
  min-height: 44px;
  padding: 0.75rem;
  cursor: pointer;
  border: 1px solid var(--hf-border);
  border-radius: var(--hf-radius-control);
  background-color: var(--hf-surface);
}

.handover-kind:hover {
  border-color: var(--hf-action);
}

.handover-kind.is-selected {
  border-color: var(--hf-action);
  background-color: var(--hf-active-soft);
}

.handover-kind:focus-within {
  outline: 2px solid var(--hf-focus);
  outline-offset: 2px;
}

.handover-kind-copy {
  color: var(--hf-heading);
  font-size: 0.875rem;
  font-weight: 600;
}
</style>
