# Caja (cash register) — frontend UI, S1 subset

Local frontend implementation of the POS **Caja** screen, integrated into the
existing POS navigation/shell. Derived from the authoritative backend contract
`houndfe-backend/.tmp/cash-register-closing/docs/cash-register-closing.md` and the
supporting handoff `docs/cash-register-frontend-handoff.md` in that worktree.

**Delivered scope (user-approved S1 subset):** registers, session opening, manual
movements, blind freeze/count, append-only notes, independent verification,
recipient custody discovery, explicit FLOAT and drawer release.

**Explicitly NOT delivered here (still pending):** refund settlement,
closing/PDF, live backend calls, backend or environment changes, commits, and
any production or existing-database operation. The POS→Caja binding
(`cashSessionId`) is now a **frontend-only** increment — see §2.2 and §9.

---

## 1. Where it lives

| Surface                | Path                                                          |
| ---------------------- | ------------------------------------------------------------- |
| Route (thin container) | `src/features/POS/cash-register/views/CashRegisterView.vue`   |
| Components             | `src/features/POS/cash-register/components/*.vue`             |
| Composables            | `src/features/POS/cash-register/composables/*.ts`             |
| Route registration     | `src/app/router/index.ts` → `/pos/caja` (`pos-cash-register`) |
| Navigation entry       | `src/app/navigation/navigation.registry.ts` → POS → **Caja**  |

Integration follows the existing conventions rather than a parallel design: the
route uses the shared `permission` meta + global guard, the nav entry is registry
data consumed by `useSidebar` and the command palette, the view is a composition
surface, and forms/tables/state reuse the shared Nuxt UI primitives and TanStack
Query patterns already used across POS.

Cash queries use the feature-local `composables/cashQueryKeys.ts`, following
the tenant and identity scoping described in §3. The task-focused presentation
uses `composables/useCashWorkspace.ts`; it owns navigation only, not queries,
commands, register selection or cash-session selection.

`useSidebar.ts` needed **no** change: the registry drives it.

### Task-focused workspace

The existing `/pos/caja` route now presents one operation area at a time, using
`CashWorkspace.vue` for navigation/context and `CashWorkspaceShiftCard.vue` for
the explicitly selected session. It adapts the approved v0 proposal
<https://v0.app/bdps-projects/chat/eFftT6irkfs> to the existing Vue/Nuxt UI shell;
there is no second sidebar, simulated role switch or mock business state.

Choose **Mis sesiones** (or **Sesiones** with the existing audit scope) to
explicitly select a session. Navigation offers opening, sessions, movements,
blind count, declaration notes, verification, outgoing custody/drawer release
and recipient reception where applicable. These are independent tasks, not a
mandatory linear wizard. Selecting a task sends no command and does not
implicitly select a register or session.

Operation panels remain mounted while switching tasks to preserve drafts.
Session-sensitive forms remount when the selected session or identity changes;
existing panel and command authorization guards remain authoritative. Blind
count retains every frozen required channel, not only CASH. Recipient-only
reception remains available on its separate restricted route.

### Recipient-only reception

`/pos/caja/recepciones` (`pos-cash-reception`) uses `CashReceptionView.vue` and
appears as **Recepciones de caja** in POS navigation. A user with only
`read:CashHandover` and `update:CashHandover` lands here without register,
session or audit grants. The existing `/pos/caja` operational screen remains
restricted to `read:CashRegister`.

The reception view loads only recipient custody. It does not instantiate register,
session-detail, session-list or audit queries. Reading requires
`read:CashHandover`; receipt additionally requires `update:CashHandover` and a
pending handover addressed to the current user. Unknown handovers, overlapping
submissions and stale completions after identity changes are rejected. It cannot
open sessions, declare outgoing handovers or release drawers. Permission codes
remain case-sensitive: use the exact subject `CashHandover`, not `cashhandover`
or `cashHandOver`.

---

## 2. Contract rules enforced in the UI

- **Pesos in the UI, integer cents on the wire.** Every human money field is
  typed in **pesos** (opening, movements, blind count, verification,
  custody/FLOAT declared and received amounts) and converted **exactly once**
  with the feature's `utils/cash-input.ts`. The API still receives integer cents,
  never strings or decimals. See §2.1 for the conversion rules and real bounds.
- **Blind windows.** While `blind: true`, the UI renders no expected value, no
  difference and no movements — even if a malformed/stale payload still carries
  them. Absence is never coerced to `0` (absence ≠ `0`).
- **Frozen channels.** The blind count form is built from the frozen
  `requiredChannels` identities, never from the live payment catalog. A blank
  channel is a _missing_ channel; an explicit `0` is a valid counted zero.
