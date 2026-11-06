<script setup lang="ts">
/**
 * ZoneValidationDrawer — one validation (handoff §3.3–§3.4): place, waiting
 * customers, live deadline, and the decision. Conflicts reload the detail and
 * say why; a resolved validation shows who decided and what.
 */
import { computed, shallowRef, watch } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import { readApiErrorEnvelope } from '@/core/shared/utils/api-error-envelope'
import { useResolveValidation } from '../composables/useResolveValidation'
import { useSessionLogout } from '../composables/useSessionLogout'
import { useZoneValidationDetail } from '../composables/useZoneValidations'
import type { ValidationResolution, ZoneValidation } from '../interfaces/delivery-zone.types'
import { formatCountdown, liveUrgencyLevel, urgencyBadge } from '../utils/urgency'
import { buildResolveDecision, formatEtaDays, ZONE_TYPE_LABELS, type ResolveDraft } from '../utils/zoneForm'
import ZoneResolveForm from './ZoneResolveForm.vue'

const props = defineProps<{ validationId: string | null; now: number; canResolve: boolean }>()
const emit = defineEmits<{ close: []; gone: [message: string] }>()
const open = computed({
  get: () => props.validationId !== null,
  set: (value: boolean) => { if (!value && !resolver.pending.value) emit('close') },
})

const detail = useZoneValidationDetail(() => props.validationId)
const resolver = useResolveValidation()
const logout = useSessionLogout()

// A resolve answers with the resolved validation; show it at once, before the refetch lands.
const resolvedNow = shallowRef<ZoneValidation | null>(null)
const banner = shallowRef<{ tone: 'success' | 'warning'; text: string } | null>(null)
const formMessage = shallowRef('')
const formKey = shallowRef(0)
// A resolved validation comes back with lastCustomerMessageAt null (handoff §3); keep the one seen while pending.
const seenLastMessageAt = shallowRef<string | null>(null)

watch(() => props.validationId, () => {
  resolvedNow.value = null
  seenLastMessageAt.value = null
  banner.value = null
  formMessage.value = ''
  resolver.reset()
  formKey.value++
})

const validation = computed(() =>
  resolvedNow.value && resolvedNow.value.id === props.validationId ? resolvedNow.value : (detail.validation.value ?? null),
)
watch(() => validation.value?.lastCustomerMessageAt, (at) => { if (at) seenLastMessageAt.value = at }, { immediate: true })
const lastMessageAt = computed(() => validation.value?.lastCustomerMessageAt ?? seenLastMessageAt.value)
const loadStatus = computed(() => (detail.error.value ? readApiErrorEnvelope(detail.error.value).status : null))
watch(loadStatus, (status) => {
  if (status === 404) emit('gone', 'Esta validación ya no existe en esta sucursal.')
  else if (status === 401) void logout()
})

const title = computed(() => (validation.value ? `Código postal ${validation.value.zipCode}` : 'Validación de zona'))
const place = computed(() =>
  validation.value ? [validation.value.neighborhood, validation.value.municipality, validation.value.state].filter(Boolean).join(', ') : '',
)
const level = computed(() => (validation.value ? liveUrgencyLevel(validation.value.urgency, props.now) : null))
const badge = computed(() => (level.value ? urgencyBadge(level.value) : null))
const countdown = computed(() =>
  validation.value?.urgency && level.value !== 'EXPIRED' ? formatCountdown(validation.value.urgency.deadlineAt, props.now) : '',
)
const waiting = computed(() => {
  const count = validation.value?.requesterCount ?? 0
  if (validation.value?.status === 'RESOLVED') return count === 1 ? '1 cliente preguntó' : `${count} clientes preguntaron`
  return count === 1 ? '1 cliente espera respuesta' : `${count} clientes esperan respuesta`
})

function decisionText(resolution: ValidationResolution): string {
  if (resolution.action === 'REJECT_DELIVERY_ZONE' || resolution.zoneType === 'DENIED' || !resolution.zoneType) {
    return ZONE_TYPE_LABELS.DENIED
  }
  return [
    ZONE_TYPE_LABELS[resolution.zoneType],
    resolution.surchargeCents !== null ? formatCentsMXN(resolution.surchargeCents) : null,
    resolution.etaDays !== null ? formatEtaDays(resolution.etaDays) : null,
  ].filter(Boolean).join(' · ')
}
const decidedBy = computed(() => {
  const resolution = validation.value?.resolution
  if (!resolution) return ''
  return [resolution.resolvedBy?.displayName, formatShortDateTime(resolution.resolvedAt)].filter(Boolean).join(' · ')
})

async function handle(outcome: Awaited<ReturnType<typeof resolver.submit>> | null) {
  if (!outcome) return
  if (outcome.ok) {
    resolvedNow.value = outcome.response.validation
    formMessage.value = ''
    banner.value = { tone: 'success', text: 'Decisión guardada.' }
    return
  }
  const { kind, message } = outcome.error
  if (kind === 'logout') return logout()
  if (kind === 'gone') return emit('gone', message)
  if (kind === 'reload') {
    formMessage.value = ''
    banner.value = { tone: 'warning', text: message }
    formKey.value++
    await detail.refetch()
    return
  }
  formMessage.value = message
}

