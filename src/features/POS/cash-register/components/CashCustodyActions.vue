<script setup lang="ts">
/**
 * Outgoing custody (FLOAT / WITHDRAWAL) and the separate physical drawer release.
 *
 * - FLOAT and WITHDRAWAL are explicit, distinct choices. FLOAT stays as the next
 *   opening fund and still requires an explicit receipt by its recipient.
 * - The recipient is picked by name and role (radio cards) from
 *   `GET /cash-handovers/recipients` for the chosen kind (S6); there is no raw
 *   UUID input. Loading, empty and error (with «Reintentar») are told per kind.
 * - A same-person WITHDRAWAL is blocked client-side
 *   (`CASH_HANDOVER_SELF_WITHDRAWAL`); a same-person FLOAT is allowed.
 * - Drawer release is a separate event from the session status and is blocked
 *   while any handover is still unreceived.
 * - `section` lets the timeline open each part in its own step: «Entregar el
 *   efectivo» (`handover`, offered from SUBMITTED, before verification — S8)
 *   and «Liberar el cajón» (`release`). The default shows both.
 */
import { computed, ref, useId, watch } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { pesosToCents } from '../utils/cash-input'
import type { CashHandoverKind, CashHandoverRecipient } from '../interfaces/cash.types'

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
    /** Recipients per kind from `GET /cash-handovers/recipients`. */
    recipients?: Partial<Record<CashHandoverKind, CashHandoverRecipient[]>>
    recipientsLoading?: Partial<Record<CashHandoverKind, boolean>>
    recipientsError?: Partial<Record<CashHandoverKind, boolean>>
    currentUserId?: string | null
    submitting?: boolean
    releasing?: boolean
    /** Another cash command is in flight: every control here is disabled. */
    busy?: boolean
    errorMessage?: string | null
    /** Which part to render: both (default), only the handover, or only the release. */
    section?: 'all' | 'handover' | 'release'
  }>(),
  {
    sessionId: null,
    canDeclareHandover: false,
    canReleaseDrawer: false,
    drawerReleased: false,
    pendingReceiveCount: 0,
    countedCashCents: null,
    recipients: () => ({}),
    recipientsLoading: () => ({}),
    recipientsError: () => ({}),
    currentUserId: null,
    submitting: false,
    releasing: false,
    busy: false,
    errorMessage: null,
    section: 'all',
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
  'retry-recipients': [kind: CashHandoverKind]
}>()

const uid = useId()
const recipientName = `cash-handover-recipient-${uid}`

const showHandover = computed(() => props.section !== 'release')
const showRelease = computed(() => props.section !== 'handover')
const sectionTitle = computed(() =>
  props.section === 'handover'
    ? 'Entrega de efectivo'
    : props.section === 'release'
      ? 'Liberar cajón físico'
      : 'Custodia y liberación de cajón',
)

const handoverKind = ref<CashHandoverKind>('FLOAT')
const selectedRecipientId = ref<string | null>(null)
const amountInput = ref('')
const notesInput = ref('')
const localError = ref<string | null>(null)

const kindRecipients = computed(() => props.recipients[handoverKind.value] ?? [])
const kindLoading = computed(() => props.recipientsLoading[handoverKind.value] === true)
const kindError = computed(() => props.recipientsError[handoverKind.value] === true)
const kindEmpty = computed(
  () => !kindLoading.value && !kindError.value && kindRecipients.value.length === 0,
)

// Each kind has its own list: a person chosen for one never carries over.
watch(handoverKind, () => {
  selectedRecipientId.value = null
  localError.value = null
})

const recipientUserId = computed(() => selectedRecipientId.value ?? '')

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
  if (!recipient || !kindRecipients.value.some((item) => item.userId === recipient)) {
    localError.value = 'Elige la persona que recibe.'
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
      <h2 class="cash-list-title">{{ sectionTitle }}</h2>
    </header>

    <div class="flex flex-col gap-4">
      <p v-if="!sessionId" class="text-sm text-muted" data-testid="cash-custody-actions-no-session">
        Selecciona una sesión para declarar custodia.
      </p>

      <template v-else>
        <p
          v-if="showHandover && countedCashCents !== null"
          class="cash-meta"
          data-testid="cash-custody-actions-counted"
        >
          Efectivo contado disponible para asignar: {{ formatCentsMXN(countedCashCents) }}.
        </p>

        <form
          v-if="showHandover && canDeclareHandover"
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
                <span class="handover-kind-copy">Fondo</span>
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
                <span class="handover-kind-copy">Retiro</span>
              </label>
            </div>
          </fieldset>

          <fieldset class="flex flex-col gap-2" data-testid="cash-handover-recipients">
            <legend class="cash-meta">Persona que recibe</legend>
            <div
              v-if="kindLoading"
              class="flex flex-col gap-2"
              aria-hidden="true"
              data-testid="cash-handover-recipients-loading"
            >
              <div v-for="n in 2" :key="n" class="hf-skeleton h-11 w-full animate-pulse rounded-lg" />
            </div>
            <div
              v-else-if="kindError"
              class="cash-inline-error"
              role="alert"
              data-testid="cash-handover-recipients-error"
            >
              <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
              <span>No se pudo cargar quién puede recibir.</span>
              <UButton
                type="button"
                color="neutral"
                variant="outline"
                size="sm"
                class="min-h-11"
                @click="emit('retry-recipients', handoverKind)"
              >
                Reintentar
              </UButton>
            </div>
            <p v-else-if="kindEmpty" class="cash-meta-wrap" data-testid="cash-handover-recipients-empty">
              No hay quién pueda recibir en esta sucursal. Pide a un administrador que asigne el
              permiso «Recibir entregas».
            </p>
            <div v-else class="grid gap-2 sm:grid-cols-2">
              <label
                v-for="person in kindRecipients"
                :key="person.userId"
                class="handover-kind"
                :class="{ 'is-selected': selectedRecipientId === person.userId }"
                :data-testid="`cash-handover-recipient-card-${person.userId}`"
              >
                <input
                  v-model="selectedRecipientId"
                  type="radio"
                  :name="recipientName"
                  :value="person.userId"
                  class="sr-only"
                  :data-testid="`cash-handover-recipient-${person.userId}`"
                />
                <span class="flex min-w-0 flex-col">
                  <span class="handover-kind-copy">
                    {{ person.displayName }}<template v-if="person.userId === currentUserId"> (tú)</template>
                  </span>
                  <span class="cash-meta">{{ person.roleName }}</span>
                </span>
              </label>
            </div>
          </fieldset>

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
            :disabled="busy || submitting || kindEmpty"
            data-testid="cash-handover-submit"
          >
            Declarar entrega
          </UButton>
        </form>

        <p v-else-if="showHandover" class="cash-meta" data-testid="cash-handover-forbidden">
          No tienes permiso para declarar entregas de custodia.
        </p>

        <div v-if="showRelease" class="cash-note flex flex-col gap-2">
          <h3 v-if="section === 'all'" class="cash-list-title">Liberar cajón físico</h3>
          <p v-else class="cash-meta-wrap">
            Libera el cajón cuando retires todo el efectivo. Es un paso aparte: no cierra la caja.
          </p>
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