- **Denominations are optional.** When supplied they must sum exactly to the
  `CASH` line; `denominationCents >= 1` and `quantity >= 0` (a zero quantity is
  valid and contributes `0`) are validated client-side. Transport-level bounds
  belong to `api/cash.api.ts`.
- **Status vs drawer release.** The session status badge and the drawer state are
  two separate facts; freezing never implies releasing the drawer.
- **Custody is recipient-bound.** The receipt action appears only for the
  authenticated, designated recipient. A same-person `WITHDRAWAL` is blocked;
  a same-person `FLOAT` is allowed (the receipt is still explicit).
- **FLOAT = the RECEIVED amount.** A received FLOAT whose amount differs from the
  declared one is valid, and the _received_ amount is the opening fund. A FLOAT
  whose source drawer is still unreleased blocks only the **same** register.
- **Discovery is a hint, not a reservation.** `eligibleFloat` is displayed with
  an explicit "not a reservation" note; the backend re-runs the authoritative
  checks at opening.
- **No automatic balancing.** There is no affordance anywhere to "fix" a
  difference with an offsetting movement.
- **Append-only after submission.** After the declaration, only
  `declaration-notes` is offered; there is no "new blind count".
- **Idempotency.** Every command carries a stable `Idempotency-Key` from the
  existing `commandAttempt()` util (§4).
- **Two distinct differences.** Declaration and verification differences are
  rendered as separate numbers and never merged.

Caja UI copy uses neutral Mexican Spanish, with loading, error, empty and access
states for each surface. Currency remains the application's canonical
`es-MX` / `MXN`; v0's Argentine copy, ARS labels and denominations are not
production requirements.

### 2.1 Human money entry: pesos in, integer cents out

People type money in **pesos**; the API receives **integer cents**. The conversion
lives in `utils/cash-input.ts` and is exact: the whole part and the (at most two)
fraction digits are scaled from their own digits, so there is no float
multiplication and no rounding. A third decimal is rejected, never rounded. A
single comma is also accepted as the decimal separator, matching the app's
existing input convention.

| Human entry (pesos) | Wire value (integer cents) |
| ------------------- | -------------------------- |
| `350`               | `35000`                    |
| `350.5`             | `35050`                    |
| `350,50`            | `35050`                    |
| `0.01`              | `1`                        |
| `0`                 | `0` (explicit zero)        |
| `''` (blank)        | — no command is sent       |

A blank field stays **missing**, never a counted zero. An explicit `0` is valid
for opening, count/verification and receipt; movements and custody declarations
(both FLOAT and WITHDRAWAL) require at least `0.01` pesos. Signs, exponents,
non-finite text, a second decimal separator and any third decimal are rejected.

**Actual bounds are per field, not a blanket ceiling.**

| Field                                                                | Bound                                                                                         |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Opening, count/verification lines and custody received (money)       | `0 .. MAX_CASH_MONEY_CENTS` = `2147483647` cents (`$21,474,836.47`)                           |
| Manual movements and custody declared, both FLOAT/WITHDRAWAL (money) | `1 .. MAX_CASH_MONEY_CENTS` cents; minimum entry `0.01` pesos                                 |
| Denomination amount (money)                                          | `>= MIN_DENOMINATION_CENTS` = `1` cent, up to the same money maximum                          |
| Denomination quantity (pieces, **not money**)                        | integer `0 .. MAX_CASH_QUANTITY` = `2147483647`; a zero quantity is valid and contributes `0` |

The `$21,474,836.47` figure applies only to fields whose existing limit is
`2147483647` cents; `api/cash.api.ts#assertCents` re-checks every money field
against that same PostgreSQL `Int` maximum, so an over-range value fails closed
instead of wrapping. A field with a narrower limit passes its own bound.
Custody declarations also use the latest counted cash as a coarse client-side
ceiling; this does **not** prove remaining capacity. The backend enforces the
new declaration plus all existing allocations against the latest declared cash,
including concurrent changes.

**Non-money quantities stay non-money.** A denomination quantity is a count of
pieces: it keeps count units and count copy (never "pesos"/"centavos") and is
parsed by `countQuantity`, apart from the money parser.

**Default FLOAT conversion.** Choosing a received FLOAT seeds the opening field
with its **received** amount formatted in pesos (`centsToPesosInput`), and that
text converts back once; the received amount — not the declared one — is the
opening fund.

**Presentation redesign.** The later v0 adaptation reorganizes existing
operations into focused tasks and localizes Caja copy for Mexico. It does not
change this money-entry contract, POS binding, backend endpoints or permissions.
Definitive closing, PDF and refunds remain outside the authorized redesign.

**POS binding.** Linking a POS charge to a selected cash session
(`cashSessionId`) is delivered as a frontend-only increment — see §2.2. Legacy
unbound POS charging remains supported, and no session is ever selected
automatically.

