<script setup lang="ts">
import { es } from '@nuxt/ui/locale'
</script>

<template>
  <UApp :locale="es" class="h-full">
    <div class="h-full w-full overflow-hidden">
      <slot />
    </div>
  </UApp>
</template>
