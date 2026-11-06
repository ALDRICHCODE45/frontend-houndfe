<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useTenantSelection } from '@/features/auth/tenant-selection/composables/useTenantSelection'
import TenantSelectionList from '@/features/auth/tenant-selection/components/TenantSelectionList.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import '@/features/auth/styles/auth-visual.css'

const route = useRoute()
const authStore = useAuthStore()
const { tenants, isSubmitting, error, submit, cancel } = useTenantSelection()

const isExpiredFlow = computed(() => route.query.expired === 'tenant')
// Kept from the first render: a failed selection clears the session, and the
// greeting should still name the person instead of falling back to «equipo».
const greetedUser = authStore.user
const userName = computed(() => authStore.user?.name ?? greetedUser?.name ?? 'equipo')
const userEmail = computed(() => authStore.user?.email ?? '')
// The store ends the session when a selection fails on the server or the
// network; nothing here can be chosen any more, only signing in again.
const sessionEnded = computed(() => !authStore.isAuthenticated && !authStore.tempToken)

// Two-stage selection: TenantSelectionList exposes the currently selected
// tenant id via defineExpose. The list fires `select` (highlight) and
// `confirm` (real submit); the parent's job is to wire the "Continuar"
// CTA into `confirm` and gate it on whether something is highlighted.
const listRef = ref<InstanceType<typeof TenantSelectionList> | null>(null)
// Track the selected id locally so the CTA stays reactive without depending
// on the child's exposed ref shape. The list's `select` event feeds this.
const localSelectedId = ref<string | null>(null)
const canContinue = computed(() => !!localSelectedId.value && !isSubmitting.value)

function handleContinue() {
  if (!canContinue.value) return
  listRef.value?.confirm()
}

function handleSelect(tenantId: string) {
  // Mirror the list's internal selection so the CTA can enable/disable
  // synchronously without reaching into the child's internals.
  localSelectedId.value = tenantId
}
</script>

<template>
  <div class="hf-auth-page">
    <div class="hf-auth-card hf-auth-card--wide">
      <div class="hf-auth-head space-y-1">
        <img src="/hounfeLogos/primary.png" alt="HounFe" class="hf-auth-logo mb-4" />
        <h1 class="hf-auth-title">Selecciona tu sucursal</h1>
        <p class="hf-auth-help">Hola, {{ userName }}</p>
      </div>

      <UAlert
        v-if="isExpiredFlow"
        color="warning"
        variant="soft"
        icon="i-lucide-clock-alert"
        title="Tu sesión temporal expiró. Inicia sesión de nuevo para continuar."
      />

      <UAlert
        v-if="error"
        color="error"
        variant="soft"
        icon="i-lucide-triangle-alert"
        :title="error"
        :description="sessionEnded ? 'Tu sesión se cerró. Inicia sesión de nuevo para continuar.' : undefined"
      />

      <TenantSelectionList
        v-if="!sessionEnded"
        ref="listRef"
        :tenants="tenants"
        :is-submitting="isSubmitting"
        @select="handleSelect"
        @confirm="submit"
      />

      <div v-if="sessionEnded" class="flex justify-end">
        <UButton
          color="primary"
          variant="solid"
          class="hf-primary-control"
          icon="i-lucide-log-in"
          @click="cancel"
        >
          Iniciar sesión de nuevo
        </UButton>
      </div>

      <div v-else class="flex items-center justify-between gap-3">
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-log-out"
          :disabled="isSubmitting"
          @click="cancel"
        >
          Cerrar sesión
        </UButton>

        <UButton
          color="primary"
          variant="solid"
          class="hf-primary-control"
          trailing-icon="i-lucide-arrow-right"
          :disabled="!canContinue"
          :loading="isSubmitting"
          data-testid="tenant-continue"
          @click="handleContinue"
        >
          Continuar
        </UButton>
      </div>

      <p v-if="userEmail" class="hf-auth-help text-center">Sesión iniciada como {{ userEmail }}</p>
    </div>
  </div>
</template>
