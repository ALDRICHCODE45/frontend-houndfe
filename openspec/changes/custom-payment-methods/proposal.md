# Proposal: Custom Payment Methods (Métodos de cobro)

## Why

Cada sucursal cobra con destinos de pago distintos (p. ej. "Transferencia BBVA HFE", "LINK EVO Crédito", "Depósito en efectivo") pero hoy el POS del frontend solo expone cuatro etiquetas genéricas (`Efectivo`, `Tarjeta crédito`, `Tarjeta débito`, `Transferencia`). El cashier elige una etiqueta fija y el recibo guarda esa etiqueta base, lo que obliga al cliente a reconocer el destino en el extracto bancario y a que cada sucursal negocie cobros idénticos con identificadores visuales distintos. El backend ya implementó un catálogo `PaymentMethod` por sucursal (archivo `2026-08-26-custom-payment-methods`) con snapshot inmutable en `SalePayment.metadataJson.catalog`; lo que falta es la integración frontend que conecte ese catálogo con el selector del POS y la superficie admin que la sucursal necesita para mantenerlo. Sin esta pieza, el backend cobra por capacidades que nadie puede administrar ni aprovechar.

## What Changes

- **Admin CRUD** en `src/features/admin/payment-methods/` (espejo estructural de `payment-details`): lista de todos los métodos del tenant (activos + inactivos, `updatedAt DESC`), formulario crear/editar con `name` + `category` (4 opciones, **`credit` excluido**) + `subtitle` opcional, badge `Activo`/`Inactivo`, **toggle `Activo/Inactivo` en el slideover de edición** (`PATCH { isActive: true|false }`), botón "Desactivar" con `ConfirmModal` (`DELETE` baja lógica), menú lateral en `/admin/payment-methods` con gating `read:PaymentMethod`.
- **Proyección POS** consumida con `read:Sale` (NO `read:PaymentMethod`): los métodos activos se suman como tiles adicionales al mismo grid 2x2 de `PaymentModal.vue` y `DebtPaymentModal.vue`; cada tile custom reutiliza el icono de su `category` base y muestra `subtitle` como sub-línea gris; selección vacía → solo los 4 fijos, sin warning.
- **Payload de cobro**: `PaymentEntry` (en `sale.types.ts`) y los entry builders de ambos modales aceptan `paymentMethodId?: string` opcional; al elegir tile custom el entry sale con `{ method: category, paymentMethodId }`; tiles fijos omiten el id (compatibilidad legacy).
- **Sale detail + timeline**: `SaleDetailPayment` y el evento `PAYMENT_RECEIVED` del timeline aceptan `paymentMethodName?` + `paymentMethodSubtitle?` opcionales; `PaymentsListSection` y `SaleDetailTimeline` prefieren el nombre del catálogo sobre la etiqueta base, y renderizan `subtitle` como sub-línea gris.
- **CASL**: nuevo subject `PaymentMethod` registrado en `AppSubject` union, `APP_SUBJECTS` y `PERMISSION_COPY` con las 4 acciones (`create/read/update/delete`).
- **Errores de catálogo** mapeados en un nuevo `PAYMENT_METHOD_ERROR_MAP` (admin) y un mapa POS (charge) para los códigos nuevos de la integración del cobro.

### Assumptions (encoded from product rules — do not change without re-confirming)

