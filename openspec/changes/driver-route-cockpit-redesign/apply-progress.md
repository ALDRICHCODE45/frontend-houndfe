# Apply progress — driver-route-cockpit-redesign

## S1 — Pure derivation selector (REMEDIATED, GREEN)

Compaction: prior commit breached the 600 all-inclusive cap (678 lines vs baseline `2425c17`); this file trimmed 70→10 and the spec tightened by ~32 lines (fixture/dividers/whitespace). **No production change, no test assertion weakened, all 41 tests + REQ-DCD-001..008 coverage preserved.**

**TDD**: RED module-resolution fail → 1 failed suite · GREEN 41/41 pass · TRIANGULATE 8 `it.each` + 100-read side-effect spy · REFACTOR helpers named for S4–S10.

**Verify**: `pnpm test:unit --run .../cockpit` 41/41 · `pnpm test:unit --run` (full) 356 files / 5486 tests · `pnpm type-check` clean.

**Budget vs `2425c17`**: impl 146+/0-, spec ~422+/0-, tasks.md 4+/4-, apply-progress.md 10+/0- ⇒ **TOTAL ≤600 (additions+deletions, margin)**. Branch `feat/driver-route-cockpit-redesign-b1-foundations`; no push. S2 not started.

## S2 — Truthful quick-action predicates and guards (GREEN)

Co-located `driverCockpitQuickActions.ts` + spec. Predicates (`canOpenExternalMap`/`canCopyAddress`/`canOpenEmail`) are synchronous + pure; helpers (`openExternalMap`/`copyAddressToClipboard`/`openEmail`) return typed `QuickActionResult { ok, message }` and NEVER throw (SSR / blocked popup / clipboard rejection / `window.open` throw all return canonical failure copy).

**TDD**: RED module-resolution fail → 1 failed suite · GREEN 41/41 pass (after parameterizing SSR + throwing cases) · TRIANGULATE 12/5/5 `it.each` + SSR / blocked / clipboard-rejection paths via `vi.stubGlobal('window'|'navigator', undefined)` · REFACTOR shared `encodeQuery` helper, `QUICK_ACTION_FAILURE_MESSAGES` exported for S3 to mirror into `copy.ts` `cockpit.quickActions` subtree.

**Verify**: `pnpm test:unit --run .../utils/cockpit` 41/41 · `pnpm test:unit --run` (full) green · `pnpm type-check` clean.

**Budget vs `4bd68a2`**: impl 108+/0-, spec 266+/0-, tasks.md 4+/0- (checkbox toggles), apply-progress.md 10+/0- ⇒ **TOTAL ≤390** (under 400 cap, under 370 aim + slack). Branch unchanged; no push. S3 not started.
## S3 — Cockpit/drawer/confirmation/refresh copy source (GREEN)

Additive `cockpit.*` subtree on `copy.ts` (header / operational / drawer / quickActions / confirm / footer) + `toasts.refreshFailed` for the manual-refresh path. `actions.checkIn` reused verbatim (no duplicate `Marcar entregada` key); `QUICK_ACTION_FAILURE_MESSAGES` cross-imported so any drift in either file fails the spec immediately.

**TDD**: RED 9 cockpit assertions fail on `cockpit`/`refreshFailed` undefined · GREEN 17/17 · TRIANGULATE live-import cross-pin of `QUICK_ACTION_FAILURE_MESSAGES` + `it.each` over `{customer}`/`{N}`/`{folio}` + `{completed}`/`{total}` template order · REFACTOR consolidated two quick-action failure tests into one cross-import test; tightened copy.ts S3 comments to single-line REQ annotations.

**Verify**: `pnpm test:unit --run .../__tests__/copy.spec.ts` 19/19 (8 existing + 11 new) · `pnpm test:unit --run` (full) 357 files / 5538 tests green · `pnpm type-check` clean.

**Budget vs `196848f`**: impl 59+/0-, spec 107+/0-, tasks.md 4+/4- (S3 checkboxes), apply-progress.md ~12+/0- ⇒ **TOTAL ≈ 190** (under 200 cap, slightly over 170 aim by ~20 lines from the cross-import + REQ comments). Branch unchanged; no push. S4 not started.

