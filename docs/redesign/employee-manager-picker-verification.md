# Employee manager picker verification

## Correction

The edit form captured a null/first employee ID at setup. The picker now accepts a scalar, ref or getter exclusion, resolves it inside its options computation, and cannot reinsert self through current-manager merging. The edit caller passes a getter and explicitly names the native trigger `Jefe directo` instead of the primitive's `Show popup` default.

Tenant/search cache keys, raw cached employee arrays, search requests, debounce, create-form omission and valid selected-manager labels remain unchanged. This repairs existing frontend exclusion intent; it does not change hierarchy or backend policy.

## Observed checks

- RED: three real-QueryClient tests failed on reactive switching, merge collision and delayed search; three scalar/create cases passed. Native field-name regression failed separately.
- Job13 passed26 tests but failed the synthetic ArrowDown opening probe. Installed ComboboxTrigger opens on click; corrected the jsdom interaction and retained browser keyboard verification.
- Job14 passed27 tests/three suites, Vue-aware test typechecking, full build and diff check. Existing build chunk warnings remain.
- Real rebuilt preview/local API,390/1440px light/dark: edit Luis → Raúl → Luis on the mounted screen. Every edited self is absent; the other employee remains eligible; selected María retains her human label. Focused Enter opens; Escape keeps the form; Cancel closes without mutation. Menus are277px mobile/351px desktop by240px high, contained.
- Actual search `Luis` returnedHTTP200; self remained absent and the selected María option remained visible despite not matching the search.
- Captures `odd/evidence/hf-ui-complete-audit/employee-manager-fixed-{390,1440}-{light,dark}.png`; mobile-dark and desktop-light visually inspected.

## Limits

An initial offscreen-focus keyboard probe lost the popup before geometry collection and timed out. Explicit scrolling before keyboard focus produced12 stable openings; this does not establish every scroll/keyboard scenario. No employee save or manager assignment was submitted. No exact total-option-count contract was introduced.

Risk:item3 — shared composable consumed by create/edit forms. Independent verifier `mvyq7lk2-f-fpwz` found no severe code findings and passed bounded source/visual inspection, but execution is blocked. Its single scratch attempt exited1 before Vitest: pnpm automatically entered a dependency check/install path and aborted with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. No retry or workaround was attempted; scratch-side mutation is unverified. The parent's27-test result is not independent execution. The maintainer explicitly accepted this missing independent execution and authorized committing A16: “Bien, adelante entonces con tus recomendaciones”. This is a documented exception, not an independent test PASS or native review approval. Native assessment is unavailable due untracked declaration, not approved. LSP Vue-import diagnostics in the reused test are not a clean result; Vue-aware compiler passed. Remaining route/state/contrast coverage belongs to the global audit.