1. **Categoría == método base.** El `category` de un método personalizado debe coincidir con el `method` del `PaymentEntry` al cobrar. Si el backend responde `400 PAYMENT_METHOD_CATEGORY_MISMATCH`, el frontend limpia la selección del catálogo (sin toast críptico) y deja al cashier elegir otra opción.
2. **Nombre duplicado (409).** El frontend muestra "Ya existe un método con ese nombre en esta sucursal" y mantiene el form abierto. No se hace debounce de pre-verificación — se delega al backend.
3. **Baja lógica + reactivar.** `DELETE` es `isActive=false`; la fila sigue visible como Inactiva en la lista admin. PATCH con `{ isActive: true }` la reactiva (sin recrear). **No existe hard delete** en ninguna acción del frontend.
4. **Carga POS.** `GET /sales/payment-methods` se dispara al abrir el selector de cobro. Si la respuesta viene `[]`, se renderizan solamente los 4 tiles fijos, sin warning visible al cashier.
5. **`isActive` reversible — diferencia deliberada con `payment-details`.** El subject `PaymentMethod` SÍ expone `PATCH` sobre `isActive`; el subject `PaymentDetail` NO. Esta es la ÚNICA excepción estructural entre ambos CRUD admin y debe respetarse en todas las capas (tipos, payloads, form state, `UpdateRequest`, API `update()`, slideover). El resto del pipeline ya valida `isActive` para `PaymentDetail` con `filterAllowedKeys`; ese guard no debe copiarse a `PaymentMethod`.

## Out of Scope

- Hard delete de `PaymentMethod` (no soportado por backend).
- Edición del `metadataJson` admin-only desde el frontend (no se expone en el wire).
- Agregar la categoría `credit` al selector admin (rechazada por backend con `400 INVALID_CATEGORY`).
- Refactor de `usePaymentDetailsTable` / `PaymentDetailsCardGrid` / `PaymentDetailUpsertSlideover` para compartirse con `payment-methods` (estructuralmente análogos pero contratos y lifecycle divergen; se duplica intencionadamente, igual que el resto del módulo admin).
- Cache invalidation cruzada entre `useSalePaymentMethods` y `useAdminPaymentMethods` (caches distintos por scope; la proyección POS es opt-in por sucursal y aceptar refetch al siguiente uso es aceptable).
- Refunds: `SaleRefund.method` se queda con la categoría base; no se introduce un valor `CUSTOM` en ningún enum del frontend.
- Path del bot WhatsApp (`POST /sales/:id/payments` con `method: "transfer"` y `metadataJson.origin`). No se modifica; sigue funcionando legacy sin `paymentMethodId`.
- Filtros del listado de ventas confirmadas (`PaymentMethodPills`): los métodos personalizados son snapshots dentro de payments rows, no se agregan al filtro.
- Paginación server-side en la lista admin (el backend retorna el arreglo plano completo; se reutiliza `applyLocalPaymentDetailFilters` + `paginatePaymentDetails` style).
- Hardening del `subtitle` searchable en la búsqueda global (search por `name` solamente, igual que el resto del grid).

## Capabilities

### New Capabilities

- **`admin-payment-methods`**: CRUD admin del catálogo de métodos de cobro por sucursal, con gating `read|create|update|delete:PaymentMethod`, badges Activo/Inactivo, slideover crear/editar con categoría de 4 opciones (`cash | card_credit | card_debit | transfer`) y `subtitle` opcional, reactivación explícita vía toggle en edición, baja lógica vía `ConfirmModal`, manejo de errores de validación (`INVALID_*` / `*_TOO_LONG`) y duplicado (`DUPLICATE_NAME`), menú `/admin/payment-methods`.

- **`pos-payment-method-tiles`**: Selector del POS consume `GET /sales/payment-methods` con `read:Sale`, suma los métodos personalizados al grid 2x2 de `PaymentModal` y `DebtPaymentModal` con icono derivado de la categoría y `subtitle` como sub-línea gris, opcional vacío sin warning, y propaga `paymentMethodId` al `PaymentEntry` sin tocar clientes legacy.

### Modified Capabilities

