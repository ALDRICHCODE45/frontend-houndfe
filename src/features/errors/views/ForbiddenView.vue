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
      <h1 class="text-6xl font-bold text-muted">403</h1>
      <h2 class="text-xl font-semibold">Acceso denegado</h2>
      <p class="text-muted max-w-md">
        No tenés permisos para acceder a esta página. Contactá al administrador si creés que es un
        error.
      </p>
      <div class="flex justify-center gap-3 pt-2">
        <UButton label="Volver" color="neutral" variant="outline" @click="goBack" />
        <UButton label="Ir al inicio" @click="goHome" />
      </div>
    </div>
  </div>
</template>
