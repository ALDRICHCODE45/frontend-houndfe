<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import '@/features/catalog/styles/catalog.css'

// The body boundary also covers Nuxt UI portals, without changing the user's theme.
let previousHtmlBackground = ''
let previousBodyBackground = ''
let previousTheme: string | null = null
const background = '#F5F6F8'

onMounted(() => {
  previousHtmlBackground = document.documentElement.style.backgroundColor
  previousBodyBackground = document.body.style.backgroundColor
  previousTheme = document.body.getAttribute('data-catalog-theme')
  document.body.setAttribute('data-catalog-theme', 'light')
  document.documentElement.style.backgroundColor = background
  document.body.style.backgroundColor = background
})

onUnmounted(() => {
  if (previousTheme === null) document.body.removeAttribute('data-catalog-theme')
  else document.body.setAttribute('data-catalog-theme', previousTheme)
  // Do not overwrite a newer owner's background during a route transition.
  if (document.documentElement.style.backgroundColor === 'rgb(245, 246, 248)')
    document.documentElement.style.backgroundColor = previousHtmlBackground
  if (document.body.style.backgroundColor === 'rgb(245, 246, 248)')
    document.body.style.backgroundColor = previousBodyBackground
})
</script>

<template>
  <div class="catalog-layout min-h-dvh">
    <slot />
  </div>
</template>