- **`payment-details`**: Se anota explícitamente que la regla "`isActive` NO editable vía PATCH, baja lógica solo vía DELETE" **NO aplica** al nuevo subject `PaymentMethod`. Esta nota se incluye en el spec de `payment-details` para evitar drift futuro en helpers compartidos (p. ej. un `filterAllowedKeys` no debe generalizarse).
- **`sales`**: Se agregan a `PaymentEntry`, `SaleDetailPayment` y `SaleTimelineEvent` los campos opcionales `paymentMethodId?`, `paymentMethodName?`, `paymentMethodSubtitle?`. Se documenta la preferencia por `paymentMethodName` sobre la etiqueta base de `method`, y el manejo de los nuevos códigos de error del endpoint de cobro (`PAYMENT_METHOD_CATEGORY_MISMATCH`, `PAYMENT_METHOD_NOT_FOUND`, `INACTIVE_PAYMENT_METHOD`, `INVALID_PAYMENT_METHOD_ID`).

## Approach

El módulo admin se construye espejando el árbol de archivos de `payment-details-admin` (mismas carpetas `api/`, `composables/`, `components/`, `interfaces/`, `utils/`, `views/`, `__tests__/`). Las piezas POS se construyen sobre los modales existentes sin reescribirlos: se extrae el mapa icono-por-categoría a una utilidad compartida para no duplicarlo por tercera vez, y se sustituye `methodOptions` por una lista computada que une los 4 tiles fijos con los customs del query `useSalePaymentMethods`. `PaymentEntry` extiende con un campo opcional que default-a-`undefined` para no romper clientes que mandan solo `method`. La superficie del detalle de venta usa la regla estándar del spec: si el snapshot existe, gana; si no, cae a la etiqueta base sin necesidad de ramificación por enum.

1. **Foundations (CASL + tipos + query keys + errors)** — `auth.types.ts`, `ability.ts`, `permissions.ts`, `query-keys.ts`, `payment-methods/interfaces/*`, `payment-methods/interfaces/errors.ts`. Cero componentes de UI todavía.
2. **Admin read path** — `api/payment-methods.api.ts`, `composables/usePaymentMethodsTable.ts`, `composables/usePaymentMethodColumns.ts`, `views/AdminPaymentMethodsView.vue` (read-only), ruta y entrada de nav.
3. **Admin mutations** — `composables/usePaymentMethodForm.ts`, `components/PaymentMethodUpsertSlideover.vue` (con toggle `isActive` en edit), `components/PaymentMethodCardGrid.vue`, `utils/payment-method-actions.utils.ts`. Confirmación de desactivar vía `ConfirmModal`. Manejo de toast por código de error.
4. **POS projection + tiles** — `useSalePaymentMethods`, helper compartido de iconos, `methodOptions` computada en `PaymentModal.vue` y `DebtPaymentModal.vue`. `PaymentEntry.paymentMethodId` se pule desde el slideover del grid al array de entries.
5. **Sale detail + timeline** — extender `SaleDetailPayment` / `SaleTimelineEvent`, `PaymentsListSection.vue`, `SaleDetailTimeline.vue` para preferir el snapshot y mostrar `subtitle` en gris.
6. **Charge error dispatch** — mapeo de los 4 códigos nuevos del cobro (`PAYMENT_METHOD_CATEGORY_MISMATCH`, `PAYMENT_METHOD_NOT_FOUND`, `INACTIVE_PAYMENT_METHOD`, `INVALID_PAYMENT_METHOD_ID`) y comportamiento de cada uno (limpiar selección / refetch + retry / toast + refetch / validar antes de enviar).

## Impact

### Áreas modificadas