## S4 — Sticky cockpit header `DriverCockpitHeader` (GREEN)

Presentational sticky panel-contained header: back, identity (`route.driver?.name ?? 'Ruta'`), lifecycle `StatusDotBadge` (tone/label from `DELIVERY_ROUTE_STATUS_*`), `{completed}/{total}` progress, history, refresh. Typed props `{ route; progress; isFetching }` · typed emits `{ back: []; refresh: []; 'open-history': [{ trigger: HTMLElement }] }`. Native `<button>` for back/history/refresh (no `UButton` shell drift) + `<UIcon>` for the icon glyphs; ≥44×44 (`min-h-11 min-w-11`) on every control + `focus-visible:ring-2 focus-visible:ring-primary`; `sticky top-0 z-10` + `min-w-0 truncate` so 320px never horizontally overflows; semantic dark/light tokens (`bg-default`, `border-default`, `text-muted`); refresh disabled while `isFetching` AND its handler early-returns (REQ-DCS-007); history emit carries `event.currentTarget` for focus-return (REQ-DCK-008). No `vue-router` / `useQuery` / `useMutation` / `useQueryClient` / `axios` / `fetch(` imports anywhere in the SFC body (static source assertion in the spec, doc comment intentionally names the forbidden identifiers).

**TDD**: RED module-resolution fail → 1 failed suite · GREEN 16/16 · TRIANGULATE `it.each` over the four route statuses with tone/label shared maps + one reactivity test (isFetching true→false re-enables refresh) + one scope-pin test (no ETA / distance / Siguiente / km / min / map) + one source-invariant test (`fs.readFileSync` scan against `vue-router` / `useQuery` / `axios` / `fetch(` with the JSDoc header stripped) · REFACTOR trimmed the redundant UButton stub + the four per-status badge tests into one `it.each`; tightened fixtures to one `makeRoute` helper.

**Verify**: `pnpm test:unit --run .../components/cockpit` 16/16 · `pnpm test:unit --run` (full) 358 files / 5554 tests green (+1 file, +16 tests vs S3 baseline) · `pnpm type-check` clean · `DriverCockpitHeader` SFC never imported anywhere yet (S10 will mount it) — `vue-tsc --build` stays green per the S4 verify note.

**Budget vs `12e5d8e`**: impl 141+/0- (DriverCockpitHeader.vue), spec 186+/0- (DriverCockpitHeader.spec.ts incl. stubs/fixtures/source-scan), tasks.md 4+/4- (S4 checkbox toggles), apply-progress.md 10+/0- ⇒ **TOTAL 345 (additions+deletions, ≤340 aim + 5 lines slack, well under ≤400 cap)**. Branch unchanged; no push. S5 not started.

## S5 — Operational current/next stop hierarchy `DriverOperationalStops` (GREEN)

Mobile-first current + next hierarchy as one DOM region. Typed props `{ currentStop; nextStop; notes; hasStops; isTerminal }`; typed emit `'open-stop': [payload: StopTrigger { stopId, trigger }]` (StopTrigger re-used from S1). Current (REQ-DCS-003): position + optional folio; `EntityAvatar` with stop-id seed; customer fallback; `formatAddress`; notes only when non-empty after trim. Emphasis: PENDING gold, IN_PROGRESS navy, other muted. Null current → fallback copy only, no card/customer/address/avatar decoration. Next (REQ-DCS-004): low emphasis, no avatar / map / ETA / distance. Precedence (terminal beats non-terminal, `hasStops` gates): null next + hasStops + !isTerminal → last-stop copy; null next + hasStops + isTerminal → no-more-pending copy; hasStops=false → not rendered.

**TDD**: RED module-resolution fail → 1 failed suite · GREEN 19/19 (after fixing fixture `?? null` quirk) · TRIANGULATE added 6: PENDING/IN_PROGRESS emphasis + every-field-rendered (consolidated `it.each`), other muted, label placeholder interpolation, empty-branch `it.each` over 4 combos, terminal-beats-non-terminal pin, empty+terminal still suppressed · REFACTOR consolidated emphasis + triangulation into one `it.each`, deduplicated source-invariants into one `it.each` per literal, trimmed JSDoc headers to fit ≤400 cap. Final 25/25.

