# Product workspace: operational navigation

## Delivered in I2a (S1, S5, S6)

Choose Identidad, Presentaciones, Contenido or Revisar in any order. These are
work areas, not required steps or publication eligibility checks.

- `ProductDetailView.vue` retains its operational state, schema and handlers.
- Identidad contains the existing identity fields, category, service/product
  type, SAT key and operational description. Category does not determine type.
- Presentaciones retains costs, taxes, service details, inventory, catalog
  settings, variants, lots, price lists and the existing image gallery.
- Both operational groups use `v-show`: navigating does not replace controls
  or discard pending values. The first validation error reveals its work area.
- Read-only users can browse tasks; the existing disabled fieldset and child
  permission props still control editing.
- Navigation does not explicitly save. Existing variant blur/Enter handlers can
  save when focus leaves an input. Operational and variant saves remain distinct.
- Images remain unavailable until creation. Service inventory restrictions and
  unsupported lot editing remain unchanged.

## Delivered in I2b (S1, S5, S6)

Contenido and Revisar lazily mount one real EditorialWorkspace on the first
editorial visit, outside the operational UForm. Later task changes use v-show;
embedded and activeSection props select the existing content/review presentation.
No editorial reads occur before the first authorized visit.

Admission reuses canReadEditorial and the established authenticated-phase,
identity, loaded-permissions and tenant/global-claim requirements. New products,
unready sessions, missing tenants and missing grants receive distinct reasons
without mounting or reading editorial data. Operational update permission does
not substitute for editorial permission or prevent authorized editorial reading.

The existing Workspace/editor lifecycle remains the only sensitive-state owner:
it clears context and cancels requests on actor/tenant/grant changes. Losing
admission also unmounts the editor. Navigation within an unchanged session retains
the same controls and pending input. No auth, store, lifecycle or API was changed;
the standalone editorial route and production publication restriction are intact.

Risk item 2: access gating is security-sensitive. The focused integration matrix
covers unavailable sessions, grant revocation, actor/tenant replacement, tenant-local
manage:all versus explicit global claims, and independent operational read-only state.

## Remaining work

I2c replaces legacy surfaces/actions
and the desktop-only summary with responsive HF presentation and operational
readiness wording. The existing “Lista para publicar” summary is legacy copy,
not a new publication guarantee; its replacement belongs to I2c.

## Verification and rollback

Public-interface tests cover task switching, raw input/DOM retention, error-event
reveal for identity and operational fields, new-product unavailable copy, form
scope and read-only browsing. Existing catalog, service and variant suites remain.
I2b also tests the real Workspace with mocked contract reads: lazy admission,
single mounted root and pending input, independent form scope and context retirement.
Focused Vitest: 46 tests across four files passed. App `vue-tsc` passed; it does
not type-check tests. Browser/theme verification remains with the parent.

I2b rollback boundary: remove Workspace admission/rendering and its added tests,
restoring the interim I2a notices. I2a rollback: remove the navigation component,
task state/error reveal and
mounted group wrappers in ProductDetailView, plus their tests and this document.
No persistence, permission, router or API changes are part of this unit.
