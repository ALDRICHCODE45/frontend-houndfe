<script setup lang="ts">
import { computed, nextTick, shallowRef, useTemplateRef, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import CatalogDetailBreadcrumb from './CatalogDetailBreadcrumb.vue'
import CatalogDetailGallery, { type CatalogDetailGalleryImage } from './CatalogDetailGallery.vue'
import CatalogDetailPresentations, {
  type CatalogDetailPresentationOption,
} from './CatalogDetailPresentations.vue'
import CatalogBranchBlock from './CatalogBranchBlock.vue'
import CatalogDetailShareButton from './CatalogDetailShareButton.vue'
import CatalogDetailStickyBar from './CatalogDetailStickyBar.vue'
import CatalogWhatsappLink from './CatalogWhatsappLink.vue'
import CatalogDetailSpecs from './CatalogDetailSpecs.vue'
import { sortVariantsBySize } from '../utils/variant-order'
import { presentationLabel } from '../utils/presentation-label'
import { computeUnitPrices } from '../utils/unit-price'
import { normalizeWhatsappNumber, productInquiryMessage } from '../utils/whatsapp'
import {
  defaultPresentationId,
  displayAvailability,
  displayPrice,
  displayQuantity,
  exactQuantityLabel,
  groupAttributesBySection,
  presentationAttributes,
} from '../utils/detail-presentation'
import type { DisplayAvailability } from '../utils/detail-presentation'
import type { PublicCatalogProductDetailDto } from '../interfaces/public-catalog-product-detail.types'
import type { PublicCatalogBranchDetailDto } from '../interfaces/public-catalog-branch.types'
import '../styles/catalog-extras.css'

/**
 * The populated product page. It owns only the selected presentation; everything shown (price,
 * stock, gallery, characteristics) is derived from the detail and that selection.
 */
const props = withDefaults(
  defineProps<{
  detail: PublicCatalogProductDetailDto
  branchName: string | null
  catalogTo: RouteLocationRaw
  category: { name: string; to: RouteLocationRaw } | null
  backTo: RouteLocationRaw
  backLabel: string
  shareUrl: string
  /** The storefront URL of this page, named in the WhatsApp message. */
  pageUrl?: string
  /** The business WhatsApp number; without it no WhatsApp UI is rendered at all. */
  whatsappNumber?: string | null
  /** The public branch card; without it no branch block is rendered. */
  branchDetail?: PublicCatalogBranchDetailDto | null
}>(),
  { pageUrl: '', whatsappNumber: null, branchDetail: null },
)

function savingLabel(saving: { percent: number; versus: string } | null): string | null {
  return saving ? `Ahorras ${saving.percent} % vs ${saving.versus}` : null
}

/** Unit prices, only when every presentation shares one content unit (see utils/unit-price). */
const unitPrices = computed(() => {
  const productAttributes = props.detail.attributes ?? []
  const items =
    props.detail.variants.length > 0
      ? props.detail.variants.map((variant) => ({
          id: variant.id,
          name: presentationLabel(props.detail.name, variant.name),
          priceCents: variant.price.hidden ? null : variant.price.priceCents,
          attributes: presentationAttributes(productAttributes, variant.attributes ?? []),
        }))
      : [
          {
            id: props.detail.id,
            name: props.detail.name,
            priceCents: props.detail.price.hidden ? null : props.detail.price.priceCents,
            attributes: productAttributes,
          },
        ]
  return computeUnitPrices(items)
})

/**
 * What a stock line says: the real quantity («Quedan 3») replaces the generic low-stock wording,
 * so the quantity never needs a line of its own. Only a published custom quantity stays apart.
 */
function stockLines(
  stock: PublicCatalogProductDetailDto['stockPresentation'],
  status: DisplayAvailability | null,
) {
  const exact = exactQuantityLabel(stock)
  return {
    availability: status && exact ? { ...status, label: exact } : status,
    quantity: exact ? null : displayQuantity(stock),
  }
}

/** Presentations from the smallest size up, each reporting the selected branch only. */
const variants = computed(() =>
  sortVariantsBySize(props.detail.variants).map((variant) => {
    const selectedBranch = variant.availabilityByBranch.find((entry) => entry.isSelected) ?? null
    const stock = stockLines(
      variant.stockPresentation,
      displayAvailability(variant.stockPresentation, selectedBranch?.availability ?? null),
    )
    const unit = unitPrices.value[variant.id] ?? null
    const label = presentationLabel(props.detail.name, variant.name)
    return {
      variant,
      label,
      option: {
        id: variant.id,
        name: label,
        price: displayPrice(variant.price),
        quantity: stock.quantity,
        unitPrice: unit ? `${unit.amount}/${unit.unit}` : null,
        saving: savingLabel(unit?.saving ?? null),
        availability: stock.availability,
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
const stock = computed(() =>
  selected.value
    ? { availability: selected.value.option.availability, quantity: selected.value.option.quantity }
    : stockLines(
        props.detail.stockPresentation,
        displayAvailability(props.detail.stockPresentation, props.detail.availability),
      ),
)
const quantity = computed(() => stock.value.quantity)
const availability = computed(() => {
  const status = stock.value.availability
  if (!status) return null
  return {
    ...status,
    text: props.branchName ? `${status.label} en ${props.branchName}` : status.label,
  }
})

/** «Presentación 2 kg · $110.00 por kg»: each part only when it exists; nothing else is invented. */
const metaLine = computed(() => {
  const unit = unitPrices.value[selected.value ? selected.value.variant.id : props.detail.id]
  const parts = [
    selected.value ? `Presentación ${selected.value.label}` : null,
    unit ? `${unit.amount} por ${unit.unit}` : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? parts.join(' · ') : null
})

const outOfStock = computed(() => stock.value.availability?.isOut ?? false)
const hasWhatsapp = computed(() => normalizeWhatsappNumber(props.whatsappNumber) !== null)
const whatsappMessage = computed(() =>
  productInquiryMessage({
    productName: props.detail.name,
    presentationName: selected.value?.label ?? null,
    branchName: props.branchName,
    url: props.pageUrl,
    outOfStock: outOfStock.value,
  }),
)
const whatsappLabel = computed(() =>
  outOfStock.value ? 'Preguntar por WhatsApp' : 'Pedir por WhatsApp',
)

const presentationsRef = useTemplateRef<{ $el: HTMLElement }>('presentations')
/** «Cambiar» (mobile bar): bring the presentations into view and focus the chosen one. */
async function goToPresentations() {
  await nextTick()
  const element = presentationsRef.value?.$el
  if (!element) return
  element.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  element.querySelector<HTMLInputElement>('input:checked, input')?.focus({ preventScroll: true })
}

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
      alt: `Imagen de ${props.detail.name}, presentación ${selected.value?.label ?? variant.name}`,
      caption: `Presentación ${selected.value?.label ?? variant.name}`,
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
          <p v-if="metaLine" data-testid="catalog-detail-meta" class="catalog-pdp-meta">
            {{ metaLine }}
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
          <CatalogWhatsappLink
            variant="cta"
            :number="whatsappNumber"
            :message="whatsappMessage"
            :label="whatsappLabel"
            :secondary="outOfStock"
          />
          <CatalogDetailShareButton :url="shareUrl" :title="detail.name" mode="copy" />
        </div>
        <p v-if="hasWhatsapp" data-testid="catalog-detail-whatsapp-hint" class="catalog-pdp-wa-hint">
          Abrirá WhatsApp con este mensaje: «{{ whatsappMessage }}»
        </p>
      </div>

      <CatalogDetailPresentations
        v-if="options.length > 0"
        ref="presentations"
        v-model="selectedId"
        :options="options"
      />

      <CatalogBranchBlock v-if="branchDetail" :branch="branchDetail" />

      <CatalogDetailSpecs
        :description="description"
        :groups="attributeGroups"
        :scope="selected ? selected.label : null"
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

  <CatalogDetailStickyBar
    v-if="hasWhatsapp && whatsappNumber"
    :price="price"
    :line="selected ? selected.label : null"
    :can-change="options.length > 1"
    :whatsapp-number="whatsappNumber"
    :message="whatsappMessage"
    :asking="outOfStock"
    @change="goToPresentations"
  />
</template>