### 2.2 POS→Caja binding: explicit, own/OPEN, fail-closed

The POS charge may be linked to a Caja session the cashier **explicitly** picks.
The binding is a single optional **top-level** `cashSessionId` field on BOTH wire
shapes (legacy single-payment and multi-payment) and is **never** nested inside
`payments`.

| Rule                  | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explicit only         | Nothing is auto-selected: not the first, sole, previous, nor a refreshed row. The charge is unbound until the cashier selects.                                                                                                                                                                                                                                                                                                                                                     |
| Eligible set          | Only **own + `OPEN` + current-tenant + canonical-UUID** rows are offered. A foreign cashier, non-`OPEN` status, foreign tenant or non-UUID id is never selectable.                                                                                                                                                                                                                                                                                                                 |
| Read gate             | The picker renders and the list is fetched ONLY with `read:CashSession`, a resolved principal and resolved permissions. No request otherwise — including the public `refetch`, which is gated by the same fence and is a no-op without the ability.                                                                                                                                                                                                                                |
| Paging                | Only `page`/`limit` travel. `pendingOnly` is never sent (`true` excludes `OPEN`). The response `total` spans **all** statuses and is never presented as a filtered total; later pages re-filter their own rows.                                                                                                                                                                                                                                                                    |
| Identity lifecycle    | Any identity/permission/session-lifecycle change — including a same-principal logout/login and an unresolved permission set — clears the ACTUAL selection immediately (sync), so no old-scope id survives. Reopening the modal or switching the charged sale clears it. A lost binding leaves a boolean "needs explicit decision" marker (never the old id), and the live scope guard catches a non-reactive generation write before any emit.                                     |
| Fail-closed submit    | The selected id is revalidated **live** at submit against the current access gate, the captured identity scope and the current eligible rows (never a cached view). If the scope is no longer current, the actual selection is cleared and the charge is **blocked**; if only the page changed, the explicit selection is kept and the charge is blocked. Either way it is never sent carrying a stale session id.                                                                 |
| Lost-binding recovery | While the "needs explicit decision" marker is set, a stale-scope confirm never charges implicitly unbound. A control rendered **outside** the permission-gated picker (so it stays reachable when `read:CashSession` is revoked/unresolved) lets the cashier explicitly "Cobrar sin vincular (legacy)", preserving the payment entries, delivery and due date. Re-selecting a session also clears the marker. Ordinary legacy unbound charges (no prior selection) are unaffected. |
| Binding key           | Changing the binding invalidates the attempt idempotency key (sync), so a new request body never reuses the prior attempt key; an unchanged retry keeps it.                                                                                                                                                                                                                                                                                                                        |
| Legacy omission       | With no explicit selection, the key is **absent** (never `null`, never an empty string).                                                                                                                                                                                                                                                                                                                                                                                           |

Backend contract (static DTO — `charge-sale.dto.ts:39-80`, not live-verified
here): the field is a shared optional top-level `cashSessionId` on BOTH shapes;
omission is the only optional case; a null, empty or non-UUID value is rejected
with `INVALID_CASH_SESSION_ID`. The service validates the supplied session
(own, `OPEN`, tenant, active member) BEFORE any money write and records the
payment/change once. Audit grants are **not** required to bind, and the
client-side own/`OPEN`/tenant filter is mandatory regardless. A backend rejection
to the POS charge surfaces through the existing charge-error path — the frontend
does **not** retry as an unbound charge.

**Boundaries.** The frontend binding is proven with a mocked transport only; no
live backend call is claimed. The authoritative backend re-checks every
own/`OPEN`/tenant/active condition, including when cached eligibility is stale.

---

## 3. Permission, identity and tenant model

Permissions are granular CASL abilities; nothing is granted by the UI.

| Ability                            | Gates                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| `read:CashRegister`                | register list (and the route/nav entry)                                                     |
| `create`/`update:CashRegister`     | create / activate-rename                                                                    |
| `create:CashSession`               | opening a session                                                                           |
| `read:CashSession`                 | own sessions list/detail                                                                    |
| `read:CashSessionAudit`            | widens list/detail scope (never auto-granted)                                               |
| `create:CashCount`                 | freeze, declare, append notes                                                               |
| `create:CashIn` / `create:CashOut` | manual movements                                                                            |
| `create:CashVerification`          | verification (see the derived gate below)                                                   |
| `create:CashHandover`              | outgoing custody **and** drawer release                                                     |
| `read:CashHandover`                | reception route/nav and recipient custody discovery (independent of register/session/audit) |
| `update:CashHandover`              | confirming a receipt                                                                        |

