<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore } from '@/features/auth/stores/useAuthStore'
import HumanDecisionsOfflineDemoView from './HumanDecisionsOfflineDemoView.vue'

const authStore = useAuthStore()
const tenantName = computed(() => authStore.currentTenant?.name.trim() ?? '')
const resolverName = computed(() => authStore.user?.name.trim() || 'Responsable de demostración')
const canUpdate = computed(() => authStore.userCan('update', 'HumanDecision'))
</script>

<template>
  <HumanDecisionsOfflineDemoView
    v-if="tenantName"
    :can-update="canUpdate"
    :tenant-name="tenantName"
    :resolver-name="resolverName"
  />
  <section v-else role="alert" class="p-6 text-sm text-error">
    Selecciona una sucursal antes de abrir la simulación.
  </section>
</template>
