# Handoff 34 — GET /sales/drafts includes the customer (backend 1319f193)

Verbatim copy of the backend session's handoff (2026-11-28; backend doc docs/frontend-handoff/33-drafts-customer-summary.md). Served on dev :3003.

A cada fila de GET /sales/drafts (read:Sale, solo tus borradores, más nuevo primero) se le suman dos keys. Todo lo demás sigue igual y en el mismo orden:
```ts
customer: { id: string; firstName: string; lastName: string | null } | null
shippingAddress: { id: string | null; street: string; exteriorNumber; interiorNumber; zipCode; neighborhood; municipality; city; state } | null
```
- La forma y las reglas de null son exactamente las de PUT /sales/drafts/:id/customer y del borrador individual: usan el mismo select y el mismo mapper, así que no pueden divergir.
- Sin cliente → customer y shippingAddress en null. Con cliente sin dirección → shippingAddress null.
- Es una sola query de lista, sin N+1: la integración midió las mismas 8 sentencias para 1 borrador y para 6.
- Riesgos que preguntaste:
  - Permisos: no expone nada nuevo. GET /sales/:id ya devuelve ese resumen del cliente con read:Sale. No hay teléfono, correo, RFC ni datos fiscales.
  - Tamaño: suma ~0,3–0,5 KB por fila. No hay tope de borradores por usuario ni paginación, igual que antes.

Verificación: suite completa 17888 ✓; integración 5/5 ✓ (más sale-line-pets 32/32).

Frontend note (2026-11-28): no change needed — `mergeDraftListWithCache` (useSalesDrafts.ts, owner-ideas-batch L11) lets a row that carries the full objects win, so POS drafts now show their customer after a page reload too.
