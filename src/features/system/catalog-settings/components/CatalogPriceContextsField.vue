<script setup lang="ts">
/**
 * CatalogPriceContextsField — WU3B tenant public-context editor (REQ-6A).
 * Accepted membership/default always comes from the settings draft +
 * accepted priceContexts; candidates only OFFER additions and never redefine
 * membership. Without global-list read, editing is disabled with a Spanish
 * explanation while accepted rows stay visible; a draft id missing from
 * accepted contexts/candidates is preserved and shown by id.
 */
import { computed } from 'vue'
import type { CatalogSettingsDraft, CatalogPriceContextDto } from '../interfaces/catalog-settings.types'

const props = defineProps<{
  draft: CatalogSettingsDraft
  acceptedContexts: Array<CatalogPriceContextDto>
  candidates: Array<{ id: string; name: string }>
  disabled?: boolean
}>()

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
  <div class="flex flex-col gap-3" data-testid="contexts-field">
    <div class="flex flex-col gap-1">
      <h4 class="text-sm font-semibold text-default">Listas de precios públicas</h4>
      <p class="text-xs text-muted">
        Listas de precios visibles para clientes públicos
      </p>
    </div>

    <p v-if="rows.length === 0" class="text-sm text-muted" data-testid="contexts-empty">
      Sin listas públicas: la configuración no se mostrará públicamente
    </p>

    <ul v-else class="flex flex-col gap-2">
      <li
        v-for="row in rows"
        :key="row.priceListId"
        class="flex items-center justify-between rounded-lg border border-default px-3 py-2"
        data-testid="context-row"
      >
        <span class="text-sm text-default">{{ row.name }}</span>
        <span class="flex items-center gap-2">
          <span
            v-if="row.isDefault"
            class="rounded bg-primary-50 px-2 py-0.5 text-xs text-primary"
            data-testid="default-badge"
          >
            Predeterminada
          </span>
          <button
            v-else
            type="button"
            data-testid="set-default"
            class="text-xs text-primary underline"
            :disabled="props.disabled"
            @click="emit('setDefault', row.priceListId)"
          >
            Predeterminada
          </button>
          <button
            type="button"
            data-testid="remove-context"
            class="text-xs text-error underline"
            :disabled="props.disabled"
            @click="emit('remove', row.priceListId)"
          >
            Quitar
          </button>
        </span>
      </li>
    </ul>

    <template v-if="!props.disabled">
      <div v-if="addable.length > 0" class="flex flex-col gap-1">
        <span class="text-xs text-muted">Agregar lista</span>
        <button
          v-for="candidate in addable"
          :key="candidate.id"
          type="button"
          data-testid="add-candidate-option"
          class="text-left text-sm text-primary underline"
          @click="emit('add', candidate.id)"
        >
          {{ candidate.name }}
        </button>
      </div>
      <button
        v-if="props.draft.catalogDefaultPriceListId !== null"
        type="button"
        data-testid="clear-default"
        class="self-start text-xs text-muted underline"
        @click="emit('setDefault', null)"
      >
        Quitar predeterminada
      </button>
    </template>

    <!-- REQ-6A: least-privilege explanation while accepted rows stay visible. -->
    <p v-if="props.disabled" class="text-sm text-muted" data-testid="contexts-disabled-note">
      Se requiere permiso de lectura de listas de precios globales para editar los contextos
    </p>
  </div>
</template>