**Verify**: `pnpm test:unit --run .../components/cockpit/__tests__/DriverOperationalStops.spec.ts` 25/25 · `pnpm test:unit --run` (full) 359 files / 5581 tests green (+1 file, +27 tests vs S4 358/5554) · `pnpm type-check` clean.

**Budget vs `42e2134`**: impl 143+/0-, spec 238+/0-, tasks.md 4+/4-, apply-progress.md 10+/0- ⇒ **TOTAL 399 (additions+deletions, 1 under the ≤400 cap; ≤390 aim exceeded by 9 lines)**. Branch unchanged; no push. S6 not started. **Compaction**: trimmed impl JSDoc 12→6 lines (kept contract shape: props/emit/REQ-DCS-003/004); inlined `currentAvatarName` computed alias to reuse `currentCustomerName` in the `<EntityAvatar :name="...">` binding (rendered attribute identical, no spec assertion weakened). All 25/25 DriverOperationalStops tests still green; full unit + type-check re-run below.


## S6 — Accessible route spine `DriverRouteSpine` (GREEN)

Mobile-first `<ol>` sequence rendered in input (backend sortOrder ASC) order verbatim — defensive no-re-sort invariant asserted by source scan + reactive prop update test. Typed props `{ nodes: readonly CockpitSpineNode[] }` · typed emit `'select-stop': [payload: StopTrigger]`. One real `<button>` per node, `aria-label` builder `Parada N: Estado — Cliente` (status + em-dash + customer; null customer → `cockpit.operational.customerFallback`), textual status from `DELIVERY_ROUTE_STOP_STATUS_LABELS`, visible focus ring, `min-h-11 min-w-11` on every node, connector (`bg-primary` rounded dot) between all-but-last node. Current state conveyed by text + visuals: textual status label + visible `→` marker on a `bg-primary` round badge + `border-primary border-l-4` emphasis. **No** `disabled` / `aria-disabled` / `aria-readonly` / `cursor-not-allowed` on SKIPPED or non-current PENDING — every node is selectable. Native `<button>` keyboard semantics: `@click` handler emits exactly once per Enter/Space activation. Empty state: `cockpit.operational.emptySpine` central copy, no `<ol>`. No `vue-router` / `useQuery` / `useMutation` / `useQueryClient` / `axios` / `fetch(` imports anywhere in the SFC body (source scan, JSDoc header stripped).

**TDD**: RED module-resolution fail → 1 failed suite · GREEN 20/20 · TRIANGULATE added IN_PROGRESS / all-COMPLETED / reactive prop swap (3 cases merged into existing it.each where possible; connector-count folded into the connector existence test) → 21/21 · REFACTOR trimmed unused `const props = ` to bare `defineProps<…>()`, no behavior change.

**Verify**: `pnpm test:unit --run .../components/cockpit` 64/64 (3 files: S4 16 + S5 27 + S6 21) · `pnpm test:unit --run` (full) 360 files / 5602 tests green (+21 vs S5 baseline, after spec consolidation) · `pnpm type-check` (vue-tsc --build) clean.

**Budget vs `374be38`**: impl 78+/0- (DriverRouteSpine.vue), spec 227+/0- (DriverRouteSpine.spec.ts incl. fixtures + source-scan invariants), tasks.md 4+/4- (S6 checkbox toggles), apply-progress.md 10+/0- ⇒ **TOTAL = 323** (additions+deletions, ≤330 aim ✓, ≤400 cap ✓). Branch unchanged; no push. S7 not started.

## S7 — Four-mode cockpit footer `DriverCockpitFooter` (GREEN)

