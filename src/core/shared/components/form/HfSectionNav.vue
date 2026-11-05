<script setup lang="ts">
/**
 * HfSectionNav — The sticky index of a long form's sections. Each entry says
 * whether its section is complete (a check, `Completo` for assistive tech) or
 * how much is left (`falta N` in `--hf-warning`). A click scrolls to `#id`
 * (smooth, or instant under reduced motion), focuses nothing on its own and
 * marks the entry current; while scrolling, an IntersectionObserver keeps the
 * section in view current (scroll-spy).
 *
 * From md it is a vertical list beside the cards (sticky); below md it becomes
 * a horizontal, scrollable row of chips stuck to the top of the scroller.
 *
 * Props:
 *   sections  — { id, label, missing }[] in page order (`id` is the section element id)
 *   label     — aria-label of the nav (default `Secciones`)
 *   root      — scroll container for the observer (default: the viewport)
 *
 * Events:
 *   navigate(id) — an entry was clicked; the owner may move focus to the section heading
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import './hf-form.css'

export interface HfSection {
  id: string
  label: string
  missing: number
}

const props = withDefaults(defineProps<{
  sections: readonly HfSection[]
  label?: string
  root?: HTMLElement | null
}>(), { label: 'Secciones', root: null })

const emit = defineEmits<{ navigate: [id: string] }>()

const current = ref(props.sections[0]?.id ?? '')
// A click scrolls through the sections in between; hold the spy until it lands.
let lockedUntil = 0
let observer: IntersectionObserver | null = null
const visible = new Set<string>()

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function onClick(event: MouseEvent, id: string) {
  const target = document.getElementById(id)
  if (!target) return
  event.preventDefault()
  lockedUntil = Date.now() + 700
  current.value = id
  target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  emit('navigate', id)
}

function onIntersect(entries: Partial<IntersectionObserverEntry>[]) {
  for (const entry of entries) {
    const id = (entry.target as Element | undefined)?.id
    if (!id) continue
    if (entry.isIntersecting) visible.add(id)
    else visible.delete(id)
  }
  if (Date.now() < lockedUntil) return
  // The first section (in page order) that is in the upper band is current.
  const first = props.sections.find(section => visible.has(section.id))
  if (first) current.value = first.id
}

function observe() {
  observer?.disconnect()
  visible.clear()
  if (typeof IntersectionObserver === 'undefined') return
  observer = new IntersectionObserver(onIntersect, { root: props.root, rootMargin: '0px 0px -60% 0px', threshold: 0 })
  for (const section of props.sections) {
    const element = document.getElementById(section.id)
    if (element) observer.observe(element)
  }
}

onMounted(observe)
watch(() => [props.sections.map(section => section.id).join('|'), props.root], observe, { flush: 'post' })
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <nav class="hf-section-nav" :aria-label="label">
    <ol class="hf-section-nav__list">
      <li v-for="section in sections" :key="section.id">
        <a
          class="hf-section-nav__link"
          :href="`#${section.id}`"
          :aria-current="section.id === current ? 'true' : undefined"
          @click="onClick($event, section.id)"
        >
          <span class="hf-section-nav__name">{{ section.label }}</span>
          <span v-if="section.missing > 0" class="hf-section-nav__missing">falta {{ section.missing }}</span>
          <span v-else class="hf-section-nav__ok">
            <UIcon name="i-lucide-check" class="hf-section-nav__ok-icon" aria-hidden="true" />
            <span class="sr-only">Completo</span>
          </span>
        </a>
      </li>
    </ol>
  </nav>
</template>
