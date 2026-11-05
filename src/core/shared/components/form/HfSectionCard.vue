<script setup lang="ts">
/**
 * HfSectionCard — One meaningful group of a form: a 16px/600 heading, an
 * optional meta on the right (`Revisada el 4 nov 2026`) and the fields
 * (usually an HfFieldGrid). 24px padding, 16px on mobile. The heading takes
 * programmatic focus (tabindex -1) so HfSectionNav's owner can move focus to
 * it after a jump; the section id is the scroll target.
 *
 * Props:
 *   title         — the group name, sentence case
 *   id            — section element id (HfSectionNav target)
 *   headingLevel  — 2 to 4 (default 3)
 *
 * Slots: default (body), meta (right of the heading)
 */
import { computed, useId } from 'vue'
import './hf-form.css'

const props = withDefaults(defineProps<{
  title: string
  id?: string
  headingLevel?: 2 | 3 | 4
}>(), { id: undefined, headingLevel: 3 })

const headingId = `${props.id ?? useId()}-title`
const headingTag = computed(() => `h${props.headingLevel}`)
</script>

<template>
  <section :id="id" class="hf-section-card" :aria-labelledby="headingId">
    <div class="hf-section-card__head">
      <component :is="headingTag" :id="headingId" class="hf-section-card__title" tabindex="-1">
        {{ title }}
      </component>
      <span v-if="$slots.meta" class="hf-section-card__meta">
        <slot name="meta" />
      </span>
    </div>
    <slot />
  </section>
</template>