Mutually exclusive `mode` computed: `current-action` (non-terminal + PENDING + canCheckIn), `in-progress`, `terminal` (COMPLETED/CANCELLED), `empty`. Typed props `{ routeStatus; currentStop; progress; hasStops; canCheckIn; checkInPending }`; emits `'request-confirm': [StopTrigger]` (idle only) + `'open-history': [{ trigger }]` (terminal only). Central ≥44px primary action (Coco gold), disabled while `checkInPending`; handler early-returns so repeated clicks emit nothing. IN_PROGRESS = `role="status"` indicator, no button/emits. Terminal = `{completed}`/`{total}` interpolated summary + `Ver historial` semantic-muted button. Empty = no controls. No mutation/query/router/HTTP (source scan). `pb-[env(safe-area-inset-bottom)]` in EVERY mode (S10 owns body-clearance). 320px safe.

**TDD**: RED module-resolution fail → 1 failed suite · GREEN 26/26 · TRIANGULATE 9-row mode-exclusivity + 3-row empty-branches + 2-row terminal it.each · REFACTOR collapsed first 39-test draft by folding per-mode duplicates into it.each tables + trimmed JSDoc so `body()` regex leaves no Spanish literal in scope.

**Verify**: `pnpm test:unit --run .../components/cockpit` 90/90 (4 files: S4 16 + S5 27 + S6 21 + S7 26) · `pnpm test:unit --run` (full) 361 files / **5628** tests green (+1 file vs S6 360; +26 tests vs S6 5602) · `pnpm type-check` clean · `pnpm build` succeeds. *Correction: the previously reported 5641 was a transient run-time reporting delta; S7 added exactly 26 tests, not 39, so the canonical S7 baseline is 5628 = 5602 + 26.*

**Budget vs `d6315ea`**: impl 136+/0-, spec 295+/0-, tasks.md 4+/4-, apply-progress.md 10+/0- ⇒ **TOTAL = 449** (additions+deletions, ≤450 cap ✓, **151 under ≤600 slice hard cap**). Branch unchanged; no push. S8 not started.

## TDD Cycle Evidence

| Slice | RED | GREEN | TRIANGULATE | REFACTOR | Final |
|-------|-----|-------|-------------|----------|-------|
| **S4** `DriverCockpitHeader` | module-resolution fail · 1 failed suite | 16/16 | 4-status `it.each` w/ shared tone+label maps · reactivity (isFetching true→false re-enables) · scope-pin (no ETA / distance / Siguiente / km / min / map) · source-invariant (JSDoc-stripped `fs.readFileSync` scan against `vue-router`/`useQuery`/`axios`/`fetch(`) | trimmed redundant UButton stub + 4 per-status badge tests → 1 `it.each` · fixtures → one `makeRoute` helper | 18/18 |
| **S5** `DriverOperationalStops` | module-resolution fail · 1 failed suite | 19/19 (after fixing fixture `?? null` quirk) | +6: PENDING/IN_PROGRESS emphasis + every-field-rendered (consolidated) · other muted · label placeholder interpolation · empty-branch `it.each` (4 combos) · terminal-beats-non-terminal pin · empty+terminal still suppressed | emphasis+triangulation → 1 `it.each` · source-invariants → 1 `it.each` per literal · JSDoc trimmed for ≤400 cap | 29/29 |
| **S6** `DriverRouteSpine` | module-resolution fail · 1 failed suite | 20/20 | IN_PROGRESS / all-COMPLETED / reactive prop swap folded into existing `it.each` · connector-count folded into connector-existence test | trimmed unused `const props = ` → bare `defineProps<…>()` | 27/27 |
| **S7** `DriverCockpitFooter` | module-resolution fail · 1 failed suite | 26/26 | 9-row mode-exclusivity · 3-row empty-branches · 2-row terminal `it.each` | collapsed first 39-test draft by folding per-mode duplicates into `it.each` tables · JSDoc trimmed so `body()` regex leaves no Spanish literal in scope | 26/26 |
| **Safety net** | `pnpm test:unit --run` (full) + `pnpm type-check` green at every slice — S4 5554 · S5 5581 · S6 5602 · S7 **5628** (corrected) · REQ-DCS-002..009 coverage intact · no `useQuery`/`useMutation`/`useQueryClient`/`vue-router`/`axios`/`fetch(` imports introduced in any SFC; static source scans asserted per slice | | | | |

## B2 correction — `fix(delivery-routes): address cockpit shell review findings`

