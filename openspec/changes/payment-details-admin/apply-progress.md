# Apply progress — payment-details-admin (Datos bancarios)

> **Final apply-progress** (completo). El apply se completó en dos partes:
> 1. **Subagente `sdd-apply` (intento 1):** S1 + S2 completos con TDD, S3 a medio (specs sin mock del api → 10 tests fallando), S4 sin implementar. El subagente timeouteó a los 20 min.
> 2. **Completado manual por el orquestador (con autorización del maintainer):** S3 y S4 implementados, specs corregidos, suite completa verde. Commits realizados por el maintainer (el harness bloquea commits del agente — bug del detector que escanea el texto "git commit").

---

## S1 — Foundation (types + error map + CASL registration + query keys)

**Status: ✅ Complete** (RED → GREEN → TRIANGULATE → REFACTOR)

### Files
- NUEVO: `src/features/admin/payment-details/interfaces/payment-detail.types.ts`, `interfaces/errors.ts`, `interfaces/__tests__/payment-detail.types.spec.ts`, `interfaces/__tests__/errors.spec.ts`
- MOD: `src/features/auth/interfaces/auth.types.ts` (AppSubject + 'PaymentDetail'), `src/features/auth/authorization/ability.ts` (APP_SUBJECTS), `src/features/admin/roles/i18n/permissions.ts` (SUBJECT_LABELS + PERMISSION_COPY), `src/core/shared/constants/query-keys.ts` (adminPaymentDetailQueryKeys)
- TEST MOD: `ability.test.ts`, `permissions.spec.ts`, `query-keys.test.ts`

### TDD Cycle Evidence

| Step | Evidence |
| --- | --- |
| RED | Specs escritos y corriendo rojo: schemas (create all-required / edit all-optional / isActive ausente), extractor de error, tests de ability/permissions/query-keys extendidos. |
| GREEN | Implementación + registro CASL. `pnpm test:unit --run` → 202 tests verdes (5 files: interfaces, auth/authorization, roles/i18n, query-keys). |
| TRIANGULATE | Edge cases: edit acepta `{}`; códigos desconocidos/message-only → null; malformed codes drop; revocación. |
| REFACTOR | Naming/comentarios; HIDDEN_SUBJECTS intacto; sin manage/batch_delete. |

---

## S2 — Pure data layer (API + form + columns + view-mode + actions utils)

**Status: ✅ Complete** (RED → GREEN → TRIANGULATE → REFACTOR)

### Files
- NUEVO: `api/payment-details.api.ts` + spec, `composables/usePaymentDetailForm.ts` + spec, `composables/usePaymentDetailColumns.ts` + test, `composables/usePaymentDetailViewMode.ts` + test, `utils/payment-detail-actions.utils.ts` + spec

### TDD Cycle Evidence

| Step | Evidence |
| --- | --- |
| RED | Specs de api (filtros/sort/paginate + URL/método/payload via vi.mock http), form (schema por modo, reset, setValues), view-mode (default table, bridge card→cards), actions utils (last-active, descripciones, row actions). |
| GREEN | Implementación. Tests verdes. |
| TRIANGULATE | Empty list → pageCount 1; sort updatedAt desc; globalFilter case-insensitive; last-active false cuando target inactivo u otro activo. |
| REFACTOR | Helpers puros exportados; sin duplicación con tenant-actions.utils; sin type leak de employees. |

---

## S3 — Table wrapper + columns + card grid + nav/route (read-only list)

**Status: ✅ Complete** (completado manualmente por el orquestador — el subagente dejó specs fallando por falta de mock del api)

### Files
- NUEVO: `composables/usePaymentDetailsTable.ts` (single-source wrapper LOCKED) + spec, `components/PaymentDetailCardGrid.vue` + spec
- MOD: `src/app/navigation/navigation.registry.ts` (admin child "Datos bancarios" → /admin/payment-details), `src/app/router/index.ts` (lazy import + ruta con meta.permission read:PaymentDetail)

### Correcciones manuales (bugs de los specs que dejó el subagente)
1. **`usePaymentDetailsTable.spec.ts`**: mockeaba `useServerTable` y `useAuthStore` pero NO `paymentDetailsApi` → el queryFn hacía `http.get` real → Network Error. Fix: `vi.mock('@/features/admin/payment-details/api/payment-details.api')` manteniendo `paginatePaymentDetails` real (importOriginal) + `vi.mocked(paymentDetailsApi.list).mockResolvedValue(allRows)` en los 3 tests que usan capturedQueryFn. También se corrigió el import del api a ruta alias (la ruta relativa `../api/` desde `composables/__tests__/` era incorrecta).
2. **`PaymentDetailCardGrid.spec.ts`**: usaba un `mountWithUApp` inline con `UApp` real importado de `@nuxt/ui/runtime/components/App.vue` → "Cannot call find on an empty VueWrapper". Fix: usar el helper real `mountWithUApp` de `@/test/mountWithUApp` con `props:` en el objeto de options (no props sueltos).

### TDD Cycle Evidence

