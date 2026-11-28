# Handoff 33 — customers bulk actions (backend 053429df)

Verbatim copy of the backend session's handoff (2026-11-28; backend doc docs/frontend-handoff/32-customers-bulk-actions.md, its own numbering). Merged on backend local main (HEAD 053429df), served on dev :3003. No migration.

Commits: 08795da8 contrato · 1ab4920b ZIP · bafb6c29 selección + CSV + CORS · 9946d2f5 keys reservadas / log de denegados / merge de CORS · 7047c129 estados masivos · e55240d0 deadline de 120 s + abort silencioso · ae67dadd docs · 053429df abort si el cliente se fue antes del handler.

**Selección** (body JSON, compartida por las dos rutas)
- {"mode":"ids","customerIds":[...]}, de 1 a 1.000 UUIDs. Es estricto: cualquier id desconocido, de otra sucursal o borrado → 404 BULK_CUSTOMERS_NOT_FOUND con details.missingIds.
- {"mode":"filter","filter":{…params de GET /customers/listing, como strings…},"excludeIds":[...]}, con hasta 1.000 excludeIds. Mismas reglas y errores que el listado. page/limit/sortBy/sortOrder no van dentro de filter. Las keys __proto__, constructor y prototype dentro de filter → 400.

**1) POST /customers/bulk/export → CSV**
- Permisos: read:Customer + export:Customer (permiso NUEVO, se siembra al arrancar y se asigna en Admin → Roles). Super Admin lo tiene por manage:all; manage:Customer NO alcanza.
- Body: { selection, sortBy?, sortOrder? }.
- Las métricas (8 columnas) salen solo con read:Sale; sin read:Sale, los filtros y órdenes de métricas → 400 LISTING_PARAM_REQUIRES_PERMISSION.
- Formato: text/csv; charset=utf-8, BOM, coma, CRLF, RFC 4180, protección contra fórmulas, montos en pesos (785.00), fechas locales YYYY-MM-DD y YYYY-MM-DD HH:mm, CP como ="03100". Content-Disposition attachment con fecha.
- Columnas: ID cliente, Nombre, Apellido, Razón social, Lada, Teléfono, Correo, Lista de precios, RFC, Régimen fiscal, Forma de pago preferida, Cliente de confianza, Alta, Colonia, Municipio, Ciudad, Estado, CP, Mascotas activas, Especies; con read:Sale se suman Deuda, Deuda vencida, Ventas vencidas, Vencido desde, Compras, Total comprado, Ticket promedio y Última compra.
- Máximo 10.000 filas: si se pasa, 400 BULK_SELECTION_TOO_LARGE {count, max} y no se escribe nada.

**2) POST /customers/bulk/statements → ZIP**
- Permisos: read:Sale + read:Customer. Body: { selection, from, to }, con las mismas reglas de período que el PDF individual (hasta 366 días).
- Un PDF por cliente, idéntico byte a byte al individual, en orden de nombre e incluyendo a los clientes sin movimientos. Cada archivo se llama con el nombre del cliente, saneado y desambiguado ("Ana López.pdf", "Ana López (2).pdf"). El ZIP: estados-de-cuenta-<from>-<to>.zip.
- Máximo 50 clientes (400 BULK_SELECTION_TOO_LARGE) y no puede quedar vacío (400 BULK_SELECTION_EMPTY).
- Es sincrónico: ~180 ms por PDF, ~9–10 s para 50 completos.
- Una corrida por proceso, compartida entre sucursales: 429 BULK_EXPORT_BUSY con details.retryAfterSeconds 10 (el header Retry-After NO está expuesto por CORS; leelo del body).
- Deadline de 120 s → 503 BULK_EXPORT_TIMEOUT {deadlineSeconds: 120}. Si el usuario cancela, el server libera el lugar y no responde nada.
- Otros errores: 500 PDF_GENERATION_FAILED; 403 con el código en `error` (INSUFFICIENT_PERMISSIONS).

**CORS:** Access-Control-Expose-Headers: Content-Disposition (verificado en :3003). Usá el filename del server y, si no viene, armá uno vos.

**Flujo sugerido:**
- Descargá con fetch + blob.
- 404 → sacá los missingIds de la selección, avisale al usuario y ofrecé reintentar.
- 429 → esperá retryAfterSeconds.
- 503 → «La descarga tardó demasiado; probá con menos clientes».
- 400 TOO_LARGE/EMPTY → refrescá la tabla.

**Límites conocidos:**
- Las keys reservadas fuera de selection.filter se descartan en silencio.
- Durante otra corrida, un filtro inválido recibe 429 antes que 400.
- Ante un timeout, el render trabado sigue corriendo de fondo.
- No hay tabla de auditoría (pendiente para hablar después); sí queda un log estructurado por pedido.

Verificación: suite completa 17884 ✓. Integraciones de export y de estados 23 + 36 ✓. Review nativa APPROVED en T1, T3 y los arreglos; verificador independiente PASS en T1 y T3.

## Update (backend 9ad65e9a, 2026-11-28, verbatim summary)
1) CORS ahora expone Retry-After además de Content-Disposition (Access-Control-Expose-Headers: Content-Disposition,Retry-After). En un 429 BULK_EXPORT_BUSY podés leer el header directo; details.retryAfterSeconds sigue viniendo.
2) Las keys __proto__, constructor y prototype dan 400 en cualquier parte del body de POST /customers/bulk/export y /statements: raíz, selection y objetos anidados hasta 4 niveles (los arrays no se recorren). Antes solo pasaba dentro de selection.filter. El body del error es idéntico al de una propiedad desconocida en esa ruta (si la key está dentro de selection, viene anidada en selection.children). Si selection.filter tiene una, se informa solo ese error.
Frontend note: no change needed — the client reads details.retryAfterSeconds and `buildBulkSelectionFilter` already strips the reserved keys.
