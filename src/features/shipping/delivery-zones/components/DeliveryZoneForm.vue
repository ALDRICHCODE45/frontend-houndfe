<script setup lang="ts">
/**
 * DeliveryZoneForm — create or replace one zone (handoff §2.3). The fields
 * follow the type: surcharge only for «Con cargo», days for «Envío gratis» and
 * «Con cargo». The surcharge is typed in pesos and kept in cents (S4).
 */
import { computed, reactive, shallowRef, watch } from 'vue'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import HfMoneyInput from '@/core/shared/components/form/HfMoneyInput.vue'
import HfSegmented from '@/core/shared/components/form/HfSegmented.vue'
import type { DeliveryZoneType } from '../interfaces/delivery-zone.types'
import {
  SURCHARGE_MAX_CENTS,
  ZONE_TYPE_LABELS,
  validateZoneDraft,
  zoneTypeUses,
  type ZoneDraft,
  type ZoneFieldErrors,
} from '../utils/zoneForm'

const props = defineProps<{
  initial: ZoneDraft
  editing: boolean
  submitLabel: string
  saving?: boolean
  serverErrors?: ZoneFieldErrors
  serverMessage?: string
}>()
const emit = defineEmits<{ submit: [draft: ZoneDraft] }>()

// The parent mounts a fresh form per open; background reads never replace this buffer.
const draft = reactive<ZoneDraft>({ ...props.initial })
const localErrors = shallowRef<ZoneFieldErrors>({})
const moneyParseError = shallowRef<string | null>(null)
const submitted = shallowRef(false)

const TYPE_HELP: Record<DeliveryZoneType, string> = {
  FREE: 'Entrega propia sin costo para el cliente.',
  SURCHARGE: 'Entrega propia con un cargo fijo por pedido.',
  CARRIER_ONLY: 'Se envía por paquetería; la cotización trae su propio tiempo de entrega.',
  DENIED: 'No se entrega aquí; el chatbot ofrece recoger en tienda.',
}
const typeItems = (Object.keys(ZONE_TYPE_LABELS) as DeliveryZoneType[]).map((value) => ({
  value,
  label: ZONE_TYPE_LABELS[value],
}))
const uses = computed(() => zoneTypeUses(draft.type))

// Errors show on submit, then live; a server error stays until its field changes.
const shownServerErrors = shallowRef<ZoneFieldErrors>({})
watch(() => props.serverErrors, (next) => { shownServerErrors.value = { ...(next ?? {}) } }, { immediate: true })
watch(draft, () => {
  if (submitted.value) localErrors.value = validateZoneDraft(draft)
})
function clearServer(field: keyof ZoneFieldErrors) {
  if (shownServerErrors.value[field]) shownServerErrors.value = { ...shownServerErrors.value, [field]: undefined }
}
const errorOf = (field: keyof ZoneFieldErrors) => localErrors.value[field] ?? shownServerErrors.value[field]

function submit() {
  if (props.saving) return
  submitted.value = true
  localErrors.value = validateZoneDraft(draft)
  if (Object.keys(localErrors.value).length > 0 || (uses.value.surcharge && moneyParseError.value)) return
  emit('submit', { ...draft })
}
</script>