- **Derived verification access.** `canVerifyIndependent` requires
  `create:CashVerification` **and** `read:CashSession` **and**
  `read:CashSessionAudit`, because the verifier is by definition not the cashier
  and needs the wider read to reach the session. The UI never grants audit.
- **No invented user-list permission.** The recipient selector reuses the
  existing `usersApi.listAssignable()` / `usersQueryKeys.assignable()` source,
  and only when `read:User` is already held. Otherwise the form falls back to an
  explicit UUID input validated against a UUID pattern, with copy explaining why.
- **Session identity scoping.** Visibility is principal-dependent (the same
  session detail is a blind owner projection for the cashier but a wider audit
  projection for an audit reader) and permission-dependent. Every cash cache slot
  is therefore scoped by the full identity —
  **tenant + user + permission fingerprint + session lifecycle generation**:
  `['cash', tenantId, userId, permissionFingerprint, generation, …]`.
  The permission fingerprint is derived deterministically from the store's
  existing `permissionCodes`, and the generation is the real
  `authStorage.getSessionGeneration()` that the auth layer advances on login,
  logout, tenant switch and clear — and deliberately NOT on a context-preserving
  token rotation. There is no auth edit and no storage hack.
- **Two sessions, one principal.** Tenant+user+permissions alone cannot separate
  a logout→login of the _same_ user/tenant/permissions. The generation does, so
  such a re-login never reuses the previous session's slots and never lets an
  in-flight result from the previous session reach the new one.
- **Reads do not run without their ability**, principal or resolved permissions.
- **Stale results are discarded.** Each command captures the full identity
  _before_ the request and re-checks it after. A same-tenant user switch, a
  logout/login or a permission change makes the in-flight result stale: it is
  dropped silently — never returned to the new user's form, never used to select
  an old session or render a stale comparison, and never used to invalidate the
  new principal's caches.
- **No active tenant/user ⇒ the command is refused before dispatch**, with
  actionable copy.
- **Detail query capture.** The detail query reads the identity and id from the
  query key it captured, never the live selection, after the async boundary.
- **Tenant/recipient never travel to the backend** — they come from the JWT.

---

## 4. Idempotency

`commandAttempt()` (`utils/cash-input.ts`) is instantiated once per
form family. The attempt key is derived from **actor + context + body**, so:

- an identical retry of the same command replays the same key (no duplicate
  command);
- a changed body, a different principal/session or a different permission
  generation produces a new key;
- the attempt is reset **only after a confirmed success**, and **before** the
  cache refresh — so a refresh failure cannot be reported as a command failure
  and cannot invite a duplicate re-issue. Cache refreshes are explicitly
  best-effort.

---

## 5. Tests (what is actually proven)

All specs below are UI/cache behaviour tests against a **mocked transport**. They
prove frontend behaviour only; they are **not** backend integration.

