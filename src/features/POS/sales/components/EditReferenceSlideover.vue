<script setup lang="ts">
import { ref, watch } from 'vue'
import { getMethodMeta } from '../utils/paymentMethodMeta'
import { normalizeReferenceInput } from '../utils/paymentEntries.utils'

/**
 * sales-pos-charge WU-B.5 — slideover for editing a single payment's
 * `reference` field. Owners call `submit` with the normalized value (per
 * design D8 the slideover does the trim/empty-to-null conversion locally so
 * the consumer does not have to know the wire contract).
 */
const props = withDefaults(
  defineProps<{
    open: boolean
    /** Existing reference for this payment (`null` when no reference is stored). */
    currentReference: string | null
    /** Payment method code, used only to render the header subtitle. */
    paymentMethod: string
    /** Disable inputs while the parent mutation is in-flight. */
    loading?: boolean
  }>(),
  {
    loading: false,
  },
)

const emit = defineEmits<{
  'update:open': [open: boolean]
  submit: [payload: { reference: string | null }]
}>()

const referenceInput = ref<string>('')

// Pre-fill the local input every time the slideover opens. We reset on every
// transition to avoid leaking a previous row's value if the cashier edits
// two rows in a row without closing the slideover in between.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      referenceInput.value = props.currentReference ?? ''
    }
  },
  { immediate: true },
)

const methodMeta = getMethodMeta(props.paymentMethod)

function handleSubmit() {
  // Per design D8: empty/whitespace input becomes `undefined`, which the
  // wire treats as "no change" — we map it to `null` here because the slideover
  // is the explicit-clear surface. The PATCH endpoint persists `null` as the
  // cleared value (backend §7.4).
  const normalized = normalizeReferenceInput(referenceInput.value)
  const wireValue = normalized === undefined ? null : normalized
  emit('submit', { reference: wireValue })
}

function handleClear() {
  referenceInput.value = ''
}

function handleCancel() {
  emit('update:open', false)
}
</script>

<template>
  <USlideover
    :open="open"
    title="Editar referencia de pago"
    :description="`Método de pago: ${methodMeta.label}`"
    side="right"
    inset
    :ui="{ content: '!max-w-md' }"
    data-testid="edit-reference-slideover"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Modificá la referencia asociada a este pago. Si la vaciás, el backend
          la va a borrar al guardar.
        </p>

        <UFormField label="Referencia" required>
          <UInput
            v-model="referenceInput"
            placeholder="Ej. AUTH-001, TRF-12345"
            :disabled="loading"
            data-testid="edit-reference-input"
            @keydown.enter.prevent="handleSubmit"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton
          v-if="referenceInput.length > 0"
          color="error"
          variant="ghost"
          :disabled="loading"
          label="Limpiar"
          data-testid="edit-reference-clear"
          @click="handleClear"
        />
        <div class="ml-auto flex gap-2">
          <UButton
            color="neutral"
            variant="soft"
            label="Cancelar"
            :disabled="loading"
            data-testid="edit-reference-cancel"
            @click="handleCancel"
          />
          <UButton
            color="primary"
            :loading="loading"
            label="Guardar"
            data-testid="edit-reference-submit"
            @click="handleSubmit"
          />
        </div>
      </div>
    </template>
  </USlideover>
</template>