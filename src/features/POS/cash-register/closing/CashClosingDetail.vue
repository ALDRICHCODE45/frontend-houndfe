<script setup lang="ts">
/**
 * Corte de caja by folio (T4, S5) — design A `panelCorte` (01) and the 390 board
 * (04). Everything comes from the frozen snapshot (handoff 25 §6), never
 * recomputed: header, physical-cash totals with the two differences apart,
 * channels, handovers (sorted here, the snapshot is unordered) and notes.
 *
 * PDF: fetched with the authenticated client as a Blob; «Ver PDF» opens a tab on
 * the click and points it at an object URL, «Descargar PDF» saves
 * corte-caja-<folio>.pdf. Object URLs are always revoked.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { cashApi } from '../api/cash.api'
import { cashErrorInfo } from '../composables/cashErrorCopy'
import { useCashClosingDetail } from './useCashClosing'
import { closingPdfFileName, downloadClosingPdf, normalizeBlobError, showClosingPdf } from './closingPdf'
import { CASH_HANDOVER_KIND_LABELS, closingPersonName, sortedClosingHandovers } from './closingView'

const props = defineProps<{ closingId: string }>()
defineEmits<{ back: [] }>()

const { closing, isLoading, isError, error, refetch } = useCashClosingDetail(() => props.closingId)

const snapshot = computed(() => closing.value?.snapshot ?? null)
const loadError = computed(() =>
  isError.value ? cashErrorInfo(error.value, 'No pudimos cargar el corte.').message : '',
)

function money(cents: number | null | undefined): string {
  return typeof cents === 'number' ? formatCentsMXN(cents) : '—'
}

function signedTone(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || cents === 0) return ''
  return 'cd-diff--off'
}

function differenceLabel(cents: number | null | undefined): string {
  if (typeof cents !== 'number') return '—'
  if (cents === 0) return `${formatCentsMXN(0)} · cuadra`
  return `${formatCentsMXN(cents)} · ${cents < 0 ? 'faltante' : 'sobrante'}`
}

const facts = computed(() => {
  const s = snapshot.value
  if (!s) return []
  return [
    ['Caja', s.registerName?.trim() || '—'],
    ['Cajero(a)', s.cashierName?.trim() || '—'],
    ['Declaró', formatShortDateTime(s.countedAt)],
    ['Verificó', `${s.verifierName?.trim() || '—'} · ${formatShortDateTime(s.verifiedAt)}`],
    ['Cerró', `${s.closedByName?.trim() || '—'} · ${formatShortDateTime(s.closedAt)}`],
    ['Fondo inicial', money(s.openingCents)],
  ] as Array<[string, string]>
})

const handovers = computed(() => (snapshot.value ? sortedClosingHandovers(snapshot.value.handovers) : []))

const notes = computed(() => {
  const s = snapshot.value
  if (!s) return []
  return (
    [
      ['Nota de la declaración', s.declarationNotes],
      ['Nota de la verificación', s.verificationNotes],
      ['Nota de cierre', s.closingNotes],
    ] as Array<[string, string | null]>
  ).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
})

// ─── PDF ─────────────────────────────────────────────────────────────────────

const pdfBusy = ref<'view' | 'download' | null>(null)
const pdfError = ref<string | null>(null)
const pdfStatus = ref('')
let pdfController: AbortController | null = null

onBeforeUnmount(() => pdfController?.abort())

async function fetchPdf(): Promise<Blob> {
  pdfController?.abort()
  const controller = new AbortController()
  pdfController = controller
  try {
    return await cashApi.getClosingPdf(props.closingId, { signal: controller.signal })
  } catch (failure) {
    throw await normalizeBlobError(failure)
  } finally {
    if (pdfController === controller) pdfController = null
  }
}

async function runPdf(mode: 'view' | 'download') {
  if (pdfBusy.value || !closing.value) return
  const fileName = closingPdfFileName(closing.value.folio, closing.value.id)
  // Open the tab inside the click so the browser does not block it.
  const tab = mode === 'view' ? window.open('', '_blank') : null
  pdfBusy.value = mode
  pdfError.value = null
  pdfStatus.value = 'Preparando el PDF…'
  try {
    const blob = await fetchPdf()
    if (mode === 'view') {
      const shown = showClosingPdf(blob, tab, fileName)
      pdfStatus.value = shown === 'tab' ? 'El PDF se abrió en otra pestaña.' : `Se descargó ${fileName}.`
    } else {
      downloadClosingPdf(blob, fileName)
      pdfStatus.value = `Se descargó ${fileName}.`
    }
  } catch (failure) {
    tab?.close()
    pdfStatus.value = ''
    pdfError.value = cashErrorInfo(failure, 'No pudimos obtener el PDF del corte.').message
  } finally {
    pdfBusy.value = null
  }
}
</script>

<template>
  <section class="cd" data-testid="cash-closing-detail">
    <div
      v-if="isLoading && !snapshot"
      class="cd-skeleton"
      aria-busy="true"
      aria-label="Cargando el corte"
      data-testid="cash-closing-loading"
    >
      <span class="cd-skel cd-skel--title" />
      <span class="cd-skel" />
      <span class="cd-skel" />
      <span class="cd-skel cd-skel--block" />
    </div>

    <EmptyState
      v-else-if="isError && !snapshot"
      kind="error"
      title="No se pudo mostrar el corte"
      :description="loadError"
      action-label="Volver a cargar"
      @action="refetch()"
    />

    <article v-else-if="closing && snapshot" class="cd-article" :aria-label="`Corte de caja ${closing.folio}`">
      <header class="cd-header" data-testid="cash-closing-header">
        <div class="cd-header__title">
          <span class="cd-meta">Corte de caja · {{ snapshot.registerName || 'Caja' }}</span>
          <h3 class="cd-folio">Folio {{ closing.folio }}</h3>
        </div>
        <div class="cd-actions">
          <UButton
            color="neutral"
            variant="outline"
            class="min-h-11"
            icon="i-lucide-external-link"
            :loading="pdfBusy === 'view'"
            :disabled="pdfBusy !== null"
            data-testid="cash-closing-pdf-view"
            @click="runPdf('view')"
          >
            Ver PDF
          </UButton>
          <UButton
            class="min-h-11"
            icon="i-lucide-download"
            :loading="pdfBusy === 'download'"
            :disabled="pdfBusy !== null"
            data-testid="cash-closing-pdf-download"
            @click="runPdf('download')"
          >
            Descargar PDF
          </UButton>
        </div>
      </header>
      <p class="cd-meta">Se descarga como {{ closingPdfFileName(closing.folio, closing.id) }}</p>
      <p class="sr-only" role="status" aria-live="polite">{{ pdfStatus }}</p>
      <p v-if="pdfError" class="cd-error" role="alert" data-testid="cash-closing-pdf-error">
        <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
        <span>{{ pdfError }}</span>
      </p>

      <dl class="cd-facts" data-testid="cash-closing-facts">
        <div v-for="[label, value] in facts" :key="label" class="cd-fact">
          <dt>{{ label }}</dt>
          <dd>{{ value }}</dd>
        </div>
      </dl>

      <section class="cd-section" aria-labelledby="cd-totals-title" data-testid="cash-closing-totals">
        <h4 id="cd-totals-title" class="cd-h">Efectivo físico</h4>
        <dl class="cd-totals">
          <div class="cd-fact"><dt>Fondo inicial</dt><dd class="cd-num">{{ money(snapshot.openingCents) }}</dd></div>
          <div class="cd-fact"><dt>Esperado</dt><dd class="cd-num">{{ money(snapshot.comparison.expectedCents) }}</dd></div>
          <div class="cd-fact"><dt>Declarado</dt><dd class="cd-num">{{ money(snapshot.comparison.declaredCents) }}</dd></div>
          <div class="cd-fact"><dt>Verificado</dt><dd class="cd-num">{{ money(snapshot.comparison.verifiedCents) }}</dd></div>
          <div class="cd-fact">
            <dt>Declarado vs esperado</dt>
            <dd class="cd-num" :class="signedTone(snapshot.comparison.declarationDifferenceCents)">
              {{ differenceLabel(snapshot.comparison.declarationDifferenceCents) }}
            </dd>
          </div>
          <div class="cd-fact">
            <dt>Verificado vs declarado</dt>
            <dd class="cd-num" :class="signedTone(snapshot.comparison.verificationDifferenceCents)">
              {{ differenceLabel(snapshot.comparison.verificationDifferenceCents) }}
            </dd>
          </div>
        </dl>
        <p class="cd-meta">Los totales son solo efectivo; los demás canales van aparte.</p>
      </section>

      <section class="cd-section" aria-labelledby="cd-channels-title">
        <h4 id="cd-channels-title" class="cd-h">Por canal</h4>
        <div class="cd-table-wrap" tabindex="0" role="region" aria-labelledby="cd-channels-title">
          <table class="hf-plain-table cd-table">
            <thead>
              <tr>
                <th scope="col">Canal</th>
                <th scope="col" class="cd-num">Esperado</th>
                <th scope="col" class="cd-num">Declarado</th>
                <th scope="col" class="cd-num">Verificado</th>
                <th scope="col" class="cd-num">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="channel in snapshot.channels" :key="channel.channelKey" data-testid="cash-closing-channel">
                <td>{{ channel.channelLabel }}</td>
                <td class="cd-num">{{ money(channel.expectedCents) }}</td>
                <td class="cd-num">{{ money(channel.declaredCents) }}</td>
                <td class="cd-num">{{ money(channel.verifiedCents) }}</td>
                <td class="cd-num" :class="signedTone(channel.differenceCents)">{{ money(channel.differenceCents) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="cd-meta">Diferencia por canal = declarado − esperado.</p>
      </section>

      <section class="cd-section" aria-labelledby="cd-handovers-title">
        <h4 id="cd-handovers-title" class="cd-h">Entregas</h4>
        <p v-if="handovers.length === 0" class="cd-meta">Sin entregas en este turno.</p>
        <div v-else class="cd-table-wrap" tabindex="0" role="region" aria-labelledby="cd-handovers-title">
          <table class="hf-plain-table cd-table">
            <thead>
              <tr>
                <th scope="col">Entrega</th>
                <th scope="col">Recibió</th>
                <th scope="col" class="cd-num">Declarado</th>
                <th scope="col" class="cd-num">Recibido</th>
                <th scope="col">Hora</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="handover in handovers" :key="handover.handoverId" data-testid="cash-closing-handover">
                <td>{{ CASH_HANDOVER_KIND_LABELS[handover.kind] }}</td>
                <td>{{ closingPersonName(snapshot, handover.receiptActorUserId ?? handover.receiverUserId) }}</td>
                <td class="cd-num">{{ money(handover.declaredCents) }}</td>
                <td class="cd-num">{{ money(handover.receivedCents) }}</td>
                <td>{{ formatShortDateTime(handover.receivedAt ?? handover.declaredAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section v-if="notes.length" class="cd-section cd-notes" aria-labelledby="cd-notes-title" data-testid="cash-closing-notes">
        <h4 id="cd-notes-title" class="cd-h">Notas</h4>
        <dl class="cd-note-list">
          <div v-for="[label, text] in notes" :key="label">
            <dt class="cd-meta">{{ label }}</dt>
            <dd>{{ text }}</dd>
          </div>
        </dl>
      </section>
    </article>
  </section>
</template>

<style scoped>
.cd {
  container-type: inline-size;
  color: var(--hf-ink);
  font-size: 14px;
}
.cd-article {
  display: grid;
  gap: 16px;
}
.cd-meta {
  color: var(--hf-muted);
  font-size: 13px;
}
.cd-header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}
.cd-header__title {
  min-width: 0;
  flex: 1 1 18rem;
}
.cd-folio {
  color: var(--hf-heading);
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.cd-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cd-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid var(--hf-danger-border);
  border-radius: 12px;
  background: var(--hf-danger-soft);
  color: var(--hf-danger);
  font-size: 13px;
}
.cd-facts,
.cd-totals {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px 16px;
  margin: 0;
}
.cd-fact dt {
  color: var(--hf-muted);
  font-size: 13px;
}
.cd-fact dd {
  margin: 0;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.cd-section {
  display: grid;
  gap: 8px;
}
.cd-h {
  color: var(--hf-heading);
  font-size: 15px;
  font-weight: 600;
}
.cd-num {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.cd-totals .cd-num {
  text-align: left;
  font-weight: 600;
}
.cd-diff--off {
  color: var(--hf-warning);
  font-weight: 600;
}
.cd-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--hf-border);
  border-radius: 12px;
  background: var(--hf-surface);
}
.cd-table-wrap:focus-visible {
  outline: 2px solid var(--hf-focus);
  outline-offset: 2px;
}
.cd-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
}
.cd-table th,
.cd-table td {
  padding: 10px 12px;
  white-space: nowrap;
}
.cd-notes {
  padding: 12px 16px;
  border: 1px solid var(--hf-border);
  border-radius: 12px;
  background: var(--hf-surface-muted);
}
.cd-note-list {
  display: grid;
  gap: 8px;
  margin: 0;
}
.cd-note-list dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.cd-skeleton {
  display: grid;
  gap: 12px;
}
.cd-skel {
  display: block;
  height: 16px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--hf-ink) 16%, var(--hf-surface));
}
.cd-skel--title {
  width: 40%;
  height: 28px;
}
.cd-skel--block {
  height: 120px;
}
@container (max-width: 720px) {
  .cd-facts,
  .cd-totals {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container (max-width: 480px) {
  .cd-actions {
    width: 100%;
  }
  .cd-actions > * {
    flex: 1 1 100%;
    justify-content: center;
  }
  .cd-table th,
  .cd-table td {
    padding-inline: 8px;
    font-size: 13px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .cd * {
    transition: none !important;
    animation: none !important;
  }
}
</style>
