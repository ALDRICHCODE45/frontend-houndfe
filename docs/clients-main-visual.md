# Clients main workspace

The Clients workspace adopts the approved Products and unified-shell visual language. The listing (header, search/table toolbar, table, cards, pagination, list menus and empty states) and its overlays (create/edit slideover, address dialog and delete confirmation) opt in. Sales history and global notifications/toasts keep their previous presentation and behavior.

## Visual review

Open `/pos/customers` with a test account using the existing development server:

1. Compare table and cards in light/dark mode and at narrow widths.
2. Check search, sorting, pagination, view-mode persistence and column menus.
3. Check one-card width, long names/contact data, price-list badges and row/card menus.
4. Review empty, loading and error/retry states. Do not execute destructive actions for visual review.
5. Open the create and edit slideovers, both tabs and the address dialog in light/dark mode, including their nested select popups.
6. Open the delete confirmation from the row/card menu and cancel it; check only its theming, never confirm a destructive action.
7. Open sales history to confirm that surface still works and retains its previous theme.

Automated source/functional tests establish contracts, not rendered fidelity. No browser or live API execution is claimed. Visual acceptance remains user-owned.

## Theme ownership

| Boundary                                             | Owner                                                                                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `hf-theme hf-ui clients-visual`                      | Listing section only; overlays remain sibling nodes outside it.                          |
| `hf-theme hf-ui clients-list-portal`                 | Table column/page-size menus and row/card dropdowns.                                     |
| `hf-theme hf-ui hf-form-overlay clients-form-portal` | Create/edit slideover, address dialog and delete confirmation content roots.             |
| `hf-theme hf-ui clients-form-portal`                 | Nested select popups opened inside those overlays.                                       |
| `clients-visual.css`                                 | Clients-local palette and geometry for listing and overlays; imports the opt-in adapter. |

The local bridge repeats the approved shell palette for list and form portals rather than borrowing the Products-only marker or editing shared styles. The overlay root reuses the same palette and controlled radius scale as the listing (6px controls, 12px panels; circles keep their full radius). Grouped panels use the muted surface and shared border, the billing disclosure link uses the action role with the shared focus ring, and submits reuse the shared `hf-primary-control` foreground/background. Native overlay headers, bodies and footers and native fields inherit the semantic surface/text/font/border/focus roles from `hf-ui`; no rule keys on an element-blind data slot. The default `variant="link"` tabs stay native, driven by the theme aliases. Foundation field-border contrast and semantic error/success roles remain unchanged. Future shell-palette changes should update this bridge alongside its tests.

The delete confirmation opts in through the public `ConfirmModal.ui` content marker only; its semantic `confirm-color="error"`, required description, loading state and confirm/close handlers are unchanged. Sales history, global toasts, endpoints, permissions and business logic are untouched. `CustomersView` passes the marker, and the shared `ConfirmModal` source is not modified.

`CustomersEmptyState` is a stateless message-only unit used by table and card empty slots. `CustomerCardGrid` retains its original empty fallback and loading precedence when no custom slot is supplied. `portalClass` is optional in the grid/card; omission preserves legacy menu presentation.

The shared `AppDataTable` also accepts a separately optional `paginationPortalClass`, forwarded to the page-size menu via `DataTablePagination.portalClass`. This is independent of the existing toolbar `portalClass`: Clients opts into both, while Products and legacy callers keep their previous page-size presentation. No counters, filters, endpoints, permissions or business behavior were added.

## Technical status

Initial RED: 8 expected visual-contract failures and 243 passing tests. Initial GREEN and Products/shell boundary guards: 2,008 passing tests across 147 files. Those early commands also discovered archived copies inside `artifacts/`; their counts are not current-checkout-only evidence. Independent verification exposed a missing page-size portal boundary, which received public-prop RED tests before correction. Final checkout-only checks exclude `artifacts/**` and `.worktrees/**`; actual results are recorded in `odd/tasks/clients-main-visual.md` when observed.

Final independent checkout-only correction verification passed 205 tests across 16 files and closed the page-size portal blocker. Vue-aware typecheck and production build passed; Vite retains its nonblocking large-chunk advisory. Formatting on new presentation files/docs and whitespace checks passed.

Overlay verification (S1-S3): the form writer observed RED10fail/44pass then GREEN54tests/2files. The styles writer reported RED6fail/33pass and GREEN39tests/2files but failed at process cleanup, leaving capacity quarantined; that report is not successful runtime completion. User-authorized read-only diagnosis found no active child writer in the current session's process tree. No worker was replayed and no quarantine was reset.

Parent directly verified the retained files: 289 tests across 19 files, Vue-aware typecheck/build and a 12-path source drift guard passed. Independent verification then passed S1-S3 and the same 289 tests once, with all 12 hashes unchanged. It inspected installed Nuxt/Reka/Vue source to confirm the real teleported dialog and five select listbox roots receive the theme markers, including AddressModal's `content.class` path. Form business scripts and destructive/error/cancellation semantics are unchanged. No source correction blocker remains; these checks are not rendered-fidelity acceptance.

One auxiliary HEAD comparison failed because the pre-existing untracked shell stylesheet has no HEAD version; matching hashes establish stability, not authorship. Scoped CSS/spec/docs formatting and whitespace checks passed. The failed styles worker remains failed/quarantined even though its actual files were independently verified.

The checkout-only full suite remains **not green**: 8,710 passing tests, 5 test timeouts, 35 skipped tests and a suite-initialization hook timeout. Affected files are router.spec.ts, PendingApprovalsView.test.ts and ProductDetailView.test.ts. Their cause is not established; no automatic retry or timeout changes were performed. Global closure waits for the user's decision about investigating those failures. Visual review is also outstanding.

Native assessment is unavailable because the checkout contains pre-existing untracked work; the high-equivalent independent verification plan was followed. No native review approval, commit or publication is claimed. LSP coverage is incomplete; an existing plain-TypeScript `.vue` import false positive was checked with Vue-aware typecheck, and Spanish copy receives auxiliary English spellcheck hints.
