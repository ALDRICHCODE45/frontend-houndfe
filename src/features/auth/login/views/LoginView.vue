<script setup lang="ts">
import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import LoginForm from '@/features/auth/login/components/LoginForm.vue'
import LoginOtpForm from '@/features/auth/login/components/LoginOtpForm.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import { buildCanAccess, canAccessMeta } from '@/app/navigation/navigation.access'
import { resolveLandingDestinationForAuth } from '@/app/navigation/navigation.landing'
import type { AccessMeta } from '@/app/navigation/navigation.types'
import type { LoginFormValues } from '../composables/useLoginForm'
import '@/features/auth/styles/auth-visual.css'

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
    const result = await authStore.login(values)
    if (generation !== viewGeneration || !result) return
    now.value = Date.now()
    if ('requiresTenantSelection' in result) await navigateAfterLogin()
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
    await navigateAfterLogin()
  } catch {
    // Store-level errors never expose attempt counts or challenge status.
  }
}

async function navigateAfterLogin() {
  if (authStore.authPhase === 'needs-tenant-selection') {
    await router.push('/select-tenant')
    return
  }
  if (authStore.authPhase !== 'authenticated') return

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
}
</script>

<template>
  <div class="hf-auth-page">
    <div class="hf-auth-card">
      <!-- Cancelar lives in the card's corner: it appears while signing in without adding a row. -->
      <UButton
        v-if="isLoading && !showingOtp"
        type="button"
        color="neutral"
        variant="ghost"
        size="xs"
        class="hf-auth-cancel"
        data-testid="login-cancel"
        @click="restart"
      >
        Cancelar
      </UButton>

      <img src="/hounfeLogos/primary.png" alt="HounFe" class="hf-auth-logo" />

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
      <LoginForm v-else :loading="isLoading" @submit="handleLogin">
        <!-- The failure notice sits inside the card, above Ingresar; the live region is always present so it is announced. -->
        <template #feedback>
          <div data-testid="login-feedback" class="hf-auth-feedback" aria-live="assertive">
            <UAlert
              v-if="loginError"
              color="error"
              variant="subtle"
              icon="i-lucide-triangle-alert"
              :title="loginError"
            />
          </div>
        </template>
      </LoginForm>
    </div>
  </div>
</template>
