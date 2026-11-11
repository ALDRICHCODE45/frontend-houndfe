<script setup lang="ts">
import type { AttributeGroup } from '../utils/detail-presentation'

/**
 * Description and characteristics as open accordions. The characteristics are those of the
 * selected presentation (`scope` names it); only published data is listed, unknown data is omitted.
 */
defineProps<{
  description: string | null
  groups: AttributeGroup[]
  scope: string | null
}>()
</script>

<template>
  <div data-testid="catalog-detail-specs" class="catalog-pdp-specs">
    <details v-if="description" class="catalog-pdp-accordion" open>
      <summary>
        Descripción
        <UIcon name="i-lucide-chevron-down" class="size-4" aria-hidden="true" />
      </summary>
      <div class="catalog-pdp-accordion-body">
        <p data-testid="catalog-detail-description" class="catalog-pdp-description">
          {{ description }}
        </p>
      </div>
    </details>
    <details v-if="groups.length > 0" class="catalog-pdp-accordion" open>
      <summary>
        <span>
          Características
          <small v-if="scope" data-testid="catalog-detail-specs-scope">{{ scope }}</small>
        </span>
        <UIcon name="i-lucide-chevron-down" class="size-4" aria-hidden="true" />
      </summary>
      <div class="catalog-pdp-accordion-body">
        <section
          v-for="group in groups"
          :key="group.id"
          data-testid="catalog-detail-spec-group"
          class="catalog-pdp-spec-group"
        >
          <h3 v-if="group.label">{{ group.label }}</h3>
          <dl>
            <div v-for="attribute in group.attributes" :key="attribute.code">
              <dt>{{ attribute.label }}</dt>
              <dd>{{ attribute.display }}</dd>
            </div>
          </dl>
        </section>
        <p v-if="scope" class="catalog-pdp-spec-note">
          Solo se muestran los datos publicados de la presentación elegida.
        </p>
      </div>
    </details>
  </div>
</template>
