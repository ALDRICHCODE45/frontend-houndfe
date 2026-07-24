# HoundFe Design System

## Palette

- **Primary:** amber — primary actions, current selection, active state indicators only.
- **Secondary:** rose — reserved secondary accent.
- **Neutral:** zinc — surfaces, text, borders. Dark mode: zinc-900 / zinc-950.
- **Status:** success (green), warning (amber-tinted), error (red), info (blue) — state communication only (badges, debt text), never decoration.
- Source of truth: `vite.config.ts` → `ui.colors`.

## Typography

- **Family:** Outfit (weights 100–900), loaded via Google Fonts in `src/assets/main.css`, set as `--font-sans` in `@theme`.
- **Monospace:** system default mono stack — legitimate for folio numbers, tabular data, and measurements (`font-mono`, `tabular-nums`). Never used as decoration.
- **Scale:** fixed rem sizes (not fluid clamp). Body `text-sm`. Clear weight/size steps (`font-bold`, `text-lg` / `text-xl` / `text-2xl`).
- **Measure:** body content targets 65–75ch.

## Components

- **System:** Nuxt UI 4 via Vite plugin. All primitives (`UButton`, `UBadge`, `UTabs`, `UCard`, `UDropdownMenu`, `UTooltip`, `USeparator`, `USkeleton`, `USlideover`, `UModal`) are globally auto-imported — no per-file imports.
- **Buttons:** `variant` (solid default, outline, ghost, soft), `color` (primary, neutral, error), `size` (sm, md). Icon + label pattern. Same shape across the surface.
- **Badges:** `variant="soft"` with semantic `color` for status. `variant="outline"` for neutral counts.
- **Cards:** `rounded-lg`, subtle shadow, `bg-white dark:bg-zinc-900`. No nested cards.

## Patterns

### Sticky workbench header
Compact bar pinned to `top-0` with `backdrop-blur` and `border-b`. Contains: back button, folio (monospace, prominent), status badges, date, total, inline action buttons. Persists on scroll.

### Tabbed workbench body
`UTabs` with `:unmount-on-hide="false"` so tab panel state survives switching. Tabs: Productos (items + count label), Pagos y deuda (totals + debt badge when `debtCents > 0`), Datos (metadata grid), Comentarios (timeline + input). Default: Productos.

### Metadata grid
Bordered cards in a responsive `sm:grid-cols-2` grid. Each card: label + value. Click-to-assign affordance on vendedor card.

### State vocabulary
- Loading: skeleton blocks (never center spinner).
- Debt: red text/badge when `debtCents > 0`, green when paid in full.
- Disabled actions: visible with tooltip explaining why (e.g. DRAFT PDF entries).
