<script setup lang="ts">
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type { EditorialTableRow } from '../../utils/editorial-attribute-table'

/** The name of a row of the attribute table, with its Interno marker and help, shared by the table and the mobile cards. */
defineProps<{ row: Pick<EditorialTableRow, 'code' | 'label' | 'internal' | 'description'> }>()
</script>

<template>
  <span class="hf-attr-name">
    {{ row.label }}
    <StatusBadge v-if="row.internal" label="Interno" tone="neutral" aria-label="Interno, no se muestra al público" title="No se muestra al público" data-testid="internal-chip" />
    <template v-if="row.description">
      <UPopover :content="{ side: 'bottom', align: 'start' }" :ui="{ content: 'hf-theme hf-ui hf-attr-table__help-popover' }">
        <button type="button" class="hf-attr-name__help" data-testid="row-help" :aria-label="`Qué es ${row.label}`" :aria-describedby="`attr-${row.code}-help`">
          <UIcon name="i-lucide-info" class="size-4" aria-hidden="true" />
        </button>
        <template #content>
          <p class="hf-attr-name__help-text" data-testid="row-help-content">{{ row.description }}</p>
        </template>
      </UPopover>
      <span :id="`attr-${row.code}-help`" hidden>{{ row.description }}</span>
    </template>
  </span>
</template>

<style scoped>
.hf-attr-name { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.hf-attr-name__help { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--hf-muted); cursor: pointer; }
.hf-attr-name__help:hover { background: var(--hf-surface-muted); color: var(--hf-ink); }
.hf-attr-name__help:focus-visible { outline: 2px solid var(--hf-focus); outline-offset: 2px; }
.hf-attr-name__help-text { max-width: min(20rem, 86vw); margin: 0; padding: 12px; color: var(--hf-ink); font-size: 14px; line-height: 1.45; }
</style>
