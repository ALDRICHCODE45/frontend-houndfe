# Run catalog detail checks without touching the preview

Set `RESPONSIVE_WEB_SERVER_PORT=4174` and use a fresh `RESPONSIVE_RUN_ID` for each invocation. The responsive runner starts and owns a separate strict Vite server; it never reuses the preview on 4173 or requires the backend on 3000.

## Commands

Run the config contract first (Node 24 supports TypeScript stripping; no Vite server starts):

```sh
node --test e2e/responsive/responsive-port.test.mjs
```

For a focused desktop check, then all 21 detail cases, use different run IDs:

```sh
RESPONSIVE_WEB_SERVER_PORT=4174 RESPONSIVE_RUN_ID=detail-desktop-unique pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/public-catalog-product-detail.spec.ts --grep 'interaction at desktop'
RESPONSIVE_WEB_SERVER_PORT=4174 RESPONSIVE_RUN_ID=detail-full-unique pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/public-catalog-product-detail.spec.ts
RESPONSIVE_WEB_SERVER_PORT=4174 RESPONSIVE_RUN_ID=runner-wiring-unique pnpm exec playwright test --config=playwright.responsive.config.ts e2e/responsive/specs/harness.spec.ts --grep '@responsive-harness runner wiring'
pnpm type-check:responsive
```

Replace each example run ID before rerunning. If 4174 is occupied, strict port binding fails instead of reusing or stopping that process. Do not kill or restart the preview/backend to make tests pass.

## Configuration and evidence contract

| Setting                               | Behavior                                                                                                                                                                                                          |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Port absent, empty or whitespace-only | Defaults to 4173, preserving existing consumers.                                                                                                                                                                  |
| Port override                         | Decimal digits only, integer 1–65535. Surrounding whitespace on a nonblank value, fractions, exponents, signs, hexadecimal, shell syntax and out-of-range values fail during config import, before Vite launches. |
| Server/origin                         | Command, health URL and exported fixture port use the same validated number; `--strictPort` and `reuseExistingServer: false` stay enabled.                                                                        |
| API/network                           | `/__e2e-api` and existing strict network declarations remain unchanged. No live backend access is needed.                                                                                                         |
| Artifacts                             | Reports, traces and screenshots live under `artifacts/responsive/<runId>/`. Explicit detail captures use `testInfo.outputPath`, within per-test results, not historical `local-run/detail-*.png` paths.           |

## Coverage and limitations

The shell inventory remains an exact role/name multiset: searchbox **Buscar productos o marcas**, buttons **Buscar**, **Limpiar búsqueda**, **Todas las categorías**, existing shell controls, anchor and detail invokers. Empty fixture facets create no named category buttons. Searchbox naming is also checked independently through Playwright accessibility locators. Cart/sort absence and all dialog, inert preview, focus, image, anonymous wire, request-count, concurrency, hidden-price and stock guards remain intact.

Observed runs for this change:

- Config RED: 3 passed / 15 failed before implementation; GREEN: 18 passed.
- `isolated-detail-red-20260720-a`: desktop booted with declared initial traffic, then failed on four newly delivered shell controls (including the unnamed searchbox in the old snapshot helper).
- `isolated-detail-green-20260720-a`: desktop passed; `isolated-detail-full-20260720-a`: all 21 passed.
- `isolated-runner-wiring-20260720-a`: all 5 runner-wiring cases passed; responsive type-check passed.

These are scoped Chromium fixture checks, not the entire responsive suite, production/backend integration or human visual acceptance. The config is shared by all responsive consumers, including `fixtures/test.ts` and `cash-workspace-offline.spec.ts`; independent review should compare default/override wiring and ensure unrelated consumers retain their prior behavior. Default compatibility is verified without opening port 4173. Human review remains separate.

Independent verification passed for this five-file unit: 18 config tests, responsive types and diff-check; the differential against the prior config confirmed identical stdout/stderr/exit for absent/empty/blank values and only the requested port/URL/command changes for 4174. Existing browser reports contained 21 passed attempt-0 detail results and five wiring passes; the verifier did not rerun those browser cases. Structured evidence records were zero, so these reports are not structured coverage proof.

Native review `review-b5eae9b4ccb7c64c` approved the 170-line unit and its exact acknowledgement consumed authority. Informational advisory `R3-001` at `playwright.responsive.config.ts:8` is non-blocking follow-up, not an open correction. This unit is based on local commit `5d62b16`, which separately holds the prior approved discovery-control polish. No publication or human visual acceptance is implied.
