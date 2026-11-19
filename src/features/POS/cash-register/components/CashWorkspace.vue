<script setup lang="ts">
/**
 * Shell of the Caja shift timeline (direction A): three regions.
 *
 *   side    — «Tu turno» and the session list (the branch's sessions for a
 *             supervisor, the own ones otherwise);
 *   main    — the selected shift: its header, the «Siguiente paso» bar and the
 *             timeline with each task opened in place;
 *   context — the shift summary, «Por recibir» and the permission note.
 *
 * Presentational only: it owns no query, command or selection. The page
 * heading is always the workspace title, so it matches the breadcrumb. Below
 * lg the regions stack (main, context, side — the shift first, as on the 390
 * artboard) and the optional `bar` slot is a
 * sticky action bar placed OUTSIDE the scrolling content, so it never covers
 * the focused field (WCAG 2.4.11).
 */
defineProps<{ title: string }>()
</script>

<template>
  <section class="cash-workspace cash-visual" data-testid="cash-workspace">
    <header class="cash-workspace-header">
      <h1 class="cash-page-title" data-testid="cash-workspace-heading">{{ title }}</h1>
    </header>
    <div class="cash-a-grid">
      <aside class="cash-a-side" aria-label="Sesiones" data-testid="cash-workspace-side">
        <slot name="side" />
      </aside>

      <main class="cash-a-main" aria-labelledby="cash-shift-heading" data-testid="cash-workspace-main">
        <header class="cash-a-head" data-testid="cash-workspace-head">
          <slot name="head" />
        </header>
        <slot />
      </main>

      <aside
        v-if="$slots.context"
        class="cash-a-ctx"
        aria-label="Resumen del turno"
        data-testid="cash-workspace-context"
      >
        <slot name="context" />
      </aside>
    </div>

    <div v-if="$slots.bar" class="cash-mobile-bar" data-testid="cash-workspace-bar">
      <slot name="bar" />
    </div>
  </section>
</template>
