# Shared confirmation modal verification

## Scope and result

A9 of `odd/tasks/hf-ui-complete-audit.md`; bounded evidence for S1, S2, S5 and S6, not completion of the application audit.

Added `src/core/shared/components/__tests__/ConfirmModal.integration.spec.ts` using the existing `mountWithUApp` helper and the installed Nuxt UI Modal/Button and Reka implementation. No Modal, Button or Teleport mocks; a memory router supplies the normal link injection context. Existing mocked item-branch tests remain unchanged. A test-first follow-up reproduced and fixed a missing accessible description association using Nuxt Modal's supported `description` slot and a screen-reader-only span. Required description, public API, events, caller UI, pending guards and destructive semantics remain unchanged; no CSS files changed.

## Automated DOM evidence

Fourteen integration cases verify:

- The dialog teleports outside its caller into body, retains its accessible title and moves focus inside.
- Confirm emits once without automatically closing; explicit cancel emits `update:open(false)` and `cancel`.
- Escape, the native header close button and outside pointer dismiss via `update:open(false)` without inventing cancel/confirm events. Focus returns to the external opener after each dismissal and explicit cancel.
- Loading removes header close, disables both footer buttons and blocks Escape/outside-pointer dismissal and footer actions. After loading clears, confirm and dismissal work again.
- Caller content, overlay, body and footer classes survive, including content `z-[90]`, overlay `z-[89]` and caller width. Without overrides, native defaults remain.
- Under a global body HF boundary with light/dark markers, teleported content remains a descendant of that boundary. Destructive confirmation renders `bg-error`, not `bg-primary`; cancel remains non-destructive.
- Real item rows replace the visible body description, retain optional status and honor caller action labels.
- For ordinary, empty-items fallback and populated-items branches, every `aria-describedby` ID resolves to a nonempty element inside the dialog containing the required description. The native description slot contains screen-reader-only text; ordinary/fallback body text remains once, and populated items do not gain visible description text.

The test host owns `open` and `loading`; it only closes on the public model update. Cleanup unmounts the owning app because `mountWithUApp` returns a child wrapper, then removes its own container/classes.

## Validation

- `pnpm exec vitest run src/core/shared/components/__tests__/ConfirmModal.integration.spec.ts src/core/shared/components/__tests__/ConfirmModal.test.ts --maxWorkers=1 --no-file-parallelism --exclude '**/.worktrees/**'` — PASS, 21 tests across two suites (14 installed integration + 7 existing mocked cases).
- `pnpm exec vue-tsc --noEmit -p tsconfig.app.json --incremental false` — PASS. This app compiler excludes test files; it is not a test-file type-check claim.
- `git diff --check` — PASS at final handoff. Both new files also checked with `git diff --no-index --check /dev/null <path>`: no whitespace diagnostics (exit 1 denotes added-file differences). Cumulative unit remains below 400 authored lines.

The first integration run passed 8/10 cases and failed two harness assumptions: the close button's own rendered slot is `base`, not `close`, and native width is `max-w-lg`, not `sm:max-w-lg`. Corrected test selectors/expectations against installed source; these were not component defects or product RED evidence. That run's missing Description warning prompted the follow-up below. Editor diagnostics reported unresolved `.vue` types in this test file; runtime transformation and the app compiler passed, but neither proves standalone test type-checking.

## Test-first description repair

- RED: Before the component change, the integration command above (integration file only) failed all three new description cases, with 11 other cases passing. Each dialog had an `aria-describedby` ID whose target resolved to `null`; Reka also emitted the missing Description warning. This is genuine behavior-level RED, unlike the earlier selector/width harness failures.
- Installed `Modal.vue` renders its native `DialogDescription` when the supported `description` prop or slot exists. The smallest repair adds only the `description` slot with `<span class="sr-only">{{ props.description }}</span>`; native generated IDs provide the association without new IDs/API, UI merging or event changes.
- GREEN: All 21 tests pass after that four-line template addition. Ordinary and empty/populated items triangulate the branch contract; existing focus, loading, dismissal, caller UI and semantic-color cases stay green. No later source refactor was necessary. Test-first applies by default to this reproduced behavior change; the earlier handoff's “strict TDD not activated” label was misleading and is superseded by this observed RED/GREEN evidence.

## Pending browser evidence

DOM classes and ancestor relationships do **not** establish browser paint. jsdom does not validate compiled Tailwind output, resolved HF colors, contrast, visible focus rings, responsive geometry, transition timing, physical stacking order or occlusion. Light/dark cases here prove identical semantic wiring under each marker, not visual acceptance. Pointer events and activeElement assertions are DOM evidence, not a complete keyboard/focus-trap or assistive-technology audit.

Parent-owned actual browser checks remain pending: settled light/dark desktop/mobile screenshots; resolved destructive/cancel colors and contrast; focus visibility and return; narrow-screen footer layout; nested dialog layering with caller overrides; and loading dismissal behavior in the live caller. No server, browser/session operations or full build were performed by this worker.

## Key Learnings

Nuxt UI Button renders its own `data-slot="base"`, so the modal close action should be located through the header and accessible label rather than assuming its slot remains `close`. The existing UApp helper returns a child wrapper, requiring owning-app cleanup for real teleported integration tests. Nuxt Modal's description slot creates the native accessible association even when the visible body is supplied separately. Installed modal DOM coverage can verify focus, dismissal and semantic classes without claiming browser paint or visual stacking acceptance.

## Parent integrated evidence

Job 30 passed both focused suites, full build and whitespace checks. Four settled actual-browser cases (390/1440, light/dark) opened the existing product price-list deletion confirmation and canceled without submitting. `aria-describedby` resolved to the exact nonempty description; its screen-reader span measured 1×1px, the visible body was not duplicated, dialog widths were 358/512px and Cancel restored opener focus. Destructive red semantics remained. Captures: `odd/evidence/hf-ui-complete-audit/confirm-{390|1440}-{light|dark}.png`; mobile-dark inspected. This closes the accessible-association repair, not the broader loading/nested/contrast/touch-target audit. Existing build warnings remain.
