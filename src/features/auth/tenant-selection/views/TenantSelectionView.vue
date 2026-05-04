<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useTenantSelection } from '@/features/auth/tenant-selection/composables/useTenantSelection'
import TenantSelectionList from '@/features/auth/tenant-selection/components/TenantSelectionList.vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'

const route = useRoute()
const authStore = useAuthStore()
const { tenants, isSubmitting, error, submit, cancel } = useTenantSelection()

const isExpiredFlow = computed(() => route.query.expired === 'tenant')
const userName = computed(() => authStore.user?.name ?? 'Equipo HoundFe')
</script>

<template>
  <div class="min-h-screen bg-default flex items-center justify-center p-6">
    <div class="w-full max-w-2xl space-y-6">
      <div class="text-center space-y-3">
        <img src="/hounfeLogos/primary.png" alt="HoundFe" class="mx-auto size-12" />
        <div class="space-y-1">
          <p class="text-sm text-muted">Bienvenido, {{ userName }}</p>
          <h1 class="text-2xl font-semibold text-highlighted">Seleccioná tu sucursal</h1>
          <p class="text-sm text-toned">
            Elegí la sucursal con la que querés trabajar en esta sesión.
          </p>
        </div>
      </div>

      <UCard class="border border-default dark:border-white/10 bg-elevated/60 dark:bg-white/[0.04] backdrop-blur-sm">
        <div class="space-y-5">
          <UAlert
            v-if="isExpiredFlow"
            color="warning"
            variant="soft"
            icon="i-lucide-clock-alert"
            title="Tu sesión temporal expiró. Iniciá sesión nuevamente para continuar."
          />

          <UAlert
            v-if="error"
            color="error"
            variant="soft"
            icon="i-lucide-triangle-alert"
            :title="error"
          />

          <TenantSelectionList :tenants="tenants" :is-submitting="isSubmitting" @select="submit" />

          <div class="flex justify-end">
            <UButton color="neutral" variant="ghost" @click="cancel">Cerrar sesión</UButton>
          </div>
        </div>
      </UCard>
    </div>
  </div>
</template>
