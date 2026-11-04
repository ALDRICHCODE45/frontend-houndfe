<script setup lang="ts">
import { computed } from 'vue'
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
                <p class="timeline__name">Borrador</p>
                <p class="timeline__what">Lo que guardas con «Guardar». Aún no se ve en el catálogo.</p>
                <p v-if="savedText" class="timeline__when">{{ savedText }}</p>
              </div>
            </li>
            <li v-if="hasPublished" class="timeline__item">
              <span class="timeline__dot timeline__dot--published" aria-hidden="true" />
              <div class="timeline__body">
                <p class="timeline__name">Versión publicada</p>
                <p class="timeline__what">Lo que verá el catálogo.</p>
              </div>
            </li>
          </ol>
        </section>

        <section v-if="hasDraft" aria-labelledby="history-diff-title">
          <h3 id="history-diff-title" class="history__title">Cambios frente a lo publicado</h3>
          <div v-if="!hasPublished" class="history__empty" data-testid="history-empty">
            <UIcon name="i-lucide-git-compare" class="history__empty-icon" aria-hidden="true" />
            <p>Aún no hay una versión publicada con la que comparar.</p>
            <p class="history__empty-hint">Cuando la haya, aquí verás en qué cambia tu borrador.</p>
          </div>
          <div v-else-if="!changes.length" class="history__empty" data-testid="history-empty">
            <UIcon name="i-lucide-check" class="history__empty-icon" aria-hidden="true" />
            <p>El borrador es igual a lo publicado.</p>
          </div>
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
.history { display: grid; gap: 32px; color: var(--hf-ink); font-family: var(--hf-font); }
.history__title { margin: 0 0 12px; color: var(--hf-heading); font-size: 14px; font-weight: 600; }
.history__empty { display: grid; justify-items: start; gap: 4px; margin: 0; padding: 16px; border: 1px dashed var(--hf-field-border); border-radius: var(--hf-radius-card); background: var(--hf-surface-muted); color: var(--hf-ink); font-size: 14px; }
.history__empty p { margin: 0; }
.history__empty-icon { width: 20px; height: 20px; margin-bottom: 4px; color: var(--hf-muted); }
.history__empty-hint { color: var(--hf-muted); font-size: 13px; }
.timeline { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); }
.timeline__item { display: flex; gap: 12px; padding: 14px 16px; }
.timeline__item + .timeline__item { border-top: 1px solid var(--hf-border); }
.timeline__dot { flex: none; width: 10px; height: 10px; margin-top: 6px; border: 2px solid var(--hf-field-border); border-radius: 50%; background: var(--hf-surface); }
.timeline__dot--published { border-color: var(--hf-action); background: var(--hf-action); }
.timeline__body { display: grid; gap: 2px; min-width: 0; }
.timeline__body p { margin: 0; }
.timeline__name { font-weight: 600; color: var(--hf-heading); }
.timeline__what { color: var(--hf-ink); font-size: 14px; }
.timeline__when { color: var(--hf-muted); font-size: 13px; }
.diff-head { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 0 0 8px; padding: 0 16px; color: var(--hf-muted); font-size: 13px; font-weight: 600; }
.diff { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.diff__row { padding: 12px 16px 16px; border: 1px solid var(--hf-border); border-radius: var(--hf-radius-card); background: var(--hf-surface); }
.diff__label { margin: 0 0 8px; font-size: 14px; font-weight: 600; color: var(--hf-heading); }
.diff__cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.diff__col { margin: 0; padding: 10px 12px; border-radius: var(--hf-radius-control); font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; white-space: pre-wrap; }
.diff__col--before { background: var(--hf-surface-muted); color: var(--hf-muted); }
.diff__col--after { border: 1px solid var(--hf-border); border-left: 3px solid var(--hf-action); background: var(--hf-surface); color: var(--hf-ink); }
.notes { display: grid; gap: 6px; margin: 0; padding-left: 18px; color: var(--hf-muted); font-size: 13px; list-style: disc; }
</style>