| Spec                                                        | Proves                                                                                                                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/router/__tests__/router.cashRegister.spec.ts`          | route resolves with `read:CashRegister`; redirects to `/403` without it                                                                                                                                                                    |
| `app/navigation/__tests__/navigation.cashRegister.spec.ts`  | POS **Caja** entry registered and gated; receiver-only navigation and landing                                                                                                                                                              |
| `app/composables/__tests__/useSidebar.cashRegister.spec.ts` | the sidebar shows/hides **Caja** by ability                                                                                                                                                                                                |
| `composables/__tests__/cashRules.spec.ts`                   | blind projection, absence≠0, blanks≠zero, frozen channels, denomination sum + zero quantity, distinct differences, self-verification, recipient-only receipt, received-FLOAT semantics, same-register block, identity fingerprint/equality |
| `composables/__tests__/useCashRegisters.spec.ts`            | principal-scoped list; command refused without identity; stale result discarded; actor-scoped attempt key; refresh-failure safety                                                                                                          |
| `composables/__tests__/useCashSessions.spec.ts`             | audit-gated `cashierUserId`; same-tenant user switch and permission change never reuse a slot; detail captures its identity/id                                                                                                             |
| `composables/__tests__/useCashSessionCommands.spec.ts`      | stable per-attempt keys; identity gate; stale discard (user/permission/logout); captured-principal invalidation; refresh-failure safety                                                                                                    |
| `composables/__tests__/useCashCustody.spec.ts`              | `read:CashHandover` is its own grant (audit never substitutes); per-principal slot; only `page`/`limit` travel                                                                                                                             |
| `components/__tests__/CashRegistersPanel.spec.ts`           | states, permission-gated actions, create/activate contracts                                                                                                                                                                                |
| `components/__tests__/CashOpenSessionForm.spec.ts`          | explicit opening confirmation, received-FLOAT fund, mismatch block, same-register block, other-register allowed, not-a-reservation copy                                                                                                    |
| `components/__tests__/CashSessionSummary.spec.ts`           | blind safety with malformed payloads, status vs drawer separation, distinct differences                                                                                                                                                    |
| `components/__tests__/CashMovementsPanel.spec.ts`           | blind hides history but preserves own OPEN commands; non-owner denied; frozen disables; reason/amount validation                                                                                                                           |
| `components/__tests__/CashCountForm.spec.ts`                | frozen channels, blank≠zero, explicit zero, optional denominations + sum, zero quantity, no oracle inputs                                                                                                                                  |
| `components/__tests__/CashVerificationPanel.spec.ts`        | access gate, self-verification block, notes-required on difference, separate differences                                                                                                                                                   |
| `components/__tests__/CashCustodyDiscovery.spec.ts`         | access-not-empty, recipient-only receipt, FLOAT vs WITHDRAWAL, received≠declared, unreleased drawer shown, no reservation                                                                                                                  |
| `components/__tests__/CashCustodyActions.spec.ts`           | UUID fallback vs selector, self-WITHDRAWAL block, zero amount, release ordering                                                                                                                                                            |
| `views/__tests__/CashRegisterView.spec.ts`                  | access state, panel composition, **stale pending opening discarded on same-tenant user switch**, derived verification gate, unchanged integer-cent transport from pesos entry, blank/over-precise entry dispatching nothing                |
| `views/__tests__/CashReceptionView.spec.ts`                 | recipient-only guards, blinded receipt controls, and the real custody UI transporting typed pesos as unchanged integer cents                                                                                                               |

**Observed run (prior batches):** `17 files / 157 tests passed` over the curated
spec set. The retained historical §7 snapshot reports a different earlier count;
neither historical figure is current T7 proof. The T5 integration/docs pass re-ran the whole
`src/features/POS/cash-register` directory as `18 files / 253 tests passed`
(exact commands in §7).

### Chronology (not retro-labelled)

- The original batch (registers, movements, blind count, verification, custody)
  was implemented **before** its specs were written. Those specs are reported as
  GREEN with RED **not** observed for the rules they cover; they are **not**
  presented as test-first work.
- The identity/permission-scoping rules in the continuation batch were written
  **test-first**: `cashRules.spec.ts` (fingerprint/equality) and the composable
  specs failed first (`TypeError: … is not a function`, and behavioural failures
  such as reusing another principal's slot), and then were made green by the fix.
- Real defects found by the tests during this batch:
  1. `readDetailContext` destructured the detail key without its `'sessions'`
     segment, so the shape check failed and detail never fetched (RED → fixed).
  2. The register command runner computed the idempotency key **twice** with
     different inputs (RED → fixed to a single key per attempt).
  3. The registers/sessions reads fired **without** their read ability (RED →
     fixed by adding the ability to each `enabled` gate).
  4. `CashOpenSessionForm` did not seed the opening amount from a preselected
     FLOAT (watcher not `immediate`) (RED → fixed).
  5. Cross-test pollution: mounted components were never unmounted, so a shared
     reactive auth stub re-triggered their observers and inflated call counts
     (fixed with `enableAutoUnmount(afterEach)`).

---

## 6. Limits and unmet proof

- **No live integration.** Every test mocks the transport. No route was exercised
  against a running backend; no endpoint availability is claimed.
- **Backend conditional grants are authoritative.** Per-row CASL conditions are
  evaluated server-side; the UI only reflects the abilities it receives and still
  handles `403` / `422 CASH_PERMISSION_DENIED`.
- **No real CLS, concurrency, race or load proof**; no exhaustive idempotency
  race coverage.
- **Client-side checks are convenience only** for allocation equality
  (`declaredCents` summing to counted cash), the opening-fund equality and the
  same-register drawer rule; the backend re-validates all of them.
- **Not covered:** closing/`CASH_CLOSING*`, PDF receipt, refund
  settlement, session-audit UI beyond scope widening, and a `CASH_*` → copy map
  for codes outside the enabled flows (unmapped codes fall back to generic copy).
- **Mocked vs live:** this document must not be read as an integration claim.
  A live happy path against an isolated backend remains outstanding.

### Tooling discrepancies observed (not product defects)

- A language-server without a Vue plugin reports `TS2307` for every `.vue` import
  from `.ts` (e.g. `src/app/router/index.ts`). This is a tool discrepancy: the
  project's authoritative, Vue-aware check
  `pnpm exec vue-tsc --noEmit -p tsconfig.app.json` exits `0` with no output.
  No suppression, shim or tooling change was added, per direction.
- One aggregated lint report claimed new lint errors for a spec file; the
  project linters disagree — `npx eslint <file>` and `npx oxlint <file>` both
  report **0 errors** for the file in question.

---

## 7. Validation performed (own scope only)

### Current T5 evidence (mocked transport)

```sh
# Writer and parent spot check: 2 files / 16 tests passed, exit 0
pnpm exec vitest run src/features/POS/cash-register/views/__tests__/CashRegisterView.spec.ts src/features/POS/cash-register/views/__tests__/CashReceptionView.spec.ts --exclude '.worktrees/**' --exclude '.git/**'

