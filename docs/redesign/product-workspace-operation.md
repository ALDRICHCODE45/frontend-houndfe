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

Contenido and Revisar currently explain that editorial integration is not yet
available here; new products instead receive a creation prerequisite. Neither
task mounts an editorial editor or introduces editorial requests in I2a.
The separate editorial route is unchanged.

## Remaining work

I2b adds the single lazy, permission/readiness-gated editorial workspace outside
UForm and preserves it across task changes. I2c replaces legacy surfaces/actions
and the desktop-only summary with responsive HF presentation and operational
readiness wording. The existing “Lista para publicar” summary is legacy copy,
not a new publication guarantee; its replacement belongs to I2c.

## Verification and rollback

Public-interface tests cover task switching, raw input/DOM retention, error-event
reveal for identity and operational fields, new-product unavailable copy, form
scope and read-only browsing. Existing catalog, service and variant suites remain.
Focused Vitest: 31 tests across four files passed. App `vue-tsc` passed; it does
not type-check tests. Browser/theme verification remains with the parent.

Rollback boundary: remove the navigation component, task state/error reveal and
mounted group wrappers in ProductDetailView, plus their tests and this document.
No persistence, permission, router or API changes are part of this unit.
