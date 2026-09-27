# Admin user email and tenant roles

## Authorized scope

Work only in the principal frontend repository on `feat/admin-user-email-roles`, based on `ba36d698c07a36cc3412003dc8e8cb16cb4a3eac`. No new worktree or edits to the previous OTP worktree. Preserve both untracked OpenSpec files. Owner alone pushes and deploys. No commits or MAIN integration until both candidates are stable, verified, reviewed and coordinated.

Backend contract v1 was released by coordinator message `1672d1b0-055f-48ed-a7c4-2ed3f5970db8`; canonical backend task has the same relative path (mirror 10847).

## Contract and boundaries

- PATCH `/admin/users/:id`: required `name: string`, optional `email: string`, optional `roleIds: string[]`. Omitted fields preserve values; null is invalid. Existing profile response shape remains.
- Email is trimmed/lowercased by backend and globally unique (409). Actual email change atomically invalidates pending/active OTP challenges, without immediate logout.
- Supplied role IDs replace the complete nonempty, unique UUID set for the current tenant only. Creation retains singular `roleId` unchanged.
- Profile editing requires `update:User`; supplying role IDs additionally requires `update:TenantMembership`. Role UI also requires existing `read:Role` catalog access. Do not widen permissions or introduce an inferred hierarchy.
- Backend validates target membership/tenant roles before atomic writes, rejects non-superadmin edits to globally privileged targets, and preserves global/foreign memberships and session fields.
- Hydrate edit state from GET detail `{user, roles}` for the current tenant, never aggregated list roles. Fence user/tenant changes, cancellation and reopening; submit only after the correct detail loads.
- Send role IDs only for an intentional authorized change. Missing catalog/permissions or current roles absent from the catalog must not truncate roles or unnecessarily block profile editing.
- Preserve inputs and useful errors on 400/403/409; invalidate/refetch list and detail on success. No UI redesign.

## Work plan and review forecast

- [x] Read-only mapping and explicit policy/contract agreement.
- [ ] One writer: RED then GREEN for detail hydration, profile fields and authorized multi-role editing; creation regressions unchanged.
- [ ] Relevant regression suite, three TypeScript projects and exact lint/format checks; independent verification.
- [ ] Coordinated native review and local delivery under the existing feature-branch-chain strategy.

Forecast: approximately 500–900 authored changed lines including regression coverage; likely above the 400-line advisory. Proposed coherent work units are detail-backed profile editing with tests, then permission-gated multi-role editing with tests, where independently buildable. Do not shrink coverage or split code from tests to meet an arbitrary count. Actual delivery remains held until both repositories are coordinated.

Writer allowlist (eight paths):

- `src/features/admin/users/components/UserUpsertSlideover.vue`
- `src/features/admin/users/composables/useUserForm.ts`
- `src/features/admin/users/interfaces/user.types.ts`
- `src/features/admin/users/views/AdminUsersView.vue`
- `src/features/admin/users/components/__tests__/UserUpsertSlideover.spec.ts`
- `src/features/admin/users/composables/__tests__/useUserForm.spec.ts`
- `src/features/admin/users/api/__tests__/users.api.spec.ts`
- `src/features/admin/users/views/__tests__/AdminUsersView.test.ts`

This task document is parent-owned. API production forwarding already preserves its typed payload; request an explicit scope amendment if another production path proves necessary.

All tests and static validation commands must run under `unshare --user --map-root-user --net`, failing closed if isolation fails. No browser, live requests, services, DB, environment/secrets inspection, installs, remote operations or runtime acceptance. Local source checks do not establish deployed email delivery or backend authorization enforcement.
