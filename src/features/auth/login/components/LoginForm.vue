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
  <div class="space-y-10 animate-fade-in">
    <!-- Header -->
    <div class="space-y-2">
      <h2 class="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50">
        Iniciar sesi&oacute;n
      </h2>
      <p class="text-sm text-neutral-500 dark:text-neutral-400">
        Ingres&aacute; tus credenciales para continuar
      </p>
    </div>

    <!-- Form -->
    <UForm class="space-y-5" :schema="schema" :state="state" @submit="handleSubmit">
      <!-- Email -->
      <UFormField
        label="Email"
        name="email"
        class="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
      >
        <UInput
          id="email"
          v-model="state.email"
          type="email"
          placeholder="tu@email.com"
          size="lg"
          class="w-full"
          :disabled="loading"
        />
      </UFormField>

      <!-- Password -->
      <UFormField
        label="Contraseña"
        name="password"
        class="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
      >
        <UInput
          id="password"
          v-model="state.password"
          :type="showPassword ? 'text' : 'password'"
          placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
          size="lg"
          class="w-full"
          :disabled="loading"
        >
          <template #trailing>
            <UButton
              :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
              color="neutral"
              variant="ghost"
              size="xs"
              :ui="{ leadingIcon: 'size-4' }"
              @click="showPassword = !showPassword"
            />
          </template>
        </UInput>
      </UFormField>

      <!-- Submit Button -->
      <div class="pt-2">
        <UButton
          type="submit"
          size="lg"
          block
          :loading="loading"
          class="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-neutral-950 font-semibold shadow-sm cursor-pointer transition-colors duration-150"
        >
          Ingresar
        </UButton>
      </div>
    </UForm>
  </div>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.5s ease-out;
}
</style>
