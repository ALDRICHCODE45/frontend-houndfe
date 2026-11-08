<script setup lang="ts">
/**
 * CatalogPriceContextsField — «Precios que ve el público» (artboard 01, REQ-6A).
 *
 * One row per price list: the name (never an id), a compact «Pública» switch,
 * and on public rows a «Predeterminada» radio pill (board 04 patterns 1 and 2).
 * The pills form one radio group with roving tabindex: arrows, Home and End
 * move and choose. The default row carries the info badge and a soft tint.
 *
 * Membership and default come from the draft; candidates only OFFER rows, and
 * a draft id missing from candidates stays as a row named from the accepted
 * contexts. The field emits granular intents (`add`, `remove`, `setDefault`);
 * the parent applies the default rules and reports a moved default through
 * `defaultMove`, shown here as a notice with «Deshacer». Without global-list
 * read the controls are locked with an explanation; read-only mode lists the
 * accepted public lists only.
 */
import { computed, useId } from 'vue'
import EmptyState from '@/core/shared/components/EmptyState.vue'
import StatusBadge from '@/core/shared/components/StatusBadge.vue'
import type {
  CatalogDefaultMove,
  CatalogPriceContextDto,
  CatalogSettingsDraft,
} from '../interfaces/catalog-settings.types'

interface PriceRow {
  id: string
  name: string
  isPublic: boolean
  isDefault: boolean
}

const props = withDefaults(
  defineProps<{
    draft: CatalogSettingsDraft
    acceptedContexts: Array<CatalogPriceContextDto>
    candidates: Array<{ id: string; name: string }>
    loading?: boolean
    error?: boolean
    disabled?: boolean
    readonly?: boolean
    defaultMove?: CatalogDefaultMove | null
  }>(),
  { loading: false, error: false, disabled: false, readonly: false, defaultMove: null },
)

const emit = defineEmits<{
  (event: 'add', priceListId: string): void
  (event: 'remove', priceListId: string): void
  (event: 'setDefault', priceListId: string): void
  (event: 'undoDefaultMove'): void
  (event: 'retry'): void
}>()

const headingId = useId()
const descriptionId = useId()

function resolveName(priceListId: string): string {
  return (
    props.candidates.find((candidate) => candidate.id === priceListId)?.name ??
    props.acceptedContexts.find((context) => context.priceListId === priceListId)?.name ??
    'Lista sin nombre'
  )
}

const rows = computed<PriceRow[]>(() => {
  if (props.readonly) {
    return props.acceptedContexts.map((context) => ({
      id: context.priceListId,
      name: context.name,
      isPublic: true,
      isDefault: context.isCatalogDefault,
    }))
  }
  const publicIds = new Set(props.draft.publicPriceListIds)
  const ids = props.candidates.map((candidate) => candidate.id)
  for (const priceListId of props.draft.publicPriceListIds) {
    if (!ids.includes(priceListId)) ids.push(priceListId)
  }
  return ids.map((id) => ({
    id,
    name: resolveName(id),
    isPublic: publicIds.has(id),
    isDefault: publicIds.has(id) && props.draft.catalogDefaultPriceListId === id,
  }))
})

const publicRows = computed(() => rows.value.filter((row) => row.isPublic))
const countLabel = computed(() => `${publicRows.value.length} de ${rows.value.length} públicas`)
const showLoading = computed(() => !props.readonly && !props.disabled && props.loading)
const showError = computed(() => !props.readonly && !props.disabled && !props.loading && props.error)
const showRows = computed(() => !showLoading.value && !showError.value && rows.value.length > 0)
const showEmpty = computed(() => !showLoading.value && !showError.value && rows.value.length === 0)

/** Roving tab stop: the chosen pill, or the first public row when none is chosen. */
const tabStopId = computed(
  () => publicRows.value.find((row) => row.isDefault)?.id ?? publicRows.value[0]?.id ?? null,
)

const pillElements = new Map<string, HTMLElement>()
function setPillRef(id: string, el: unknown) {
  if (el instanceof HTMLElement) pillElements.set(id, el)
  else pillElements.delete(id)
}

function onToggle(row: PriceRow) {
  if (props.disabled) return
  if (row.isPublic) emit('remove', row.id)
  else emit('add', row.id)
}

function onChoose(row: PriceRow) {
  if (props.disabled || row.isDefault) return
  emit('setDefault', row.id)
}

const KEY_STEP: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }

function onPillKeydown(event: KeyboardEvent, row: PriceRow) {
  const radios = publicRows.value
  const index = radios.findIndex((candidate) => candidate.id === row.id)
  let next = -1
  if (event.key in KEY_STEP) next = (index + KEY_STEP[event.key]! + radios.length) % radios.length
  else if (event.key === 'Home') next = 0
  else if (event.key === 'End') next = radios.length - 1
  if (next < 0) return
  event.preventDefault()
  const target = radios[next]!
  onChoose(target)
  pillElements.get(target.id)?.focus()
}
</script>

