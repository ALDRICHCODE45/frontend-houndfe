# HoundFe design system snapshot

Re-synced from the project sources on 2026-11-04; table rules re-synced on 2026-11-07 (premium tables). Every value below was read from the named source `path`; nothing is invented. Offline artboards use only these tokens plus `transparent`, `currentColor` and `color-mix` of them.

## Sources
- `src/core/shared/design-system/houndfe-theme.css`: authoritative `--hf-*` colors (light and `.dark`), font stack, card/control radius, control height.
- `src/core/shared/design-system/houndfe-ui.css`: the `.hf-ui` semantic adapter (Nuxt `--ui-*` aliases), primary pairing, fields, focus, page header, table surface and table layout (widths, pinned edge, resize handle, header grip and ⋯, drag, density, «Columnas» panel, saved cue, bulk bar, totals, views), status badge, row actions, empty state, skeleton.
- `src/core/shared/components/DataTable/` (`AppDataTable.vue`, `columnLayout.utils.ts`, `tableLayout.ts`, `DataTableToolbar.vue`, `README.md`) and `src/core/shared/composables/` (`useTablePreferences.ts`, `useTableViews.ts`): default widths, shrink-to-fit, column menu, density presets, persisted layout and views.
- `src/core/shared/design-system/hf-toast.css`: toast geometry and tones (colors come from `--hf-*` through the `--shell-*` aliases).
- `src/assets/main.css`: Coco shade scales, legacy brand vocabulary, radius scale, `--font-sans`.
- `vite.config.ts`: Nuxt UI color mapping and component slot defaults.
- `docs/design-system.md`, section Patrones: component rules.

Legacy `coco-*` scales are compatibility surfaces. New work uses `--hf-*`.

## Colors: HF semantic roles
Source: `src/core/shared/design-system/houndfe-theme.css` (23 tokens; light on `.hf-theme`, dark on `.dark .hf-theme`).

| Token | Light | Dark | Usage |
|---|---|---|---|
| --hf-page | #f5f6f8 | #0e1520 | quiet canvas behind content |
| --hf-surface | #ffffff | #192332 | panels, cards, tables |
| --hf-surface-muted | #e7eef7 | #202e43 | secondary grouping, neutral badge, checklist panel |
| --hf-field | #ffffff | #121d2c | input background |
| --hf-field-border | #8593a3 | #64758d | field hover and emphasis boundary; also checkbox/indicator outlines (rest is `--hf-border`) |
| --hf-ink | #24313d | #edf2fa | body and operational data |
| --hf-heading | #173968 | #edf2fa | titles, record names |
| --hf-muted | #576574 | #adbcd0 | metadata, column headings, supporting text |
| --hf-border | #dce2e8 | #354459 | quiet dividers |
| --hf-action | #2442f6 | #91b0ff | the single primary action, links |
| --hf-on-action | #ffffff | #132344 | foreground on `--hf-action`, always paired |
| --hf-active | #2442f6 | #b3caff | selection, info tone text |
| --hf-active-soft | #edf0ff | #223555 | selection and info tone background |
| --hf-focus | #2442f6 | #a6c1ff | 2px keyboard focus ring |
| --hf-gold | #f6bb13 | #f2c456 | restrained brand accent |
| --hf-gold-soft | #fff5d6 | #3b311d | gold surface |
| --hf-gold-ink | #443218 | #f2cb71 | text on gold surface |
| --hf-warning | #805511 | #f2cb71 | pending, urgency, `Falta` marker |
| --hf-warning-soft | #fff5d6 | #3b311d | warning badge and pending row tint |
| --hf-success | #236044 | #a2d9b9 | success tone, done step |
| --hf-danger | #b42318 | #ffb4ab | destructive item, danger status, field in error (the one red) |
| --hf-danger-soft | #fef3f2 | #3d2220 | danger status and error state surface |
| --hf-danger-border | #f4b8b2 | #7a3f3b | danger status and error state border |

