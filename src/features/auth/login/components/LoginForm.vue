<script setup lang="ts">
import { ref } from 'vue'
import type { FormSubmitEvent } from '@nuxt/ui'
import { useLoginForm, type LoginFormValues } from '../composables/useLoginForm'

defineProps<{
  loading?: boolean
}>()

const emit = defineEmits<{
  submit: [values: LoginFormValues]
}>()

const showPassword = ref(false)
const { schema, state } = useLoginForm()

function handleSubmit(event: FormSubmitEvent<LoginFormValues>) {
  emit('submit', event.data)
}
</script>

<template>
  <div class="space-y-6">
    <h2 class="hf-auth-title">Iniciar sesi&oacute;n</h2>

    <UForm class="space-y-4" :schema="schema" :state="state" @submit="handleSubmit">
      <UFormField label="Email" name="email">
        <UInput
          id="email"
          v-model="state.email"
          type="email"
          autocomplete="username"
          placeholder="tu@email.com"
          size="lg"
          class="w-full"
          :disabled="loading"
        />
      </UFormField>

      <UFormField label="Contraseña" name="password">
        <UInput
          id="password"
          v-model="state.password"
          :type="showPassword ? 'text' : 'password'"
          autocomplete="current-password"
          size="lg"
          class="w-full"
          :disabled="loading"
        >
          <template #trailing>
            <UButton
              :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              :aria-label="showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              color="neutral"
              variant="ghost"
              size="xs"
              :ui="{ leadingIcon: 'size-4' }"
              @click="showPassword = !showPassword"
            />
          </template>
        </UInput>
      </UFormField>

      <UButton type="submit" size="lg" block class="mt-2" :loading="loading">Ingresar</UButton>
    </UForm>
  </div>
</template>
