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
 *
 * Direction A: the original declaration first, read-only on a neutral surface
 * (no decorative tint), then the verifier's second count (the shared count form
 * with its error summary, which also carries the server error), then the
 * comparison, where a non-zero difference is said in words (faltante /
 * sobrante) and never by color alone.
 */
import { computed } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
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

/** Before any recount every figure is unknown: one line says so instead of five dashes. */
const hasComparison = computed(() => {
  const view = diff.value
  if (!view) return false
  return [
    view.expectedCents,
    view.declaredCents,
    view.declarationDifferenceCents,
    view.verifiedCents,
    view.verificationDifferenceCents,
  ].some((cents) => cents !== null)
})

/** Only the DECLARATION difference can require the verifier's note. */
const notesRequired = computed(() => {
  if (!isSubmitted.value) return false
  const declarationDifference = diff.value?.declarationDifferenceCents ?? null
  return declarationDifference !== null && declarationDifference !== 0
})

function money(cents: number | null): string {
  return cents === null ? '—' : formatCentsMXN(cents)
}

/** A difference in words: «$5.00 sobrante», «$5.00 faltante» or «Sin diferencia». */
function difference(cents: number | null): string {
  if (cents === null) return '—'
  if (cents === 0) return 'Sin diferencia'
  return `${formatCentsMXN(Math.abs(cents))} ${cents > 0 ? 'sobrante' : 'faltante'}`
}

const declaredAt = computed(() =>
  originalDeclaration.value ? formatShortDateTime(originalDeclaration.value.createdAt) : null,
)
const cashierName = computed(() => session.value?.cashierDisplayName?.trim() || null)
</script>

<template>
  <section class="cash-list-section" data-testid="cash-verification">
    <header class="cash-list-header">
      <h2 class="cash-list-title">Verificación independiente</h2>
    </header>

    <EmptyState
      v-if="!canVerify"
      kind="forbidden"
      title="Sin permiso para verificar"
      description="Necesitas permiso de verificación y acceso de auditoría a la sesión."
      data-testid="cash-verification-forbidden"
    />

    <div v-else-if="!safeDetail" class="cash-callout" data-testid="cash-verification-no-session">
      <UIcon name="i-lucide-clock" class="cash-callout-icon" aria-hidden="true" />
      <p>Selecciona una sesión declarada para verificarla.</p>
    </div>

    <template v-else>
      <div
        v-if="selfVerification"
        class="cash-callout"
        data-testid="cash-verification-self"
      >
        <UIcon name="i-lucide-user" class="cash-callout-icon" aria-hidden="true" />
        <p>
          <strong>No puedes verificar tu propia sesión</strong><br />
          <span class="cash-meta-wrap">La verificación la hace otra persona con permiso.</span>
        </p>
      </div>

      <div
        v-else-if="!isSubmitted"
        class="cash-callout"
        data-testid="cash-verification-state"
      >
        <UIcon name="i-lucide-clock" class="cash-callout-icon" aria-hidden="true" />
        <p>
          <strong>Todavía no hay una declaración enviada</strong><br />
          <span class="cash-meta-wrap"
            >Solo se verifica una sesión declarada. Estado actual:
            {{ statusLabel ?? session?.status }}.</span
          >
        </p>
      </div>

      <template v-else>
        <!-- Immutable original facts, read-only, on a neutral surface. -->
        <section
          v-if="originalLines.length > 0"
          class="cash-original"
          aria-labelledby="cash-verification-original-title"
          data-testid="cash-verification-original"
        >
          <div class="cash-original-head">
            <h3 id="cash-verification-original-title" class="cash-list-title">
              Declaración original
            </h3>
            <span v-if="declaredAt || cashierName" class="cash-meta-wrap">
              {{ [cashierName, declaredAt].filter(Boolean).join(' · ') }}
            </span>
          </div>
          <dl class="cash-original-lines">
            <div v-for="line in originalLines" :key="line.key" class="cash-original-line">
              <dt>{{ line.label }}</dt>
              <dd
                class="cash-fact-value hf-figure"
                :data-testid="`cash-verification-original-${line.key}`"
              >
                {{ formatCentsMXN(line.cents) }}
              </dd>
            </div>
          </dl>
          <p class="cash-meta-wrap">Recuenta sin mirar la diferencia; la verás al enviar.</p>
        </section>

        <p
          v-if="notesRequired"
          class="cash-note cash-note--warning"
          data-testid="cash-verification-notes-required"
        >
          La declaración tiene diferencia: el recuento requiere una nota que la explique.
        </p>

        <CashCountForm
          :channels="channels"
          :submitting="submitting"
          :notes-required="notesRequired"
          submit-label="Enviar verificación"
          success-label="Verificación enviada."
          heading="Tu recuento"
          lede="Compara la declaración original con lo que cuentas tú. El cero debe ser explícito."
          variant="flat"
          :error-message="errorMessage"
          error-test-id="cash-verification-error"
          @submit="emit('submit', $event)"
        />

        <p
          v-if="!hasComparison"
          class="cash-meta-wrap"
          data-testid="cash-verification-no-comparison"
        >
          Las diferencias aparecen cuando envías tu recuento.
        </p>
        <section v-else class="cash-compare" aria-labelledby="cash-verification-compare-title">
          <h3 id="cash-verification-compare-title" class="cash-list-title">Comparación</h3>
          <dl class="cash-compare-grid">
            <div class="cash-fact">
              <dt>Esperado</dt>
              <dd class="cash-fact-value hf-figure" data-testid="cash-verification-expected">
                {{ money(diff?.expectedCents ?? null) }}
              </dd>
            </div>
            <div class="cash-fact">
              <dt>Declarado</dt>
              <dd class="cash-fact-value hf-figure" data-testid="cash-verification-declared">
                {{ money(diff?.declaredCents ?? null) }}
              </dd>
            </div>
            <div class="cash-fact">
              <dt>Diferencia de declaración</dt>
              <dd
                class="cash-fact-value hf-figure"
                :class="{ 'cash-diff': (diff?.declarationDifferenceCents ?? 0) !== 0 }"
                data-testid="cash-verification-declaration-difference"
              >
                {{ difference(diff?.declarationDifferenceCents ?? null) }}
              </dd>
            </div>
            <div class="cash-fact">
              <dt>Verificado</dt>
              <dd class="cash-fact-value hf-figure" data-testid="cash-verification-verified">
                {{ money(diff?.verifiedCents ?? null) }}
              </dd>
            </div>
            <div class="cash-fact">
              <dt>Diferencia de verificación (verificado − declarado)</dt>
              <dd
                class="cash-fact-value hf-figure"
                :class="{ 'cash-diff': (diff?.verificationDifferenceCents ?? 0) !== 0 }"
                data-testid="cash-verification-verification-difference"
              >
                {{ difference(diff?.verificationDifferenceCents ?? null) }}
              </dd>
            </div>
          </dl>
        </section>
      </template>
    </template>
  </section>
</template>
