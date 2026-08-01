<script setup lang="ts">
/**
 * QuotationDetailView — Slice 1 placeholder (REQ-QTN-001 navigation only).
 *
 * Mounted for both /pos/cotizaciones/nueva (create flow) and /pos/cotizaciones/:id
 * (detail). S1 only registers the route — no data fetching, no `createDraft`,
 * no edit controls. S4 adds the createDraft() bootstrap that fires on mount of
 * `/nueva` and the mode-switch between DRAFT (editable) and other statuses
 * (read-only).
 *
 * Composition surface: no logic in this slice. View-level wiring lands in S4.
 */
</script>

<template>
  <section class="quotation-detail-view" data-testid="quotation-detail-view">
    <header class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold">Detalle de cotización</h1>
      <p class="text-sm text-neutral-500">
        Editá la cotización, asignale un cliente, items y lista de precios.
      </p>
    </header>

    <div
      class="mt-6 rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-500"
      data-testid="quotation-detail-placeholder"
    >
      <p class="text-base font-medium">Próximamente</p>
      <p class="mt-1 text-sm">
        El editor con productos, promociones, promociones manuales, fecha de
        expiración y envío por email se entrega en los Slices 4 a 7.
      </p>
    </div>
  </section>
</template>