async function submit(draft: ResolveDraft) {
  const current = validation.value
  if (!current || current.status !== 'PENDING' || resolver.pending.value) return
  banner.value = null
  formMessage.value = ''
  await handle(await resolver.submit(current, buildResolveDecision(draft)))
}
async function retry() {
  await handle(await resolver.retry())
}
function onDraftChange() {
  // A different decision is a new submission with a new id; the retry is only for the same one.
  if (resolver.canRetry.value) {
    resolver.reset()
    formMessage.value = ''
  }
}
</script>

<template>
  <USlideover
    v-model:open="open"
    :title="title"
    :dismissible="!resolver.pending.value"
    :ui="{ content: 'hf-theme hf-ui hf-form-overlay zone-validations-portal' }"
  >
    <template #description>
      <span v-if="validation" class="validation-meta">
        <StatusBadge v-if="validation.status === 'RESOLVED'" label="Resuelta" tone="success" />
        <StatusBadge v-else-if="badge" :label="badge.label" :tone="badge.tone" :urgent="badge.urgent" aria-prefix="Plazo:" />
        <span v-if="countdown" class="validation-countdown">{{ countdown }}</span>
      </span>
      <span v-else class="sr-only">Cargando la validación</span>
    </template>

    <template #body>
      <div v-if="detail.isLoading.value && !validation" class="validation-skeleton" aria-busy="true">
        <USkeleton class="h-4 w-3/4" />
        <USkeleton class="h-4 w-1/2" />
        <USkeleton class="h-24 w-full" />
      </div>

      <EmptyState
        v-else-if="!validation && detail.error.value"
        kind="error"
        title="No se pudo cargar la validación"
        action-label="Reintentar"
        :action-loading="detail.isFetching.value"
        @action="detail.refetch()"
      />

      <div v-else-if="validation" class="validation-body">
        <p v-if="banner" :role="banner.tone === 'success' ? 'status' : 'alert'" class="validation-banner" :data-tone="banner.tone">
          {{ banner.text }}
        </p>

        <dl class="validation-facts">
          <div v-if="place" class="validation-fact validation-fact-wide">
            <dt>Lugar</dt>
            <dd>{{ place }}</dd>
          </div>
          <div class="validation-fact">
            <dt>Clientes</dt>
            <dd>{{ waiting }}</dd>
          </div>
          <div v-if="lastMessageAt" class="validation-fact">
            <dt>Último mensaje</dt>
            <dd>{{ formatShortDateTime(lastMessageAt) }}</dd>
          </div>
          <template v-if="validation.resolution">
            <div class="validation-fact">
              <dt>Decisión</dt>
              <dd>{{ decisionText(validation.resolution) }}</dd>
            </div>
            <div class="validation-fact">
              <dt>Resolvió</dt>
              <dd>{{ decidedBy }}</dd>
            </div>
          </template>
        </dl>

        <p v-if="validation.status === 'PENDING' && level === 'EXPIRED'" class="validation-expired">
          Pasaron 24 horas desde el último mensaje: el chatbot ya no puede contestar por mensaje libre, pero la zona se guarda para los próximos clientes.
        </p>

        <ZoneResolveForm
          v-if="validation.status === 'PENDING' && canResolve"
          :key="formKey"
          :saving="resolver.pending.value"
          :message="formMessage"
          :can-retry="resolver.canRetry.value"
          @submit="submit"
          @retry="retry"
          @change="onDraftChange"
        />
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.validation-meta { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.validation-countdown { color: var(--hf-ink); font-size: 13px; font-variant-numeric: tabular-nums; }
.validation-skeleton { display: grid; gap: 12px; }
.validation-body { display: grid; gap: 24px; color: var(--hf-ink); }
.validation-banner { border-radius: 6px; padding: 12px; font-size: 14px; }
.validation-banner[data-tone='success'] { background: color-mix(in srgb, var(--hf-success) 12%, var(--hf-surface)); color: var(--hf-success); }
.validation-banner[data-tone='warning'] { background: var(--hf-warning-soft); color: var(--hf-warning); }
.validation-facts { display: grid; gap: 16px; }
.validation-fact { display: grid; gap: 2px; }
.validation-fact dt { color: var(--hf-muted); font-size: 13px; }
.validation-fact dd { font-size: 14px; overflow-wrap: anywhere; }
.validation-expired { border-radius: 6px; background: var(--hf-surface-muted); color: var(--hf-muted); padding: 12px; font-size: 13px; }
@media (min-width: 768px) {
  .validation-facts { grid-template-columns: 1fr 1fr; }
  .validation-fact-wide { grid-column: 1 / -1; }
}
</style>
