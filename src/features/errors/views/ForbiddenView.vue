<script setup lang="ts">
import { useRouter } from 'vue-router'
import EmptyState from '@/core/shared/components/EmptyState.vue'

const router = useRouter()

function goHome() {
  void router.replace('/')
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-2 p-4">
    <EmptyState
      kind="forbidden"
      title="Tu rol no tiene acceso a esta página"
      description="Si lo necesitas, pide acceso a un administrador."
      action-label="Ir al inicio"
      action-variant="solid"
      @action="goHome"
    />
    <UButton label="Volver" color="neutral" variant="ghost" @click="goBack" />
  </div>
</template>
