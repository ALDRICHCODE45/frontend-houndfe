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
 * - Each card says each fact once: the declared amount carries its own label,
 *   the note hint appears only when the received amount differs, and a receipt
 *   error lands on the card (and the field) it belongs to.
 * - The date line says who handed the cash over and from which register, and
 *   the sender's notes follow; a missing name or note shows nothing.
 */
import { computed, ref } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { pesosToCents } from '../utils/cash-input'
import { custodyOrigin } from '../utils/cash-display'
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
    /** Off when the page title already names the section (reception). */
    showHeading?: boolean
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
    errorMessage: undefined,
    receivingId: null,
    showHeading: true,
  },
)

const emit = defineEmits<{
  receive: [payload: { id: string; receivedCents: number; notes?: string }]
  refresh: []
}>()

const receivedInputs = ref<Record<string, string>>({})
const notesInputs = ref<Record<string, string>>({})

/** A receipt problem belongs to one card and to one of its two fields. */
interface ReceiptError {
  field: 'amount' | 'notes'
  message: string
}
const receiptErrors = ref<Record<string, ReceiptError>>({})

function kindLabel(kind: CashCustodyItem['kind']): string {
  return kind === 'FLOAT' ? 'Fondo' : 'Retiro'
}

const kindTone = (kind: CashCustodyItem['kind']) => (kind === 'FLOAT' ? 'info' : 'neutral')

const senderNotes = (item: CashCustodyItem) => item.notes?.trim() ?? ''

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

/**
 * The message for one field of the card, or `false`. It goes to that field's
 * `UFormField`, which marks the input `aria-invalid` and links the message.
 */
function fieldError(item: CashCustodyItem, field: ReceiptError['field']): string | false {
  const error = receiptErrors.value[item.id]
  return error?.field === field ? error.message : false
}

/** The typed amount in cents, or `null` while it is blank or unreadable. */
function typedCents(item: CashCustodyItem): number | null {
  const raw = (receivedInputs.value[item.id] ?? '').trim()
  if (raw === '') return null
  try {
    return pesosToCents(raw)
  } catch {
    return null
  }
}

/** The note becomes required (and its hint appears) only once the amounts differ. */
function differs(item: CashCustodyItem): boolean {
  const cents = typedCents(item)
  return cents !== null && cents !== item.declaredCents
}

/** A fondo repeats its declared amount only when the received one differs. */
const floatDiffers = (item: CashEligibleFloatItem) =>
  item.receivedCents !== null && item.receivedCents !== item.declaredCents

function setReceiptError(item: CashCustodyItem, error: ReceiptError | null) {
  const next = { ...receiptErrors.value }
  if (error) next[item.id] = error
  else delete next[item.id]
  receiptErrors.value = next
}

