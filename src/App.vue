<script setup lang="ts">
import DashboardLayout from '@/app/layouts/DashboardLayout.vue'
</script>

<template>
  <UApp class="h-full">
    <DashboardLayout class="h-full">
      <RouterView />
    </DashboardLayout>
  </UApp>
</template>
