# Delta for Payment Details — `isActive` Reversal Note for the `PaymentMethod` Subject

Extends `openspec/specs/payment-details/spec.md` with a single declarative note that prevents future drift between `PaymentDetail` (this capability) and the new `PaymentMethod` subject (governed by `admin-payment-methods`). Anchored on `openspec/changes/custom-payment-methods/design.md` §2.2 (`isActive` reversal), §5 (CASL permission matrix), §11 (risks), and the per-change proposal's assumption #5.

No existing REQ-PD-* is modified. The note is purely declarative and lives under `## ADDED Requirements` so any future generalization of shared admin helpers (for example a shared `filterAllowedKeys` in `payment-details.api.ts`) cannot silently strip `isActive` from `PaymentMethod.update()` payloads. The wire contract difference is enforced by `admin-payment-methods` REQ-PM-002 (create) and REQ-PM-003 (edit) and by pin tests in `payment-methods.api.spec.ts` per design §11.

## ADDED Requirements

### REQ-PD-NOTE-001: `PaymentDetail`'s "`isActive` NOT editable + no reactivation" rule MUST NOT be generalized to `PaymentMethod`

The "create always starts active, `isActive` is NOT editable via PATCH, logical delete only via DELETE, no reactivation, no hard delete" rule (REQ-PD-002 through REQ-PD-004) governs `PaymentDetail` and ONLY `PaymentDetail`. The `PaymentMethod` subject (governed by `admin-payment-methods`) has the deliberate, load-bearing reversal: `PATCH /admin/payment-methods/:id` DOES accept `isActive: boolean` so the admin can reactivate a previously-deactivated method without recreating it (design §2.2, §3.1; backend §3.4). Any future abstraction of shared admin helpers — specifically `filterAllowedKeys` in `payment-details.api.ts` (which strips `isActive` from `PaymentDetail` updates) — MUST NOT be applied to `PaymentMethod`. If a shared whitelist is ever introduced, `PaymentMethod.update()` MUST be registered with `isActive` allowed (create: `['name','category','subtitle']`; update: `['name','category','subtitle','isActive']` — see `payment-method.types.ts` and design §2.2).

#### Scenario: shared `filterAllowedKeys` MUST NOT strip `isActive` from `PaymentMethod`

- GIVEN a future refactor that generalizes `filterAllowedKeys` across admin modules
- WHEN the helper is applied to `paymentMethodsApi.update()`
- THEN `isActive` is forwarded in the PATCH payload
- AND `tenantId` is NEVER forwarded (whitelist is stricter than the backend's `forbidNonWhitelisted`)
- AND a pin test in `payment-methods.api.spec.ts` asserts `isActive` IS forwarded and `tenantId` is NOT

#### Scenario: `PaymentDetail` rules remain unchanged

- GIVEN the existing `filterAllowedKeys` for `PaymentDetail`
- WHEN the helper is applied to `paymentDetailsApi.update()`
- THEN `isActive` is stripped (consistent with REQ-PD-003)
- AND `tenantId` is stripped
- AND no `isActive` field appears in any `PaymentDetail` PATCH payload sent from the frontend

#### Scenario: cross-reference — `PaymentMethod` create omits `isActive`

- GIVEN the create flow for `PaymentMethod`
- WHEN the payload is emitted
- THEN `isActive` is NOT included (per `admin-payment-methods` REQ-PM-002 / backend §3.1 `forbidNonWhitelisted`)
- AND the new method is born active (default `true` server-side)

#### Scenario: cross-reference — `PaymentMethod` edit accepts `isActive`

- GIVEN the edit flow for `PaymentMethod`
- WHEN the user toggles `isActive` in the edit slideover (per `admin-payment-methods` REQ-PM-003)
- THEN the PATCH payload contains `isActive: true | false`
- AND the row's badge updates accordingly after refetch

#### Scenario: reversal is documented in the CASL permission copy

- GIVEN the role-permissions UI block for `PaymentMethod` (per design §5.1)
- WHEN the admin inspects the permission descriptions
- THEN `update` copy states "Modificar nombre, categoría, subtítulo o estado activo de un método"
- AND `delete` copy states "Dar de baja un método. Deja de aparecer al cobrar; puede reactivarse"
- AND the language reflects that reactivation IS supported (vs `PaymentDetail`'s "no se reactiva")

