<script lang="ts">
import type { EditorialReadinessItem } from '../../interfaces/editorial-contract-readiness.types'

export const EDITORIAL_PUBLISH_CHECKLIST_ID = 'editorial-publish-checklist'
export type EditorialChecklistEntry = { key: string; item: EditorialReadinessItem
  /** The field the item is about, when it is on the page: the link says «Ir a {label}». */
  label: string | null }
</script>

<script setup lang="ts">

/** Issue checklist (design-system.md) of what the backend says is missing to publish the SAVED draft.
 * Product, presentation and care items first, then the data, each with the backend's own message.
 * With unsaved edits it says the list is from the last save, since readiness never sees the buffer.
 */
defineProps<{ entries: readonly EditorialChecklistEntry[]; stale: boolean }>()
const emit = defineEmits<{ goto: [item: EditorialReadinessItem] }>()
</script>

<template>
  <div :id="EDITORIAL_PUBLISH_CHECKLIST_ID" class="publish-checklist" data-testid="publish-checklist">
    <p v-if="stale" class="publish-checklist__stale">
      <UIcon name="i-lucide-save" aria-hidden="true" />Según lo último que guardaste
    </p>
    <ul aria-label="Pendientes para publicar">
      <li v-for="entry in entries" :key="entry.key">
        <UIcon name="i-lucide-triangle-alert" class="publish-checklist__icon" aria-hidden="true" />
        <span class="publish-checklist__message">{{ entry.item.message }}</span>
        <button v-if="entry.label" type="button" class="publish-checklist__link" @click="emit('goto', entry.item)">Ir a {{ entry.label }}</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.publish-checklist { display: grid; gap: 8px; padding: 12px 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface-muted); font-size: 13px; }
.publish-checklist ul { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.publish-checklist li { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; min-width: 0; color: var(--hf-warning); font-weight: 600; }
.publish-checklist__icon { flex-shrink: 0; width: 16px; height: 16px; }
.publish-checklist__message { min-width: 0; overflow-wrap: anywhere; }
.publish-checklist__stale { display: flex; align-items: center; gap: 6px; margin: 0; color: var(--hf-muted); font-weight: 600; }
.publish-checklist__link { min-height: 0; margin-left: 4px; padding: 0; border: 0; background: none; color: var(--hf-action); font: inherit; font-weight: 600; text-decoration: underline; text-underline-offset: 2px; cursor: pointer; }
.publish-checklist__link:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; border-radius: 2px; }
</style>
