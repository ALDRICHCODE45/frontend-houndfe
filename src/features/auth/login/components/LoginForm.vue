<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  email: string
  password: string
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:email': [value: string]
  'update:password': [value: string]
  submit: []
}>()

const showPassword = ref(false)

const emailValue = computed({
  get: () => props.email,
  set: (value) => emit('update:email', value),
})

const passwordValue = computed({
  get: () => props.password,
  set: (value) => emit('update:password', value),
})

function handleSubmit() {
  emit('submit')
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
    <form class="space-y-5" @submit.prevent="handleSubmit">
      <!-- Email -->
      <div class="space-y-1.5">
        <label
          for="email"
          class="block text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
        >
          Email
        </label>
        <UInput
          id="email"
          v-model="emailValue"
          type="email"
          placeholder="tu@email.com"
          size="lg"
          class="w-full"
          required
          :disabled="loading"
        />
      </div>

      <!-- Password -->
      <div class="space-y-1.5">
        <label
          for="password"
          class="block text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
        >
          Contrase&ntilde;a
        </label>
        <UInput
          id="password"
          v-model="passwordValue"
          :type="showPassword ? 'text' : 'password'"
          placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
          size="lg"
          class="w-full"
          required
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
      </div>

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
    </form>
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
