<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useColorMode } from '@vueuse/core'

const colorMode = useColorMode()

/** Cool near-white page base. The catalog identity is cobalt, never a warm cream. */
const LIGHT_BG = '#F4F6FB'
const DARK_BG = '#18181b' // zinc-900

function applyBg() {
  const bg = colorMode.value === 'dark' ? DARK_BG : LIGHT_BG
  document.documentElement.style.backgroundColor = bg
  document.body.style.backgroundColor = bg
}

watch(() => colorMode.value, applyBg)

onMounted(() => {
  applyBg()
})

onUnmounted(() => {
  document.documentElement.style.backgroundColor = ''
  document.body.style.backgroundColor = ''
})
</script>

<template>
  <div class="min-h-dvh bg-[#F4F6FB] dark:bg-zinc-900">
    <slot />
  </div>
</template>
