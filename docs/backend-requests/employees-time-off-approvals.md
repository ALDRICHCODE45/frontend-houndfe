# Time-off approvals — User ↔ Employee relation — RESOLVED

> Status: **closed**. Backend shipped Option 1 + Option 2 from the original
> request. Frontend now uses the JWT-resolved endpoint. The original analysis
> is kept below for context.

## Final backend contract

- `Employee.userId` is the link to the logged-in `User`.
- Personal endpoint (used by the "Aprobaciones pendientes" view):

  ```http
  GET /admin/employees-time-off/pending-approvals
  ```

  No query params. Backend reads `userId` from the JWT, finds the linked
  Employee, and returns the PENDING requests of its direct subordinates. If
  the user has no Employee linked, the backend returns `[]` (not an error).

- Admin/HR endpoint (optional, used by any future "view another manager's
  queue" dashboard):

  ```http
  GET /admin/employees-time-off/pending-approvals/by-manager/:managerId
  ```

  Here `:managerId` is an `Employee.id`, NOT a `User.id`.

## Frontend changes shipped

- `employeesApi.getPendingApprovals()` no longer accepts a `managerId`. Calls
  the new JWT-resolved endpoint.
- `employeesApi.getPendingApprovalsByManager(managerId)` added for the
  admin/HR variant. Path-parameter style, no query params.
- `usePendingApprovals()` is the personal hook; `usePendingApprovalsByManager(id)`
  is the admin/HR hook.
- Query keys split into `pending(tenantId)` (scoped per tenant, user implicit
  in the JWT) and `pendingByManager(tenantId, managerId)`.
- `PendingApprovalsView` removed the placeholder `authStore.user.id` getter
  and rolled the empty state back to a normal "all caught up" message — now
  that the backend can actually return data when there is data.

---

## Original analysis (kept for history)

### Symptom

`GET /admin/employees-time-off/pending-approvals?managerId=...` always returned
`[]`, even when there were real `PENDING` time-off requests in the database.
The frontend rendered the "no pending approvals" empty state regardless of
state.

### Root cause

`employee-time-off.service.ts:218-246` filtered with:

```ts
const subordinates = await prisma.employee.findMany({
  where: { managerId }, // expected an Employee.id
  select: { id: true },
});
```

The query expected an `Employee.id`. The frontend only knew
`authStore.user.id`, which was a `User.id`. The `Employee` model had no
`userId` and no `user` relation, so there was no way to resolve "this
logged-in User corresponds to this Employee". The WHERE never matched.

### Options proposed

1. **Add a 1:1 `User ↔ Employee` relation** (recommended).
2. **Resolve manager from the JWT in the backend** (complementary to 1).
3. **Manual manager selector in the UI** (workaround, no model change).

Backend shipped 1 + 2 together. Option 3 was not needed.