# Writer and independent verifier: 18 files / 253 tests passed, exit 0
pnpm exec vitest run src/features/POS/cash-register --exclude '.worktrees/**' --exclude '.git/**'

# Writer checks: exit 0
pnpm exec eslint src/features/POS/cash-register/views/__tests__/CashRegisterView.spec.ts src/features/POS/cash-register/views/__tests__/CashReceptionView.spec.ts src/features/POS/cash-register/utils/cash-input.ts
pnpm exec prettier --check src/features/POS/cash-register/views/__tests__/CashRegisterView.spec.ts src/features/POS/cash-register/views/__tests__/CashReceptionView.spec.ts src/features/POS/cash-register/utils/cash-input.ts docs/cash-register-ui.md
```

### Historical snapshot (not current T7 proof)

The original command below was retained as a placeholder, not a reproducible
current invocation. Its 137-test count predates the later 157-test batch in §5.
Compiler and lint success below belong to that historical batch only; the current
full-repository/compiler checks remain pending T7.

```sh
# Historical focused suite placeholder, not a command to rerun
npx vitest run <17 cash specs>            # 17 files / 137 tests passed

# authoritative Vue-aware type-check of the app project
pnpm exec vue-tsc --noEmit -p tsconfig.app.json   # exit 0, no output

# no-fix lint on the new/edited surfaces
npx eslint src/app/router/index.ts src/app/navigation/navigation.registry.ts \
  'src/app/**/__tests__/*cashRegister*' 'src/features/POS/cash-register/**/*.{ts,vue}'  # clean
