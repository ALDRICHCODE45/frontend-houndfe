<script setup lang="ts">
import { computed } from 'vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import { formatShortDateTime } from '@/core/shared/utils/dateTime.utils'
import type { EditorialHistoryChange } from '../../utils/editorial-history-diff'

/** What is saved and how the draft differs from the published version, in plain words: a short
 * timeline, then a two-column comparison of only the fields that changed. Read-only; it never
 * shows cycles, revision numbers or ids.
 */
const props = defineProps<{ hasDraft: boolean; hasPublished: boolean
  /** When this session saved the draft; the server sends no dates, so it is shown only when known. */
  savedAt: Date | null
  changes: readonly EditorialHistoryChange[]
  /** Archived options that were kept in the draft, already written for people. */
  warnings: readonly string[] }>()
const open = defineModel<boolean>('open', { required: true })
const savedText = computed(() => (props.savedAt ? `Guardado el ${formatShortDateTime(props.savedAt)}` : ''))
</script>

<template>
  <USlideover v-model:open="open" side="right" title="Historial" description="Lo que hay guardado y en qué cambia el borrador."
    :close="{ 'aria-label': 'Cerrar historial' }" :ui="{ content: 'hf-theme hf-ui hf-form-overlay editorial-history-portal w-full max-w-xl' }">
    <template #body>
      <div class="history">
        <section aria-labelledby="history-saved-title">
          <h3 id="history-saved-title" class="history__title">Lo que hay guardado</h3>
          <ol class="timeline" data-testid="history-timeline">
            <li v-if="hasDraft" class="timeline__item">
              <span class="timeline__dot" aria-hidden="true" />
              <div class="timeline__body">
                <p class="timeline__name">Borrador <StatusBadge label="Borrador" tone="neutral" aria-prefix="Versión:" /></p>
                <p v-if="savedText" class="timeline__when">{{ savedText }}</p>
              </div>
            </li>
            <li v-if="hasPublished" class="timeline__item">
              <span class="timeline__dot timeline__dot--published" aria-hidden="true" />
              <div class="timeline__body">
                <p class="timeline__name">Versión publicada <StatusBadge label="Publicada" tone="info" aria-prefix="Versión:" /></p>
              </div>
            </li>
          </ol>
        </section>

        <section v-if="hasDraft" aria-labelledby="history-diff-title">
          <h3 id="history-diff-title" class="history__title">Cambios frente a lo publicado</h3>
          <p v-if="!hasPublished" class="history__note">Aún no hay una versión publicada con la que comparar.</p>
          <p v-else-if="!changes.length" class="history__note">El borrador es igual a lo publicado.</p>
          <template v-else>
            <p class="diff-head" data-testid="history-diff-head" aria-hidden="true"><span>Publicado</span><span>Borrador</span></p>
            <ul class="diff" data-testid="history-diff">
              <li v-for="change in changes" :key="change.key" class="diff__row">
                <p class="diff__label">{{ change.label }}</p>
                <div class="diff__cols">
                  <p class="diff__col diff__col--before" data-column="before">
                    <span class="sr-only">Publicado: </span>
                    <template v-if="change.before !== null">{{ change.before }}</template>
                    <template v-else><span aria-hidden="true">—</span><span class="sr-only">Sin dato</span></template>
                  </p>
                  <p class="diff__col diff__col--after" data-column="after">
                    <span class="sr-only">Borrador: </span>
                    <template v-if="change.after !== null">{{ change.after }}</template>
                    <template v-else><span aria-hidden="true">—</span><span class="sr-only">Sin dato</span></template>
                  </p>
                </div>
              </li>
            </ul>
          </template>
        </section>

        <section v-if="warnings.length" aria-labelledby="history-notes-title">
          <h3 id="history-notes-title" class="history__title">Opciones archivadas que se conservaron</h3>
          <ul class="notes"><li v-for="(warning, index) in warnings" :key="index">{{ warning }}</li></ul>
        </section>
      </div>
    </template>
  </USlideover>
</template>

<style scoped>
.history { display: grid; gap: 28px; color: var(--hf-ink); font-family: var(--hf-font); }
.history__title { margin: 0 0 12px; color: var(--hf-heading); font-size: 16px; font-weight: 600; }
.history__note { margin: 0; color: var(--hf-muted); font-size: 14px; }
.timeline { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
.timeline__item { position: relative; display: flex; gap: 14px; padding: 0 0 20px; }
.timeline__item:last-child { padding-bottom: 0; }
.timeline__item:not(:last-child)::before { content: ''; position: absolute; left: 5px; top: 16px; bottom: 0; width: 2px; background: var(--hf-border); }
.timeline__dot { flex: none; width: 12px; height: 12px; margin-top: 5px; border: 2px solid var(--hf-field-border); border-radius: 50%; background: var(--hf-surface); }
.timeline__dot--published { border-color: var(--hf-action); background: var(--hf-action); }
.timeline__body { min-width: 0; }
.timeline__name { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; font-weight: 600; color: var(--hf-heading); }
.timeline__when { margin: 2px 0 0; color: var(--hf-muted); font-size: 13px; }
.diff-head { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0 0 8px; color: var(--hf-muted); font-size: 13px; font-weight: 600; }
.diff { display: grid; gap: 16px; margin: 0; padding: 0; list-style: none; }
.diff__label { margin: 0 0 6px; font-size: 14px; font-weight: 600; color: var(--hf-heading); }
.diff__cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.diff__col { margin: 0; padding: 10px 12px; border-radius: var(--hf-radius-control); font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; white-space: pre-wrap; }
.diff__col--before { background: var(--hf-surface-muted); color: var(--hf-muted); }
.diff__col--after { border: 1px solid var(--hf-border); border-left: 3px solid var(--hf-action); background: var(--hf-surface); color: var(--hf-ink); }
.notes { display: grid; gap: 6px; margin: 0; padding-left: 18px; color: var(--hf-muted); font-size: 13px; list-style: disc; }
</style>
