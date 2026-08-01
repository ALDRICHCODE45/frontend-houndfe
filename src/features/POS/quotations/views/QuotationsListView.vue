<script setup lang="ts">
/**
 * QuotationsListView — Slice 1 placeholder (REQ-QTN-001 navigation only).
 *
 * S1 ships a minimal page shell so the route exists, the CASL guard runs,
 * and the sidebar entry resolves. S3 replaces this with the real
 * AppDataTable + status tabs + search + pagination.
 *
 * Composition surface: no logic in this slice. View-level wiring lands in S3.
 */
</script>

<template>
  <section class="quotations-list-view" data-testid="quotations-list-view">
    <header class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold">Cotizaciones</h1>
      <p class="text-sm text-neutral-500">
        Listado de cotizaciones por cliente, con filtros por estado y búsqueda.
      </p>
    </header>

    <div
      class="mt-6 rounded-lg border border-dashed border-neutral-300 p-8 text-center text-neutral-500"
      data-testid="quotations-list-placeholder"
    >
      <p class="text-base font-medium">Próximamente</p>
      <p class="mt-1 text-sm">
        La tabla con paginación, tabs de estado (Borradores / Enviadas /
        Expiradas / Canceladas) y búsqueda se entrega en el Slice 3.
      </p>
    </div>
  </section>
</template>