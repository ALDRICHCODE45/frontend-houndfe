<script setup lang="ts">
import { useEventListener, useResizeObserver } from '@vueuse/core'
import { nextTick, onMounted, useTemplateRef, watch } from 'vue'
import { scrollOffsetToReveal } from '../utils/animal-groups'

/**
 * A row that wraps on a wide screen and scrolls sideways on a phone. Fades appear only on the side
 * where content is still hidden, and the elements marked `data-reveal` (the selected ones) are
 * brought into view when the row appears and whenever `revealKey` changes.
 */
const props = defineProps<{ revealKey?: string }>()
const row = useTemplateRef<HTMLElement>('row')

function updateFades() {
  const el = row.value
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  el.style.setProperty('--catalog-fade-start', el.scrollLeft > 2 ? '28px' : '0px')
  el.style.setProperty('--catalog-fade-end', el.scrollLeft < max - 2 ? '28px' : '0px')
}

function reveal() {
  const el = row.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  const marked = [...el.querySelectorAll<HTMLElement>('[data-reveal]')]
  const first = marked[0]
  const last = marked[marked.length - 1]
  if (!first || !last) return
  el.scrollLeft = scrollOffsetToReveal({
    start: first.offsetLeft,
    end: last.offsetLeft + last.offsetWidth,
    viewport: el.clientWidth,
  })
  updateFades()
}

onMounted(() => {
  reveal()
  updateFades()
})
watch(
  () => props.revealKey,
  async () => {
    await nextTick()
    reveal()
  },
  { flush: 'post' },
)
useEventListener(row, 'scroll', updateFades, { passive: true })
useResizeObserver(row, updateFades)
</script>

<template>
  <div ref="row" class="catalog-animal-scroll">
    <slot />
  </div>
</template>
