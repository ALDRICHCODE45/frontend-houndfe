# Archive Report — custom-payment-methods (Métodos de cobro)

```yaml
schema: gentle-ai.archive-result/v1
archive_date: 2026-08-27
change: custom-payment-methods
mode: openspec
branch: feat/custom-payment-methods (merged to main via fast-forward)
head: fd264dde0868b43a611125f5bfd4aa12bf70b416
target: main
status: success
verdict: pass_with_warnings

blockers: 0
critical_findings: 0
warnings: 1
suggestions: 8
requirements: 30/31
scenarios: 31/31
test_command: pnpm test:unit --run
test_exit_code: 0
test_files: 321
test_count: 4843
build_command: pnpm build
build_exit_code: 0
```

## Summary

Feature **custom-payment-methods** (catálogo de métodos de cobro por sucursal)
implementada, verificada (PASS with warnings) y mergeada a `main`.

**Integración completa**: admin CRUD (`/admin/payment-methods`) + tiles POS en la
grilla de cobro (`PaymentModal`/`DebtPaymentModal`) + snapshot `paymentMethodName`
preferido en sale detail/timeline + short-circuit de errores de catálogo en el cobro.

## Commits (rama feat/custom-payment-methods → main)

| Commit | Contenido |
|--------|-----------|
| `8badb29` | docs(sdd) + S1–S4A (foundations, admin api/composables/view, form/actions, slideover/cardgrid, tile-identity util + POS projection + types) |
| `41117bc` | S4B — tiles custom en modales POS + `paymentMethodId` threading + `catalogClearSignal` |
| `de85c10` | S5A — charge error map + short-circuit antes de legacy dispatch |
| `fb5acf4` | S5B — sale detail/timeline prefieren `paymentMethodName` |
| `b629a0c` | fix(types) — 14 errores `vue-tsc --build` (el gate real; `--noEmit` es no-op) |
| `cb0dcde` | docs(sdd) — apply-progress final + verify-report PASS |
| `fd264dd` | docs(sdd) — verify-result envelope + parent lifecycle tasks |

## Reviews (receipt-driven, RDD global ON)

| Review | Candidato | Verdict |
|--------|-----------|---------|
| `review-2583aa39475891a3` | S4B | approved (6 advisory) |
| `review-836102eef63a5494` | S5A | approved (4 advisory) |
| `review-5bcdb35c10a7662c` | S5B | approved (3 advisory) |
| `review-2060ef7c24a1fb88` | type-fix | approved (CRITICAL refuted by refuter) |
| `review-a8bef72423861b01` | docs de cierre | approved (3 advisory) |
| `review-0838b66fa9f2a06c` | envelope + checkboxes | approved (4 advisory) |

Todas las reviews aprobaron con findings advisory/informational no-bloqueantes
(ninguno abrió corrección). El único CRITICAL (watch reactivity en el type-fix) fue
**refutado** por el rol refuter (open es `defineModel` → watch correcto).

## Warnings (follow-up debt, no bloqueante)

1. **REQ-PM-007 PARTIAL** — el admin error map cubre 3 de 7 códigos mandados
   (`DUPLICATE_NAME`, `ENTITY_NOT_FOUND`, `NAME_TOO_LONG`). Los 4 restantes
   (`INVALID_NAME`, `INVALID_CATEGORY`, `INVALID_SUBTITLE`, `SUBTITLE_TOO_LONG`) se
   pre-validan en el cliente y no llegan al wire. Recomendado como follow-up: agregar
   los 4 códigos al map.
2. Advisory de las reviews (S4B/S5A/S5B): closed-modal `catalogClearSignal` drop,
   chain end-to-end solo piecewise, `invalidateQueries` fire-and-forget,
   empty/whitespace `paymentMethodName` fallback, timeline type-guard asymmetry,
   paymentId-keyed Map con ids duplicados. Todos no-bloqueantes, aceptados como
   follow-up debt en el verify-report §7.

## Verified

- `pnpm test:unit --run` → 321 files / 4843 tests pass.
- `pnpm exec vue-tsc --build` → clean (exit 0).
- `pnpm build` → exit 0.

## Archive evidence

Snapshot → `mv` → `diff -r` (mecánico, archivos idénticos). Change movido de
`openspec/changes/custom-payment-methods/` a
`openspec/changes/archive/2026-08-27-custom-payment-methods/`.