npx oxlint src/features/POS/cash-register   # 0 warnings, 0 errors
```

The current full suite, Vue-aware compiler, production build and final lint remain
pending T7. Historical tooling claims in §6/§8 are not evidence for these changes.

---

## 8. Correction batch — independent verifier `mv04hg3b-6-ytmo`

Six verified blockers, each reproduced test-first before its fix. Scope stayed
inside the same authorized surfaces; no backend/auth edit, no commit, no live call.

| #   | Blocker                                                                                                                                                                                                                               | Status                                                   | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `router/index.ts` had rewritten the pre-existing customer route `/pos/customers` → `/pos/clientes` while the navigation still targeted `/pos/customers`                                                                               | **FIXED**                                                | RED: `router.resolve('/pos/customers')` → `not-found`; GREEN after restoring the baseline path. Regression pins added: the Clientes route resolves to `pos-customers`, every POS navigation target resolves to a registered route, and both the Caja and Clientes nav entries resolve. No other route was rewritten.                                                                                                                                                                                                                                                                   |
| 2   | `CashMovementsPanel` hid the history **and** the commands whenever `blind` was true, so contract example A (owner, `OPEN`, `blind: true`) lost its authorized command forms                                                           | **FIXED**                                                | RED: the example-A test found no command form. Now the history is hidden while blind (status-independent) and the commands require `writable && caller === session.cashierUserId`. New public regressions: example A shows the form and hides the history (even with a malformed payload carrying a movement); a non-owner never gets the form; a missing caller identity counts as a non-owner.                                                                                                                                                                                       |
| 3   | Identity/cache/attempt keys used only tenant+user+permissions, so a **same-identity logout→login** (same user, tenant and permissions) could reuse the previous session's slots, and an in-flight command could reach the new session | **FIXED**                                                | RED: custody/session lists were fetched once (slot reused) and a deferred command resolved instead of being discarded. Now the identity carries `authStorage.getSessionGeneration()` (advanced on login/logout/switch/clear, NOT on token rotation). Catch-up re-read after the store's synchronous transition (the store publishes refs before it writes storage). New tests: same-identity re-login refetches; a stale in-flight detail response does not populate the new lifecycle slot; a deferred command across a same-identity re-login is discarded and invalidates nothing.  |
| 4   | The view's comparison refs survived an identity change, and the command guard did not re-check after the refresh continuation                                                                                                         | **FIXED**                                                | RED: a command whose identity changed _during_ the awaited refresh still resolved. Now every async continuation is re-checked (commands and register commands, after the refresh too) and the view clears **all** sensitive local state (selection, FLOAT choice, comparisons, errors, pending receipt) on identity change, with the session section remounted on an identity/session key. RED→GREEN tests: deferred refresh + switch ⇒ rejected, result not applied; a completed comparison and the session selection do not survive a logout.                                        |
| 5   | The view always passed `receiving-id="null"`, so a repeat receipt click could fire a second command; nothing prevented overlapping command entry                                                                                      | **FIXED**                                                | RED: the receipt button was never disabled and a repeat click issued a second API call. Now the pending receipt target is tracked, its button is disabled while pending, other command controls are disabled while a command is busy, and the commands composable refuses an overlapping command **before** generating a key or dispatching. New tests: a duplicate click while pending (and one landing during the awaited refresh, after the attempt reset) produces no second API call and no new key; the busy state is released in `finally` so a retry after failure is allowed. |
| 6   | `router.cashRegister.spec.ts` timed out (5000 ms) in the verifier's focused run                                                                                                                                                       | **FIXED (deterministic setup, no timeout/retry change)** | The heavy `vi.resetModules()` + dynamic import ran inside a test. The router is now imported once at file scope and each navigation starts from a different path (a push to the current path is a duplicate navigation that never runs the guard). The file runs end to end in **~1.9 s**, with no test near the 5 s budget; no timeout value and no retry was added.                                                                                                                                                                                                                  |

### Test-first chronology for this batch

For every blocker above the failing assertion was written and observed **before**
the fix (RED), then re-run to GREEN. The original feature batch remains
implementation-before-tests and is not relabelled; the "Observed run" figure in
§5 counts both.

### Limits after this batch (unchanged in kind)

- Mocked transport only — **no live backend integration**, no endpoint
  availability, no real CLS/race/load proof. Not an integration claim.
- Backend conditional per-row grants stay authoritative; the UI only reflects the
  abilities it receives.
- The receipt actor binding (JWT subject == designated recipient) is enforced by
  the backend; the UI only offers the action to that recipient.
- The lens `TS2307` `.vue`-import diagnostics remain a **tool discrepancy**
  (`vue-tsc -p tsconfig.app.json` exits 0); per direction no suppression, shim or
  tooling change was added.

---

## 9. T6 — explicit Caja↔charge binding (frontend)

Delivered the explicit, fail-closed POS→Caja binding described in §2.2. Existing
pesos conversion, change math, payment catalog, customer, due-date and delivery
logic are **unchanged**; the binding was added to the existing attempt-key
invalidation so a new request body never reuses a prior key.

| Surface                           | Change                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `useCashSaleSession.ts` (new)     | Read gate (also on the public `refetch`), own/`OPEN`/tenant/UUID filter, honest paging, no auto-select, identity/permission/lifecycle-scoped clearing of the ACTUAL selection, captured selection scope plus LIVE `isSelectionScopeCurrent` / `revalidateSelection` fail-closed submit checks.                                                                                       |
| `CashSaleSessionPicker.vue` (new) | Presentational picker + paging; props down, events up. Never fetches or selects on its own.                                                                                                                                                                                                                                                                                          |
| `PaymentModal.vue`                | Owns the single composable instance; renders the picker only with `read:CashSession`; adds an optional top-level `cashSessionId` to BOTH payload shapes; blocks a stale selection via live scope revalidation; invalidates the attempt key on any binding edit; renders an accessible explicit opt-out **outside** the permission-gated picker; clears on reopen and on sale change. |
| `sale.types.ts`                   | Optional `cashSessionId?: string` on `LegacyChargePayload` and `MultiPaymentChargePayload`.                                                                                                                                                                                                                                                                                          |

### Test-first chronology (honest)

- The `useCashSaleSession` spec was created before the module. Its initial
  failure was module resolution (`Failed to resolve import .../useCashSaleSession`,
  0 executed tests, exit 1), **not a behavioural RED proving each rule**.
  After implementation the same spec ran **12/12 green**.
- The modal/picker **wiring** specs were authored alongside their implementation;
  the first run of the new modal binding tests produced **4 observed failures**
  caused by a real defect (a nested composable `ref` read without `.value`, and a
  second composable instance that disagreed about the page). Both were fixed, then
  the suite went green. This is reported as a defect found by the new tests, not
  as a pre-implementation RED for the presentational layer.
- **Correction batch 1 (T6 admission findings 1-4).** Before the production fix,
  15 behaviour probes were added. The observed RED was **13 failed / 88 passed
  (101 total), exit 1**; after the fix the same two files ran **101 passed, exit
  0**.
- **Correction batch 2 (limited to findings 2/4).** The parent rejected the first
  batch's retention deviation (keeping the selection on a permission/lifecycle
  change). Tests were rewritten to the original ACTUAL-selection-clears
  semantics plus a visible permission-loss/unresolved explicit opt-out that
  preserves payments. Against the retention code the observed RED was **7 failed
  / 96 passed (103 total), exit 1**; after restoring clearing and adding the
  accessible opt-out, the same two files ran **103 passed, exit 0** (GREEN).
- Existing legacy single/multi/regression assertions were extended with
  `cashSessionId` omission assertions; no legacy test was rewritten.

### Evidence (mocked transport)

```sh
# Two focused correction files: 2 files / 103 tests passed, exit 0
pnpm exec vitest run \
  src/features/POS/cash-register/composables/__tests__/useCashSaleSession.spec.ts \
  src/features/POS/sales/components/__tests__/PaymentModal.test.ts \
  --exclude '.worktrees/**' --exclude '.git/**'