function submitReceive(item: CashCustodyItem) {
  const raw = (receivedInputs.value[item.id] ?? '').trim()
  let receivedCents: number
  try {
    receivedCents = pesosToCents(raw)
  } catch {
    setReceiptError(item, {
      field: 'amount',
      message: 'Ingresa el monto recibido en pesos (con hasta dos decimales).',
    })
    return
  }
  const notes = (notesInputs.value[item.id] ?? '').trim()
  if (receivedCents !== item.declaredCents && notes === '') {
    setReceiptError(item, {
      field: 'notes',
      message:
        'El monto recibido difiere del declarado: agrega una nota que explique la diferencia.',
    })
    return
  }
  setReceiptError(item, null)
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
      <!-- A page that already names this section keeps the heading for the outline only. -->
      <h2 class="cash-list-title" :class="{ 'sr-only': !showHeading }">Mi custodia pendiente</h2>
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
        <!-- Shaped like a pending-handover card: kind badge and labelled amount,
             the date line, then the receipt fields and the Recibir button. -->
        <div
          v-for="index in 2"
          :key="`custody-skeleton-${index}`"
          class="cash-card flex flex-col gap-3"
          aria-hidden="true"
        >
          <div class="flex items-center justify-between">
            <div class="hf-skeleton h-6 w-20 animate-pulse rounded-md" />
            <div class="hf-skeleton h-5 w-28 animate-pulse rounded" />
          </div>
          <div class="hf-skeleton h-4 w-40 animate-pulse rounded" />
          <div class="grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
            <div class="hf-skeleton h-11 animate-pulse rounded-lg" />
            <div class="hf-skeleton h-11 animate-pulse rounded-lg" />
            <div class="hf-skeleton h-11 animate-pulse rounded-lg sm:w-24" />
          </div>
        </div>
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
        description="Aquí aparecerán las entregas y los fondos que recibas."
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
              <div class="flex min-w-0 flex-col items-start gap-1">
                <StatusBadge
                  :label="kindLabel(item.kind)"
                  :tone="kindTone(item.kind)"
                  aria-prefix="Tipo:"
                  :data-testid="`cash-custody-kind-${item.id}`"
                />
                <p class="cash-meta cash-custody-dateline" :data-testid="`cash-custody-declared-at-${item.id}`">
                  Entregado el
                  <time :datetime="item.declaredAt">{{
                    formatShortDateTime(item.declaredAt)
                  }}</time>
                  <template v-if="custodyOrigin(item)"> · {{ custodyOrigin(item) }}</template>
                </p>
              </div>
              <dl class="cash-custody-amount" :data-testid="`cash-custody-amount-${item.id}`">
                <dt>Declarado</dt>
                <dd class="hf-figure" :data-testid="`cash-custody-declared-${item.id}`">
                  {{ formatCentsMXN(item.declaredCents) }}
                </dd>
              </dl>
            </div>

            <p
              v-if="senderNotes(item)"
              class="cash-meta cash-custody-notes"
              :data-testid="`cash-custody-notes-${item.id}`"
            >
              Nota: {{ senderNotes(item) }}
            </p>

            <p
              v-if="!isMine(item)"
              class="cash-meta mt-3"
              :data-testid="`cash-custody-not-mine-${item.id}`"
            >
              Destinatario distinto: solo la persona destinataria puede recibir esta entrega.
            </p>

            <template v-else>
              <!-- Stacked full width on a phone; one row from sm, top-aligned so a
                   field's own error can grow below it without moving the others. -->
              <div
                class="cash-form-content mt-3 grid gap-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-start"
                :data-testid="`cash-custody-fields-${item.id}`"
              >
                <UFormField label="Monto recibido (pesos)" :error="fieldError(item, 'amount')">
                  <UInput
                    v-model="receivedInputs[item.id]"
                    inputmode="decimal"
                    class="w-full"
                    :data-testid="`cash-custody-received-input-${item.id}`"
                  />
                  <template #error="{ error }">
                    <span role="alert" data-testid="cash-custody-local-error">{{ error }}</span>
                  </template>
                </UFormField>
                <UFormField
                  label="Notas de recepción"
                  :required="differs(item)"
                  :error="fieldError(item, 'notes')"
                >
                  <UInput
                    v-model="notesInputs[item.id]"
                    class="w-full"
                    :data-testid="`cash-custody-received-notes-${item.id}`"
                  />
                  <template #error="{ error }">
                    <span role="alert" data-testid="cash-custody-local-error">{{ error }}</span>
                  </template>
                </UFormField>
                <!-- The spacer matches a field label, so the button lines up with the inputs. -->
                <div v-if="canReceive" class="cash-custody-receive">
                  <UButton
                    type="button"
                    class="min-h-11 w-full justify-center sm:w-auto"
                    :loading="receivingId === item.id"
                    :disabled="receivingId === item.id"
                    :data-testid="`cash-custody-receive-${item.id}`"
                    @click="submitReceive(item)"
                  >
                    Recibir
                  </UButton>
                </div>
              </div>
              <p
                v-if="!receiptErrors[item.id] && differs(item)"
                class="cash-meta mt-2"
                :data-testid="`cash-custody-received-note-hint-${item.id}`"
              >
                El monto difiere del declarado: la nota es obligatoria.
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
          <h3 class="text-sm font-semibold text-highlighted">Fondos disponibles</h3>
          <p
            v-if="eligibleFloat.length === 0"
            class="cash-meta"
            data-testid="cash-custody-float-empty"
          >
            No tienes fondos sin usar.
          </p>
          <article
            v-for="item in eligibleFloat"
            :key="item.id"
            class="cash-card"
            :data-testid="`cash-custody-float-${item.id}`"
          >
            <div class="cash-card-heading">
              <div class="flex min-w-0 flex-col items-start gap-1">
                <StatusBadge
                  :label="kindLabel(item.kind)"
                  :tone="kindTone(item.kind)"
                  aria-prefix="Tipo:"
                />
                <p
                  v-if="item.receivedAt"
                  class="cash-meta cash-custody-dateline"
                  :data-testid="`cash-custody-float-received-at-${item.id}`"
                >
                  Recibido el
                  <time :datetime="item.receivedAt">{{
                    formatShortDateTime(item.receivedAt)
                  }}</time>
                  <template v-if="custodyOrigin(item)"> · {{ custodyOrigin(item) }}</template>
                </p>
              </div>
              <dl class="cash-custody-amount">
                <dt class="sr-only">Recibido</dt>
                <dd class="hf-figure" :data-testid="`cash-custody-float-received-${item.id}`">
                  {{ formatCentsMXN(item.receivedCents ?? 0) }}
                </dd>
                <dd
                  v-if="floatDiffers(item)"
                  class="cash-custody-amount-note hf-figure"
                  :data-testid="`cash-custody-float-declared-${item.id}`"
                >
                  Declarado {{ formatCentsMXN(item.declaredCents) }}
                </dd>
              </dl>
            </div>
            <p
              v-if="senderNotes(item)"
              class="cash-meta cash-custody-notes"
              :data-testid="`cash-custody-float-notes-${item.id}`"
            >
              Nota: {{ senderNotes(item) }}
            </p>
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
    </template>
  </section>
</template>
