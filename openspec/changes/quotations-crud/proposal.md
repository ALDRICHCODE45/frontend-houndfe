# Proposal: Quotations CRUD

## Why

Sellers need to create and send customer quotations before a sale. The frontend lacks this pre-sale workflow.

## What Changes

- Add `src/features/quotations/` with API, composables, views, components, utilities, and tests.
- Add a **Cotizaciones** sidebar item plus list, create, and detail routes.
- Provide a full-page list with status/customer filters, search, and pagination.
- Let `DRAFT` quotations assign customers/price lists, manage items, quantities, prices and promotions, set expiry, and show advisory stock badges.
- Preview/download authenticated PDFs through blob URLs.
- Send by email or mark as `SENT`; failed email delivery keeps the quotation in `DRAFT`.
- Cancel with a required reason.
- Make `SENT`, `EXPIRED`, and `CANCELLED` details read-only with PDF access.
- Gate routes and actions with CASL `create/read/update/delete:Quotation` permissions.

## Out of Scope

- Quotation-to-sale conversion (`CONVERTED_TO_SALE`); future slice.
- Stock validation or reservation; badges are informative only.
- Real-time updates or WebSockets.

## Capabilities

### New Capabilities
- `quotations-management`: Listing, draft authoring, lifecycle actions, read-only history, PDFs, and permissions.

### Modified Capabilities
- None. Sales and promotions requirements remain unchanged.

## Approach

Follow Vue 3 Composition API and POS patterns. Reuse authenticated Axios, TanStack Query, and shared sales/UI components. After every mutation, replace cached state via `setQueryData` using the backend's complete response. Deliver strict-TDD slices with `pnpm test:unit`, targeting at most 400 changed lines per slice.

## Impact

| Area | Impact | Description |
|---|---|---|
| `src/features/quotations/` | New | Feature module and tests |
| `src/features/auth/authorization/ability.ts` | Modified | Register `Quotation` |
| `src/app/navigation/navigation.registry.ts` | Modified | Add sidebar item |
| `src/app/router/index.ts` | Modified | Add guarded routes |
| `src/core/shared/constants/query-keys.ts` | Modified | Add cache keys |

Reuses `AssignCustomerSlideover`, `ProductSearchPanel`, `PriceListSelector`, `ConfirmModal`, `StatusDotBadge`, `AppDataTable`, and `formatCentsMXN`.

## Risks / Unknowns

| Risk | Likelihood | Mitigation |
|---|---|---|
| Iframes cannot attach JWT headers | High | Use blob/object URLs and revoke them |
| Cache drift without WebSockets | Medium | Replace caches with complete mutation responses |
| Stock badges imply availability | Medium | Label as advisory; never gate actions |

## First Slice Scope

Ship a permission-gated list, create `DRAFT`, optional customer assignment, product addition with advisory stock, and backend totals. Defer promotions, PDF, send, cancel, and advanced editing.

## Rollback Plan

Remove routes, navigation, CASL subject, query keys, and the isolated feature module. No frontend data migration is required.

## Success Criteria

- [ ] Authorized sellers can list, create, edit, send, cancel, and view quotations according to lifecycle rules.
- [ ] Non-drafts expose no editing controls and retain PDF access.
- [ ] Mutations replace cached quotation state from backend responses.
- [ ] `pnpm test:unit` passes.
