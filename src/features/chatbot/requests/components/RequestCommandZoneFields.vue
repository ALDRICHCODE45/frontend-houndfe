<script setup lang="ts">
/**
 * RequestCommandZoneFields — the DELIVERY_ZONE part of the resolve form: approve (with a zone type,
 * surcharge and days as the type requires) or reject, and the impact «Esto resolverá N solicitudes
 * de M clientes» the decision applies to. Bound to the shared resolve draft.
 */
import { computed } from 'vue'
import { zoneTypeUses } from '@/features/shipping/delivery-zones/utils/zoneForm'
import type { ChatbotRequestZoneImpact, ZoneType } from '../interfaces/chatbot-request.types'
import type { FieldErrors, ResolveDraft } from '../utils/command-forms'
import { zoneImpactText } from '../utils/detail-format'
import RequestCommandField from './RequestCommandField.vue'
import RequestCommandRadioGroup from './RequestCommandRadioGroup.vue'

const props = defineProps<{
  draft: ResolveDraft
  errors: FieldErrors
  zipCode: string
  impact: ChatbotRequestZoneImpact | null
  impactLoading?: boolean
  impactFailed?: boolean
  /** The impact changed under the user: the new numbers are waiting for a new confirmation. */
  reconfirm?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ reloadImpact: []; change: [patch: Partial<ResolveDraft>] }>()

const OPTIONS = [
  { value: 'APPROVE', label: 'Aprobar la zona', hint: 'Define el tipo de envío.' },
  { value: 'REJECT', label: 'Rechazar la zona', hint: 'No hay entrega en este código postal.' },
]
const ZONE_TYPES = [
  { value: 'FREE', label: 'Envío gratis' },
  { value: 'SURCHARGE', label: 'Con cargo adicional' },
  { value: 'CARRIER_ONLY', label: 'Solo paquetería' },
]

const approving = computed(() => props.draft.option === 'APPROVE')
const uses = computed(() => zoneTypeUses(props.draft.zoneType))
</script>

<template>
  <div class="rc-zone" data-testid="zone-fields">
    <RequestCommandRadioGroup
      :model-value="draft.option"
      :items="OPTIONS"
      label="Decisión sobre la zona"
      :disabled="disabled"
      @update:model-value="emit('change', { option: $event })"
    />

    <template v-if="approving">
      <RequestCommandRadioGroup
        :model-value="draft.zoneType"
        :items="ZONE_TYPES"
        label="Tipo de envío"
        :error="errors.zoneType"
        :disabled="disabled"
        @update:model-value="emit('change', { zoneType: $event as ZoneType })"
      />
      <RequestCommandField
        v-if="uses.surcharge"
        :model-value="draft.surcharge"
        label="Cargo de envío (MXN)"
        inputmode="decimal"
        prefix="$"
        :error="errors.surchargeCents"
        :disabled="disabled"
        test-id="zone-surcharge"
        @update:model-value="emit('change', { surcharge: $event })"
      />
      <RequestCommandField
        v-if="uses.eta"
        :model-value="draft.etaDays"
        label="Días de entrega"
        inputmode="numeric"
        :maxlength="2"
        help="0 = mismo día."
        :error="errors.etaDays"
        :disabled="disabled"
        test-id="zone-eta"
        @update:model-value="emit('change', { etaDays: $event })"
      />
    </template>

    <div class="rc-impact" :class="{ 'rc-impact--changed': reconfirm }" role="note" data-testid="zone-impact-note">
      <UIcon name="i-lucide-users" aria-hidden="true" />
      <div v-if="impact">
        <strong data-testid="zone-impact-text">{{ zoneImpactText(impact) }}</strong>
        <span>
          {{
            reconfirm
              ? `Cambió desde la última vez. La decisión aplica a todos los clientes que preguntaron por el código postal ${zipCode}.`
              : `La decisión aplica a todos los clientes que preguntaron por el código postal ${zipCode}.`
          }}
        </span>
      </div>
      <div v-else-if="impactLoading" role="status">
        <strong>Calculando a cuántas solicitudes afecta…</strong>
      </div>
      <div v-else>
        <strong data-testid="zone-impact-missing">No se pudo calcular el alcance de la decisión</strong>
        <span>Sin ese dato no se puede confirmar, para no resolver solicitudes de más.</span>
        <UButton
          v-if="impactFailed"
          size="sm"
          color="neutral"
          variant="outline"
          label="Reintentar"
          data-testid="zone-impact-retry"
          @click="emit('reloadImpact')"
        />
      </div>
    </div>
  </div>
</template>
