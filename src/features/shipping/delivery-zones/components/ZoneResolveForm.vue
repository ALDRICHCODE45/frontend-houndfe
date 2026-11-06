<script setup lang="ts">
/**
 * ZoneResolveForm — the one decision of a validation («Todo junto», handoff
 * §3.4): deliver free, with a surcharge (typed in pesos), by carrier only, or
 * not at all (saved as «Sin entrega»).
 */
import { computed, reactive, shallowRef, watch } from 'vue'
import HfFormField from '@/core/shared/components/form/HfFormField.vue'
import HfMoneyInput from '@/core/shared/components/form/HfMoneyInput.vue'
import HfSegmented from '@/core/shared/components/form/HfSegmented.vue'
import {
  SURCHARGE_MAX_CENTS,
  validateResolveDraft,
  zoneTypeUses,
  type ResolveChoice,
  type ResolveDraft,
} from '../utils/zoneForm'

defineProps<{ saving?: boolean; message?: string; canRetry?: boolean }>()
const emit = defineEmits<{ submit: [draft: ResolveDraft]; retry: []; change: [] }>()

const draft = reactive<{ choice: ResolveChoice | null; surchargeCents: number | null; etaDays: string }>({
  choice: null,
  surchargeCents: null,
  etaDays: '',
})
const submitted = shallowRef(false)
const moneyParseError = shallowRef<string | null>(null)

const CHOICES: { value: ResolveChoice; label: string; help: string }[] = [
  { value: 'FREE', label: 'Envío gratis', help: 'Entrega propia sin costo para el cliente.' },
  { value: 'SURCHARGE', label: 'Con cargo', help: 'Entrega propia con un cargo fijo por pedido.' },
  { value: 'CARRIER_ONLY', label: 'Solo paquetería', help: 'Se envía por paquetería; la cotización trae su propio tiempo de entrega.' },
  { value: 'REJECT', label: 'No entregar', help: 'Se guarda como «Sin entrega» y el chatbot ofrece recoger en tienda.' },
]
const items = CHOICES.map(({ value, label }) => ({ value, label }))
const help = computed(() => CHOICES.find((choice) => choice.value === draft.choice)?.help ?? '')
const uses = computed(() =>
  draft.choice && draft.choice !== 'REJECT' ? zoneTypeUses(draft.choice) : { surcharge: false, eta: false },
)
const errors = computed(() => {
  if (!submitted.value) return {}
  if (!draft.choice) return { choice: 'Elige qué responder a los clientes.' }
  return validateResolveDraft(draft as ResolveDraft)
})
const choiceError = computed(() => (errors.value as { choice?: string }).choice)
const fieldError = (field: 'surchargeCents' | 'etaDays') => (errors.value as Record<string, string | undefined>)[field]
const submitLabel = computed(() => {
  if (draft.choice === 'REJECT') return 'Rechazar entrega'
  return draft.choice ? 'Aprobar zona' : 'Guardar decisión'
})

// A changed decision is a new submission: the previous attempt's id is dropped.
watch(draft, () => emit('change'))

function submit() {
  submitted.value = true
  if (!draft.choice) return
  if (Object.keys(validateResolveDraft(draft as ResolveDraft)).length > 0) return
  if (uses.value.surcharge && moneyParseError.value) return
  emit('submit', { ...(draft as ResolveDraft) })
}
</script>

<template>
  <form class="resolve-form" data-testid="resolve-form" novalidate @submit.prevent="submit">
    <div class="resolve-choice">
      <span id="resolve-choice-label" class="hf-form-field__label">¿Entregamos en este código postal?</span>
      <HfSegmented
        :model-value="draft.choice"
        :items="items"
        labelledby="resolve-choice-label"
        :columns="2"
        :disabled="saving"
        @update:model-value="(value) => (draft.choice = value as ResolveChoice)"
      />
      <p v-if="choiceError" id="resolve-choice-message" class="resolve-error">{{ choiceError }}</p>
      <p v-else-if="help" class="resolve-help">{{ help }}</p>
    </div>

    <HfFormField v-if="uses.surcharge" label="Cargo por envío" for="resolve-surcharge" required required-label="Obligatorio">
      <HfMoneyInput
        id="resolve-surcharge"
        v-model="draft.surchargeCents"
        :min-cents="1"
        :max-cents="SURCHARGE_MAX_CENTS"
        :error="fieldError('surchargeCents') ?? null"
        :disabled="saving"
        placeholder="45.00"
        @validation="moneyParseError = $event"
      />
    </HfFormField>
    <HfFormField
      v-if="uses.eta"
      label="Días de entrega"
      for="resolve-eta"
      :error="fieldError('etaDays')"
      hint="0 = mismo día"
      required
      required-label="Obligatorio"
    >
      <UInput
        id="resolve-eta"
        v-model="draft.etaDays"
        inputmode="numeric"
        maxlength="2"
        placeholder="1"
        :disabled="saving"
        :aria-invalid="fieldError('etaDays') ? 'true' : undefined"
        :aria-describedby="fieldError('etaDays') ? 'resolve-eta-message' : undefined"
        class="w-full"
      />
    </HfFormField>

    <div v-if="message" role="alert" class="resolve-alert">
      <p>{{ message }}</p>
      <UButton
        v-if="canRetry"
        variant="outline"
        color="neutral"
        icon="i-lucide-rotate-cw"
        data-testid="resolve-retry"
        :loading="saving"
        @click="emit('retry')"
      >
        Reintentar
      </UButton>
    </div>

    <div class="resolve-actions">
      <UButton type="submit" class="hf-primary-control" :loading="saving" :disabled="saving" data-testid="resolve-submit">
        {{ submitLabel }}
      </UButton>
    </div>
  </form>
</template>

<style scoped>
.resolve-form { display: grid; gap: 20px; color: var(--hf-ink); }
.resolve-choice { display: grid; gap: 8px; }
.resolve-help { color: var(--hf-muted); font-size: 13px; }
.resolve-error { color: var(--hf-danger); font-size: 12px; }
.resolve-alert { display: grid; gap: 12px; justify-items: start; border: 1px solid var(--hf-danger-border); border-radius: 6px; background: var(--hf-danger-soft); color: var(--hf-danger); padding: 12px; font-size: 14px; }
.resolve-actions { display: flex; justify-content: flex-end; border-top: 1px solid var(--hf-border); padding-top: 20px; }
</style>
