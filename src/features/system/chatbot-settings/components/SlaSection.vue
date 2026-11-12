<script setup lang="ts">
/**
 * SlaSection — deadlines per request subtype in business minutes, shown in human units (design 01,
 * «Plazos por tipo»). Every subtype's claim and resolve time is editable with an explicit «Sin plazo»
 * (`null`) — «Hablar con una persona» included. Only «Comprobante» is forced by the contract: no claim
 * time, resolve by the receipt rule; it shows read-only with the close margin as its one editable value.
 */
import { CHATBOT_SETTINGS_SUBTYPES, type ChatbotSettings, type ChatbotSettingsSubtype } from '../interfaces/chatbot-settings.types'
import { SUBTYPE_COPY } from '../utils/settingsLabels'
import type { SettingsErrors } from '../utils/settingsValidation'
import { formatDuration } from '../utils/settingsUnits'
import DurationField from './DurationField.vue'

const props = defineProps<{
  draft: ChatbotSettings
  readonly: boolean
  errors: SettingsErrors
}>()
const emit = defineEmits<{
  'set-sla': [subtype: ChatbotSettingsSubtype, field: 'claimMinutes' | 'resolveMinutes', value: number | null]
  'set-margin': [value: number]
}>()

const slaOf = (subtype: ChatbotSettingsSubtype) => props.draft.slas.find((s) => s.subtype === subtype)
const hint = (value: number | null) => (value === null ? 'Sin límite de tiempo' : `${formatDuration(value)} de atención`)
</script>

<template>
  <div class="cbs-sla" data-testid="sla-section">
    <p class="cbs-help cbs-sla__note">
      <UIcon name="i-lucide-timer" class="size-4" aria-hidden="true" />
      <span>
        <b>Atender</b> es el tiempo para que alguien tome la solicitud; <b>resolver</b>, para cerrarla. Se cuentan desde
        que llega y <b>solo dentro del horario de atención</b> (minutos hábiles).
      </span>
    </p>

    <div class="cbs-sla__table" role="table" aria-label="Plazos por tipo de solicitud">
      <div class="cbs-sla__head" role="row">
        <span role="columnheader">Tipo</span>
        <span role="columnheader">Atender en</span>
        <span role="columnheader">Resolver en</span>
      </div>

      <template v-for="subtype in CHATBOT_SETTINGS_SUBTYPES" :key="subtype">
        <div
          v-if="slaOf(subtype)"
          class="cbs-sla__row"
          :data-fixed="subtype === 'TRANSFER_RECEIPT'"
          role="row"
          :data-testid="`sla-${subtype}`"
        >
          <div class="cbs-sla__name">
            <UIcon :name="SUBTYPE_COPY[subtype].icon" class="size-4" aria-hidden="true" />
            <span>
              <b>{{ SUBTYPE_COPY[subtype].name }}</b>
              <small>{{ SUBTYPE_COPY[subtype].hint }}</small>
            </span>
          </div>

          <template v-if="subtype === 'TRANSFER_RECEIPT'">
            <div class="cbs-sla__cell" data-testid="receipt-claim">
              <span class="cbs-fixed">No tiene plazo para atender</span>
            </div>
            <div class="cbs-sla__cell" data-testid="receipt-resolve">
              <span class="cbs-fixed">Al cierre del día en que llega</span>
              <small>
                Si llega con menos de {{ formatDuration(draft.receiptCloseMarginMinutes) }} antes del cierre, vence al cierre
                del siguiente día hábil.
              </small>
              <div v-if="!readonly" class="cbs-sla__margin">
                <label class="cbs-label" for="cbs-margin">Margen antes del cierre</label>
                <DurationField
                  id="cbs-margin"
                  :model-value="draft.receiptCloseMarginMinutes"
                  label="Margen antes del cierre"
                  :nullable="false"
                  :invalid="!!errors['x:margin']"
                  describedby="cbs-margin-error"
                  @update:model-value="emit('set-margin', $event ?? Number.NaN)"
                />
                <span v-if="errors['x:margin']" id="cbs-margin-error" class="cbs-error" role="alert" data-testid="margin-error">
                  {{ errors['x:margin'] }}
                </span>
              </div>
            </div>
          </template>

          <template v-else>
            <div v-for="field in (['claimMinutes', 'resolveMinutes'] as const)" :key="field" class="cbs-sla__cell">
              <template v-if="readonly">
                <span class="cbs-fixed cbs-figure" :data-testid="`${subtype}-${field}-readonly`">
                  {{ formatDuration(slaOf(subtype)![field]) }}
                </span>
              </template>
              <template v-else>
                <DurationField
                  :id="`s-${subtype}-${field === 'claimMinutes' ? 'claim' : 'resolve'}`"
                  :model-value="slaOf(subtype)![field]"
                  :label="`${field === 'claimMinutes' ? 'Atender' : 'Resolver'} ${SUBTYPE_COPY[subtype].name.toLowerCase()}`"
                  :invalid="!!errors[`s:${subtype}:${field === 'claimMinutes' ? 'claim' : 'resolve'}`]"
                  :describedby="`s-${subtype}-${field}-hint`"
                  @update:model-value="emit('set-sla', subtype, field, $event)"
                />
                <small :id="`s-${subtype}-${field}-hint`" class="cbs-hint">
                  {{ Number.isNaN(slaOf(subtype)![field]) ? '' : hint(slaOf(subtype)![field]) }}
                </small>
                <span
                  v-if="errors[`s:${subtype}:${field === 'claimMinutes' ? 'claim' : 'resolve'}`]"
                  class="cbs-error"
                  role="alert"
                  :data-testid="`error-${subtype}-${field}`"
                >
                  {{ errors[`s:${subtype}:${field === 'claimMinutes' ? 'claim' : 'resolve'}`] }}
                </span>
              </template>
            </div>
          </template>
        </div>
      </template>
    </div>

    <ul class="cbs-help cbs-sla__notes">
      <li>Al liberar una solicitud, el plazo para atender vuelve a empezar; el de resolver no se reinicia.</li>
      <li>Al guardar se recalculan las solicitudes abiertas. Las cerradas no cambian.</li>
    </ul>
  </div>
</template>