Derived (all in `houndfe-ui.css`):
- Table header wash `--hf-table-head`: `color-mix(in srgb, var(--hf-ink) 4%, var(--hf-surface))`.
- Success badge background: `color-mix(in srgb, var(--hf-success) 12%, var(--hf-surface))`.
- Urgent badge: background `color-mix(in srgb, var(--hf-badge-fg) 18%, var(--hf-surface))`, border `... 55% ...`.
- Row hover `color-mix(in srgb, var(--hf-active-soft) 55%, var(--hf-surface))`; clickable-row hover `color-mix(in srgb, var(--hf-surface-muted) 45%, var(--hf-surface))`; selected row `--hf-active-soft`.
- Skeleton wash `color-mix(in srgb, var(--hf-ink) 16%, var(--hf-surface))`.
- Danger menu-item highlight `color-mix(in srgb, var(--hf-danger) 10%, var(--hf-surface))`.

## Colors: Nuxt UI mapping and legacy
- Nuxt UI roles, `vite.config.ts` (4): primary `coco`, secondary `coco-navy`, neutral `coco-neutral`, action `coco-gold`.
- Nuxt semantic aliases inside `.hf-ui`, `houndfe-ui.css` (16 `--ui-*`): `--ui-primary` = `--hf-action`; `--ui-error` = `--hf-danger`; `--ui-warning` = `--hf-warning`; `--ui-text-highlighted` = `--hf-heading`; `--ui-text` = `--hf-ink`; `--ui-text-toned` and `--ui-text-muted` = `--hf-muted`; `--ui-text-dimmed` = muted 70% over surface; `--ui-bg` and `--ui-bg-elevated` = `--hf-surface`; `--ui-bg-muted` and `--ui-bg-accented` = `--hf-surface-muted`; `--ui-border` and `--ui-border-muted` = `--hf-border`; `--ui-border-accented` = muted 45% over border; `--ui-radius` = `--hf-radius-control`.
- Shade scales, `src/assets/main.css` (44 tokens, 11 shades each, 50 to 950):
  - `--color-coco-*`: 500 `#2442f6` (50 `#e9edff`, 950 `#040718`).
  - `--color-coco-neutral-*`: 900 `#2c2434` (50 `#f5f4f6`, 950 `#16121a`).
  - `--color-coco-navy-*`: 500 `#173968` (50 `#e7eef7`, 950 `#02060a`).
  - `--color-coco-gold-*`: 500 `#f6bb13` (50 `#fef9e8`, 950 `#281d03`).
- Legacy brand vocabulary, `src/assets/main.css` (4): `--brand-primary` = `--hf-action`, `--brand-action` = `--hf-gold` (fallback `#f6bb13`), `--brand-accent` = `--hf-active`, `--brand-danger` `#ef4444`. Plus `--light-surface-page` `#f5f4f6` (sales entry only).

## Typography
- Family: `--hf-font` = `'Geist', ui-sans-serif, system-ui, sans-serif`, `houndfe-theme.css`. `--font-sans` = `'Geist', system-ui, sans-serif`, `src/assets/main.css`. Offline artboards declare Geist only as a family name with the `--hf-font` fallback; no remote font.
- Weights (3 in use), `docs/design-system.md` Typography: 400 body; 500 medium UI labels and menu items; 600 names, titles, column headings, badges, money. 700 is not used for names or titles. `main.css` loads 400 to 700.
- Sizes (9), `docs/design-system.md` Typography, `houndfe-ui.css`, Patrones:
  - Page title `clamp(1.75rem, 1.55rem + 0.6vw, 2rem)` (28 to 32px), 600, line-height 1.25, letter-spacing -0.045em (`.hf-page-title`).
  - Page subtitle 0.875rem / 1.5, max 62ch (`.hf-page-subtitle`).
  - Detail title 22px (17px on mobile), 600, letter-spacing -0.02em.
  - Section 16px, 600. Empty-state title 15px, 600.
  - Body 14px (table text 0.875rem). Secondary and column headings 13px (0.8125rem). Badge and meta 12px (0.75rem).
- Figures: `font-variant-numeric: tabular-nums` (`.hf-figure`); `main.css` also sets `font-feature-settings: "cv11", "ss01", "tnum"`.

