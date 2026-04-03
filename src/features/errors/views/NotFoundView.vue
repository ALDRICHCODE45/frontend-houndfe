<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

function goHome() {
  void router.push('/')
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center p-4">
    <div class="text-center space-y-4">
      <h1 class="text-6xl font-bold text-muted">404</h1>
      <h2 class="text-xl font-semibold">Página no encontrada</h2>
      <p class="text-muted max-w-md">La página que buscás no existe o fue movida.</p>
      <div class="flex justify-center gap-3 pt-2">
        <UButton label="Volver" color="neutral" variant="outline" @click="goBack" />
        <UButton label="Ir al inicio" @click="goHome" />
      </div>
    </div>
  </div>
</template>
