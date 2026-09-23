<script setup lang="ts">
/**
 * CatalogPriceContextsField — U9 tenant public-context editor (REQ-6A).
 *
 * Accepted membership/default always comes from the settings draft +
 * accepted priceContexts; candidates only OFFER additions and never redefine
 * membership. Without global-list read, editing is disabled with a Spanish
 * explanation while the accepted selections stay visible; a draft id missing
 * from accepted contexts/candidates is preserved and selectable by id.
 *
 * U9 replaces the ad-hoc add/remove/default buttons with the repository's
 * Nuxt UI select pattern: one searchable multiple USelectMenu for the complete
 * visible allowlist and one searchable single clearable USelectMenu for the
 * principal list, limited to the currently selected lists. Granular emits are
 * preserved by diffing the next multi-selection against the draft: removals
 * follow draft order, additions follow selection order. Props are never
 * mutated.
 */
import { computed } from 'vue'
import type {
  CatalogSettingsDraft,
  CatalogPriceContextDto,
} from '../interfaces/catalog-settings.types'

interface PriceListOption {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    draft: CatalogSettingsDraft
    acceptedContexts: Array<CatalogPriceContextDto>
    candidates: Array<{ id: string; name: string }>
    disabled?: boolean
  }>(),
  { disabled: false },
)

const emit = defineEmits<{
  (event: 'add', priceListId: string): void
  (event: 'remove', priceListId: string): void
  (event: 'setDefault', priceListId: string | null): void
}>()

/** Names resolve from accepted contexts first, then candidates, falling back
 *  to the raw id so stale membership is never renamed away or dropped. */
function resolveName(priceListId: string): string {
  return (
    props.acceptedContexts.find((context) => context.priceListId === priceListId)?.name ??
    props.candidates.find((candidate) => candidate.id === priceListId)?.name ??
    priceListId
  )
}

const selectedIds = computed(() => [...props.draft.publicPriceListIds])

/** Selectable allowlist: every visible candidate plus any accepted/stale draft
 *  id absent from candidates, so existing membership stays selectable. */
const listOptions = computed<PriceListOption[]>(() => {
  const options: PriceListOption[] = props.candidates.map((candidate) => ({
    value: candidate.id,
    label: candidate.name,
  }))
  const known = new Set(props.candidates.map((candidate) => candidate.id))
  for (const priceListId of props.draft.publicPriceListIds) {
    if (known.has(priceListId)) continue
    options.push({ value: priceListId, label: resolveName(priceListId) })
  }
  return options
})

/** Principal list options are limited to the currently selected public lists. */
const defaultOptions = computed<PriceListOption[]>(() =>
  props.draft.publicPriceListIds.map((priceListId) => ({
    value: priceListId,
    label: resolveName(priceListId),
  })),
)

const summaryCopy = computed(() =>
  selectedIds.value.length === 1
    ? '1 lista seleccionada para el catálogo público'
    : `${selectedIds.value.length} listas seleccionadas para el catálogo público`,
)

/** Diff the next multi-selection into the granular emits the draft expects. */
function onListsChange(next: unknown) {
  if (props.disabled) return
  const nextIds = Array.isArray(next) ? next.map((value) => String(value)) : []
  const nextSet = new Set(nextIds)
  const currentIds = props.draft.publicPriceListIds
  const currentSet = new Set(currentIds)

  // Removals keep the draft order; additions keep the selection order.
  for (const priceListId of currentIds) {
    if (!nextSet.has(priceListId)) emit('remove', priceListId)
  }

  const additions = new Set<string>()
  for (const priceListId of nextIds) {
    if (currentSet.has(priceListId) || additions.has(priceListId)) continue
    additions.add(priceListId)
    emit('add', priceListId)
  }
}

function onDefaultChange(next: unknown) {
  if (props.disabled) return
  emit('setDefault', typeof next === 'string' && next.length > 0 ? next : null)
}
</script>

<template>
  <fieldset class="contents" data-testid="contexts-field">
    <legend class="sr-only">Listas de precios públicas</legend>
    <div class="flex flex-col gap-1">
      <h2 class="text-sm font-semibold text-default">Listas de precios públicas</h2>
      <p class="text-xs text-muted">Listas de precios visibles para clientes públicos</p>
    </div>

    <div class="flex w-full flex-col gap-4">
      <!-- Visible allowlist: one searchable multiple selection. -->
      <UFormField label="Listas visibles" class="w-full">
        <USelectMenu
          :model-value="selectedIds"
          :items="listOptions"
          value-key="value"
          label-key="label"
          multiple
          :search-input="{ placeholder: 'Buscar lista de precios...' }"
          placeholder="Buscar lista de precios..."
          aria-label="Listas visibles"
          class="w-full"
          :disabled="props.disabled"
          data-testid="public-lists-select"
          @update:model-value="onListsChange"
        >
          <template #empty="{ searchTerm }">
            <p class="p-2 text-center text-sm text-muted">
              {{ searchTerm ? 'Sin resultados' : 'Sin listas de precios disponibles' }}
            </p>
          </template>
        </USelectMenu>

        <p
          v-if="selectedIds.length === 0"
          class="mt-1.5 text-sm text-muted"
          data-testid="contexts-empty"
        >
          Sin listas públicas: la configuración no se mostrará públicamente
        </p>
        <p v-else class="mt-1.5 text-xs text-muted" data-testid="contexts-summary">
          {{ summaryCopy }}
        </p>
      </UFormField>

      <!-- Principal list: single, clearable, limited to the selected lists. -->
      <UFormField
        label="Lista predeterminada"
        description="Los clientes públicos verán esta lista primero."
        class="w-full"
      >
        <USelectMenu
          :model-value="props.draft.catalogDefaultPriceListId"
          :items="defaultOptions"
          value-key="value"
          label-key="label"
          clear
          :search-input="{ placeholder: 'Buscar lista de precios...' }"
          placeholder="Sin lista predeterminada"
          aria-label="Lista predeterminada"
          class="w-full"
          :disabled="props.disabled"
          data-testid="default-context-select"
          @update:model-value="onDefaultChange"
        >
          <template #empty="{ searchTerm }">
            <p class="p-2 text-center text-sm text-muted">
              {{ searchTerm ? 'Sin resultados' : 'Sin listas públicas seleccionadas' }}
            </p>
          </template>
        </USelectMenu>
      </UFormField>
    </div>

    <!-- REQ-6A: least-privilege explanation while accepted rows stay visible. -->
    <p v-if="props.disabled" class="text-sm text-muted" data-testid="contexts-disabled-note">
      Se requiere permiso de lectura de listas de precios globales para editar los contextos
    </p>
  </fieldset>
</template>
