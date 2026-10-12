<script setup lang="ts">
/**
 * Independent verification of a submitted session.
 *
 * A different authenticated person must verify: self-verification is blocked in
 * the UI (`CASH_SELF_VERIFICATION_FORBIDDEN`) and a non-zero difference requires
 * a written note. The two differences are always displayed as SEPARATE numbers;
 * the UI never manufactures a balancing movement.
 *
 * Reaching another cashier's session needs the wider `read:CashSessionAudit`
 * scope in addition to `create:CashVerification`, so `canVerify` is the derived
 * gate — never an automatically-granted ability.
 */
import { computed } from 'vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { blindSafeDetail, comparisonView, isSelfVerification } from '../composables/cashRules'
import type {
  CashChannelIdentity,
  CashComparison,
  CashCountPayload,
  CashSessionDetail,
  CashSessionStatus,
} from '../interfaces/cash.types'
import CashCountForm from './CashCountForm.vue'

const props = withDefaults(
  defineProps<{
    detail?: CashSessionDetail | null
    canVerify?: boolean
    currentUserId?: string | null
    submitting?: boolean
    errorMessage?: string | null
    comparison?: CashComparison | null
  }>(),
  {
    detail: null,
    canVerify: false,
    currentUserId: null,
    submitting: false,
    errorMessage: null,
    comparison: null,
  },
)

const emit = defineEmits<{
  submit: [payload: CashCountPayload]
}>()

const safeDetail = computed(() => blindSafeDetail(props.detail))
const session = computed(() => safeDetail.value?.session ?? null)

const selfVerification = computed(() =>
  isSelfVerification(session.value?.cashierUserId, props.currentUserId),
)

const isSubmitted = computed(() => session.value?.status === 'SUBMITTED')

const STATUS_LABELS: Record<CashSessionStatus, string> = {
  OPEN: 'Abierta',
  COUNTING: 'Congelada',
  SUBMITTED: 'Declarada',
  CLOSED: 'Cerrada',
}

/** Spanish status label: never surface the raw backend enum to the verifier. */
const statusLabel = computed(() =>
  session.value?.status ? STATUS_LABELS[session.value.status] : null,
)

const channels = computed<CashChannelIdentity[]>(() =>
  (safeDetail.value?.channelSnapshot ?? []).map((line) => ({
    channelKey: line.channelKey,
    channelLabel: line.channelLabel,
    method: line.method,
  })),
)

const channelLabels = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const line of safeDetail.value?.channelSnapshot ?? []) {
    map[line.channelKey] = line.channelLabel
  }
  return map
})

/**
 * The latest DECLARATION count is an immutable fact the verifier must be able to
 * read; it is never merged with (or replaced by) the verifier's own recount.
 */
const originalDeclaration = computed(() => {
  const declarations = (safeDetail.value?.counts ?? [])
    .filter((count) => count.kind === 'DECLARATION')
    .sort((a, b) => b.revision - a.revision)
  return declarations[0] ?? null
})

const originalLines = computed(() =>
  (originalDeclaration.value?.lines ?? []).map((line) => ({
    key: line.channelKey,
    label: channelLabels.value[line.channelKey] ?? line.channelKey,
    cents: line.amountCents,
  })),
)

const diff = computed(() => comparisonView(props.comparison ?? null))

/** Only the DECLARATION difference can require the verifier's note. */
const notesRequired = computed(() => {
  if (!isSubmitted.value) return false
  const declarationDifference = diff.value?.declarationDifferenceCents ?? null
  return declarationDifference !== null && declarationDifference !== 0
})

function money(cents: number | null): string {
  return cents === null ? '—' : formatCentsMXN(cents)
}
</script>

