<script lang="ts">
interface RangeMeta {
  page: number
  limit: number
  total: number
}

/** «Mostrando a–b de N productos» from the listing meta; null when the page holds nothing. */
export function resultsRangeLabel(meta: RangeMeta): string | null {
  const first = (meta.page - 1) * meta.limit + 1
  if (meta.total === 0 || first > meta.total) return null
  const last = Math.min(meta.page * meta.limit, meta.total)
  return `Mostrando ${first}–${last} de ${meta.total} ${meta.total === 1 ? 'producto' : 'productos'}`
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * Metadata-driven pager: numbered pages on desktop, «Anterior · Página X de Y · Siguiente»
 * on a phone (both rendered; CSS picks one). It only relays the target page.
 */
const props = defineProps<{ page: number; totalPages: number; total: number; limit: number }>()
const emit = defineEmits<{ navigate: [page: number] }>()

const summary = computed(() =>
  resultsRangeLabel({ page: props.page, limit: props.limit, total: props.total }),
)

type PagerEntry = { kind: 'page'; page: number } | { kind: 'gap'; key: string }
/** First, last and the current page with its neighbours; longer runs collapse into «…». */
const entries = computed<PagerEntry[]>(() => {
  const { page, totalPages } = props
  const wanted = new Set([1, totalPages, page - 1, page, page + 1])
  const pages = [...wanted].filter((entry) => entry >= 1 && entry <= totalPages).sort((a, b) => a - b)
  const result: PagerEntry[] = []
  pages.forEach((entry, index) => {
    const previous = pages[index - 1]
    if (previous !== undefined && entry - previous > 1) {
      if (entry - previous === 2) result.push({ kind: 'page', page: previous + 1 })
      else result.push({ kind: 'gap', key: `gap-${entry}` })
    }
    result.push({ kind: 'page', page: entry })
  })
  return result
})

function go(target: number) {
  if (target < 1 || target > props.totalPages || target === props.page) return
  emit('navigate', target)
}
</script>

<template>
  <nav class="catalog-pager" aria-label="Paginación del catálogo">
    <p v-if="summary" class="catalog-pager-summary">{{ summary }}</p>
    <ol class="catalog-pager-list">
      <li>
        <button
          type="button"
          class="catalog-pager-button"
          :disabled="page <= 1"
          @click="go(page - 1)"
        >
          <UIcon name="i-lucide-chevron-left" class="size-4" aria-hidden="true" />Anterior
        </button>
      </li>
      <li class="catalog-pager-pages-item">
        <ol class="catalog-pager-pages">
          <li v-for="entry in entries" :key="entry.kind === 'page' ? entry.page : entry.key">
            <span v-if="entry.kind === 'gap'" class="catalog-pager-gap" aria-hidden="true">…</span>
            <button
              v-else
              type="button"
              class="catalog-pager-button"
              :aria-label="`Página ${entry.page}`"
              :aria-current="entry.page === page ? 'page' : undefined"
              @click="go(entry.page)"
            >
              {{ entry.page }}
            </button>
          </li>
        </ol>
      </li>
      <li class="catalog-pager-compact" role="status" aria-live="polite">
        Página {{ page }} de {{ totalPages }}
      </li>
      <li>
        <button
          type="button"
          class="catalog-pager-button"
          :disabled="page >= totalPages"
          @click="go(page + 1)"
        >
          Siguiente<UIcon name="i-lucide-chevron-right" class="size-4" aria-hidden="true" />
        </button>
      </li>
    </ol>
  </nav>
</template>
