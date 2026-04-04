<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMutation } from '@tanstack/vue-query'
import LoginForm from '@/features/auth/login/components/LoginForm.vue'
import LoginHero from '@/features/auth/login/components/LoginHero.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import type { LoginFormValues } from '../composables/useLoginForm'

const isLoading = ref(false)
const loginError = ref<string | null>(null)
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const loginMutation = useMutation({
  mutationFn: (payload: LoginFormValues) => authStore.login(payload),
})

async function handleLogin(values: LoginFormValues) {
  isLoading.value = true
  loginError.value = null

  try {
    await loginMutation.mutateAsync(values)

    const redirectTo = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.push(redirectTo)
  } catch {
    loginError.value = 'No se pudo iniciar sesión. Verificá credenciales.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="relative h-full w-full flex overflow-hidden bg-white dark:bg-neutral-950">
    <!-- Left Side: Hero / Brand -->
    <div class="hidden lg:flex lg:w-1/2 relative overflow-hidden">
      <LoginHero />
    </div>

    <!-- Right Side: Login Form -->
    <div
      class="relative w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 overflow-y-auto"
    >
      <!-- Mobile logo (visible only on small screens) -->
      <div class="absolute top-8 left-8 lg:hidden">
        <img src="/hounfeLogos/primary.png" alt="HoundFe" class="w-12 h-12 object-contain" />
      </div>

      <div class="w-full max-w-sm">
        <UAlert
          v-if="loginError"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="loginError"
          class="mb-4"
        />

        <LoginForm :loading="isLoading" @submit="handleLogin" />
      </div>
    </div>
  </div>
</template>
