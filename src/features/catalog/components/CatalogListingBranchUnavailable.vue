<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PublicBranchDto } from '../interfaces/catalog.types'

/**
 * Branch without a published catalog (artboard 05). The unpublished branch is not in the
 * public list, so its name is unknown and never invented; the published ones are
 * selectable rows (no checkboxes) and one button opens the chosen catalog.
 */
const props = defineProps<{ branches: PublicBranchDto[] }>()
const emit = defineEmits<{ select: [slug: string] }>()

const chosenSlug = ref<string | null>(null)
const chosen = computed(
  () =>
    props.branches.find((branch) => branch.slug === chosenSlug.value) ?? props.branches[0] ?? null,
)
</script>

<template>
  <section class="catalog-listing-state" data-testid="catalog-branch-unavailable" role="status">
    <span class="catalog-listing-state-icon"><UIcon name="i-lucide-store" class="size-5" aria-hidden="true" /></span>
    <h3>Esta sucursal aún no publica su catálogo</h3>
    <p>Puedes ver el catálogo de otra sucursal.</p>
    <div class="catalog-branch-rows" role="group" aria-label="Sucursales">
      <button
        v-for="branch in branches"
        :key="branch.id"
        type="button"
        class="catalog-branch-row"
        :aria-pressed="chosen?.slug === branch.slug"
        @click="chosenSlug = branch.slug"
      >
        <span class="catalog-branch-row-name">
          <b>{{ branch.name }}</b>
          <span v-if="branch.address">{{ branch.address }}</span>
        </span>
        <span class="catalog-branch-row-mark" aria-hidden="true">
          <UIcon name="i-lucide-check" class="size-3.5" />
        </span>
      </button>
    </div>
    <div v-if="chosen" class="catalog-listing-state-actions">
      <button
        type="button"
        class="catalog-button catalog-button--primary"
        @click="emit('select', chosen.slug)"
      >
        Ver catálogo de {{ chosen.name }}
      </button>
    </div>
  </section>
</template>