<template>
  <section class="cash-panel" data-testid="cash-verification">
    <header class="cash-panel-header">
      <span class="cash-icon-tile" aria-hidden="true">
        <UIcon name="i-lucide-shield-check" />
      </span>
      <div class="cash-panel-header-text">
        <h2 class="cash-panel-title">Verificación independiente</h2>
        <p class="cash-panel-subtitle">
          Verifica otra persona: la declaración y el recuento se comparan por separado.
        </p>
      </div>
    </header>

    <div class="cash-panel-body">
      <p
        v-if="!canVerify"
        class="rounded-lg border border-default p-3 text-sm text-muted"
        data-testid="cash-verification-forbidden"
      >
        Necesitas permiso de verificación y acceso de auditoría a la sesión para verificar. No
        otorgamos auditoría automáticamente.
      </p>

      <template v-else-if="!safeDetail">
        <p class="text-sm text-muted" data-testid="cash-verification-no-session">
          Selecciona una sesión declarada para verificarla.
        </p>
      </template>

      <template v-else>
        <p
          v-if="selfVerification"
          class="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error"
          data-testid="cash-verification-self"
        >
          No puedes verificar tu propia sesión: la verificación la hace otra persona.
        </p>

        <p
          v-else-if="!isSubmitted"
          class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning"
          data-testid="cash-verification-state"
        >
          Solo se verifica una sesión declarada. Estado actual:
          {{ statusLabel ?? session?.status }}.
        </p>

        <template v-else>
          <dl class="cash-facts-grid">
            <div class="cash-fact">
              <dt>Esperado</dt>
              <dd class="cash-fact-value" data-testid="cash-verification-expected">
                {{ money(diff?.expectedCents ?? null) }}
              </dd>
            </div>
            <div class="cash-fact">
              <dt>Declarado</dt>
              <dd class="cash-fact-value" data-testid="cash-verification-declared">
                {{ money(diff?.declaredCents ?? null) }}
              </dd>
            </div>
            <div class="cash-fact">
              <dt>Diferencia de declaración</dt>
              <dd class="cash-fact-value" data-testid="cash-verification-declaration-difference">
                {{ money(diff?.declarationDifferenceCents ?? null) }}
              </dd>
            </div>
            <div class="cash-fact">
              <dt>Verificado</dt>
              <dd class="cash-fact-value" data-testid="cash-verification-verified">
                {{ money(diff?.verifiedCents ?? null) }}
              </dd>
            </div>
            <div class="cash-fact">
              <dt>Diferencia de verificación (verificado − declarado)</dt>
              <dd class="cash-fact-value" data-testid="cash-verification-verification-difference">
                {{ money(diff?.verificationDifferenceCents ?? null) }}
              </dd>
            </div>
          </dl>

          <p
            v-if="notesRequired"
            class="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning"
            data-testid="cash-verification-notes-required"
          >
            La declaración tiene diferencia: el recuento requiere una nota que la explique.
          </p>

          <!-- Immutable original facts: never hidden from the verifier. -->
          <div
            v-if="originalLines.length > 0"
            class="cash-note"
            data-testid="cash-verification-original"
          >
            <header class="flex items-start gap-3">
              <span class="cash-icon-tile cash-icon-tile-sm" aria-hidden="true">
                <UIcon name="i-lucide-receipt" />
              </span>
              <div class="cash-panel-header-text">
                <h3 class="cash-panel-title">Declaración original</h3>
                <p class="cash-panel-subtitle">
                  Conteo inmutable de quien declaró. Tu propio recuento se registra aparte.
                </p>
              </div>
            </header>
            <dl class="mt-3 flex flex-col divide-y divide-default border-t border-default">
              <div
                v-for="line in originalLines"
                :key="line.key"
                class="flex items-center justify-between gap-3 py-2"
              >
                <dt>{{ line.label }}</dt>
                <dd class="cash-fact-value" :data-testid="`cash-verification-original-${line.key}`">
                  {{ formatCentsMXN(line.cents) }}
                </dd>
              </div>
            </dl>
          </div>

          <p v-if="errorMessage" class="text-sm text-error" data-testid="cash-verification-error">
            {{ errorMessage }}
          </p>

          <CashCountForm
            :channels="channels"
            :submitting="submitting"
            :notes-required="notesRequired"
            submit-label="Enviar verificación"
            heading="Tu recuento"
            lede="Compara la declaración original con lo que cuentas tú. El cero debe ser explícito."
            variant="flat"
            error-message=""
            @submit="emit('submit', $event)"
          />
        </template>
      </template>
    </div>
  </section>
</template>
