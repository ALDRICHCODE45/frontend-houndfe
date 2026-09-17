<script setup lang="ts">
/**
 * CatalogPriceContextsField — WU3B tenant public-context editor (REQ-6A).
 * Accepted membership/default always comes from the settings draft +
 * accepted priceContexts; candidates only OFFER additions and never redefine
 * membership. Without global-list read, editing is disabled with a Spanish
 * explanation while accepted rows stay visible; a draft id missing from
 * accepted contexts/candidates is preserved and shown by id.
 *
 * UI redesign: UBadge for default markers, UButton variant="ghost" with icon
 * for contextual actions (set-default, remove, clear-default, add options).
 * All data-testid, props, emits, and row-rendering contracts are preserved.
 */
import { computed } from 'vue'
import type {
  CatalogSettingsDraft,
  CatalogPriceContextDto,
} from '../interfaces/catalog-settings.types'

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

/** Rows follow the draft allowlist; names resolve from accepted contexts
 *  first, then candidates, falling back to the raw id (missing ids preserved). */
const rows = computed(() =>
  props.draft.publicPriceListIds.map((priceListId) => {
    const name =
      props.acceptedContexts.find((c) => c.priceListId === priceListId)?.name ??
      props.candidates.find((c) => c.id === priceListId)?.name ??
      priceListId
    return {
      priceListId,
      name,
      isDefault: props.draft.catalogDefaultPriceListId === priceListId,
    }
  }),
)

/** Add candidates are the global lists not already selected (additions only). */
const addable = computed(() =>
  props.candidates.filter((candidate) => !props.draft.publicPriceListIds.includes(candidate.id)),
)
</script>

<template>
  <fieldset class="contents" data-testid="contexts-field">
    <legend class="sr-only">Listas de precios públicas</legend>
    <div class="flex flex-col gap-1">
      <h2 class="text-sm font-semibold text-default">Listas de precios públicas</h2>
      <p class="text-xs text-muted">Listas de precios visibles para clientes públicos</p>
    </div>

    <p v-if="rows.length === 0" class="text-sm text-muted" data-testid="contexts-empty">
      Sin listas públicas: la configuración no se mostrará públicamente
    </p>

    <ul v-else class="flex flex-col gap-2" data-testid="contexts-list">
      <li
        v-for="row in rows"
        :key="row.priceListId"
        class="flex flex-col gap-2 rounded-lg border border-default bg-default px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-0"
        data-testid="context-row"
      >
        <span class="min-w-0 break-words text-sm text-default">{{ row.name }}</span>
        <div class="flex flex-wrap items-center gap-1.5">
          <template v-if="row.isDefault">
            <UBadge label="Predeterminada" color="primary" variant="subtle" size="sm" />
          </template>
          <template v-else>
            <UButton
              type="button"
              label="Predeterminada"
              variant="ghost"
              size="xs"
              data-testid="set-default"
              :disabled="props.disabled"
              @click="emit('setDefault', row.priceListId)"
            />
          </template>
          <UButton
            type="button"
            icon="i-lucide-trash-2"
            variant="ghost"
            size="xs"
            color="error"
            :data-testid="row.isDefault ? 'remove-default-context' : 'remove-context'"
            :aria-label="`Eliminar ${row.name} del catálogo`"
            :disabled="props.disabled"
            @click="emit('remove', row.priceListId)"
          />
        </div>
      </li>
    </ul>

    <template v-if="!props.disabled">
      <div v-if="addable.length > 0" class="flex flex-col gap-1.5">
        <span class="text-xs text-muted">Agregar lista</span>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="candidate in addable"
            :key="candidate.id"
            type="button"
            :label="candidate.name"
            variant="outline"
            size="xs"
            data-testid="add-candidate-option"
            @click="emit('add', candidate.id)"
          />
        </div>
      </div>
      <UButton
        v-if="props.draft.catalogDefaultPriceListId !== null"
        type="button"
        label="Quitar predeterminada"
        variant="ghost"
        size="xs"
        color="neutral"
        aria-label="Quitar lista predeterminada del catálogo"
        data-testid="clear-default"
        @click="emit('setDefault', null)"
      />
    </template>

    <!-- REQ-6A: least-privilege explanation while accepted rows stay visible. -->
    <p v-if="props.disabled" class="text-sm text-muted" data-testid="contexts-disabled-note">
      Se requiere permiso de lectura de listas de precios globales para editar los contextos
    </p>
  </fieldset>
</template>
