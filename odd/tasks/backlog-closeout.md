# Backlog close-out (FE)

The remaining backlog after the pending sweep: editorial admin integration, the POS «Pedido» tab, the browser matrix for routes never checked, and three code improvements the review flagged. The old-route redirect is explained to the owner first.

## Specs
- S1 «lo demas hazlo ya»: editorial admin integration (T12 in odd/tasks/editorial-single-contract.md) completed.
- S2 «lo demas hazlo ya»: the POS «Pedido» tab (ActiveSalePanel.vue, disabled today) works end to end with what the backend supports.
- S3 «lo demas hazlo ya»: light/dark × 1440/390 browser check of /sistema/envios, /sistema/envios/validaciones, /chatbot/solicitudes, /chatbot/solicitudes/:id, /perfil, /catalogo/:branchSlug/p/:productId, /sistema/atencion-chatbot; defects fixed.
- S4 «lo demas hazlo ya»: review advisories — one shared price-lists query for PromotionForm and PromotionConditionsSection; one cards-mode selection filter in AppDataTable; the legacy palette guard also scans .ts class strings and the missing prefixes (divide, outline, placeholder, accent, shadow).
- S5 «la redireccion no se a que te refieres»: explain /pos/decisiones-pendientes and let the owner decide.

- S6 Backend N18 (BE aebb60ef, docs/frontend-handoff/22-receipt-destination-check.md): `destinationCheck: 'match' | 'mismatch' | 'unknown'` on receipt review items and TRANSFER_RECEIPT `decision`; 'mismatch' → «⚠ El destinatario no coincide con la cuenta del negocio», shown like the amount alert (mismatch?.flagged stays amount-only); 'unknown' = not verified, no alert; `extracted` adds destinationBank, destinationName, destinationAccountLast4, originName, shown with «Detectado en la imagen»; old receipts read 'unknown'; nothing is rejected automatically.

## Tasks
- T1 | S4 | worker | done — review advisories
- T2 | S3 | worker | browser matrix for the 7 routes (mocked API), then fixes
- T3 | S1 | explore → plan | editorial admin T12
- T4 | S2 | explore + backend → plan | POS «Pedido» tab
- T6 | S5 | worker | redirect /pos/decisiones-pendientes → /chatbot/solicitudes and remove the old inbox screen from the FE (owner chose)
- T7 | S6 | worker | done — receipt destination check alert (BE handoff 22)
- T5 | S1–S6 | parent | full suite, build, merge

## Log
- L1 Owner 2026-11-18 (verbatim): «la redireccion no se a que te refieres, lo demas hazlo ya.»
- L2 Backend on the old route: the backfill never ran and is not needed (prod had 0 pending human decisions/zone requests/receipts); since the deploy every new decision is also created as a chatbot request in the same transaction (chatbot-request-wrapper.ts) and resolving from the new inbox syncs the old decision. Old endpoints stay alive until BE unit 13 (owner decides after the new inbox is proven). BE recommendation: FE redirect /pos/decisiones-pendientes → /chatbot/solicitudes is safe now.
- L3 Owner chose «Redirigirla a Chatbot → Solicitudes (recomendado)».
- L4 T3 map (explorer mwmdx5yw-k-bzay): T12 code is merged (T10/T11/T11b: editorial-access.ts:5-15, router :708-712/:753-758, useEditorialDraft :55,59-62); missing: live admin/global run against the real backend (Super Admin global + with tenant, manage:all, specific grants; open/initialize/save/discard, no publish) and two likely global-mode gaps in ProductEditorialView.vue (:27 product title via productApi.getById, :14 goBack to a tenant route). Readiness and unpublish endpoints added after S66: global/manage:all admission unconfirmed (ask backend).
- L5 Backend on «Pedido»: not supported today. Quotations: DRAFT|SENT|EXPIRED|CANCELLED, no CONVERTED_TO_SALE, no route sale→quotation or quotation→sale, no Quotation↔Sale relation; Order/OrderItem retired; credit sales are Sale with CREDIT; no layaway/pre-order. New backend work needed; until the owner decides, keep the tab disabled or hidden. Also: PATCH /quotations/drafts/:id/tax-rate now answers Deprecation: true (per-item IVA snapshot, after docs/quotations-frontend.md eb92df3a). Editorial: no admin HTTP endpoints exist beyond the 9 the FE already consumes (vocabulary/definitions live in backend code).
- L6 T1 done (worker mwmdx5yr-j-punc): usePromotionPriceLists composable (one request, tested), AppDataTable selectedCardRows helper, palette guard scans non-test .ts + divide/outline/placeholder/accent/shadow/decoration/caret (no offenders); 1252 related tests. Owner on «Pedido»: «Lo que sea mas completo hermano.» → both directions (sale → quotation and quotation → sale); requested the backend contract.
- L7 Backend: «Pedido» in progress on BE feat/quotation-sale-conversion with owner decisions: (1) sale draft → quotation discards the sale draft (empty POS); (2) quotation → sale keeps quoted prices/discounts while not expired; expired is refused; missing product / no stock reported per line; (3) SENT and DRAFT convertible unless expired/cancelled/converted; CONVERTED_TO_SALE + saleId/quotationId links, Idempotency-Key, coded rejections; handoff doc to follow. Tax-rate override deprecated: do not offer it on new quotations, show included IVA from the response; exact rule to be written in docs/quotations-frontend.md (confirm before removing the control). Editorial: readiness/unpublish admit global mode and manage:all in code (missing BE positive HTTP tests); GET /products/:id admits global mode (CASL manage:all when isSuperAdmin and no tenant). No editorial live harness exists; building one (cash-live pattern, 4 actors) is new BE work the owner must decide.
- L8 T6 done 3fb8f0fe (worker mwme47uv-m-ao95): /pos/decisiones-pendientes redirects to /chatbot/solicitudes (query/hash dropped; target keeps read:ChatbotRequest, so read:HumanDecision-only users get /403); old inbox api/composables/views/components/styles deleted; kept human-decision types (query-keys) and humanDecisionPresentation (product-units spec). Leftovers → T6b: vitest.auth.owner.config.ts:28, e2e/responsive human-decisions specs, VITE_HUMAN_DECISIONS_OFFLINE_DEMO, http.ts opt-in, humanDecisionQueryKeys.
- L9 T7 done (worker mwmehnpq-o-j7c3): chatbot 1341 tests; tag «El destinatario no coincide con la cuenta del negocio» (triangle icon, like the amount tag); lines «Beneficiario: X · Banco destino: Y · Cuenta destino: ****9616» and «Ordenante: Z». Not covered: receipt review queues (GET /sales/:id/receipts, /sales/receipts/pending) — the FE has no screen consuming them.