## Spacing
- Scale (6), `docs/design-system.md`: 4, 8, 12, 16, 24, 32px.
- Table content padding `0.75rem`, `1rem` from 640px; table cell inline padding `0.75rem`; primary control inline padding `1rem`; page-header gap `0.35rem`; page header to surface `gap-6`. Source: `houndfe-ui.css`, `docs/design-system.md`.
- Control height `--hf-control-height: 44px` (`houndfe-theme.css`); row-actions target 44px (36px in compact rows).
- Default column widths (`columnLayout.utils.ts`): selection 48px, Acciones 64px (its declared `size` wins), name column 256px, a `w-N` header class N×4px, else the column's declared `size`, else 128px. Bounds: name 160 to 1200px, others 80 to 640px (a declared `minSize`/`maxSize` wins); selection and Acciones are fixed. Shrink floor 96px (`SHRINK_FLOOR`); keyboard resize step 16px (`RESIZE_STEP`).

## Radius
- `--hf-radius-card` 12px, `--hf-radius-control` 6px (`houndfe-theme.css`). Status badge 6px.
- Scale (6), `src/assets/main.css`: `--radius-xs` 4px, `--radius-sm` 8px, `--radius-md` 12px, `--radius-lg` 18px, `--radius-xl` 28px, `--radius-full` 9999px. Inside `.hf-ui`, `--radius-md` = control radius and `--radius-lg` = card radius (`houndfe-ui.css`).

## Shadows
- Table surface (`houndfe-ui.css`): `0 1px 2px color-mix(in srgb, var(--hf-ink) 5%, transparent)`. Use sparingly; soft borders over shadows.
- Toast (`hf-toast.css`): `0 12px 32px -12px var(--shell-shadow), 0 2px 6px var(--shell-shadow-soft)`; the `--shell-shadow*` values are not defined in the sources read.
- Card slot default (`vite.config.ts`): `shadow-sm` with `rounded-lg overflow-hidden bg-default`.
- Pinned edge, only while scrolled (`houndfe-ui.css`): `inset -1px 0 0 var(--hf-border), 8px 0 8px -6px color-mix(in srgb, var(--hf-ink) 14%, transparent)` on the left edge, mirrored on the right; 150ms fade.
- Floating layers (`houndfe-ui.css`): bulk bar `0 12px 32px color-mix(in srgb, var(--hf-ink) 16%, transparent)`; drag ghost `0 8px 24px ... 16% ...`; saved cue without toolbar `0 2px 8px ... 10% ...`.
- Focus: `2px solid var(--hf-focus)`, offset 2px (inset -2px on clickable rows).

## Component rules
Source for all: `docs/design-system.md` Patrones, plus the CSS file named.

