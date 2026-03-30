<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import DashboardLayout from '@/app/layouts/DashboardLayout.vue'
import AuthLayout from '@/app/layouts/AuthLayout.vue'

const route = useRoute()

const currentLayout = computed(() => {
  const layout = route.meta.layout as string | undefined
  return layout === 'auth' ? 'auth' : 'dashboard'
})
</script>

<template>
  <UApp class="h-full">
    <DashboardLayout v-if="currentLayout === 'dashboard'" class="h-full">
      <RouterView />
    </DashboardLayout>

    <AuthLayout v-else-if="currentLayout === 'auth'" class="h-full">
      <RouterView />
    </AuthLayout>
  </UApp>
</template>
