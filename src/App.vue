<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { es } from '@nuxt/ui/locale'
import DashboardLayout from '@/app/layouts/DashboardLayout.vue'
import AuthLayout from '@/app/layouts/AuthLayout.vue'
import CatalogLayout from '@/app/layouts/CatalogLayout.vue'

const route = useRoute()

const currentLayout = computed(() => {
  const layout = route.meta.layout as string | undefined
  if (layout === 'auth') return 'auth'
  if (layout === 'catalog') return 'catalog'
  return 'dashboard'
})
</script>

<template>
  <UApp :locale="es" class="h-full">
    <DashboardLayout v-if="currentLayout === 'dashboard'" class="h-full">
      <RouterView />
    </DashboardLayout>

    <AuthLayout v-else-if="currentLayout === 'auth'" class="h-full">
      <RouterView />
    </AuthLayout>

    <CatalogLayout v-else-if="currentLayout === 'catalog'" class="h-full">
      <RouterView />
    </CatalogLayout>
  </UApp>
</template>
