# Handoff 31 — cash registers report a held drawer (backend 699d79f2 + 9cbf0d02)

Verbatim copy of the backend session's handoff (2026-11-26). Backend doc: houndfe-backend docs/frontend-handoff/25-cash-redesign.md §7. Served on dev :3003. No migration.

GET /cash-registers (sin cambios: mismo permiso read:CashRegister, mismas rutas y mismos params). A cada item se le agregan estos campos:
```json
{
  "id": "…", "name": "Caja A", "isActive": true, "createdAt": "ISO",
  "drawerHeld": true,
  "drawerHeldStatus": "COUNTING",
  "drawerHeldSince": "2026-11-26T09:12:00.000Z",
  "heldBy": null
}
```
- drawerHeld: siempre presente. Es true si la caja tiene una sesión con el cajón sin liberar, en CUALQUIER estado (incluido CLOSED). Es exactamente la misma regla que dispara el 422 CASH_REGISTER_UNRELEASED_SESSION al abrir, porque el filtro es compartido.
- drawerHeldStatus ('OPEN'|'COUNTING'|'SUBMITTED'|'CLOSED') y drawerHeldSince (ISO, openedAt de la sesión): no null siempre que drawerHeld sea true, para todos. Nunca traen nombre. Si drawerHeld es false, vienen null.
- heldBy: null | { sessionId, status, openedAt, cashierDisplayName (string|null), byMe }. Se completa solo si el caller tiene read:CashSession (sin ese permiso GET /cash-sessions da 403, así que acá heldBy es siempre null) Y además la sesión es suya o tiene read:CashSessionAudit. Es la misma regla que GET /cash-sessions: un cajero común nunca ve el nombre de otro.
- Las cajas inactivas reportan los mismos campos.
- Es una foto del momento sin lock: otra terminal puede abrir o liberar entre el GET y el POST. Sigan mapeando el 422 CASH_REGISTER_UNRELEASED_SESSION a «La caja tiene una sesión sin liberar» y refresquen la lista.
- Textos sugeridos: «Ocupada · en conteo desde 09:12» (status + since); con heldBy, «Ocupada por Ana desde 09:12»; con byMe, el link a «Continuar / Liberar caja».

Nota de verificación: el verificador independiente encontró que un usuario con read:CashSessionAudit pero sin read:CashSession veía el nombre. Ya está corregido en 9cbf0d02, con su test.
