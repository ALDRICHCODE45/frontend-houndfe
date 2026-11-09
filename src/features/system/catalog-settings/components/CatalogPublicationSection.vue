<script setup lang="ts">
/**
 * CatalogPublicationSection — «Publicación» (artboard 01): one whole-row switch
 * «Catálogo publicado» (board 04 pattern 1, `role="switch"`, label and
 * description are part of the target) and the effective-status line under it.
 *
 * Status line precedence follows the artboard: publication off → muted; no
 * public list → warning; accepted server state not effective → warning with the
 * first closed-set server warning (or the tenant explanation); otherwise
 * success with the list count and the default. Server warnings describe the
 * accepted state, so they only apply while the draft is clean; a dirty draft
 * prefixes «Al guardar:». Read-only mode shows the accepted value as a badge.
 *
 * A second switch row under the status line, «Mostrar solo productos con
 * ficha publicada» (C3.3), mirrors catalogRequiresPublishedEditorial; the page
 * asks with the go-live checklist when it turns on at save time.
 */
import { computed, useId } from 'vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'

const props = withDefaults(
  defineProps<{
    published: boolean
    publishedOnly: boolean
    publicCount: number
    defaultName: string | null
    effectivePublication: boolean
    /** Closed-set server warnings, already mapped to Spanish copy. */
    warnings: string[]
    dirty?: boolean
    readonly?: boolean
  }>(),
  { dirty: false, readonly: false },
)

const emit = defineEmits<{
  (event: 'toggle'): void
  (event: 'toggle-published-only'): void
}>()

const headingId = useId()
const titleId = useId()
const descriptionId = useId()
const publishedOnlyTitleId = useId()
const publishedOnlyDescriptionId = useId()

type StatusTone = 'success' | 'warning' | 'muted'

const status = computed<{ tone: StatusTone; lead: string; text: string; meta?: string }>(() => {
  if (!props.published) {
    return {
      tone: 'muted',
      lead: 'No visible:',
      text: 'la publicación está desactivada.',
      meta: 'Tus clientes no pueden abrir el catálogo.',
    }
  }
  if (props.publicCount === 0) {
    return { tone: 'warning', lead: 'No visible:', text: 'no hay listas de precios públicas.' }
  }
  if (!props.dirty && !props.effectivePublication) {
    const reason =
      props.warnings[0] ?? 'la publicación efectiva también depende del estado del tenant'
    return { tone: 'warning', lead: 'No visible:', text: `${reason}.` }
  }
  if (!props.dirty && props.warnings.length > 0) {
    return { tone: 'warning', lead: 'Visible con avisos:', text: `${props.warnings[0]}.` }
  }
  const lists = props.publicCount === 1 ? '1 lista de precios' : `${props.publicCount} listas de precios`
  const first = props.defaultName ? `; se muestra primero ${props.defaultName}` : ''
  return { tone: 'success', lead: 'Visible para el público', text: '', meta: `· ${lists}${first}.` }
})

/** Further warnings beyond the one the line leads with. */
const extraWarnings = computed(() => (props.dirty ? [] : props.warnings.slice(1)))

const statusIcon = computed(
  () =>
    ({
      success: 'i-lucide-circle-check',
      warning: 'i-lucide-triangle-alert',
      muted: 'i-lucide-eye-off',
    })[status.value.tone],
)
</script>

<template>
  <section class="cs-group" :aria-labelledby="headingId" data-testid="publication-card">
    <div class="cs-group-head">
      <h2 :id="headingId" class="cs-group-title">Publicación</h2>
    </div>
    <div class="cs-surface">
      <button
        v-if="!props.readonly"
        type="button"
        role="switch"
        class="cs-switch-row"
        :aria-checked="props.published"
        :aria-labelledby="titleId"
        :aria-describedby="descriptionId"
        data-testid="publish-switch"
        @click="emit('toggle')"
      >
        <span class="grid min-w-0 flex-1 gap-0.5">
          <span :id="titleId" class="cs-row-title">Catálogo publicado</span>
          <span :id="descriptionId" class="cs-row-desc">
            Habilita la visibilidad del catálogo para clientes públicos.
          </span>
        </span>
        <span class="cs-track" aria-hidden="true" />
      </button>
      <div v-else class="cs-switch-row cs-static-row" data-testid="publication-row">
        <span class="grid min-w-0 flex-1 gap-0.5">
          <span class="cs-row-title">Catálogo publicado</span>
          <span class="cs-row-desc">Habilita la visibilidad del catálogo para clientes públicos.</span>
        </span>
        <StatusBadge
          data-testid="publication-badge"
          :label="props.published ? 'Publicado' : 'No publicado'"
          :tone="props.published ? 'success' : 'neutral'"
        />
      </div>

      <div
        class="cs-status"
        :data-tone="status.tone"
        role="status"
        aria-live="polite"
        data-testid="publication-status"
      >
        <UIcon :name="statusIcon" class="cs-status-icon" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <template v-if="props.dirty">
            <span class="cs-status-pending" data-testid="status-pending">Al guardar:</span>{{ ' ' }}
          </template>
          <b class="font-semibold">{{ status.lead }}</b>
          <template v-if="status.text">{{ ' ' + status.text }}</template>
          <span v-if="status.meta" class="cs-status-meta">{{ ' ' + status.meta }}</span>
          <ul v-if="extraWarnings.length" class="mt-1 list-disc pl-4 text-(--hf-ink)">
            <li v-for="warning in extraWarnings" :key="warning" data-testid="settings-warning">
              {{ warning }}
            </li>
          </ul>
        </div>
      </div>

      <button
        v-if="!props.readonly"
        type="button"
        role="switch"
        class="cs-switch-row cs-row-divider"
        :aria-checked="props.publishedOnly"
        :aria-labelledby="publishedOnlyTitleId"
        :aria-describedby="publishedOnlyDescriptionId"
        data-testid="published-only-switch"
        @click="emit('toggle-published-only')"
      >
        <span class="grid min-w-0 flex-1 gap-0.5">
          <span :id="publishedOnlyTitleId" class="cs-row-title">
            Mostrar solo productos con ficha publicada
          </span>
          <span :id="publishedOnlyDescriptionId" class="cs-row-desc">
            El catálogo público solo muestra productos con ficha publicada, con su título y descripción.
          </span>
        </span>
        <span class="cs-track" aria-hidden="true" />
      </button>
      <div
        v-else
        class="cs-switch-row cs-static-row cs-row-divider"
        data-testid="published-only-row"
      >
        <span class="grid min-w-0 flex-1 gap-0.5">
          <span class="cs-row-title">Mostrar solo productos con ficha publicada</span>
          <span class="cs-row-desc">
            El catálogo público solo muestra productos con ficha publicada, con su título y descripción.
          </span>
        </span>
        <StatusBadge
          data-testid="published-only-badge"
          :label="props.publishedOnly ? 'Activado' : 'Desactivado'"
          :tone="props.publishedOnly ? 'success' : 'neutral'"
        />
      </div>
    </div>
  </section>
</template>
