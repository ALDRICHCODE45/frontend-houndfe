# Small pending items after the cleanup

## Specs
- S1 Owner (2026-11-27, verbatim): «ya hice push, hay aun un archivo sin commitear en main, que hacemos con el? 2. ya esta hecho el deploy del backend, hay que hacer los pendientes chicos ya. despues de eso, revisamos las ideas que dejamos para despues.»
- S2 The untracked file was `design/customers-module/layout.json` (canvas board positions, local UI state): deleted and `design/*/layout.json` ignored (precedent: design/cash-redesign/layout.json was removed before).
- S3 Backend 699d79f2 (GET /cash-registers `drawerHeld`) is deployed everywhere (owner, S1): remove the cash picker fallback (`useCashUnreleasedSessions`, `cashRegisterBusyLabel`, `heldSessions`, `busyScope`, `busyChecking` — style-cleanup U8, cash-picker-unreleased L4).
- S4 `SaleItemRow` `composition` opt-in branch is dead (single caller ActiveSalePanel always passes true — style-cleanup L7): collapse onto the live markup.
- S5 `docs/design-system.md` still describes the deleted `--brand-*` / `--light-*` tokens (:14, :20, :582 per style-cleanup L7) and old radius/marker statements («remapped only under markers»): update to the current system (design/system.md is the synced source).

## Tasks
- [x] T1 S2 layout.json deleted + ignored — parent
- [x] T2 S3-S5 — worker
- [ ] T3 Full suite, merge — parent

## Log
- L1 Owner S1 (2026-11-27). Pushed main (origin/main = local main).
- L2 T2 (worker mwzixbv8-n-duz0): S3 cash fallback removed (useCashUnreleasedSessions, cashRegisterBusyLabel, heldSessions/busyChecking/busyScope/needsHeldFallback; grep 0 hits); drawerHeld is the only source, absent = free, 422 path kept (names the register, refetches registers, «Ver la sesión» via heldBy or audit). S4 SaleItemRow `composition` prop removed (only caller ActiveSalePanel:360 always passed true). S5 docs/design-system.md stale statements fixed (:14 brand aliases, :20 guard, :582 legacy map, :658 checkout paint → hf-pay-* sheet; radius statement added). Tests: cash-register 689 (8 fallback-only removed, 2 rewritten), sales 2311 (2 omitted-prop tests removed, 7 rewritten), design-system 168, related 44 / 656; type-check clean. Possibly stale doc rows left: :656, :663, :670.
