<script setup lang="ts">
/**
 * SettingsSection — the card of one section (design 01): title, one line of description, the section's
 * «Modificado» / «campos por corregir» badges and the body. The id (`sec-<name>`) is the target of the side index.
 */
import { plural } from '../utils/settingsLabels'

defineProps<{
  id: string
  title: string
  description: string
  dirty: boolean
  errors: number
}>()
</script>

<template>
  <section :id="`sec-${id}`" class="cbs-sec" :aria-labelledby="`h-${id}`" :data-testid="`section-${id}`">
    <header class="cbs-sec__head">
      <div class="cbs-sec__title">
        <h2 :id="`h-${id}`" tabindex="-1">{{ title }}</h2>
        <p class="cbs-help">{{ description }}</p>
      </div>
      <div class="cbs-sec__badges">
        <slot name="tag" />
        <span v-if="errors" class="cbs-badge" data-tone="danger" :data-testid="`errors-${id}`">
          {{ plural(errors, 'campo por corregir', 'campos por corregir') }}
        </span>
        <span v-if="dirty" class="cbs-badge" data-tone="info" :data-testid="`dirty-${id}`">Modificado</span>
      </div>
    </header>
    <slot />
  </section>
</template>
