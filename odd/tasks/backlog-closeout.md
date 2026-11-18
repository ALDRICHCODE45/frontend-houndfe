# Backlog close-out (FE)

The remaining backlog after the pending sweep: editorial admin integration, the POS «Pedido» tab, the browser matrix for routes never checked, and three code improvements the review flagged. The old-route redirect is explained to the owner first.

## Specs
- S1 «lo demas hazlo ya»: editorial admin integration (T12 in odd/tasks/editorial-single-contract.md) completed.
- S2 «lo demas hazlo ya»: the POS «Pedido» tab (ActiveSalePanel.vue, disabled today) works end to end with what the backend supports.
- S3 «lo demas hazlo ya»: light/dark × 1440/390 browser check of /sistema/envios, /sistema/envios/validaciones, /chatbot/solicitudes, /chatbot/solicitudes/:id, /perfil, /catalogo/:branchSlug/p/:productId, /sistema/atencion-chatbot; defects fixed.
- S4 «lo demas hazlo ya»: review advisories — one shared price-lists query for PromotionForm and PromotionConditionsSection; one cards-mode selection filter in AppDataTable; the legacy palette guard also scans .ts class strings and the missing prefixes (divide, outline, placeholder, accent, shadow).
- S5 «la redireccion no se a que te refieres»: explain /pos/decisiones-pendientes and let the owner decide.

## Tasks
- T1 | S4 | worker | done — review advisories
- T2 | S3 | worker | browser matrix for the 7 routes (mocked API), then fixes
- T3 | S1 | explore → plan | editorial admin T12
- T4 | S2 | explore + backend → plan | POS «Pedido» tab
- T6 | S5 | worker | redirect /pos/decisiones-pendientes → /chatbot/solicitudes and remove the old inbox screen from the FE (owner chose)
- T5 | S1–S5 | parent | full suite, build, merge

## Log
- L1 Owner 2026-11-18 (verbatim): «la redireccion no se a que te refieres, lo demas hazlo ya.»
- L2 Backend on the old route: the backfill never ran and is not needed (prod had 0 pending human decisions/zone requests/receipts); since the deploy every new decision is also created as a chatbot request in the same transaction (chatbot-request-wrapper.ts) and resolving from the new inbox syncs the old decision. Old endpoints stay alive until BE unit 13 (owner decides after the new inbox is proven). BE recommendation: FE redirect /pos/decisiones-pendientes → /chatbot/solicitudes is safe now.
- L3 Owner chose «Redirigirla a Chatbot → Solicitudes (recomendado)».
- L4 T3 map (explorer mwmdx5yw-k-bzay): T12 code is merged (T10/T11/T11b: editorial-access.ts:5-15, router :708-712/:753-758, useEditorialDraft :55,59-62); missing: live admin/global run against the real backend (Super Admin global + with tenant, manage:all, specific grants; open/initialize/save/discard, no publish) and two likely global-mode gaps in ProductEditorialView.vue (:27 product title via productApi.getById, :14 goBack to a tenant route). Readiness and unpublish endpoints added after S66: global/manage:all admission unconfirmed (ask backend).
- L5 Backend on «Pedido»: not supported today. Quotations: DRAFT|SENT|EXPIRED|CANCELLED, no CONVERTED_TO_SALE, no route sale→quotation or quotation→sale, no Quotation↔Sale relation; Order/OrderItem retired; credit sales are Sale with CREDIT; no layaway/pre-order. New backend work needed; until the owner decides, keep the tab disabled or hidden. Also: PATCH /quotations/drafts/:id/tax-rate now answers Deprecation: true (per-item IVA snapshot, after docs/quotations-frontend.md eb92df3a). Editorial: no admin HTTP endpoints exist beyond the 9 the FE already consumes (vocabulary/definitions live in backend code).
- L6 T1 done (worker mwmdx5yr-j-punc): usePromotionPriceLists composable (one request, tested), AppDataTable selectedCardRows helper, palette guard scans non-test .ts + divide/outline/placeholder/accent/shadow/decoration/caret (no offenders); 1252 related tests. Owner on «Pedido»: «Lo que sea mas completo hermano.» → both directions (sale → quotation and quotation → sale); requested the backend contract.