<template>
  <section class="cs-group" :aria-labelledby="headingId" data-testid="contexts-card">
    <div class="cs-group-head">
      <div>
        <h2 :id="headingId" class="cs-group-title">Precios que ve el público</h2>
        <p :id="descriptionId" class="cs-group-desc">
          Activa las listas que pueden verse en el catálogo. La predeterminada es la que aparece
          primero.
        </p>
      </div>
      <span v-if="showRows && !props.readonly" class="cs-count" data-testid="public-count">
        {{ countLabel }}
      </span>
    </div>

    <div class="cs-surface" data-testid="contexts-field">
      <div
        v-if="showLoading"
        role="status"
        aria-busy="true"
        class="flex flex-col"
        data-testid="contexts-loading"
      >
        <span class="sr-only">Cargando listas de precios…</span>
        <div
          v-for="n in 3"
          :key="n"
          class="cs-price-row animate-pulse"
          aria-hidden="true"
        >
          <span class="settings-skeleton-bar h-4 w-40" />
          <span class="settings-skeleton-bar h-11 w-full" />
          <span class="settings-skeleton-bar h-6 w-24" />
        </div>
      </div>

      <EmptyState
        v-else-if="showError"
        kind="error"
        title="No se pudieron cargar las listas de precios"
        action-label="Reintentar"
        action-test-id="contexts-retry"
        data-testid="contexts-error"
        @action="emit('retry')"
      />

      <p
        v-else-if="showEmpty && props.readonly"
        class="cs-notice"
        data-tone="muted"
        data-testid="contexts-empty"
      >
        Sin listas públicas: la configuración no se mostrará públicamente
      </p>

      <EmptyState
        v-else-if="showEmpty"
        title="No hay listas de precios"
        description="Crea una lista de precios para mostrarla en el catálogo."
        data-testid="contexts-empty"
      />

      <!-- Read-only: accepted public lists, names and the default badge only. -->
      <ul v-else-if="props.readonly" class="m-0 list-none p-0" data-testid="contexts-list">
        <li
          v-for="row in rows"
          :key="row.id"
          class="cs-price-row"
          :data-default="String(row.isDefault)"
          data-public="true"
          data-testid="context-row"
        >
          <span class="cs-price-name">
            <span class="cs-price-title">
              <span>{{ row.name }}</span>
              <StatusBadge v-if="row.isDefault" label="Predeterminada" tone="info" />
            </span>
            <span class="cs-row-desc">
              {{ row.isDefault ? 'Los clientes la ven primero' : 'Visible en el catálogo' }}
            </span>
          </span>
        </li>
      </ul>

      <div
        v-else
        role="radiogroup"
        aria-label="Lista predeterminada del catálogo"
        :aria-describedby="descriptionId"
        data-testid="contexts-list"
      >
        <div
          v-for="row in rows"
          :key="row.id"
          class="cs-price-row"
          :data-default="String(row.isDefault)"
          :data-public="String(row.isPublic)"
          data-testid="context-row"
        >
          <span class="cs-price-name">
            <span class="cs-price-title">
              <span>{{ row.name }}</span>
              <!-- Below 640px the selected «Predeterminada» pill already says it, full width. -->
              <StatusBadge v-if="row.isDefault" class="cs-default-badge" label="Predeterminada" tone="info" />
            </span>
            <span class="cs-row-desc">
              {{
                row.isDefault
                  ? 'Los clientes la ven primero'
                  : row.isPublic
                    ? 'Visible en el catálogo'
                    : 'Oculta en el catálogo'
              }}
            </span>
          </span>

          <button
            v-if="row.isPublic"
            :ref="(el) => setPillRef(row.id, el)"
            type="button"
            role="radio"
            class="cs-default-pill cs-focus"
            :aria-checked="row.isDefault"
            :aria-disabled="props.disabled ? 'true' : undefined"
            :aria-label="`Predeterminada: ${row.name}`"
            :tabindex="row.id === tabStopId ? 0 : -1"
            data-testid="default-radio"
            @click="onChoose(row)"
            @keydown="onPillKeydown($event, row)"
          >
            <span class="cs-mark" aria-hidden="true">
              <UIcon name="i-lucide-check" class="cs-mark-icon" />
            </span>
            Predeterminada
          </button>
          <span v-else class="cs-default-slot" aria-hidden="true" />

          <button
            type="button"
            role="switch"
            class="cs-public-switch cs-focus"
            :aria-checked="row.isPublic"
            :aria-disabled="props.disabled ? 'true' : undefined"
            :aria-label="`Lista ${row.name} pública`"
            data-testid="public-switch"
            @click="onToggle(row)"
          >
            <span aria-hidden="true">Pública</span>
            <span class="cs-track" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div v-if="!props.readonly" aria-live="polite">
        <div
          v-if="props.defaultMove"
          class="cs-notice"
          data-tone="info"
          data-testid="default-move-notice"
        >
          <UIcon name="i-lucide-info" class="cs-notice-icon" aria-hidden="true" />
          <span class="flex-1">
            {{ props.defaultMove.toName }} ahora es la predeterminada porque
            {{ props.defaultMove.fromName }} dejó de ser pública.
          </span>
          <button
            type="button"
            class="cs-link-button cs-focus"
            data-testid="undo-default-move"
            @click="emit('undoDefaultMove')"
          >
            Deshacer
          </button>
        </div>
        <div
          v-if="showRows && publicRows.length === 0"
          class="cs-notice"
          data-tone="warning"
          data-testid="no-public-warning"
        >
          <UIcon name="i-lucide-triangle-alert" class="cs-notice-icon" aria-hidden="true" />
          <span class="flex-1">
            Elige al menos una lista pública para que el catálogo pueda publicarse. Sin listas
            públicas no hay precios que mostrar.
          </span>
        </div>
        <p
          v-if="props.disabled"
          class="cs-notice"
          data-tone="muted"
          data-testid="contexts-disabled-note"
        >
          <UIcon name="i-lucide-lock" class="cs-notice-icon" aria-hidden="true" />
          Se requiere permiso de lectura de listas de precios globales para editar las listas
          públicas.
        </p>
      </div>
    </div>
  </section>
</template>
