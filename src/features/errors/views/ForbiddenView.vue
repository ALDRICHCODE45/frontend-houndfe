<script setup lang="ts">
import { useRouter } from 'vue-router'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import '../styles/errors-visual.css'

const router = useRouter()

function goHome() {
  void router.replace('/')
}

function goBack() {
  router.back()
}
</script>

<template>
  <main class="hf-error-page">
    <div class="hf-error-card">
      <img src="/hounfeLogos/primary.png" alt="HounFe" class="hf-error-logo" />
      <EmptyState
        kind="forbidden"
        title="Tu rol no tiene acceso a esta página"
        description="Si lo necesitas, pide acceso a un administrador."
      />
      <div class="hf-error-actions">
        <UButton
          label="Volver"
          color="neutral"
          variant="outline"
          data-testid="error-back"
          @click="goBack"
        />
        <UButton
          label="Ir al inicio"
          color="primary"
          class="hf-primary-control"
          data-testid="error-home"
          @click="goHome"
        />
      </div>
    </div>
  </main>
</template>
