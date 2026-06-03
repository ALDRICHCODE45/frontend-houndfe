<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useColorMode } from '@vueuse/core'

const colorMode = useColorMode()

const LIGHT_BG = '#FFF8F0'
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
  <div class="min-h-screen bg-[#FFF8F0] dark:bg-zinc-900">
    <slot />
  </div>
</template>
