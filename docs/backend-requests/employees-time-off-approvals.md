# Time-off approvals — User ↔ Employee relation missing

## Symptom

`GET /admin/employees-time-off/pending-approvals?managerId=...` always returns
`[]`, even when there are real `PENDING` time-off requests in the database. The
frontend renders the "no pending approvals" empty state regardless of state.

## Root cause

`employee-time-off.service.ts:218-246` filters with:

```ts
const subordinates = await prisma.employee.findMany({
  where: { managerId }, // expects an Employee.id
  select: { id: true },
});
```

The query expects an `Employee.id` (UUID from the `employees` table). The
frontend only knows `authStore.user.id`, which is a `User.id` (UUID from the
`users` table). Looking at `prisma/schema.prisma`, the `Employee` model has no
`userId` column and no `user` relation. There is no way — from frontend or
backend — to resolve "this logged-in User corresponds to this Employee in the
directory". The WHERE never matches, so the endpoint silently returns nothing.

## Options

### Option 1 — Add a 1:1 `User ↔ Employee` relation *(recommended)*

Add `userId String? @unique` to `Employee`, with
`user User? @relation(fields: [userId], references: [id], onDelete: SetNull)`.
Frontend resolves the Employee row for the current user (via a new `GET
/admin/employees/me` endpoint or a `employeeId` field added to `/auth/me`) and
passes that id as `managerId`.

Pros

- Correct domain model. Unlocks future "MY profile / MY time-off / MY
  documents" features.
- Non-breaking: `userId` is nullable, existing rows keep working.

Cons

- Requires a migration.
- Needs a decision on how to backfill the relation for current Users/Employees
  (admin UI, automatic match by email in seed, etc.).
- Adds one endpoint or one field to the auth response.

### Option 2 — Resolve manager from the JWT in the backend *(complementary to Option 1)*

Change the endpoint to `GET /admin/employees-time-off/pending-approvals` (no
query param). Backend reads `userId` from the JWT, resolves it to `Employee.id`,
and filters internally.

Pros

- Cleaner API. The caller cannot ask for another manager's approvals by
  passing a different `managerId`.
- One less round-trip for the frontend (no need to fetch the user's Employee
  first).

Cons

- Depends on Option 1 — without the relation, the backend has nothing to
  resolve.

Recommended path: ship Options 1 + 2 together in the same change.

### Option 3 — Manual manager selector in the UI *(workaround, no model change)*

Render a `USelectMenu` listing all managers in the tenant. The reviewer picks
one and sees the pending queue for that person.

Pros

- No backend changes required.
- Useful as an HR/admin tool to inspect any manager's queue.

Cons

- Bad UX for the main case (a manager reviewing their own team has to pick
  themselves from a list).
- Does not solve the underlying problem — "MY approvals" still cannot be
  answered.

## Frontend status while we wait

- Date strings from the backend are now formatted as `dd MMM yyyy` via
  `formatTimeOffDate` / `formatTimeOffDateRange` (no more raw ISO strings).
- Pending approval cards show employee avatar + full name (resolved via
  `useQueries` against `GET /admin/employees/:id`) instead of the raw
  `employeeId` UUID.
- The "no pending approvals" empty state was rewritten to honestly state the
  limitation instead of suggesting the queue is clean.
- `managerId = authStore.user.id` is kept as a placeholder. The moment the
  backend ships a way to resolve the current user's Employee id, swapping that
  getter is the only frontend change needed.
