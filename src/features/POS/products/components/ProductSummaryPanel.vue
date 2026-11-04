<script setup lang="ts">
/**
 * ProductSummaryPanel — The always-visible operational summary beside the
 * product form: identity, the four figures and the readiness checklist.
 * Presentational only; `ProductDetailView` owns every value.
 */
import { computed, ref } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { formatCentsMXN } from '@/core/shared/utils/currency.utils'

interface ProductSummaryChecklistItem {
  label: string
  done: boolean
  disabled: boolean
}

const props = defineProps<{
  name: string
  imageUrl?: string | null
  isProduct: boolean
  sellInPos: boolean
  includeInOnlineCatalog: boolean
  priceCents: number
  costCents: number
  marginPercent: number | null
  stockTotal: number | null
  checklist: ProductSummaryChecklistItem[]
  completedItems: number
  applicableItems: number
  completionPercent: number
}>()

// Below 720px the summary leads the page, so its figures and checklist fold
// behind a toggle instead of pushing the form down.
const isNarrow = useMediaQuery('(max-width: 720px)')
const expanded = ref(false)
const bodyVisible = computed(() => !isNarrow.value || expanded.value)

// The count and the list agree: only applicable items are rows; what waits for
// creation is a single muted note.
const applicableChecklist = computed(() => props.checklist.filter((item) => !item.disabled))
const deferredItems = computed(() => props.checklist.filter((item) => item.disabled))
</script>

<template>
  <aside class="product-summary" aria-label="Resumen operativo del producto">
    <div class="product-summary-identity">
      <div class="product-summary-image">
        <img v-if="imageUrl" :src="imageUrl" :alt="name || 'Imagen del producto'" />
        <p v-else class="text-sm text-muted">Sin imagen</p>
      </div>
      <div class="product-summary-heading">
        <h2 class="product-summary-name">{{ name || 'Producto sin nombre' }}</h2>
        <div class="product-summary-tags">
          <span>{{ isProduct ? 'Producto' : 'Servicio' }}</span>
          <span v-if="sellInPos">POS</span>
          <span v-if="includeInOnlineCatalog">Online</span>
        </div>
      </div>
      <button
        v-if="isNarrow"
        type="button"
        class="product-summary-toggle"
        data-testid="summary-toggle"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        {{ expanded ? 'Ocultar resumen' : 'Ver resumen' }}
        <UIcon :name="expanded ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-4" />
      </button>
    </div>

    <div v-show="bodyVisible" class="product-summary-body">
      <dl class="product-summary-values">
        <div>
          <dt>Precio de venta</dt>
          <dd class="hf-figure" data-summary="price">{{ formatCentsMXN(priceCents) }}</dd>
        </div>
        <div>
          <dt>Costo</dt>
          <dd class="hf-figure" data-summary="cost">{{ formatCentsMXN(costCents) }}</dd>
        </div>
        <div>
          <dt>Margen</dt>
          <dd
            class="hf-figure"
            :class="marginPercent == null ? 'text-muted' : marginPercent >= 0 ? 'text-success' : 'text-error'"
          >
            {{ marginPercent == null ? '—' : `${marginPercent}%` }}
          </dd>
        </div>
        <div>
          <dt>Stock</dt>
          <dd class="hf-figure" data-summary="stock">{{ stockTotal ?? '—' }}</dd>
        </div>
      </dl>

      <div class="product-summary-progress-head">
        <h3 id="operation-readiness">Datos operativos</h3>
        <span class="hf-figure">{{ completedItems }}/{{ applicableItems }}</span>
      </div>
      <progress
        class="product-readiness-progress"
        :value="completionPercent"
        max="100"
        aria-labelledby="operation-readiness"
      />
      <ul class="product-summary-checklist">
        <li v-for="item in applicableChecklist" :key="item.label">
          <UIcon
            :name="item.done ? 'i-lucide-check' : 'i-lucide-minus'"
            class="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span
            >{{ item.label
            }}<span class="sr-only">: {{ item.done ? 'Completo' : 'Pendiente' }}</span></span
          >
        </li>
      </ul>
      <p
        v-for="item in deferredItems"
        :key="item.label"
        class="product-summary-deferred"
        data-testid="summary-deferred"
      >
        {{ item.label }}
      </p>
    </div>
  </aside>
</template>

<style scoped>
.product-summary {
  position: sticky;
  top: 24px;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--hf-border);
  border-radius: var(--hf-radius-card);
  background: var(--hf-surface);
  overflow-wrap: anywhere;
}
.product-summary-identity {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 16px;
  align-items: center;
  padding: 24px 24px 20px;
}
.product-summary-image {
  display: grid;
  place-items: center;
  width: 72px;
  height: 88px;
  overflow: hidden;
  border-radius: var(--hf-radius-control);
  background: var(--hf-surface-muted);
}
.product-summary-image img {
  display: block;
  width: 100%;
  height: 100%;
  max-height: 88px;
  object-fit: contain;
}
.product-summary-image p {
  padding: 8px;
  text-align: center;
}
.product-summary-heading {
  min-width: 0;
}
.product-summary-name {
  color: var(--hf-heading);
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.4;
}
.product-summary-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 8px;
  color: var(--hf-muted);
  font-size: 0.75rem;
}
.product-summary-body {
  padding: 0 24px 24px;
}
.product-summary-values {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px 12px;
  padding: 20px 0;
  border-top: 1px solid var(--hf-border);
  border-bottom: 1px solid var(--hf-border);
}
.product-summary-values > div:first-child {
  grid-column: 1 / -1;
}
.product-summary-values > div:first-child dd {
  color: var(--hf-heading);
  font-size: 2rem;
  line-height: 1.15;
  letter-spacing: -0.04em;
}
.product-summary-values dt {
  color: var(--hf-muted);
  font-size: 0.8125rem;
}
.product-summary-values dd {
  margin-top: 4px;
  font-size: 1.125rem;
  font-weight: 600;
}
.product-summary-progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 24px;
  font-size: 0.875rem;
}
.product-summary-progress-head h3 {
  color: var(--hf-heading);
  font-weight: 600;
}
.product-readiness-progress {
  display: block;
  width: 100%;
  height: 4px;
  margin-top: 12px;
  appearance: none;
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  background: var(--hf-surface-muted);
  color: var(--hf-active);
}
.product-readiness-progress::-webkit-progress-bar {
  background: var(--hf-surface-muted);
}
.product-readiness-progress::-webkit-progress-value {
  background: var(--hf-active);
}
.product-readiness-progress::-moz-progress-bar {
  background: var(--hf-active);
}
.product-summary-checklist {
  display: grid;
  gap: 12px;
  margin-top: 16px;
  font-size: 0.8125rem;
}
.product-summary-checklist li {
  display: flex;
  gap: 8px;
}
.product-summary-deferred {
  margin-top: 12px;
  color: var(--hf-muted);
  font-size: 0.8125rem;
}
.product-summary-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  grid-column: 1 / -1;
  color: var(--hf-action);
  font-size: 0.8125rem;
  font-weight: 600;
}
@media (max-width: 720px) {
  .product-summary {
    position: static;
  }
  .product-summary-identity {
    padding: 20px 20px 16px;
  }
  .product-summary-body {
    padding: 0 20px 20px;
  }
}
</style>