# Whole sales + cash-register feature directories: 99 files / 1570 tests passed, exit 0
pnpm exec vitest run src/features/POS/sales src/features/POS/cash-register \
  --exclude '.worktrees/**' --exclude '.git/**'

# Scoped ESLint exit 0 and Prettier exit 0 on the four touched surfaces
```

**Historical vs actual counts.** The original T6 worker's report claimed the
4-file focused run at `145` tests and the feature directories at `1552`; the
parent's later observed runs measured `146` and `1553` respectively (one more on
each). Correction batch 1 re-measured the feature directories at `99 files /
1568 tests` (its 15 new probes on top of 1553); correction batch 2 adds 2 tests,
for a current observed **99 files / 1570 tests** and **103 tests** on the two
focused files, both exit 0.

Proven behaviours: explicit UUID on both payload shapes; exact omission for the
legacy unbound charge (no key, no `null`, no empty string); no auto-selection;
own/`OPEN`/tenant filtering including a later page; no fetch for an unauthorized
identity and no `refetch` without the ability; the actual selection clears on an
unresolved permission set, a revoked ability and a same-principal logout/login
while a same-tick confirm still never emits a prior-scope session id; an
invalidated binding leaves only a boolean marker, and an accessible explicit
opt-out (reachable without `read:CashSession`) restores a legacy unbound charge
while preserving the entered payments; the binding is part of the attempt body so
changing it (select B, explicit opt-out, a post-rejection edit, or a same-tick
edit) mints a fresh key while an unchanged bound retry keeps it; and the `$350`
sale paid with `$500` still yields `35000`/`50000`/`15000` cents.

### T7 current parent evidence

Independent binding/security proof admitted all four T6 findings after the bounded
corrections. The final limited check observed 103 tests / 2 files passing; its
shell did not expose a numeric exit field, while the parent's matching check
separately captured exit 0. This is mocked-transport proof, not live integration.

```sh
# Full repository: 500 files / 8530 tests passed, exit 0
pnpm exec vitest run --exclude '.worktrees/**' --exclude '.git/**'

# Current authoritative Vue-aware app type check and production build: exit 0
pnpm exec vue-tsc --noEmit -p tsconfig.app.json
pnpm run build-only
```

Non-blocking output: jsdom canvas/navigation warnings in the full suite and
production chunks above 500 kB in the build. No dependency or configuration
changes were made to silence them.

Final parent scoped ESLint, Oxlint and source/spec formatting passed (exit 0);
Oxlint reported **0 warnings / 0 errors on 50 files**. The initial 23 test-lint
errors were corrected only in assertions, without suppressions or production
changes. Independent test-only admission observed **163 tests / 6 files passing**
(normal completion; numeric exit unavailable in that verifier's tool).

The shared modal-test QueryClient was replaced with a fresh client per mount.
The failed-new-page test now directly asserts retained binding intent, error/stale
indicators and **no submit**, instead of relying on another test's warmed cache.
Parent final isolation and full-repository rerun both passed in one command
chain, exit 0:

```sh
# Isolated regression: 1 passed / 85 deliberately skipped by -t
pnpm exec vitest run src/features/POS/sales/components/__tests__/PaymentModal.test.ts -t 'never downgrades a bound charge to unbound when the session list errors' --exclude '.worktrees/**' --exclude '.git/**'
# Final tree after test cleanup: 500 files / 8530 passed
pnpm exec vitest run --exclude '.worktrees/**' --exclude '.git/**'
```

Functional T7 checks are complete; the closing documentation-format check is
recorded in the feature task log. Risk remains identity/permission and async
session scope, covered by the independent bounded verification and regressions;
this is not a claim of exhaustive concurrency or live integration. Combined
delivery/due-date preservation during lost-permission recovery is source-supported,
not directly asserted by that new recovery test.

Native assessment was unavailable because the existing untracked scope was not
declared; **no native review approval** is claimed. No browser/live backend checks,
commits, publishing, database, backend or environment changes were performed.
Full visual redesign, refunds and closing/PDF remain outside this feature.