| Área | Cambio |
|------|--------|
| `src/features/admin/payment-methods/` | Módulo nuevo (~8 archivos) |
| `src/features/auth/interfaces/auth.types.ts` | `'PaymentMethod'` antes de `'all'` en el union |
| `src/features/auth/authorization/ability.ts` | `'PaymentMethod'` en `APP_SUBJECTS` |
| `src/features/admin/roles/i18n/permissions.ts` | `PaymentMethod` label + `PERMISSION_COPY` block |
| `src/app/router/index.ts` | Ruta `/admin/payment-methods` con `meta.permission: ['read','PaymentMethod']` |
| `src/app/navigation/navigation.registry.ts` | Entrada sidebar sibling de `admin-payment-details` |
| `src/core/shared/constants/query-keys.ts` | `adminPaymentMethodQueryKeys` + key POS en `saleQueryKeys` |
| `src/features/admin/payment-methods/interfaces/errors.ts` | `PAYMENT_METHOD_ERROR_MAP` (admin) |
| `src/features/POS/sales/interfaces/sale.types.ts` | `PaymentEntry.paymentMethodId?` + `SaleDetailPayment`/`PAYMENT_RECEIVED` con los 3 campos opcionales |
| `src/features/POS/sales/components/PaymentModal.vue` | `methodOptions` computada + icono helper compartido; tile-badge (ítem custom) opcional |
| `src/features/POS/sales/components/DebtPaymentModal.vue` | Igual al anterior; preserva `paymentMethodId` en `normalizedPayments` |
| `src/features/POS/sales/composables/useSalePaymentMethods.ts` | Nuevo — query `GET /sales/payment-methods` con `staleTime` generoso |
| `src/features/POS/sales/components/PaymentsListSection.vue` | Preferir `paymentMethodName` + sub-línea `subtitle` gris |
| `src/features/POS/sales/components/SaleDetailTimeline.vue` | Misma preferencia para `PAYMENT_RECEIVED` |
| `src/features/POS/sales/api/sale.api.ts` | `getPaymentMethods()` consumido por el composable |
| `src/features/admin/payment-methods/utils/` | Helpers de descripción para ConfirmModal / kebab menu |

### Reuso explícito (sin reinventar)

- `AppDataTable`, `StatusDotBadge`, `ConfirmModal`, `AdminPageHeader`, `ViewToggle`, `<SortableHeader>` — todo desde `src/core/shared/components/`.
- `useServerTable` con `queryKey`/`defaultSorting`/`defaultPinning` del nuevo módulo.
- `createSimpleHeader` para columnas no-sortable (`isActive`, `actions`).
- `applyLocalPaymentDetailFilters` / `paginatePaymentDetails` style helpers (no se importan literalmente — el dominio difiere en fields; se reescriben para `name` + `category`).
- Patrón `// @ts-nocheck` + `mountWithUApp` + `vi.mock(...)` del spec harness de payment-details.
- `activityToBadgeTone` (`badge.utils.ts`) + `StatusDotBadge` para Activo/Inactivo.

## Risks / Unknowns

| # | Riesgo / Unknown | Mitigación / Decisión |
|---|-------------------|------------------------|
| 1 | Dos custom methods de la misma `category` seleccionados a la vez (p. ej. dos `card_credit` distintos). `toggleMethod`/`getMethodCount` actuales se keyean por `method` (categoría), no por `id` → colisión. | Asumido: el grid se compone por `category` y los customs comparten tile visual; el id se thread al entry seleccionado. Si se confirma requisito de multi-selección por id en design, se ajustará el key a `paymentMethodId` para customs. Marcado en open questions del explore, sin resolver en proposal. |
| 2 | Hash de idempotencia incluye `paymentMethodId`. Mismo método + distinto `paymentMethodId` → hash distinto; mismo método+id+monto → replay seguro. | Documentado en el spec backend; frontend no necesita acción especial más allá de no omitir el campo cuando se eligió un custom. |
| 3 | `subtitle` puede ser `null` → tile debe tolerarlo visualmente (no render sub-línea). | Helper de render del tile valida `subtitle && subtitle.trim()` antes de pintar el `<p>` gris. |
| 4 | Toggle `isActive` y `name` en PATCH simultáneos podrían divergir si el backend rechaza uno y acepta el otro (PATCH parcial devuelve `200` aún si solo algunos campos se aplicaron). | El frontend re-lee la respuesta del PATCH y reemplaza el row local; si llega `409 DUPLICATE_NAME`, revierte visualmente. |
| 5 | `statusTab` / `globalFilter` del admin resetear selección accidental — irrelevante porque el admin no tiene bulk en este slice. | No aplica. |
| 6 | Permisos antiguos de roles no incluyen `read:PaymentMethod` y los tenants existentes no migran — caja nueva queda sin acceso. | Menú y rutas gating por CASL ya filtra; documentar en release notes. |
| 7 | Tipos de error del charge (`PAYMENT_METHOD_*`) pueden colisionar con códigos legacy del módulo de ventas si el `extractErrorCode` se vuelve global. | Mapa dedicado `PAYMENT_METHOD_CHARGE_ERROR_MAP` aislado del resto de errores del charge; match solo por código `error` del response. |
| 8 | Volver a `payment-details.spec.md` para agregar la nota sobre `isActive` exige editar ese spec como "modificado" y abre el riesgo de cambiar su semántica. | La nota es puramente declarativa (un párrafo describiendo que la regla NO aplica a `PaymentMethod`), no toca ningún WHEN/SHOULD del spec existente. |

