<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import LoginForm from '@/features/auth/login/components/LoginForm.vue'
import LoginHero from '@/features/auth/login/components/LoginHero.vue'
import LoginOtpForm from '@/features/auth/login/components/LoginOtpForm.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { buildCanAccess, canAccessMeta } from '@/app/navigation/navigation.access'
import { resolveLandingDestinationForAuth } from '@/app/navigation/navigation.landing'
import type { AccessMeta } from '@/app/navigation/navigation.types'
import type { LoginFormValues } from '../composables/useLoginForm'

const isLoading = shallowRef(false)
const loginError = shallowRef<string | null>(null)
const now = shallowRef(Date.now())
const otpFormVersion = shallowRef(0)
let viewGeneration = 0
const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const showingOtp = computed(() => Boolean(authStore.otpChallenge) || authStore.otpRestartRequired)
const secondsUntil = (deadline: number) => Math.max(0, Math.ceil((deadline - now.value) / 1000))
const resendSeconds = computed(() => secondsUntil(authStore.otpChallenge?.resendAt ?? 0))
const expiresSeconds = computed(() => secondsUntil(authStore.otpChallenge?.expiresAt ?? 0))
const retrySeconds = computed(() => secondsUntil(authStore.otpRetryAt))
const clock = setInterval(() => {
  now.value = Date.now()
}, 1000)

function restart() {
  viewGeneration++
  isLoading.value = false
  loginError.value = null
  otpFormVersion.value++
  authStore.cancelLogin()
}

onBeforeUnmount(() => {
  clearInterval(clock)
  restart()
})

async function handleLogin(values: LoginFormValues) {
  if (isLoading.value || authStore.loginBusy) return
  const generation = viewGeneration
  isLoading.value = true
  loginError.value = null
  try {
    await authStore.login(values)
    if (generation !== viewGeneration) return
    now.value = Date.now()
  } catch {
    if (generation !== viewGeneration) return
    loginError.value = authStore.authError ?? 'No se pudo iniciar sesión. Verifica credenciales.'
  } finally {
    if (generation === viewGeneration) isLoading.value = false
  }
}

async function handleResend() {
  const generation = viewGeneration
  try {
    const result = await authStore.resendLoginOtp()
    if (generation !== viewGeneration || !result) return
    now.value = Date.now()
    otpFormVersion.value++
  } catch {
    // The store owns generic OTP errors and restart requirements.
  }
}

async function handleVerify(code: string) {
  const generation = viewGeneration
  try {
    const result = await authStore.verifyLoginOtp(code)
    if (generation !== viewGeneration || !result) return
    if (authStore.authPhase === 'needs-tenant-selection') {
      await router.push('/select-tenant')
      return
    }

    // ODD dashboard-analytics D1: explicit safe ?redirect= remains supported
    // — but only when the target resolves to a real application route the
    // authenticated identity may actually enter. Removed paths fall through to
    // the catch-all NotFoundView (name "not-found"); a real-but-forbidden route
    // would be bounced to /403 by the router's beforeEach guard, so we drop it
    // here and let the permission-aware resolver pick the landing destination.
    const explicitRedirect = typeof route.query.redirect === 'string' ? route.query.redirect : null
    const canAccess = buildCanAccess(authStore)
    const explicitTarget = explicitRedirect !== null ? router.resolve(explicitRedirect) : null
    const isAuthorizedExplicitRedirect =
      explicitTarget !== null &&
      explicitTarget.name !== 'not-found' &&
      canAccessMeta(explicitTarget.meta as AccessMeta, canAccess)
    const redirectTo =
      (isAuthorizedExplicitRedirect ? explicitRedirect : null) ??
      resolveLandingDestinationForAuth(authStore)
    await router.push(redirectTo)
  } catch {
    // Store-level errors never expose attempt counts or challenge status.
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
        <img src="/hounfeLogos/primary.png" alt="Coco" class="w-12 h-12 object-contain" />
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

        <LoginOtpForm
          v-if="showingOtp"
          :key="otpFormVersion"
          :loading="authStore.loginBusy"
          :error="authStore.otpError"
          :restart-required="authStore.otpRestartRequired"
          :resend-seconds="resendSeconds"
          :expires-seconds="expiresSeconds"
          :retry-seconds="retrySeconds"
          @verify="handleVerify"
          @resend="handleResend"
          @restart="restart"
        />
        <template v-else>
          <LoginForm :loading="isLoading" @submit="handleLogin" />
          <UButton
            v-if="isLoading"
            type="button"
            color="neutral"
            variant="ghost"
            block
            @click="restart"
          >
            Cancelar
          </UButton>
        </template>
      </div>
    </div>
  </div>
</template>
