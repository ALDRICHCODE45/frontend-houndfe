<script setup lang="ts">
/**
 * SettingsSideIndex — the in-page index (design 01): one link per section in PUT order, with a dot when
 * the section has changes and a red count when it has fields to fix. Below 1100 px it is a row of chips
 * (styles). Plain anchors: it only scrolls, it never owns state.
 */
export interface SideIndexEntry {
  id: string
  label: string
  icon: string
  dirty: boolean
  errors: number
}

defineProps<{ sections: readonly SideIndexEntry[] }>()
const emit = defineEmits<{ navigate: [id: string] }>()
</script>

<template>
  <nav class="cbs-index" aria-label="Secciones de esta pantalla" data-testid="side-index">
    <ul>
      <li v-for="section in sections" :key="section.id">
        <a :href="`#sec-${section.id}`" :data-testid="`index-${section.id}`" @click.prevent="emit('navigate', `sec-${section.id}`)">
          <UIcon :name="section.icon" class="size-4" aria-hidden="true" />
          {{ section.label }}
          <span
            v-if="section.errors"
            class="cbs-index__count"
            :aria-label="`${section.errors} ${section.errors === 1 ? 'campo por corregir' : 'campos por corregir'}`"
          >
            {{ section.errors }}
          </span>
          <span v-else-if="section.dirty" class="cbs-index__dot" aria-label="Modificado" />
        </a>
      </li>
    </ul>
  </nav>
</template>
