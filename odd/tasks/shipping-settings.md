# Shipping settings screens (FE)
Implements the backend handoff ../houndfe-backend/docs/frontend-handoff/10-shipping-settings-screens.md (BE local main merge bf50f34, seeded on :3003 in Sucursal Centro): delivery zones, pending zone validations, product and variant packaging, shipping boxes, shipping origin, opening hours.
Branch feat/shipping-settings from main 86468b13. Backend and chatbot requests stay first (design-pass-2 S2).

## Specs
- S1. User: «Sí, que lo arme y lo implementamos» (the BE handoff of zones, packaging, boxes, origin and schedule screens). Contract = the handoff doc; this document never restates it differently.
- S2. Menu, user choice «Envíos + Validaciones aparte»: «Envíos» in the Sistema group with tabs Zonas / Cajas / Origen / Horario; the chatbot zone validations in their own entry with a pending count, like Reembolsos.
- S3. Packaging, user choice «Sección en «Presentaciones»»: next to Variantes, only for products (not services); each variant inherits or has its own packaging from its ⋮ menu.
- S4. Units, user choice «Pesos, cm y kg»: surcharge typed in pesos ($45.00), sizes in cm with one decimal, weights in kg (1.25 kg); the app converts to cents and grams.
- S5. Boxes, user choice «Retirar y Eliminar con confirmación»: Retirar sets isActive false and can be reactivated; Eliminar deletes for good after a confirmation.
- S6. Standing rules: «ninguna persona va a buscar algo o va a reconocer o seleccionar algo por su id» (no ids on screen); browser checks judge design against docs/design-system.md (four states, 1440/390, light/dark), not only function.
- S7. Parent decisions: the time zone is fixed to America/Mexico_City and shown as text, not edited; no «copy to all days» shortcut (not requested); a DELIVERY_ZONE_VALIDATION_PENDING on save links to the validations list until the BE adds a zip filter (asked).

## Tasks
- [ ] T1 S1,S6 Foundation: CASL subjects DeliveryZone and ShippingSettings plus action validate (risk item 2, own commit); shared reader for the four error envelopes (A error, B code, C constraints by property, D message); shared {data,pagination} page type; routes and nav entries (S2) with placeholder views — parent inline
- [ ] T2 S1,S2,S6,S7 Zones and validations: zones list (search, type, active filters), zone form by type, deactivate; validation queue with live countdown and urgency, resolve approve/reject with resolutionRequestId, 409 mapping, pending count badge — worker
- [ ] T3 S1,S2,S4,S5,S6,S7 Envíos settings tabs: boxes CRUD with Retirar/Eliminar, origin form, weekly opening hours editor with per-day errors and summary — worker
- [ ] T4 S1,S3,S4,S6 Product and variant packaging in Presentaciones — worker

## Log
L1. User: «Sí, que lo arme y lo implementamos» (to «El backend ofrece armar el handoff de pantallas nuevas: zonas, empaque, cajas, origen y horario»).
L2. BE delivered the handoff (merge bf50f34) and seeded Sucursal Centro: 10 zones of every type, PENDING validations 03900 CRITICAL, 06600 WARNING (2 requesters), 04510 OK (CRITICAL becomes EXPIRED about 3 h after seeding; pnpm seed:showcase re-arms it), boxes «Caja chica» and «Caja mediana», origin Insurgentes Sur 1458 03100, hours Mon–Fri 09:00–14:00 and 16:00–19:30, Sat 09:00–14:00, Sun closed, packaging on 5 products plus a variant override on «Grande» of «Arnés Acolchado para Paseo». manager@houndfe.com has DeliveryZone and ShippingSettings. Notes: four error envelopes; Super Admin gets configured:false for a non-branch tenant id.
L3. Explorer map: validate is not an FE CASL action yet (auth.types.ts:49, ability.ts:6, silently dropped at ability.ts:110-116); normalizeApiError (core/shared/utils/error.utils.ts:63) cannot read envelope B code or C object arrays; the http interceptor handles only 401 «Tenant context required», while zones answer 403 with that message for a Super Admin without a tenant. Patterns: system/catalog-settings (tenant-path API, useSafeTenantId), procurement/suppliers (list+form, crypto.randomUUID), product workspace tasks in ProductWorkspaceNavigation.vue with Variantes in ProductDetailView.vue:2547 and handleVariantAction :1998.
L4. User decisions: «Envíos + Validaciones aparte», «Sección en «Presentaciones»», «Pesos, cm y kg», «Retirar y Eliminar con confirmación» → S2–S5.
L5. BE will add, additively, ?zipCode=NNNNN on GET /delivery-zone-validations and validationId in the 409 DELIVERY_ZONE_VALIDATION_PENDING body on PUT and DELETE /delivery-zones/:zipCode; SHA and exact JSON to follow. Until then the 409 links to the validations list (S7).