## First Slice Scope

**Slice 1 — Foundations (sin UI):** `auth.types.ts` + `ability.ts` + `permissions.ts` + `query-keys.ts` + `payment-methods/interfaces/{payment-method.types.ts, errors.ts}`. Entregable: tipos exportados, CASL parsea `create:PaymentMethod`, tests de tipos pasan. Cero componentes visuales.

**Slice 2 — Admin read:** `payment-methods.api.ts` (list/get), `usePaymentMethodsTable.ts`, `usePaymentMethodColumns.ts`, `views/AdminPaymentMethodsView.vue` (read-only con badge Activo/Inactivo), ruta + nav. Entregable: navegar a `/admin/payment-methods` muestra las filas en grid 2-col.

**Slice 3 — Admin mutations + slideover + reactivate:** `usePaymentMethodForm.ts`, `PaymentMethodUpsertSlideover.vue` (create + edit + toggle `isActive`), `PaymentMethodCardGrid.vue`, `utils/payment-method-actions.utils.ts`, `ConfirmModal` desactivar, error map dispatch. Entregable: ciclo CRUD completo + reactivación; `409 DUPLICATE_NAME` muestra mensaje específico.

**Slice 4 — POS projection + tiles + `PaymentEntry.paymentMethodId`:** `useSalePaymentMethods.ts`, helper compartido de iconos por categoría, `methodOptions` computada en ambos modales, threading del id en `normalizeEntries()` / `buildPayload()` / `normalizedPayments`. Entregable: cobrar un custom method manda `paymentMethodId` en el payload; tile fixed no lo manda.

**Slice 5 — Sale detail + timeline + charge error dispatch:** Extender `SaleDetailPayment`/`PAYMENT_RECEIVED`, `PaymentsListSection.vue`, `SaleDetailTimeline.vue`, `PAYMENT_METHOD_CHARGE_ERROR_MAP`, manejo de los 4 códigos del charge. Entregable: recibo y timeline muestran nombre del catálogo + sub-línea gris; errores del catálogo limpian/refrescan la selección.

Slices 1–3 y 4–5 son verificables independientemente (cada uno cierra con `pnpm test:unit --run` verde para sus tests co-localizados + type-check). Slices 4 y 5 son los que cierran el lazo end-to-end con el POS y el detalle de venta.

## Rollback Plan

El cambio es frontend-puro contra endpoints ya desplegados:

1. Revertir commits de los 5 slices en orden inverso (5 → 4 → 3 → 2 → 1).
2. Revertir `auth.types.ts` (quitar `'PaymentMethod'` del union), `ability.ts` (quitar de `APP_SUBJECTS`) y `permissions.ts` (quitar label + `PERMISSION_COPY` block) — rompe CASL parse, pero el módulo admin deja de montarse y el POS deja de pedir la proyección sin causar 500s.
3. Revertir ruta + entrada de sidebar.
4. `pnpm test:unit --run` + `pnpm build` deben quedar verdes con `payment-details` intacto.
5. No tocar backend: los endpoints quedan disponibles para re-habilitar el módulo en una iteración futura sin migración ni downtime.

