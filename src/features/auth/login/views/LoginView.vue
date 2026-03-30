<script setup lang="ts">
import { ref } from 'vue'
import LoginForm from '@/features/auth/login/components/LoginForm.vue'
import LoginHero from '@/features/auth/login/components/LoginHero.vue'

const email = ref('')
const password = ref('')
const isLoading = ref(false)

async function handleLogin() {
  isLoading.value = true
  // TODO: Implement actual login logic
  await new Promise((resolve) => setTimeout(resolve, 1500))
  isLoading.value = false
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
        <img src="/hounfeLogos/primary.png" alt="HounFe" class="w-12 h-12 object-contain" />
      </div>

      <div class="w-full max-w-sm">
        <LoginForm
          v-model:email="email"
          v-model:password="password"
          :loading="isLoading"
          @submit="handleLogin"
        />
      </div>
    </div>
  </div>
</template>
