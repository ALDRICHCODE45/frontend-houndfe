# HoundFe design system snapshot
Snapshot of implemented HF foundations and offline proposal rules. This is not evidence that every application route or state has completed migration.

## Authority
- src/core/shared/design-system/houndfe-theme.css: authoritative light/dark colors, font stack and geometry.
- src/core/shared/design-system/houndfe-ui.css: primary pairing, fields, 2px focus, title/subtitle, table surface and shadow.
- docs/design-system.md: approved HoundFe composition and target spacing/type guidance, plus the Patrones catalog.
- src/assets/main.css: legacy semantic roles now delegate to HF; literal Coco scales remain compatibility surfaces, not proposal defaults.
- src/core/shared/design-system/useHfAppTheme.ts: App owns the body HF boundary and removes only its own markers.
- src/features/catalog/styles/catalog.css: public catalog remains deliberately light, including teleported dialogs, under either host theme.
Historical artifacts/responsive or artifacts/v0-fidelity CSS is not the active authority.

## Colors
| Token | Light | Dark | Usage |
|---|---|---|---|
| --hf-page | #f5f6f8 | #0e1520 | page |
| --hf-surface | #ffffff | #192332 | surface |
| --hf-surface-muted | #e7eef7 | #202e43 | surface muted |
| --hf-field | #ffffff | #121d2c | field |
| --hf-field-border | #8593a3 | #64758d | field border |
| --hf-ink | #24313d | #edf2fa | ink |
| --hf-heading | #173968 | #edf2fa | heading |
| --hf-muted | #576574 | #adbcd0 | muted |
| --hf-border | #dce2e8 | #354459 | border |
| --hf-action | #2442f6 | #91b0ff | action |
| --hf-on-action | #ffffff | #132344 | on action |
| --hf-active | #2442f6 | #b3caff | active |
| --hf-active-soft | #edf0ff | #223555 | active soft |
| --hf-focus | #2442f6 | #a6c1ff | focus |
| --hf-gold | #f6bb13 | #f2c456 | gold |
| --hf-gold-soft | #fff5d6 | #3b311d | gold soft |
| --hf-gold-ink | #443218 | #f2cb71 | gold ink |
| --hf-warning | #805511 | #f2cb71 | warning |
| --hf-warning-soft | #fff5d6 | #3b311d | warning soft |
| --hf-success | #236044 | #a2d9b9 | success |
| --hf-danger | #b42318 | #ffb4ab | destructive action text/icon, danger status, field in error |
| --hf-danger-soft | #fef3f2 | #3d2220 | danger status background |
| --hf-danger-border | #f4b8b2 | #7a3f3b | danger status border |

## Typography
Source houndfe-theme.css: Geist (Google Fonts, OFL), ui-sans-serif, system-ui, sans-serif. One token: --hf-font; --shell-font and --font-sans (main.css) follow it. Manrope and Inter are retired.
Weights: 400 body, 500 medium UI labels, 600 names, titles, column headings and badges; 700 is not used for names or titles. Figures use tabular-nums.
Offline artboards MUST use only the existing fallback: ui-sans-serif, system-ui, sans-serif; no remote fonts or URLs.
Source houndfe-ui.css: page title clamp(1.75rem,1.55rem + .6vw,2rem), weight600, line-height1.25, letter-spacing-.045em; subtitle .875rem/1.5,max62ch; control .875rem/600.
Source docs/design-system.md targets: section16–18px/600, body14–16px, support12–14px. These are documented targets, not claims of globally migrated CSS.

## Spacing and geometry
Source houndfe-theme.css: --hf-radius-card12px, --hf-radius-control6px, --hf-control-height44px.
Source docs/design-system.md target spacing scale4,8,12,16,24,32px.
Source houndfe-ui.css: table padding .75rem/mobile and1rem from640px; primary inline padding1rem.
Source houndfe-ui.css shadow: 0 1px 2px color-mix(in srgb,var(--hf-ink)5%,transparent). Use sparingly.
Source houndfe-ui.css focus:2px solid var(--hf-focus),offset2px.

## Component rules
- Page heading outside surfaces; readable bounded forms rather than applying table geometry blindly.
- Blue primary with --hf-on-action in both modes; gold restrained brand accent, not default submit color.
- 12px meaningful panels;6px controls,44px hitareas. Field boundary uses --hf-field-border; quiet decorative dividers use --hf-border.
- No nested decorative cards or double input borders. Visible labels, semantic markup, keyboard focus and reduced motion.
- Inline SVG icons, consistent stroke; no emoji or external assets. Product illustration labeled illustrative, not a real photo.
- Same themed root for dialogs, sheets, tooltips and overlays. Destructive and danger use --hf-danger (+ -soft/-border for status), always with text and an icon; no arbitrary reds. Patterns (badge, row actions menu, clickable row, checklist, step strip) are cataloged in docs/design-system.md, section Patrones.
- Navigation is a UI proposal, not backend workflow/order; no mandatory sequence invented.
- Prototype state controls visibly identify simulated local behavior; no real requests, storage, uploads or persistence claims.
- Operational save and editorial save/publication remain distinct; no universal Save all or autosave. Care/private evidence never appears in public-style preview.

## Implemented integration contracts
- App imports the HF adapter and owns `body.hf-theme.hf-ui.hf-app`; importing the stylesheet alone must not repaint isolated consumers.
- Legacy page/card/field/text roles are rebound inside `.hf-ui`, where descendant HF tokens resolve. Compatibility gold/black pairs remain until their individual consumers migrate; do not recolor only one half of a pair.
- Shared filter portals carry their family-specific HF hooks. Omitted portal overrides preserve native defaults; error precedence and model/event behavior remain intact.
- Date popovers are viewport-bounded with horizontally scrollable presets on narrow screens. Category/SAT controls preserve separate create/selection actions and restore trigger focus; nested Escape must not dismiss the parent form.
- The quick-create SAT field occupies a full-width row. Its bounded verification covers 390/1440px and both themes, not every device or state.
- Confirmation dialogs retain destructive semantics and expose their description through the native accessible association, without visible duplication.
- Catalog scrims/detail/image preview use catalog-owned light roles. Private-shell dark mode must not silently change this public policy.
- Runtime verification and remaining limits are recorded in `docs/redesign/{shared-filter,product-actions,product-selector,confirmation-modal,catalog-hf-overlays}-verification.md`. Geometry and DOM evidence are not substitutes for contrast or assistive-technology validation.

## Artboard self-check
List colors and fonts; only values above or transparent/currentColor/color-mix of these tokens allowed. Check both themes, focus, navigation,390px and no external requests.