## Success Criteria

- [ ] En `/admin/payment-methods` se listan métodos activos e inactivos con `updatedAt DESC`, badge Activo/Inactivo, búsqueda por `name`.
- [ ] Crear método: nombre + categoría (4 opciones, sin `credit`) + subtitle opcional; éxito → fila aparece arriba como Activa, list query invalidado.
- [ ] Editar método: pre-rellena form, partial PATCH con `name`/`category`/`subtitle`, toggle `isActive` en edit; éxito → fila actualizada in-place.
- [ ] Desactivar: `ConfirmModal` "Desactivar este método?" → DELETE → fila aparece como Inactiva (sigue visible).
- [ ] Reactivar: toggle `Activo` en edit de fila Inactiva → PATCH `{ isActive: true }` → vuelve a Activa.
- [ ] `409 DUPLICATE_NAME` → toast "Ya existe un método con ese nombre en esta sucursal"; form permanece abierto.
- [ ] `400 INVALID_*` / `*_TOO_LONG` → mensajes por campo en el slideover; ningún campo derivado (`id`, `tenantId`, `createdAt`, `updatedAt`, `metadataJson`, `isActive` en create) se envía.
- [ ] POS: `GET /sales/payment-methods` se llama al abrir el selector de cobro; los customs aparecen como tiles adicionales con su `name` como label y `subtitle` como sub-línea gris si existe.
- [ ] POS con respuesta vacía: solo los 4 tiles fijos, sin warning visible.
- [ ] Al cobrar con un custom tile: payload incluye `{ method: <category>, paymentMethodId: <uuid> }`; cobrado con tile fijo: `{ method, amountCents }` (legacy sin id).
- [ ] Sale detail: pagos con `paymentMethodName` muestran ese nombre + `paymentMethodSubtitle` en gris; legacy cae a etiqueta base sin ramas explícitas.
- [ ] Timeline `PAYMENT_RECEIVED` con snapshot: "Cobro de $X.XX en <paymentMethodName>" + `<subtitle>` en gris.
- [ ] Errores de catálogo en charge: `PAYMENT_METHOD_CATEGORY_MISMATCH` limpia selección del catálogo; `PAYMENT_METHOD_NOT_FOUND` refetchea y re-pide selección; `INACTIVE_PAYMENT_METHOD` avisa + refetch; `INVALID_PAYMENT_METHOD_ID` se valida como UUID en cliente antes de enviar.
- [ ] Menú lateral y `/admin/payment-methods` ocultos sin `read:PaymentMethod`; botones Crear/Editar/Desactivar ocultos según permisos faltantes.
- [ ] POS NO requiere `read:PaymentMethod`; un cajero con solo `read:Sale` ve los tiles customs sin error 403.
- [ ] Cambios en `payment-details` (slideover, API, form) NO rompen ni son modificados por este cambio — la única edición al spec `payment-details` es la nota declarativa sobre la regla `isActive`.
- [ ] `pnpm test:unit --run` verde en cada slice; `pnpm build` verde al cierre de los 5 slices.

## Key Learnings

1. Verificar la línea exacta de inserción en `APP_SUBJECTS` / `AppSubject` antes de tocar CASL — la falla es silenciosa y solo se detecta a runtime cuando `parsePermissionCode` retorna null.
2. Para CRUDs admin análogos, espejar el árbol de carpetas del referente es más barato que abstraer demasiado pronto — la divergencia de `isActive` muestra que el contrato no es realmente paralelo.
3. Los snapshots inmutables en backend eliminan la necesidad de invalidación cruzada de caches en el frontend: el detalle del sale ya lo leerá con el nombre grabado, sin tocar `useSalePaymentMethods`.
