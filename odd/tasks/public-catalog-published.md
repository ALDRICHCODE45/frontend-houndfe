# Public catalog from Published editorial (C3.3 FE)
Implements BE handoff `houndfe-backend/docs/frontend-handoff/07-public-catalog-published.md` (BE merged `fa39192`). Branch `feat/public-catalog-published` from main `217bfa15`.
Out of scope: public cart (no FE cart exists; handoff §5 n/a), media in Published (BE not built, §10), number/range facets (BE §10).

## Specs
- S1 Catalog settings switch. `catalogRequiresPublishedEditorial` boolean on GET/PATCH `/tenants/:tenantId/catalog-settings` (Zod response + PATCH schema, draft, diff, dirty). PATCH sends only the changed key, e.g. `{ "catalogRequiresPublishedEditorial": true }`. Row «Mostrar solo productos con ficha publicada» in edit and read views (switch row convention). Turning it ON asks for confirmation showing the §9 checklist («Antes de encender el interruptor»): publish first, republish legacy rows, republish after adding variants, search only finds Published title/description, up to 60 seconds of public cache. Turning OFF needs no confirm. Only `update:TenantCatalogSettings` can change it.
- S2 Public detail `attributes`. Detail body and each variant may carry `attributes: PublicProductAttribute[]` (handoff §2). Show `display`, keep BE order, group by `section.label` (null section → no heading), render unknown `value.type` with `display`, never fail. Variant attributes shown with their variant. Absent key (switch off) → nothing changes. Empty-detail note must not claim emptiness when attributes exist.
- S3 Public list facets. `facets.attributes?: PublicAttributeFacet[]` (§3) rendered as toggle chips per definition (label, options with count), from the current filtered response, BE order kept. Selection in the URL as repeated `facet=<code>:<option>`; OR within a definition, AND across (BE does it). Query key unchanged when no facets. Changing facets drops `page` and resets detail like category. Active filters visible with one way to clear them. On `400` with `error: "FACET_NOT_AVAILABLE"` (switch on `error`, never `message`): drop the stale facets from the URL and reload the list. Malformed/unknown `facet` URL values that fail `[A-Za-z0-9._-]{1,120}:[A-Za-z0-9._-]{1,120}` are ignored, max 50, no duplicates.
- S4 «Despublicar» in the editorial editor header. `POST /products/:productId/editorial/published/unpublish`, headers `Idempotency-Key` + one `Editorial-Vocabulary-Revision`, never care/contract-version/adoption headers, body exactly `{ expectedCycle, expectedRevision: published.revision }`. Shown when `published` is not null and the user can publish (read+publish). Confirmation says the product leaves the online catalog if the tenant shows only published products. Without a draft, keep the content: call `initialize` first (copies Published into a draft), then unpublish. Errors per §6 table: 409 CONFLICT → reload read, retry with a new key if still published; 409 VOCABULARY_CHANGED → reload vocabulary+read, retry once with a new key; ambiguous network failure → retry with the same key/body/headers; 403 → hide. After success the header shows «Borrador» (draft) or no editorial state.

## Tasks
- T1 | S1 | worker | pending
- T2 | S2, S3 | worker | pending
- T3 | S4 | worker | pending
- T4 | S1-S4 | parent runtime + browser design check against BE dev, docs (design-system), full suite, merge | pending

## Log
- L1 User 2026-11-09: «Si hermano, quiero que todo esto del catalogo publico quede listo.» (after the status report recommending C3.3 FE first)
- L2 Parent decision: without a draft, «Despublicar» initializes first so content is never lost (handoff §6 recommendation); reversible, no product decision opened.