| Step | Evidence |
| --- | --- |
| RED | Specs del wrapper (queryFn llena fullList Y devuelve slice; hasActiveAccount desde fullList no slice; invalidation refetches) + card grid (skeleton, empty, cards, badges, click). |
| GREEN | Implementación + corrección de mocks. `pnpm test:unit --run src/features/admin/payment-details` → 125 tests verdes (9 files). |
| TRIANGULATE | Empty list → pageCount 1 y hasActiveAccount false; activo en página 2 → hasActiveAccount true; wrapper hace exactamente UNA fetch. |
| REFACTOR | Wrapper sin tocar useServerTable compartido; components puramente presentacionales. |

---

## S4 — Upsert slideover + view (inline mutations + banner + confirm + gating)

**Status: ✅ Complete** (implementado manualmente por el orquestador — el subagente no llegó)

### Files
- NUEVO: `components/PaymentDetailUpsertSlideover.vue` + spec, `views/AdminPaymentDetailsView.vue` + spec
- El view: mutaciones INLINE (useMutation create/update/delete), banner UAlert "Sin cuenta activa" inline, ConfirmModal "Desactivar", gating por permisos CASL (canCreate/canUpdate/canDelete/canManage).

### Detalles de implementación manual
- `PaymentDetailUpsertSlideover.vue`: USlideover + UForm + zod (create all-required / edit all-optional / **isActive NUNCA presente**). Helpers tipados `setCreateField`/`setEditField` + handlers por campo (handleBankName etc.) para evitar `value: any` en los `@update:model-value` de UInput.
- `usePaymentDetailForm.ts`: se agregaron `setCreateField`/`setEditField` tipados (patrón de updateName/updateSlug de tenants).
- `AdminPaymentDetailsView.vue`: destructura `usePaymentDetailsTable()` a nivel top del `<script setup>` (auto-unwrap de refs), inline useMutation con invalidation del queryKey list, error mapping vía `extractPaymentDetailErrorCode` (lee `.error`) + fallback `normalizeApiError`.
- `AdminPaymentDetailsView.spec.ts`: inicialmente mockeaba `@nuxt/ui` (frágil) → cambiado a `global.stubs` (nuxtUiStubs) con alias sin prefijo (Alert/Button/Icon/Card/DropdownMenu) porque el auto-import de Nuxt UI registra ambos nombres. El testid del banner es `no-active-account-banner` (se corrigió un mismatch `no-active-banner`).

### TDD Cycle Evidence

| Step | Evidence |
| --- | --- |
| RED | Specs slideover (title/description/formId por modo; isActive NUNCA en ambos modos; solo 4 campos) + view (banner, error state, gating, badges). |
| GREEN | Implementación. `pnpm test:unit --run src/features/admin/payment-details` → 148 tests verdes (11 files). |
| TRIANGULATE | Payloads nunca contienen isActive/tenantId; delete idempotente; banner reaparece tras desactivar última activa; gating correcto. |
| REFACTOR | View delgado (composition surface); copy en utils/interfaces; suite completa verde. |

---

## Suite completa final

| Comando | Resultado |
| --- | --- |
| `pnpm test:unit --run` | ✅ **4552 tests pasan** (305 files) |
| `pnpm exec vue-tsc --noEmit -p tsconfig.app.json` | ✅ sin errores (payment-details + resto) |
| `pnpm build` | ✅ built in 9.77s (chunk AdminPaymentDetailsView presente) |

## Commits (realizados por el maintainer — el harness bloquea commits del agente)

Tras squash del S1 duplicado (por corte de zsh del maintainer):
1. `8b20c7a` feat(payment-details): register PaymentDetail subject, types, error map and query keys (S1)
2. `4c8a666` feat(payment-details): add API client, form, columns, view-mode and actions utils (S2)
3. `ad83441` feat(payment-details): add single-source table wrapper, card grid and routes (S3)
4. `565f372` feat(payment-details): add upsert slideover, mutations wiring and confirm flow (S4)
5. `79cf336` docs(sdd): payment-details-admin exploration, proposal, design, spec and tasks

Merge a `main` completado por el maintainer. Working tree limpio.

## Deviations from design

- **Mutaciones inline en el view** (patrón compacto tenants/users) — tal como el design corregido (rerun) lo especifica. Sin composables dedicados de mutación.
- **Banner inline** UAlert (no componente separado) — conforme al design corregido.
- **Card grid único** con markup in-line (no card component separado) — conforme al design corregido.
- **Helpers `setCreateField`/`setEditField`** agregados al form composable (detalle de tipado, no cambio de contrato).
- El agente sdd-apply timeouteó; S3/S4 completados manualmente (autorizado por maintainer).

## Remaining tasks (parent-owned, post-apply)

- ✅ Lifecycle gate: merge feature branch → main (hecho por maintainer).
- ✅ Confirm per-slice budget adherence (cada slice ≤ 600 líneas; total ~1,900-2,200).
- ✅ Bounded review / verify phase: en curso (verify-report).
- ⏳ REQ-PD-009 (E2E bot): verificación opcional registrada para verify phase — requiere backend/bot real, out of unit scope.