<template>
  <form class="zone-form" data-testid="zone-form" novalidate @submit.prevent="submit">
    <HfFormField label="Código postal" for="zone-zip" :error="errorOf('zipCode')" required required-label="Obligatorio">
      <UInput
        id="zone-zip"
        v-model="draft.zipCode"
        inputmode="numeric"
        autocomplete="postal-code"
        maxlength="5"
        placeholder="06700"
        :disabled="editing || saving"
        :aria-invalid="errorOf('zipCode') ? 'true' : undefined"
        :aria-describedby="errorOf('zipCode') ? 'zone-zip-message' : undefined"
        class="w-full"
        @update:model-value="clearServer('zipCode')"
      />
    </HfFormField>

    <div class="zone-type">
      <span id="zone-type-label" class="hf-form-field__label">Tipo de entrega</span>
      <HfSegmented
        v-model="draft.type"
        :items="typeItems"
        labelledby="zone-type-label"
        :columns="2"
        :disabled="saving"
        @update:model-value="(value) => (draft.type = value as DeliveryZoneType)"
      />
      <p class="zone-type-help">{{ TYPE_HELP[draft.type] }}</p>
    </div>

    <HfFormField v-if="uses.surcharge" label="Cargo por envío" for="zone-surcharge" required required-label="Obligatorio">
      <HfMoneyInput
        id="zone-surcharge"
        v-model="draft.surchargeCents"
        :min-cents="1"
        :max-cents="SURCHARGE_MAX_CENTS"
        :error="errorOf('surchargeCents') ?? null"
        :disabled="saving"
        placeholder="45.00"
        @validation="moneyParseError = $event"
        @update:model-value="clearServer('surchargeCents')"
      />
    </HfFormField>

    <HfFormField
      v-if="uses.eta"
      label="Días de entrega"
      for="zone-eta"
      :error="errorOf('etaDays')"
      hint="0 = mismo día"
      required
      required-label="Obligatorio"
    >
      <UInput
        id="zone-eta"
        v-model="draft.etaDays"
        inputmode="numeric"
        maxlength="2"
        placeholder="1"
        :disabled="saving"
        :aria-invalid="errorOf('etaDays') ? 'true' : undefined"
        :aria-describedby="errorOf('etaDays') ? 'zone-eta-message' : undefined"
        class="w-full"
        @update:model-value="clearServer('etaDays')"
      />
    </HfFormField>

    <HfFormField label="Colonia" for="zone-neighborhood" :error="errorOf('neighborhood')">
      <UInput
        id="zone-neighborhood"
        v-model="draft.neighborhood"
        :disabled="saving"
        :aria-invalid="errorOf('neighborhood') ? 'true' : undefined"
        :aria-describedby="errorOf('neighborhood') ? 'zone-neighborhood-message' : undefined"
        class="w-full"
        @update:model-value="clearServer('neighborhood')"
      />
    </HfFormField>
    <HfFormField label="Alcaldía o municipio" for="zone-municipality" :error="errorOf('municipality')">
      <UInput
        id="zone-municipality"
        v-model="draft.municipality"
        :disabled="saving"
        :aria-invalid="errorOf('municipality') ? 'true' : undefined"
        :aria-describedby="errorOf('municipality') ? 'zone-municipality-message' : undefined"
        class="w-full"
        @update:model-value="clearServer('municipality')"
      />
    </HfFormField>
    <HfFormField label="Estado" for="zone-state" :error="errorOf('state')">
      <UInput
        id="zone-state"
        v-model="draft.state"
        :disabled="saving"
        :aria-invalid="errorOf('state') ? 'true' : undefined"
        :aria-describedby="errorOf('state') ? 'zone-state-message' : undefined"
        class="w-full"
        @update:model-value="clearServer('state')"
      />
    </HfFormField>

    <p v-if="serverMessage" role="alert" class="zone-form-alert">{{ serverMessage }}</p>

    <div class="zone-form-actions">
      <UButton type="submit" class="hf-primary-control" :loading="saving" :disabled="saving" data-testid="zone-submit">
        {{ submitLabel }}
      </UButton>
    </div>
  </form>
</template>

<style scoped>
.zone-form { display: grid; gap: 20px; color: var(--hf-ink); }
.zone-type { display: grid; gap: 8px; }
.zone-type-help { color: var(--hf-muted); font-size: 13px; }
.zone-form-alert { border: 1px solid var(--hf-danger-border); border-radius: 6px; background: var(--hf-danger-soft); color: var(--hf-danger); padding: 12px; font-size: 14px; }
.zone-form-actions { display: flex; justify-content: flex-end; border-top: 1px solid var(--hf-border); padding-top: 20px; }
</style>
