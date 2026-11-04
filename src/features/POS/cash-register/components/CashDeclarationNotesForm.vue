<script setup lang="ts">
/**
 * Append-only explanation after the blind declaration was submitted.
 *
 * The declaration itself can never be replaced: there is no "new blind count"
 * affordance, only a new immutable notes revision.
 */
import { computed, ref } from 'vue'

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

const notes = ref('')
const localError = ref<string | null>(null)

const canSubmit = computed(() => !props.disabled && notes.value.trim().length > 0)

function submit() {
  const trimmed = notes.value.trim()
  if (!trimmed) {
    localError.value = 'Escribe la nota explicativa antes de enviarla.'
    return
  }
  localError.value = null
  emit('submit', trimmed)
  notes.value = ''
}
</script>

<template>
  <section class="cash-list-section" data-testid="cash-declaration-notes">
    <header class="cash-list-header">
      <h2 class="cash-list-title">Notas de la declaración</h2>
      <p class="cash-list-subtitle">Solo se agregan notas; el conteo original no cambia.</p>
    </header>

    <div class="flex flex-col gap-4">
      <form class="cash-form-content flex flex-col gap-3" @submit.prevent="submit">
        <UFormField label="Nota explicativa">
          <UInput
            v-model="notes"
            class="w-full"
            placeholder="Faltante de 500 por cambio entregado sin registrar"
            :disabled="disabled"
            data-testid="cash-declaration-notes-input"
          />
        </UFormField>

        <p
          v-if="errorMessage"
          class="text-sm text-error"
          data-testid="cash-declaration-notes-error"
        >
          {{ errorMessage }}
        </p>
        <p
          v-if="localError"
          class="text-sm text-error"
          data-testid="cash-declaration-notes-local-error"
        >
          {{ localError }}
        </p>

        <UButton
          type="submit"
          class="min-h-11 self-start"
          :loading="submitting"
          :disabled="!canSubmit || submitting"
          data-testid="cash-declaration-notes-submit"
        >
          Agregar nota
        </UButton>
      </form>
    </div>
  </section>
</template>
