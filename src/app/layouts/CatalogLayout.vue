<script lang="ts">
// Module scope: shared by every CatalogLayout instance (see the boundary note below).
interface HostState {
  owners: number
  htmlBackground: string
  bodyBackground: string
  theme: string | null
}

const host: HostState = { owners: 0, htmlBackground: '', bodyBackground: '', theme: null }
</script>

<script setup lang="ts">
import { onBeforeMount, onUnmounted } from 'vue'
import '@/features/catalog/styles/catalog.css'

/*
 * The body boundary also covers Nuxt UI portals, without changing the user's theme.
 *
 * Every light token of the catalog hangs on `body[data-catalog-theme='light']`, so the boundary
 * must exist before the first paint and must survive overlapping layout instances: a remount
 * (route change or hot reload) can mount the new layout before the old one unmounts, and the
 * old teardown used to strip the attribute from the live page, turning cards and skeletons dark.
 * Instances therefore share one owner count; only the last one out restores the host state.
 */
const background = '#F5F6F8'
const ownedBackground = 'rgb(245, 246, 248)'

onBeforeMount(() => {
  if (host.owners === 0) {
    host.htmlBackground = document.documentElement.style.backgroundColor
    host.bodyBackground = document.body.style.backgroundColor
    host.theme = document.body.getAttribute('data-catalog-theme')
  }
  host.owners += 1
  document.body.setAttribute('data-catalog-theme', 'light')
  document.documentElement.style.backgroundColor = background
  document.body.style.backgroundColor = background
})

onUnmounted(() => {
  host.owners = Math.max(0, host.owners - 1)
  if (host.owners > 0) return
  if (host.theme === null) document.body.removeAttribute('data-catalog-theme')
  else document.body.setAttribute('data-catalog-theme', host.theme)
  // Do not overwrite a newer owner's background during a route transition.
  if (document.documentElement.style.backgroundColor === ownedBackground)
    document.documentElement.style.backgroundColor = host.htmlBackground
  if (document.body.style.backgroundColor === ownedBackground)
    document.body.style.backgroundColor = host.bodyBackground
})
</script>

<template>
  <div class="catalog-layout min-h-dvh">
    <slot />
  </div>
</template>
