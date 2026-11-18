# Backlog close-out (FE)

The remaining backlog after the pending sweep: editorial admin integration, the POS «Pedido» tab, the browser matrix for routes never checked, and three code improvements the review flagged. The old-route redirect is explained to the owner first.

## Specs
- S1 «lo demas hazlo ya»: editorial admin integration (T12 in odd/tasks/editorial-single-contract.md) completed.
- S2 «lo demas hazlo ya»: the POS «Pedido» tab (ActiveSalePanel.vue, disabled today) works end to end with what the backend supports.
- S3 «lo demas hazlo ya»: light/dark × 1440/390 browser check of /sistema/envios, /sistema/envios/validaciones, /chatbot/solicitudes, /chatbot/solicitudes/:id, /perfil, /catalogo/:branchSlug/p/:productId, /sistema/atencion-chatbot; defects fixed.
- S4 «lo demas hazlo ya»: review advisories — one shared price-lists query for PromotionForm and PromotionConditionsSection; one cards-mode selection filter in AppDataTable; the legacy palette guard also scans .ts class strings and the missing prefixes (divide, outline, placeholder, accent, shadow).
- S5 «la redireccion no se a que te refieres»: explain /pos/decisiones-pendientes and let the owner decide.

## Tasks
- T1 | S4 | worker | review advisories
- T2 | S3 | worker | browser matrix for the 7 routes (mocked API), then fixes
- T3 | S1 | explore → plan | editorial admin T12
- T4 | S2 | explore + backend → plan | POS «Pedido» tab
- T5 | S1–S4 | parent | full suite, build, merge

## Log
- L1 Owner 2026-11-18 (verbatim): «la redireccion no se a que te refieres, lo demas hazlo ya.»
