<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import CatalogDetailBreadcrumb from './CatalogDetailBreadcrumb.vue'
import CatalogDetailGallery, { type CatalogDetailGalleryImage } from './CatalogDetailGallery.vue'
import CatalogDetailPresentations, {
  type CatalogDetailPresentationOption,
} from './CatalogDetailPresentations.vue'
import CatalogDetailShareButton from './CatalogDetailShareButton.vue'
import CatalogDetailSpecs from './CatalogDetailSpecs.vue'
import { sortVariantsBySize } from '../utils/variant-order'
import {
  defaultPresentationId,
  displayAvailability,
  displayPrice,
  displayQuantity,
  groupAttributesBySection,
  presentationAttributes,
} from '../utils/detail-presentation'
import type { PublicCatalogProductDetailDto } from '../interfaces/public-catalog-product-detail.types'

/**
 * The populated product page. It owns only the selected presentation; everything shown (price,
 * stock, gallery, characteristics) is derived from the detail and that selection.
 */
const props = defineProps<{
  detail: PublicCatalogProductDetailDto
  branchName: string | null
  catalogTo: RouteLocationRaw
  category: { name: string; to: RouteLocationRaw } | null
  backTo: RouteLocationRaw
  backLabel: string
  shareUrl: string
}>()

/** Presentations from the smallest size up, each reporting the selected branch only. */
const variants = computed(() =>
  sortVariantsBySize(props.detail.variants).map((variant) => {
    const selectedBranch = variant.availabilityByBranch.find((entry) => entry.isSelected) ?? null
    return {
      variant,
      option: {
        id: variant.id,
        name: variant.name,
        price: displayPrice(variant.price),
        quantity: displayQuantity(variant.stockPresentation),
        availability: displayAvailability(
          variant.stockPresentation,
          selectedBranch?.availability ?? null,
        ),
      } satisfies CatalogDetailPresentationOption,
    }
  }),
)
const options = computed(() => variants.value.map((entry) => entry.option))

const selectedId = shallowRef<string | null>(null)
watch(
  () => props.detail.id,
  () => {
    selectedId.value = defaultPresentationId(
      options.value.map((option) => ({
        id: option.id,
        isOut: option.availability?.isOut ?? false,
      })),
    )
  },
  { immediate: true },
)
const selected = computed(
  () => variants.value.find((entry) => entry.variant.id === selectedId.value) ?? null,
)

const price = computed(() =>
  selected.value ? selected.value.option.price : displayPrice(props.detail.price),
)
const quantity = computed(() =>
  selected.value ? selected.value.option.quantity : displayQuantity(props.detail.stockPresentation),
)
const availability = computed(() => {
  const status = selected.value
    ? selected.value.option.availability
    : displayAvailability(props.detail.stockPresentation, props.detail.availability)
  if (!status) return null
  return {
    ...status,
    text: props.branchName ? `${status.label} en ${props.branchName}` : status.label,
  }
})

/** Product images, main first. */
const productImages = computed<CatalogDetailGalleryImage[]>(() => {
  const images = [...props.detail.images].sort((a, b) => Number(b.isMain) - Number(a.isMain))
  return images.map((image, index) => ({
    url: image.url,
    alt: `Imagen ${index + 1} de ${props.detail.name}`,
    caption: null,
  }))
})
/** The selected presentation's own image leads the gallery; without one, the product images do. */
const galleryImages = computed<CatalogDetailGalleryImage[]>(() => {
  const variant = selected.value?.variant
  const url = variant?.image?.url ?? null
  if (!variant || url === null) return productImages.value
  return [
    {
      url,
      alt: `Imagen de ${props.detail.name}, presentación ${variant.name}`,
      caption: `Presentación ${variant.name}`,
    },
    ...productImages.value.filter((image) => image.url !== url),
  ]
})

const attributeGroups = computed(() =>
  groupAttributesBySection(
    presentationAttributes(props.detail.attributes ?? [], selected.value?.variant.attributes ?? []),
  ),
)
const description = computed(() => props.detail.description?.trim() || null)
const showEmptyNote = computed(
  () =>
    description.value === null && options.value.length === 0 && attributeGroups.value.length === 0,
)
</script>

<template>
  <CatalogDetailBreadcrumb
    :product-name="detail.name"
    :catalog-to="catalogTo"
    :category="category"
    :back-to="backTo"
    :back-label="backLabel"
  >
    <template #actions>
      <CatalogDetailShareButton :url="shareUrl" :title="detail.name" mode="native" />
    </template>
  </CatalogDetailBreadcrumb>

  <div class="catalog-pdp">
    <header class="catalog-pdp-head">
      <p
        v-if="detail.brand || detail.category"
        data-testid="catalog-detail-eyebrow"
        class="catalog-pdp-eyebrow"
      >
        <span v-if="detail.brand">{{ detail.brand.name }}</span>
        <span v-if="detail.brand && detail.category" aria-hidden="true"> · </span>
        <span v-if="detail.category">{{ detail.category.name }}</span>
      </p>
      <h1>{{ detail.name }}</h1>
    </header>

    <CatalogDetailGallery
      class="catalog-pdp-gallery-area"
      :product-name="detail.name"
      :images="galleryImages"
    />

    <div class="catalog-pdp-buy">
      <div class="catalog-pdp-buytop">
        <div class="catalog-pdp-pricebox" aria-live="polite" aria-atomic="true">
          <p v-if="price" data-testid="catalog-detail-price" class="catalog-pdp-price">
            <span>{{ price }}</span> <small>MXN</small>
          </p>
          <p
            v-else
            data-testid="catalog-detail-price"
            class="catalog-pdp-price catalog-pdp-price--consult"
          >
            Consultar precio
          </p>
          <p data-testid="catalog-detail-price-context" class="catalog-pdp-price-context">
            <template v-if="selected">Presentación {{ selected.variant.name }} · </template>Lista de
            precios: {{ detail.priceContext.name }}
          </p>
          <p v-if="quantity" data-testid="catalog-detail-quantity" class="catalog-pdp-quantity">
            {{ quantity }}
          </p>
          <span
            v-if="availability"
            data-testid="catalog-detail-availability"
            class="catalog-pdp-availability"
            :data-tone="availability.tone"
            >{{ availability.text }}</span
          >
        </div>
        <div class="catalog-pdp-actions">
          <CatalogDetailShareButton :url="shareUrl" :title="detail.name" mode="copy" />
        </div>
      </div>

      <CatalogDetailPresentations
        v-if="options.length > 0"
        v-model="selectedId"
        :options="options"
      />

      <CatalogDetailSpecs
        :description="description"
        :groups="attributeGroups"
        :scope="selected ? selected.variant.name : null"
      />

      <div
        v-if="showEmptyNote"
        data-testid="catalog-detail-empty-note"
        class="catalog-pdp-empty-note"
        role="note"
      >
        <h2>Sin información adicional</h2>
        <p>Por ahora no hay descripción ni presentaciones publicadas para este producto.</p>
      </div>
    </div>
  </div>
</template>
