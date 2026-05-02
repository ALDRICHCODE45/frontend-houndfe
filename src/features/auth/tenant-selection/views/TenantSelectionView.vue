<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useTenantSelection } from '@/features/auth/tenant-selection/composables/useTenantSelection'
import TenantSelectionList from '@/features/auth/tenant-selection/components/TenantSelectionList.vue'

const route = useRoute()
const { tenants, isSubmitting, error, submit, cancel } = useTenantSelection()

const isExpiredFlow = computed(() => route.query.expired === 'tenant')
</script>

<template>
  <div class="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-6">
    <UCard class="w-full max-w-2xl">
      <div class="space-y-5">
        <div class="space-y-1">
          <h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            Seleccioná tu sucursal
          </h1>
          <p class="text-sm text-neutral-500 dark:text-neutral-400">
            Elegí la sucursal con la que querés trabajar en esta sesión.
          </p>
        </div>

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
</template>
