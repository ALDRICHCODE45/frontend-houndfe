<script setup lang="ts">
import { ref, onMounted } from 'vue'

const isVisible = ref(false)

onMounted(() => {
  setTimeout(() => {
    isVisible.value = true
  }, 50)
})
</script>

<template>
  <div
    class="relative w-full h-full bg-neutral-950 overflow-hidden flex items-center justify-center"
  >
    <!-- Subtle radial glow behind the logo -->
    <div
      class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(245,166,35,0.06)_0%,_transparent_70%)]"
    />

    <!-- Minimal grain texture overlay -->
    <div class="absolute inset-0 opacity-[0.03] mix-blend-overlay noise-bg" />

    <!-- Content -->
    <div
      class="relative z-10 flex flex-col items-center gap-10 transition-all duration-700 ease-out"
      :class="isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'"
    >
      <!-- Logo -->
      <div class="relative">
        <img
          src="/hounfeLogos/primary.png"
          alt="HounFe"
          class="w-44 h-44 object-contain drop-shadow-[0_0_40px_rgba(245,166,35,0.12)]"
        />
      </div>

      <!-- Wordmark -->
      <div class="text-center space-y-3">
        <h1 class="text-4xl font-bold tracking-tight text-white">
          Houn<span class="text-amber-400">Fe</span>
        </h1>
        <p class="text-sm text-neutral-500 font-light tracking-widest uppercase">
          Sistema de Gesti&oacute;n Interna
        </p>
      </div>
    </div>

    <!-- Bottom accent line -->
    <div
      class="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"
    />
  </div>
</template>

<style scoped>
.noise-bg {
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  background-size: 128px 128px;
}
</style>
