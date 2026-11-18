# Pending small and medium items (FE)

Backlog sweep after the selection/design pass deploy: the small items, the medium ones, and the backend coordination they need. Large items (old route redirect, editorial admin T12, POS «Pedido» tab) stay pending for the owner.

## Specs
- S1 «adelante con los chicos por favor y los medianos tambien»: the small items — DriverPicker placeholder «Selecciona un repartidor» ≥ 4.5:1 in light and dark; promotion summary names the price lists instead of «Solo con N lista(s) de precio»; Caja visual leftovers (two «Reintentar» errors for one failed read, «Aún no hay un turno en foco» card above mobile lists, 28px dialog ✕, decorative blue tint on «Declaración original»); fragile test permissions.spec.ts:557-562; the pre-existing eslint errors in src (18 files); evidence screenshots removed.
- S2 medium: employees list on phone cards can select rows (row mark on each card, header select-all reachable); Caja checked against the real backend (e2e/cash-live, never run); UI audit leftovers re-scoped and closed.
- S3 «lo otro aun no, pero no lo pierdas de vista»: /pos/decisiones-pendientes redirect, editorial admin T12, POS «Pedido» tab stay listed as pending.
- S4 «sobre lo que necesite del backend, coordinate con el para la informacion que necesites»: backend facts come from the backend session (intercom), never guessed.

## Tasks
- T1 | S1 | worker | done 8188f8d9 — DriverPicker placeholder contrast + promotion summary price-list names
- T2 | S1 | worker | done 171e94c1, 87fa4446 — Caja visual leftovers
- T3 | S1 | worker | eslint errors in the 18 files + permissions.spec.ts:557-562 hardening
- T4 | S2 | worker | done aca0a631 — employees phone cards row marks
- T5 | S2, S4 | backend coordination + worker | Caja live run against the real backend (e2e/cash-live)
- T6 | S2 | explore | done — re-scope in L3
- T6a | S2 | worker | done 9a316912 — legacy palette guard + LoginOtpForm:67 + docs/design-system.md rollout (:5-29) and UCard theme (:109) + design/system.html section for selection primitives, Combobox, Segmented, SaveBar, ConfirmModal
- T6b | S2 | parent | records: hf-ui-complete-audit A2–A6 closed/superseded, coverage.json, editorial-session-handoff next session
- T7 | S1–S2 | parent | full suite, type-check (vue-tsc --build), build, merge to main

## Pending (owner decides when)
- P1 /pos/decisiones-pendientes redirect (needs backend backfill)
- P2 Editorial admin integration T12 (odd/tasks/editorial-single-contract.md)
- P3 POS «Pedido» tab (ActiveSalePanel.vue disabled; sale → quotation flow)

## Log
- L1 Owner 2026-11-18 (verbatim): «adelante con los chicos por favor y los medianos tambien, lo otro aun no, pero no lo pierdas de vista, y sobre lo que necesite del backend, coordinate con el para la informacion que necesites.»
- L2 S1 evidence screenshots: untracked results/shots removed from odd/evidence/selection-and-design-audit (scripts stay committed).
- L3 T6 re-scope (explorer mwman62b-5-9j23): A2 done (paperwork stale in docs/redesign/editorial-session-handoff.md:14-20); A3 partly (LoginOtpForm.vue:67 text-neutral-500, no guard against coco-*/raw palette); A4 done (leftovers are T1/T2/T4); A5 partly (design-system.md:5-29 rollout and :109 UCard theme stale; design/system.html lacks the selection primitives, Combobox, Segmented, SaveBar, ConfirmModal); A6 partly (coverage.json never marked though 594 shots/46 routes in system-redesign L36/L45, design-pass-2 and selection audit L18/L19). Split T6a (worker) / T6b (parent records).
- L4 T1 done 8188f8d9 (worker mwman47x-1-4gon): DriverPicker placeholder via :ui text-(--hf-muted) (hf-form.css not loaded on that slideover); promotion summary «Solo con: A, B, C y N más» (PromotionForm reads the shared [price-lists] cache). T2 done 171e94c1 (worker mwman4n2-2-4sqs) + parent 87fa4446: one error for one failed session read (movements hidden while failing), idle shift card after the lists below 1024px (CSS only), «Declaración original» neutral; the 28px ✕ was the shared ConfirmModal close → size-11 (all 67 callers). Left: other .cash-note boxes keep --hf-surface-muted.
- L5 T4 done aca0a631 (worker mwman5i4-4-396o): AppDataTable cards mode with row selection → 44px mark per card (never opens it), mixed «Seleccionar todos», bulk bar fed; rowMarkLabel/selectAllLabel props; employees 1401 related tests. Parent: Promotions names its card marks. T6a done 9a316912 (worker mwmaqr4m-6-ivsk): legacy-palette-guard.spec.ts, LoginOtpForm text-muted, design/system.html «Selección y formularios» + system.md entry. Parent: removed the dead quotations p[class~=text-(--brand-primary)] rule and its allowlist key (spec updated), applied the docs rollout and UCard theme text. T5: backend preparing an isolated run (Postgres houndfe-cash-live :5435, migrations applied; harness server blocked by its own RESEND_API_KEY guard, investigating); FE origin http://127.0.0.1:4189 confirmed; contract unchanged (cents, :id routes, Idempotency-Key; display fields 65b32995, custody by recipient 03bdf0bd).