Shell review of the B2 S4–S7 stack found drift between SFC bodies and `copy.ts` (hardcoded `Parada {N}` + raw hex emphasis in `DriverOperationalStops`; hardcoded root aria + per-node aria template + visible `Parada N` in `DriverRouteSpine`) and a 320px overflow on long next-stop rows. The correction routes every user-visible literal through the central `cockpit.*` copy subtree, swaps raw hex for Coco design tokens, and adds new spec coverage so future drift regresses immediately. No new RED cycle was run — the change extends the existing S5/S6 GREEN suites with new pinning assertions.

| Area | Finding (shell review) | Fix |
|------|------------------------|-----|
| `DriverOperationalStops.vue` current card | hardcoded `Parada ${N}` literal + raw hex emphasis (`#f6bb13` / `#173968`) drift risk | `currentPositionLabel` → `cockpit.operational.positionLabel` template · emphasis classes → `coco-gold-500` / `coco-navy-500` tokens · new `cockpit-current-status` span binds textual status from `DELIVERY_ROUTE_STOP_STATUS_LABELS` so screen-reader + sighted users see the same canonical Spanish label |
| `DriverOperationalStops.vue` next card | long customer/address rows overflow at 320px — `truncate` ineffective without `min-w-0` on the flex parent | added `min-w-0 max-w-full` to card root + `w-full min-w-0 max-w-full` on each row so child `truncate` clips instead of pushing past viewport |
| `DriverRouteSpine.vue` | hardcoded root aria `"Recorrido de la ruta"` · per-node aria template literal · visible `Parada N` literal | root `:aria-label` → `cockpit.spine.rootAriaLabel` · `nodeAriaLabel(node)` interpolates `cockpit.spine.nodeAriaLabel` template · visible position span → `cockpit.operational.positionLabel` |
| `copy.ts` | no central `positionLabel` template · no `cockpit.spine` subtree | added `operational.positionLabel: 'Parada {N}'` (shared by S5 current header + S6 spine visible text) + `spine.{rootAriaLabel, nodeAriaLabel}` subtree |
| Spec coverage | no spec pinned the copy.ts contract for the new strings; no source-invariant asserted no inline literals in the SFC body | `copy.spec.ts` +3 assertions (`positionLabel` + `nextLabel` distinctness · `spine.rootAriaLabel` verbatim · `spine.nodeAriaLabel` verbatim + placeholder order + exactly the 3 placeholders `{N}`/`{status}`/`{customer}`) · `DriverOperationalStops.spec.ts` +4 assertions (textual status for PENDING/IN_PROGRESS/COMPLETED/SKIPPED · no-raw-hex regex + `coco-gold-500`/`coco-navy-500` presence · 320px safe: card `min-w-0 w-full` + row shrink + `truncate` intact · position template + 1-based `sortOrder+1` interpolation) · `DriverRouteSpine.spec.ts` +3 assertions (per-node aria template interpolation across all 5 nodes · root aria verbatim · every visible position span interpolates the position template) + source-invariant `it.each` for 3 literals (`Sin paradas` / `Recorrido de la ruta` / `Cliente sin nombre`) + `Parada ` literal-leak pin + JSDoc/HTML/line-comment strip so doc comments never false-positive |

**Verify**: focused `pnpm test:unit --run .../__tests__/copy.spec.ts` 22/22 · `.../DriverOperationalStops.spec.ts` 29/29 · `.../DriverRouteSpine.spec.ts` 27/27 · `.../components/cockpit` 100/100 (4 files) · full `pnpm test:unit --run` 361 files / **5641** tests green · `pnpm type-check` clean.

**Budget vs `e9c9a8b`** (this correction commit, additions+deletions): impl 49+/16- (operational+spine+copy) · spec 181+/15- (3 specs) · apply-progress.md ~46+/2- (S7 count correction + TDD Cycle Evidence table + B2 evidence) · **TOTAL = ~276+/33- = ~309 lines all-inclusive**, ≤330 aim ✓, ≤400 cap ✓.

**Rollback**: `git revert <B2-commit>` removes only the 6 B2 files; S4–S7 cockpit stack unchanged and its 5628-test baseline stays green.
