# Sale line with an archived pet when the customer has no active pets

From the customer-pets fix round (odd/tasks/customer-pets.md L10): the line pet picker shows only when the draft customer has active pets, so a line whose pet was archived — on a customer with no active pets left — shows «Para: X (archivada)» but offers no way to remove it.

## Specs
- S1 Owner (2026-11-26), asked about the pending items: «Como lo recomiendes.» Recommendation taken: show the picker on a line that already has a pet even when the customer has no active pets, offering «Sin mascota» and the line's pet as a disabled «<nombre> (archivada)» option, so the cashier can clear it.
- S2 Keep the permission gate: the picker (and the pets list request) still needs read:Customer — without it nothing changes (no picker). Lines without a pet and customers with no active pets keep hiding the picker. Choosing «Sin mascota» sends PUT /sales/drafts/:id/items/:itemId/pet { petId: null } as today.

## Tasks
- [ ] T1 S1-S2 Line pet picker visible for a line with a pet when the user can read pets, even with zero active pets — worker
- [ ] T2 Full suite, merge — parent

## Log
- L1 Owner: «Bien hermano, ya esta todo pusheado, algo mas que tengas en tu radar?» → «Como lo recomiendes.» The «Guardar cambios» header item was already fixed by detail-page-frame (header save `max-md:hidden`, mobile bottom bar; L8 browser 390).
