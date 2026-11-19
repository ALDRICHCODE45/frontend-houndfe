<script setup lang="ts">
/**
 * Append-only explanation after the blind declaration was submitted.
 *
 * The declaration itself can never be replaced: there is no "new blind count"
 * affordance, only a new immutable notes revision.
 *
 * Direction A: a multi-line note field; a failed attempt shows ONE summary
 * (role="alert", focused, linking to the field) and the same message under the
 * field; a server error lives in the summary only; a settled submit without
 * error is announced in a polite status.
 */
import { nextTick, ref, useId, useTemplateRef, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    submitting?: boolean
    errorMessage?: string | null
  }>(),
  {
    disabled: false,
    submitting: false,
    errorMessage: null,
  },
)

const emit = defineEmits<{
  submit: [notes: string]
}>()

const fieldId = `${useId()}-note`
const summary = useTemplateRef<HTMLElement>('summary')
const notes = ref('')
const localError = ref<string | null>(null)
const status = ref('')

async function focusSummary() {
  await nextTick()
  summary.value?.focus()
}

function submit() {
  if (props.disabled) return
  status.value = ''
  const trimmed = notes.value.trim()
  if (!trimmed) {
    localError.value = 'Escribe la nota explicativa antes de enviarla.'
    void focusSummary()
    return
  }
  localError.value = null
  emit('submit', trimmed)
  notes.value = ''
}

watch(
  () => props.errorMessage,
  (message) => {
    if (message) {
      status.value = ''
      void focusSummary()
    }
  },
)

// Success only if no error landed once the command settled (published a few
// microtasks after `submitting` drops).
watch(
  () => props.submitting,
  (now, before) => {
    if (!before || now) return
    setTimeout(() => {
      if (!props.errorMessage) status.value = 'Nota agregada a la declaración.'
    }, 0)
  },
)
</script>

<template>
  <section class="cash-list-section" data-testid="cash-declaration-notes">
    <header class="cash-list-header">
      <h2 class="cash-list-title">Notas de la declaración</h2>
      <p class="cash-list-subtitle cash-meta-wrap">
        Solo se agregan notas; el conteo original no cambia. Si hay diferencia, explícala aquí.
      </p>
    </header>

    <p class="sr-only" role="status" aria-live="polite" data-testid="cash-declaration-notes-status">
      {{ status }}
    </p>

    <form class="cash-form-content flex flex-col gap-4" novalidate @submit.prevent="submit">
      <div
        v-if="localError || errorMessage"
        ref="summary"
        class="cash-err-summary"
        role="alert"
        tabindex="-1"
        data-testid="cash-declaration-notes-summary"
      >
        <p class="cash-err-summary-title">
          <UIcon name="i-lucide-circle-alert" class="size-4 shrink-0" aria-hidden="true" />
          {{ localError ? 'Revisa la nota antes de enviarla' : 'No se pudo agregar la nota' }}
        </p>
        <ul>
          <li v-if="localError">
            <a :href="`#${fieldId}`">{{ localError }}</a>
          </li>
          <li v-if="errorMessage" data-testid="cash-declaration-notes-error">{{ errorMessage }}</li>
        </ul>
      </div>

      <div class="cash-field">
        <label :for="fieldId" class="cash-label">Nota explicativa</label>
        <UTextarea
          :id="fieldId"
          v-model="notes"
          :rows="3"
          autoresize
          class="w-full"
          placeholder="Por ejemplo: faltante de $20.00 por cambio mal entregado en la venta de las 13:40"
          :disabled="disabled"
          :aria-invalid="localError ? 'true' : undefined"
          :aria-describedby="localError ? `${fieldId}-error` : undefined"
          data-testid="cash-declaration-notes-input"
        />
        <p
          v-if="localError"
          :id="`${fieldId}-error`"
          class="cash-inline-error"
          data-testid="cash-declaration-notes-local-error"
        >{{ localError }}</p>
      </div>

      <div class="cash-form-footer">
        <span class="cash-meta-wrap">La nota queda registrada con tu nombre y la hora.</span>
        <UButton
          type="submit"
          color="neutral"
          variant="outline"
          class="min-h-11"
          :loading="submitting"
          :disabled="disabled || submitting"
          data-testid="cash-declaration-notes-submit"
        >
          Guardar nota
        </UButton>
      </div>
    </form>
  </section>
</template>