- **Buttons** (`houndfe-ui.css` `.hf-primary-control`): 44px min height, 6px radius, 600 0.875rem, `--hf-action` with `--hf-on-action`. One solid primary per page, slideover or card; the rest are outline, ghost or in the menu. Disabled: `--hf-page` background, `--hf-muted` text, `--hf-border` border, opacity 1, `not-allowed`; in dark the label is `color-mix(in srgb, var(--hf-muted) 60%, var(--hf-page))` (about 4:1), because the plain muted label read like the enabled outline button beside it. Same rule for a solid Nuxt primary without the hook. Gold is not the default submit color.
- **Inputs** (`houndfe-ui.css` `.hf-field-control`, hooked on every Nuxt field in `vite.config.ts`): 44px, 6px radius, `--hf-field` background, visible label above, one field surface. Soft rest borders in light and dark: 1px `--hf-border` at rest, `--hf-field-border` on hover, 2px `--hf-focus` ring on focus (wins over hover), `--hf-danger` when invalid, at rest too; disabled does not react to hover. Error message under the field. Checkbox, radio and switch outlines keep the stronger accented boundary (WCAG 1.4.11, 3:1 for non-text controls); text fields are identified by label, placeholder and background.
- **StatusBadge** (`houndfe-ui.css` `.hf-status-badge`): 24px high, 6px radius, 12px/600, dot plus tinted background. Tones: neutral (muted on surface-muted), info (active on active-soft), success (success on 12% mix), warning (warning on warning-soft), danger (danger on danger-soft). Draft and payment method are always neutral. A selection marker («Seleccionado» in the POS customer picker) is the info tone, never Nuxt's `xs` badge (8px text). `urgent`: deeper tint, border, icon instead of dot, no motion. Marker `⚠ 1 aviso`: warning icon plus 12px/600 `--hf-warning`.
- **RowActionsMenu** (`houndfe-ui.css` `.hf-row-actions-trigger`): ⋮ ghost button 44px; more than one action goes in the menu; items have icon and label; destructive last after a separator in `--hf-danger`; confirm items end in `…`; menu items min 44px; `aria-label` names the row.
- **EmptyState** (`houndfe-ui.css` `.hf-empty-state`): one centered column, gap 8px, padding 40px 16px, min-height 8rem; 24px icon in `--hf-muted`, title 15px/600 `--hf-heading`, description 13px `--hf-muted` (max 28rem), at most one button. Kinds: `empty` (inbox), `no-match` (search-x), `error` (triangle-alert; `--hf-danger-soft` surface, `--hf-danger-border`, danger icon and title, `role="alert"`), `forbidden` (lock). Never an illustration; no server message as title.
- **AppDataTable table row** (`houndfe-ui.css` `.hf-data-table`): row height by density (below; Cómoda 64px with a secondary line and 10px vertical cell padding is the default); 40px neutral header (`--hf-table-head`, `--hf-muted` 13px/600, no feature repaint); primary text 600 `--hf-heading` one line ellipsis, secondary 13px `--hf-muted`; figures right-aligned and tabular, absent amount `—`; Acciones column last, 64px, only the ⋮ menu; whole-row click opens (`hf-clickable-row`). The name column is the first data column after selection (or `meta.primary`, `primaryColumn.utils.ts`).
- **Table widths** (`houndfe-ui.css`, `columnLayout.utils.ts`, `AppDataTable.vue`): `table-layout: fixed`; every cell takes `var(--hf-col-w-<id>)` and the table `--hf-table-w` (min 100%), never its content. Defaults as in Spacing; the free space of the surface goes to the name column until the user sizes it (then to the last unsized centre column). At defaults the unsized columns shrink proportionally toward max(own min, 96px), the name column to 160px, before any scroll. Horizontal scroll (`overflow-x: auto` inside the surface) appears only when user widths or those minimums exceed the surface. A cell truncates with an ellipsis inside its width, 12px inline padding.
- **Resize** (`houndfe-ui.css` `[data-resize-handle]`): 8px `col-resize` hit area on the header's right edge, 2px line in `--hf-border` on header hover and `--hf-action` while dragging or focused; width tooltip while dragging; double-click autofits; Alt+←/→ on the header resizes by 16px; announced «Ancho de X: N px».
- **Header grip and ⋯** (`houndfe-ui.css` `.hf-th-*`, `AppDataTable.vue`): the label is the focus target (2px inset `--hf-focus`); on hover/focus a 12px grip floats in the left padding and a 28×32px ⋯ over the right padding with a fade of `--hf-table-head`; pinned columns show a 13px pin mark in `--hf-active`; sort arrow on hover/focus, always once sorted (`--hf-active`). ⋯ menu groups: Ordenar ascendente / descendente (Quitar orden when sorted) · Fijar a la izquierda / Fijar a la derecha, or Desfijar · Mover a la izquierda / derecha (Alt+Shift+←/→ chips) · Ajustar ancho al contenido, Restablecer ancho (disabled until sized) · Ocultar columna (not on the name column).
- **Drag reorder** (`houndfe-ui.css`): the whole header drags; dragged cells tint `color-mix(in srgb, var(--hf-active-soft) 70%, var(--hf-surface))`; a 36px ghost with `--hf-action` border; a 2px `--hf-action` full-height drop line with 8px end dots; Alt+Shift+←/→ moves; moves announced («Columna Total movida a la posición 3 de 10»).
- **Pinning** (`houndfe-ui.css`, `tableLayout.ts`): any column pins left or right; pinned cells are opaque (`--hf-surface`, header `--hf-table-head`); the last left-pinned and first right-pinned cells draw the edge divider and shadow only while content is scrolled under them. Selection is locked left and Acciones (`actions`/`acciones`) locked right: not movable, pinnable or resizable.
- **Locked Acciones width** (`columnLayout.utils.ts` `defaultColumnSize`): the locked `actions`/`acciones` column is 64px unless it declares a `size`, which wins (the stock table's labelled «Ajustar» is 112px); either way it stays locked right, not movable, resizable or hideable, and its header label is visually hidden (`sr-only` «Acciones»), never a lone pin mark.
- **Plain table** (`houndfe-ui.css` `.hf-plain-table`): small `<table>`s inside forms and details (product variants, pricing, margins, price lists, sale items, the chart's data table) wear the list look without the machinery: `--hf-table-head` wash, `thead th` `--hf-muted` 13px/600, cell hairlines on `--hf-border` (none under the last row), tabular figures; spacing stays the feature's. Row hover only with `.hf-plain-table--hover` for rows that do something (editable product tables); sale items have none. Guard: `hf-plain-table.spec.ts`.
- **«Columnas» panel** (`DataTableColumnsPanel.vue`, `houndfe-ui.css` `.hf-columns-*`): shown by default (`:enable-column-visibility="false"` hides it); 23.25rem popover with «Densidad» at the top, then three groups «Fijadas a la izquierda», «Columnas», «Fijadas a la derecha»: 44px draggable rows, 32px pin buttons (`aria-pressed`, `--hf-active-soft` when pressed), visibility switches (the name column always visible), «Restablecer columnas» in the footer. The toolbar button reads «Columnas · N oculta(s)». Below md or in cards mode: a bottom sheet with switches only, which also choose the card fields.
- **Density** (`tableLayout.ts`, `houndfe-ui.css` `[data-density]`): Compacta 40px / Normal 48px / Cómoda 64px (default); compact and normal show only the primary line; segmented radio group as tall as a control, selected `--hf-active-soft` with `--hf-active`; header height unchanged. Only in the panel, never in the toolbar or the mobile sheet.
- **«Guardado en tu vista»** (`houndfe-ui.css` `.hf-table-saved`): 28px pill, success on 12% mix, 12px/600, under the toolbar's right edge, about 2s after a user layout change (only with `persist-layout`), 200ms fade.
- **Bulk bar** (`houndfe-ui.css` `.hf-bulk-bar`): fixed in the viewport, centred over its table, 24px above the safe area, 12px radius, count chip (`--hf-active-soft`/`--hf-active`), optional summary, actions with the destructive last in `--hf-danger`, ✕ «Quitar selección».
- **Totals row** (`houndfe-ui.css` `tfoot.hf-table-totals`, column `meta.total`): 40px footer sticky at the bottom on `--hf-table-head`, 13px/600 tabular, hairline on top; label plus scope «Esta página», «Selección» (with selected rows) or «Total del filtro» (server `totals`).
- **Saved views** (`DataTableViews.vue`, `houndfe-ui.css` `.hf-views`): tabs above the toolbar (44px, active 600 with a 2px `--hf-action` underline), «Cambios sin guardar» in `--hf-warning`, «Restablecer», «Guardar vista»; a «Vista:» select below md. Ventas: «Todas», «Cobranza», «Entregas» (`useSalesViews.ts`).
- **Toolbar-less table** (`AppDataTable.vue`, `houndfe-ui.css` `.hf-table-saved--surface`): no panel, so the ⋯ menu ends with «Restablecer columnas» instead of «Ocultar columna», and the saved cue sits at the surface's top-right.
- **Persistence** (`useTablePreferences.ts`, `useTableViews.ts`): versioned layout `{ order, pinning, sizing, visibility, density }` (v1) in `localStorage` `table-preferences-<persistKey>`; views in `table-views-<persistKey>`. One key per list, never per record (`StockKardex.vue`, `AdminTenantMembersView.spec.ts`).
- **Table surface** (`houndfe-ui.css` `.hf-table-surface`): `--hf-surface`, 1px `--hf-border`, 12px radius, the shadow above, `overflow: hidden`.
- **Toolbar** (`DataTableToolbar.vue`): one row in the table surface: search (`sm:max-w-sm`), filters, `Columnas`, primary action at the far right; a single-choice filter shows its name in the control (`Estado · Todas`, `md:w-52`) and stays on the search row from md; no refresh button by default. When space runs out the search shrinks first, to a 12rem floor (`min-w-48`); filters keep their width; actions never shrink (`shrink-0`). Mobile is two rows: search, then `Filtros` left and actions right with the primary last, always with label and icon; no `Filtros` button when there are no filters.
- **Status badge in a cell** (`houndfe-ui.css`): at a narrow width the badge shrinks to the cell and its label ends in an ellipsis, dot or urgent icon kept on the label line.
- **Page header** (`houndfe-ui.css`): title plus at most one short subtitle on the page background, outside the data surface; no eyebrow.
- **Detail header**: meta line (13px muted: status badge, `location · guardada 3 nov, 20:43`), title 22px/600 `--hf-heading`, actions on the right (one primary, ⋮, close), step strip underneath. On mobile a bar: close, meta plus title, ⋮; the primary moves to the sticky bar.
- **Detail page scroll**: every detail page sits in `DetailPageFrame`: header pinned at the top (never `sticky`), the full-width area below is the only scroller (never a `max-w-*` column), content centred inside it, mobile action bar in the footer slot.
- **Step strip**: `<ol aria-label>`, 22px circles (20px mobile) plus a 13px/600 label, joined by a 24px hairline. done = `--hf-success` fill with check, current = `--hf-action` fill, upcoming = outline, muted. A count rides on its step in `--hf-warning` weight 500. Not navigation.
- **Issue checklist**: one panel on `--hf-surface-muted`, 12px radius, `--hf-border`, 13px; each pending item once, grouped by issue family; states: pending `--hf-warning` 600, blocked-by-save muted, all clear `--hf-success`. It is the only explanation of a disabled primary.
- **Mobile cards**: 12px radius, 16px padding; primary text as stretched link, ⋮ top-right (44px target), secondary line, badge, separated footer with figures left and short date right.
- **Sticky mobile bar**: `--hf-surface`, border-top, 12px/16px padding, 8px gap, 44px buttons, secondary and primary in equal-width columns with centered labels; one primary at most.
- **Cards and balance**: surfaces stay neutral (`--hf-surface`, `--hf-surface-muted`, `--hf-border`); color is for status, urgency and the single primary. No nested decorative cards. Pending rows use the `--hf-warning-soft` tint with a `Falta` marker; `--hf-danger` is for what is wrong or destructive, never for "pending".
- **Skeleton** (`houndfe-ui.css`): ink 16% wash over surface; the table skeleton keeps the real header and 64px rows.
- **Toast** (`hf-toast.css`): viewport `min(360px, calc(100vw - 32px))`, 16px padding, 12px gap, 36px icon tile, 14px/600 title, 13px description, 3px progress bar, enter 200ms and exit 160ms, no motion under `prefers-reduced-motion`.
- **Warning ink**: warning text and markers paint `--hf-warning`. `.hf-ui` binds `--ui-warning` to `--hf-warning` (like `--ui-error` to `--hf-danger`), so `text-warning`, `color="warning"` and `bg-warning/N` follow the token in both themes; `text-(--hf-warning)` is equivalent. Never a palette yellow or amber for text (`text-yellow-*`, `text-amber-*`; guarded by `hf-warning-token.spec.ts`): Nuxt's default yellow-500 is about 1.9:1 on white. Warning badges stay the StatusBadge warning tone (warning on `--hf-warning-soft`).
- **Inline notice with icon** (`SaleAddressSourceNotice`, the driver «Sin ubicación guardada» line, the map tile notice): 12px, 14px icon aligned to the first line (`items-start`, icon `margin-top: 1px`), so a wrapped line on 390px keeps the icon beside its first line. Warning (`--hf-warning`, 600) when the user should act or know the data moved on; muted 400 when it only explains a fallback.
- **Map canvas** (`AddressMapPicker`): 224px high, 12px radius, `--hf-border`; the Leaflet container background is `--hf-surface-muted` (overrides Leaflet's fixed `#ddd`, which stayed light in dark mode when tiles failed). Tiles themselves are not themed. A tile failure keeps the canvas plus the muted notice «Parte del mapa no cargó.».
- **Global**: Lucide-style inline icons; no emoji or external assets; same themed root (`hf-theme hf-ui`) for dialogs, sheets and menus; text always accompanies color; reduced motion respected.

## Counts
HF color roles 23 (x2 themes); derived mixes 6; Nuxt role mappings 4; `--ui-*` aliases 16; Coco shades 44; legacy brand 4 plus 1; font families 1 (2 declarations); weights 3; sizes 9; spacing steps 6; radius 2 HF plus 6 scale; shadows 3 plus focus ring.

## Artboard self-check
List colors and font families used; allowed: the tokens above, `transparent`, `currentColor`, `color-mix` of these tokens. Check both themes, focus ring, 390px behavior of mobile patterns, and no external requests.
