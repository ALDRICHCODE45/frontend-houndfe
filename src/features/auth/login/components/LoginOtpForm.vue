<script setup lang="ts">
import { reactive } from 'vue'
import { z } from 'zod'

const props = defineProps<{
  loading: boolean
  error: string | null
  restartRequired: boolean
  resendSeconds: number
  expiresSeconds: number
  retrySeconds: number
}>()
const emit = defineEmits<{
  verify: [code: string]
  resend: []
  restart: []
}>()
const state = reactive({ code: '' })
const schema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, 'Ingresa los 6 dígitos del código.'),
})

function submit() {
  if (props.loading || props.restartRequired || props.retrySeconds > 0) return
  const parsed = schema.safeParse(state)
  if (!parsed.success) return
  emit('verify', parsed.data.code)
  state.code = ''
}
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        Verifica tu correo
      </h2>
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Ingresa el código que enviamos a tu correo para continuar.
      </p>
    </div>
    <UAlert v-if="error" color="error" variant="subtle" :title="error" role="alert" />
    <UForm
      v-if="!restartRequired"
      :schema="schema"
      :state="state"
      class="space-y-5"
      @submit="submit"
    >
      <UFormField label="Código de verificación" name="code">
        <UInput
          v-model="state.code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          :disabled="loading || retrySeconds > 0"
          size="lg"
          class="w-full"
        />
      </UFormField>
      <p class="text-sm text-neutral-500">
        {{
          expiresSeconds > 0
            ? `El código vence en ${expiresSeconds} s.`
            : 'El código puede haber vencido. Solicita otro o vuelve a iniciar sesión.'
        }}
      </p>
      <p v-if="retrySeconds > 0" class="text-sm text-neutral-500">
        Espera {{ retrySeconds }} s para intentar de nuevo.
      </p>
      <UButton
        type="submit"
        block
        size="lg"
        :loading="loading"
        :disabled="loading || retrySeconds > 0"
      >
        Verificar código
      </UButton>
      <UButton
        data-test="resend"
        type="button"
        block
        color="neutral"
        variant="outline"
        :disabled="loading || resendSeconds > 0 || retrySeconds > 0"
        @click="emit('resend')"
      >
        {{ resendSeconds > 0 ? `Reenviar en ${resendSeconds} s` : 'Reenviar código' }}
      </UButton>
    </UForm>
    <UButton
      data-test="restart"
      type="button"
      block
      color="neutral"
      variant="ghost"
      @click="emit('restart')"
    >
      Volver a iniciar sesión
    </UButton>
  </div>
</template>
