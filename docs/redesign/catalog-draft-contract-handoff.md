# C3.1 — contrato de borrador: propuesta y puertas pendientes

**Núcleo backend aislado cerrado según informe del dueño backend; integración autoritativa pendiente.** Mensaje `4a7fe563-9089-480a-8bcd-ea9c90356864`: cortes A `80c9b88`, B1 `c188842`, B2 `5f8fd02`, C `42b4107` en `feat/catalog-draft-core`; 42 pruebas unitarias, 57 PostgreSQL y TypeScript acotado PASS, verificación independiente/parent y revisión nativa aprobada/consumida por corte reportadas por BE. Contenedor de pruebas retirado. FE no reejecutó estas comprobaciones ni inspeccionó el repositorio backend.

No hay API, grants, proveedores autoritativos ni UI D13 activados; no se tocaron DB reales ni hubo push/despliegue según ese informe. La primera unidad no equivale a D13 completo. Se coordina el siguiente corte mediante mapa de autoridad/definiciones/medios y puntos de integración FE, sin implementar rutas o UI real sobre mocks. Las secciones históricas siguientes conservan propuestas; el cierre U1 y los contratos implementados que entregue BE prevalecen sobre alternativas superadas. Los límites previos de TypeScript global e historial completo de migraciones no se consideran resueltos por un PASS acotado.

Autorización literal: ante «¿Autorizás pasar a la primera unidad backend —persistencia y lectura/creación/guardado con pruebas— sin activar el catálogo nuevo, migrar datos existentes ni borrar archivos? Yo sigo coordinando con el backend.», el usuario respondió «Si, adelante.» La implementación se coordina con el dueño backend; no implica push, despliegue ni consentimiento de revisión nativa.

Fuentes rectoras: [contrato descriptivo](product-contract-proposal.md), [hoja de ruta G1/C3](implementation-roadmap.md). La revisión visual [V1–V5](pending-human-browser-review.md) sigue pendiente y es independiente.

## Medios privados: cierre offline y configuración pendiente

Entrega BE `e1f3fa9357587aa7045570f9c9f52e9b25bbba14`, contrato literal recibido en `a961b61e-36a2-4085-b779-dac7062b8c33`. Flujo interno compuesto cerrado; 53 pruebas finales, TypeScript acotado y revisión independiente/nativa aprobadas según BE. SQL de metadata y harness se probaron por separado; transporte SDK/Prisma de composición simulado. Total 2.764 líneas frente al techo autorizado de 2.773. No afirmar build global, privacidad DigitalOcean ni integración HTTP/UI verificados.

El único contenedor `07307784d255d8cc37b8e0a3d02c727d131478b55a6f089da313075e45f2e0e1` fue eliminado por ID exacto; inspect posterior confirma ausencia y filtros por ID/nombre devuelven vacío con daemon disponible. T5 CLOSED registrado en spec backend L54; no queda target autorizado activo.

### Variables para configuración posterior

| Variable | Regla del contrato interno |
| --- | --- |
| `PRIVATE_MEDIA_ENDPOINT` | Obligatoria: HTTPS sin credenciales embebidas, query ni fragmento |
| `PRIVATE_MEDIA_REGION` | Obligatoria: texto no vacío |
| `PRIVATE_MEDIA_BUCKET` | Obligatoria: texto no vacío; no acredita existencia ni privacidad |
| `PRIVATE_MEDIA_ACCESS_KEY_ID` | Obligatoria, solo backend; nunca enviar a frontend/chat |
| `PRIVATE_MEDIA_SECRET_ACCESS_KEY` | Obligatoria, preservada sin trim; nunca enviar a frontend/chat |
| `PRIVATE_MEDIA_MAX_BYTES` | Opcional: entero entre 1 y 10.485.760; default 10.485.760 bytes |

Estas variables son **entradas explícitas** de `createPrivateMediaService(settings, prisma)`, no descubrimiento automático de `.env`. Configuración ausente/parcial/inválida o solo `SPACES_*` devuelve `null` antes de construir cliente SDK; no bloquea por sí misma el arranque de la aplicación. Configuración válida construye servicio sin consultas ni comandos de storage. Completar variables no registra módulos/rutas ni activa UI automáticamente: ese wiring sigue pendiente.

`upload(context, { mimeType, bytes })` requiere JPEG/PNG/WebP no vacío dentro del límite, actor/tenant/producto confiables y lectura+edición actuales. Devuelve metadata persistida sin key ni URL; ante entrada inválida, denegación, fallo o persistencia indeterminada devuelve `null`, sin borrar/reintentar a ciegas. Pueden quedar bytes tras un resultado ambiguo; no asumir rollback ni ejecutar GC implícito.

`read(context, assetId)` consulta metadata calificada y autorización vigente antes de storage; entrega solo Buffer completo. Inexistente, ajeno, denegado o fallo devuelven el mismo `null`: no hay discriminante ni mapping HTTP. Un `null` no debe presentarse como ausencia confirmada ni éxito. La instancia directa del servicio con cap inválido lanza; no confundirlo con factory deshabilitada.

Pendiente antes de producción: identificar y autorizar Space/objeto sintético concretos, comprobar política y carga privada, recuperación autorizada y denegación anónima; luego acordar transporte/wiring e integración frontend por alcance propio. No solicitudes DigitalOcean ni lectura de secretos autorizadas ahora. LSP inconcluso y brecha CJS project-service declarados; no reinterpretar los checks acotados como cobertura global.

### Autorización ejecutada de desarrollo offline

Plan detallado confirmado mediante cuestionario: seis cortes de implementación con pruebas/revisión (1.750–2.340 líneas previstas; 2.000–2.740 con harness SQL), sin HTTP/UI. Primer alcance aprobado: JPEG/PNG/WebP no vacíos y hasta 10 MiB; carga exige lectura+edición editoriales explícitas y entrega de bytes exige lectura vigente sobre asset/producto/sucursal. Usuario autorizó nuevo PostgreSQL local desechable con datos sintéticos, imagen local sin descargas, tmpfs sin volúmenes ni puertos públicos y eliminación/verificación del ID exacto al terminar. La autorización no cubre servicios externos ni altera los límites siguientes.

El usuario confirmó DigitalOcean Spaces como proveedor y configurará después el destino privado y las credenciales. Autorización literal: «Si hermano, completamente, avanzamos.» sobre implementar flujo privado, persistencia/validaciones, variables documentadas sin secretos y pruebas con almacenamiento simulado, **sin acceder a servicios externos**.

Backend realizará el trabajo en su repositorio y registrará spec/cortes antes de fuente. El flujo queda deshabilitado ante configuración ausente o incompleta, sin fallback al bucket público. No leer `.env` ni secretos; no crear buckets/objetos reales, cambiar ACL o archivos legacy, aplicar migraciones en DB existente, ejecutar seeds ni activar UI/transporte HTTP por inferencia. Las credenciales nunca van al frontend ni al chat.

El adapter de storage debe estar implementado, no ser un puerto vacío; las simulaciones pertenecen únicamente a tests y no sustituyen autoridad real en runtime. Verificar con DigitalOcean carga privada, lectura autorizada y denegación anónima queda pendiente hasta disponer de configuración y autorización del destino concreto. Un PASS simulado no demuestra ACL/CDN, credenciales ni privacidad de bytes desplegados. Ningún target PostgreSQL anterior puede reutilizarse; una nueva instancia de prueba requiere alcance explícito.

## Integración contextual D16: cierre interno recibido

Informe BE `a0f2d65e-7aa4-4256-b058-7409ebefdccf`, HEAD `2e4c29a236cb99ad9183a969528889841b92b7ee`: implementación interna E1–E3 cerrada; evidencia reportada de 114 pruebas unitarias, 34 PostgreSQL D16, 57 PostgreSQL históricas, TypeScript acotado y comprobación diferencial. Revisiones nativas por corte aprobadas/consumidas; última `review-e85640af0ac4ace1`. FE leyó extractos literales de interfaces/docs, sin reejecutar las pruebas ni afirmar build global limpio.

Contrato interno final: `initialize(context, { expectedCycle, idempotencyKey })` no acepta documento, baseline ni selector de operación. Copia Published persistido o comienza vacío bajo lock del producto; fuente malformada no se reemplaza silenciosamente por vacío. Save conserva únicamente desde Draft persistido bloqueado. Replay exacto reautoriza, revalida referencias/documentos retornados y no restaura ni escribe estado posterior.

`EditorialReadResult.warnings?` contiene advertencias actuales para el Draft retornado: `{ code: 'ARCHIVED_OPTION', familyId, definitionId, owner, variantId, optionCode }`. Se recalculan en replay; no son permisos ni modifican el contenido/revisión históricos. `initialize` y create legado comparten namespace de claves; reutilización entre métodos causa conflicto. Create legado sigue recibiendo documento del caller, exige pares opción/definición persistidos activos y no permite conservar archivadas. Su passthrough Published legado no fue endurecido: no extrapolar la validación de initialize/save a ese contrato.

Cleanup confirmado por BE: eliminación solo de `f764e05bf359e64cb912d5c3d56c11c4803ea5b6f8bd611091cbe2f35a68fb7b`; inspect posterior indica ausencia y listado filtrado por ID exacto devuelve vacío. No reemplazo ni target activo autorizado; no reutilizar pin.

Pendientes explícitos: proveedor real de autoridad de medios y acceso privado a bytes, transporte/principal autenticado, wiring runtime y compatibilidad de despliegue. No garantía de revocación atómica de permisos/medios externos ni ABA administrativo. Sin API/UI/publicación activadas; este cierre no autoriza cambios funcionales frontend.

### Autorización ejecutada E1–E3

Usuario: «si, autorizado», en respuesta a implementar validación de opciones archivadas contra origen persistido con advertencias (E1), integración al guardado/reintentos sin sobrescrituras ni asignaciones nuevas (E2), e inicialización desde Published o vacío (E3), con nuevas pruebas PostgreSQL desechables. **Sin tocar datos existentes ni activar API, pantallas o publicación.** Backend registró spec/mirror y cortes antes de modificar fuentes; el cierre interno y sus límites se documentan arriba.

El cliente nunca aporta baseline, estado de archivo ni autoridad. La conservación usa origen persistido y tupla de familia/definición/dueño/variante/opción; quitar/reemplazar por vigente es válido, agregar/reintroducir/mover archivadas no. La copia inicial desde Published está aprobada con advertencia y corrección antes de republicar. Replay histórico debe reautorizar y validar referencias actuales sin nueva escritura ni restauración; un receipt no concede permisos.

E2/E3 requieren comprobaciones transaccionales y de concurrencia, pruebas de contratos anteriores y verificación independiente aplicable. No reinterpretar silenciosamente `create(document)` ni dejar una vía alternativa que omita controles. Pruebas aisladas con target nuevo identificado y cleanup exacto; los targets anteriores siguen retirados. Proveedores de medios privados, transporte y activación continúan fuera de esta autorización.

## Definiciones persistentes D1/D2: cierre recibido

Informe BE `fb54c2cd-bcc2-415a-90fe-2f9cd4f021c0`: D1a `d5af96e`, D1b `f1d0d82` y D2 `9182026c28732739410f7e3db2a2e53cb42b6b4c` cerrados en cortes separados. D2 reporta 38 pruebas unitarias, 34 PostgreSQL y TypeScript acotado PASS; revisión nativa aprobada/consumida. D1a/D1b tuvieron verificación independiente; D2 verificación propia según evaluación de riesgo. FE recibió y leyó tipos/reader/docs literales, sin reejecutar pruebas backend.

`new PrismaEditorialDefinitions(prisma).read()` devuelve `EditorialDefinitionsSnapshot`: familias/códigos/bindings con dueño y definiciones tipadas; unidades numéricas admiten null explícito y opciones incluyen `archived`. Un único SELECT obtiene el snapshot; sin caché, preserva definiciones sin binding y colecciones vacías. Fallos de consulta rechazan, no se convierten en catálogo vacío. Es fuente empresarial interna, **no** DTO HTTP, lease, allowlist de opciones activas ni DocumentAuthority calificada por producto/tenant.

Cleanup reportado: eliminación únicamente de `435029b31b991a75225a1b1ba2a3c4fa3a123815d55e04be9d2bacc4b2dfe492` exitosa y consulta posterior al ID exacto devuelve objeto ausente. El wrapper de grep terminó en 1 por diferencia de mayúsculas; no se repitió eliminación ni prune. No queda target autorizado activo para nuevas pruebas.

Límites: PostgreSQL >=15 requerido; PG16 aislado no demuestra compatibilidad de despliegue ni historial completo. Validador estático Prisma seguro no disponible y cuatro diagnósticos LSP inconclusos; TypeScript acotado pasó. Advisories no bloqueantes registrados por BE no se reabren. No vocabulario cargado, API, providers, D16 con baseline, copia Published, medios privados ni editor activados. Próximo paso: plan acotado de integración de procedencia D16 antes de conectar esta fuente al núcleo.

### Autorización ejecutada de D1/D2

El usuario respondió «si hermano, adelante» a «¿Confirmás la regla del punto 1 y autorizás implementar los puntos 2–3 con PostgreSQL desechable para pruebas, sin tocar datos existentes?» Quedan autorizados artefactos aditivos/pruebas de familias, definiciones, bindings, opciones y unidades (D1), y lectura persistente tipada conservando estado archivado y distinguiendo vacío de error (D2). Backend registra tracking propio antes de fuente; no se autoriza activar API/UI, cargar vocabulario runtime, ejecutar seeds reales, migrar datos existentes ni implementar medios/publicación/GC.

**Regla confirmada:** al iniciar borrador desde Published se pueden copiar opciones ya archivadas desde ese origen persistido, con advertencia; deben corregirse antes de republicar. No permite nuevas asignaciones arbitrarias, reintroducir valores quitados ni moverlos entre dueños/variantes. La implementación de conservación D16 y de inicialización create es posterior: D1/D2 no la declaran resuelta por tener tablas.

Pruebas PostgreSQL en una nueva instancia desechable aislada y datos sintéticos, sin bases existentes; cleanup exacto al terminar. El target anterior está retirado. Familia/definición conserva códigos estables, dueño en binding único por familia/definición; archivo solo opciones. Unidad nula permitida requiere unicidad real por definición, no confiar en UNIQUE ordinario sobre NULL. Catálogo vacío real es un estado observado, no un editor listo ni licencia para usar fixtures como fuente runtime.

## Decisión vigente: permisos editoriales explícitos

Respuesta literal del usuario: «si hermano, los permisos explicitos (tu recomendacion) son la mejor opcion segun yo.» Los administradores también necesitan permisos editoriales explícitos: `manage:all` no concede por sí solo lectura, creación ni guardado del borrador. Se conserva actor activo, membresía vigente y acceso al producto de la sucursal; publicar sigue separado y fuera de este corte.

Mapping técnico vigente, refinado por confirmación humana: `read:ProductEditorialDraft` permite consultar; **crear y guardar requieren tanto `read:ProductEditorialDraft` como `update:ProductEditorialDraft` explícitos**. Solo edición no habilita operaciones ni devuelve documentos; edición no otorga lectura automáticamente. Ambos permisos se reevalúan también antes de replay. Respuesta literal a la recomendación detallada: «Si hermano, adelante con los siguientes pasos.» Publicar permanece separado.

Registrar esos permisos no los asigna a roles: excluirlos de la asignación automática del seed general, sin retirar grants existentes ni modificar la semántica global de CASL. No ejecutar seeds sobre datos reales. Autoridad P1/P2a/P2b cerrada según informe BE `30fdb24f-4582-4f04-9acc-a519f7bf42dc`, commit `243f98bad281d9302f43a24f45078eb775fdc986`: 145 pruebas y TypeScript acotado PASS por verificador independiente y parent, revisión nativa aprobada/consumida por corte. Evidencia nueva mock/in-memory; integración adapter→core comprueba replay, no nueva escritura persistida. No rutas ni UI todavía.

FE no puede usar un `userCan` genérico que acepte wildcard como prueba de estas capacidades. El consumo futuro debe respetar permisos explícitos/snapshot autoritativo, sin transferir autoridad entre identidades o sucursales. Proveedores de definiciones/medios e inicialización siguen dependencias separadas, no resueltas por registrar permisos.

### Consumo futuro de autoridad: contrato recibido, no HTTP

Adapter literal recibido: `PrismaEditorialAuthority.resolve(context)` devuelve `EditorialCapabilitySnapshot | null`, con actor/tenant/producto, membresía activa y capacidades. `canRead` exige read exacto; `canCreate`/`canSave` exigen read y update exactos. Es observación actual, sin caché ni garantía de revocación atómica en vuelo; no autentica el principal HTTP/JWT ni concede un lease reutilizable.

Los puertos `authority.createAuthority`/`authority.saveAuthority` requieren además `EditorialDocumentAuthorityProvider.resolve(context): Promise<DocumentAuthority | null>` genuino, del mismo tenant/producto, copiado profundamente y validado en cada intento/replay. Provider ausente/error/descalificado deniega. Flags verdaderos **no significan** que ese provider exista o que una API de escritura esté disponible. Core crudo acepta puertos confiables inyectados: nunca exponerlo como frontera de seguridad HTTP ni permitir selección de autoridad por el cliente.

FE no crea tipos HTTP desde estos exports internos. Para habilitar acciones necesita transporte autenticado, capacidades/recurso vigentes y preparación real de definiciones/medios; no inferir disponibilidad desde `canSave` solo ni reutilizar upload público. Aún faltan inicialización de documento, proveedores de definiciones/medios/bytes privados, wiring runtime y prueba integrada PostgreSQL nueva. El siguiente relevamiento BE acotado busca esas fuentes reales antes de proponer otro corte; sin scaffolds adicionales ni fixtures runtime.

## Integración siguiente: evidencia FE y contrato interno recibido

Contrato interno BE recibido en `0ef12373-36ee-4e29-9312-459c0bc5e977`: ciclo/revisión numéricos, CAS dual en save, `create` recibe documento validado y no decide su inicialización. Read devuelve Published/Draft opcionales; receipts sin expiración implementada. Errores internos `FORBIDDEN`, `NOT_FOUND`, `MALFORMED`, `CONFLICT`, sin mapping HTTP comprometido; errores DB pueden propagarse. Puertos de autoridad/definiciones/medios sin proveedores runtime. Ninguno de estos tipos constituye todavía una API frontend.

Mapa FE `mvot5s7q-4-2na1`, solo lectura; parent contrastó `src/features/auth/authorization/ability.ts:1–110`:

- Permisos: registros tipados `auth.types.ts` y runtime `ability.ts` rechazan códigos desconocidos; futuros códigos editoriales requieren registro coordinado y pruebas de no descarte silencioso. No equivalen a Product CRUD.
- Sesión: `useAuthStore.ts:459–468` renueva sesión/caché/permisos al cambiar tenant; el editor deberá retirar también buffer/intentos privados. `http.ts:190–237` puede reenviar tras refresh 401: verificar principal/tenant e intento inmutable antes de integrar.
- Editor: `ProductDetailView.vue:562,915` hidrata formulario y guarda producto operativo; `useProductForm` también lo usa el slideover. No reutilizar ese submit/hidratación para el borrador editorial ni cambiar helpers compartidos por anticipado.
- Superficies futuras propuestas: cliente/tipos editoriales propios y composable/componente independiente dentro de productos. Sin rutas autoritativas ni providers reales, no generar cliente, montar editor ni usar fixtures como catálogo runtime.
- Orden mínimo recomendado: acreditar actor/membresía/capacidades desde fuentes reales; cerrar proveedores de definiciones/medios e inicialización; acordar transporte privado antes de cliente/estado FE. Otro adaptador que solo deniegue no sustituye esa conexión. Mapa backend en curso, sin aprobación de implementación de este corte.

## Resultado del contraste actual

| Existente | Límite |
| --- | --- |
| Settings de catálogo GET/PATCH por tenant, editor de producto y overrides de variante | Modifican estado LIVE; el panel ya existe en frontend |
| Búsqueda, categoría, paginación y detalle públicos | Leen contratos actuales, no versiones descriptivas D13 |
| `draft` de `useCatalogSettingsForm` | Estado local `ref`, no almacenamiento recuperable entre sesiones |
| Infraestructura JWT, contexto tenant y permisos | No demuestra una matriz D13 ni autoriza publicar mediante `update:Product` |
| Medios actuales de producto/variante | No acredita almacenamiento privado para medios exclusivos de borrador |

No duplicar el panel LIVE. Ocultar un producto no crea un borrador; guardar cambios actuales no equivale a publicar una revisión descriptiva.

## Evidencia backend de la investigación autorizada

Informe `19e22865-1c42-46db-93c6-eb4a1b6a73ab`, HEAD `dee23a1f4490bd7b134974fa7139bac7a1dff1d7`. Evidencia de fuente aportada por el agente backend, no verificación desplegada ni inspección directa desde frontend. Sin cambios, DB, pruebas ni servicios.

| Área | Evidencia y consecuencia |
| --- | --- |
| Producto | `prisma/schema.prisma:523–597`: UUID global y `tenantId` obligatorio. `tenant-prisma.factory.ts:25–75` aplica contexto tenant con excepción global explícita; `tenant-context.guard.ts:15–33` obtiene contexto autenticado. No se acreditó cobertura de cada handler. |
| D17 | `schema.prisma:347–370,377–479`: Category/Brand globales; no agregado Company acreditado. Eso no satisface una frontera empresarial para diccionarios ni autoriza sustituirla por vocabulario global. |
| Autoridad | `permission.ts:16–22,98–115` y `products.controller.ts:44–83`: CRUD Product existente; no separación descriptiva editor/publicador acreditada. Los grants de usuarios desplegados no se inspeccionaron. |
| Medios | `files/infrastructure/spaces-storage.adapter.ts:29–44,72–74` solicita `public-read` y devuelve URL pública; `files/domain/storage.port.ts:21–37` no acredita entrega privada ni promoción. Autenticar metadatos File no protege los bytes. No usar ese upload para imágenes exclusivas del borrador. |

Las rutas abreviadas se refieren al repositorio backend. Los métodos de imagen con Prisma raw (`products.service.ts:1852–1892`) necesitan analizar la cadena completa antes de afirmar aislamiento uniforme o una vulnerabilidad explotable. ACL/CDN efectivos y retención de referencias draft/live siguen sin verificar.

## Invariantes aprobadas que no se reabren

- Un único borrador privado persistente y una versión descriptiva publicada **por producto**. Ninguna rama por editor ni segundo aprobador obligatorio.
- Guardar contenido incompleto pero estructuralmente válido; rechazar captura malformada sin cambiar documento ni revisión.
- Guardar/retomar no cambia lo publicado, SKU, nombre operativo, stock, precios, receta ni visibilidad.
- Edición y publicación requieren permisos diferenciados, combinables mediante roles existentes; no se fijan puestos.
- Referencias `product`/`sellable` explícitas, sin herencia ni variantes ficticias. Medios exclusivos del borrador privados, sin URL pública estable; sin limpieza inline.
- Publicación y descarte CAS corresponden al ciclo completo D13. C3.1 es una unidad dependiente, no una entrega que permita declarar D13 completo sin C3.2/C3.3.

## Propuesta técnica para acordar, no API disponible

| Operación conceptual | Propuesta y comportamiento observable |
| --- | --- |
| Leer/retomar | Lectura autenticada `no-store`; devuelve `published` y `draft` o `null` cuando no existen. Retomar no escribe |
| Crear borrador | `expectedDraftRevision: null` y revisión publicada esperada explícita; copia descripción publicada o inicia documento vacío normalizado. Si otro editor creó el borrador, conflicto sin reemplazo |
| Guardar | Revisión opaca esperada, documento completo y clave de mutación; CAS atómico. Devuelve documento normalizado y nueva revisión; no rebasa automáticamente la base publicada |
| Conflicto | Respuesta estructurada después de autorizar recurso; conservar buffer local y reconciliar explícitamente. No sobrescribir ni fusionar automáticamente |
| Resultado de red incierto | Repetir la misma clave y payload mediante idempotencia persistida junto al resultado; no inferir éxito por contenido parecido ni generar otra clave automáticamente |
| Medios | Referencias por ID, ownership comprobado en servidor. Entrega autenticada o URL efímera solo tras autorización; la URL efímera no forma parte del documento persistido |

Propuesta BE para errores: 400 por revisión requerida omitida/captura malformada; 409 por borrador existente o revisiones incompatibles. Códigos, DTOs completos y rutas todavía deben acordarse; no generar clientes desde esta tabla.

## Protocolo conceptual read/create/save — propuesta BE consolidada

Fuente: mensaje `faa078d8-ddef-4b97-9c89-0c8a2482b493`, sobre el mismo HEAD inspeccionado. No acredita endpoints, subjects ni implementación. Complementa la tabla anterior; las alternativas indicadas siguen abiertas.

- **Estado:** Draft propuesto con FK al producto, `UNIQUE(productId)`, `revision`, `basePublishedRevision` y `document`. Revisiones opacas de servidor, no reutilizadas después de descartar/recrear. Published permanece separado conceptualmente; representación física y adopción inicial pendientes.
- **Autorización:** resolver producto bajo contexto tenant validado antes de acceder al borrador o revelar conflictos. La excepción super-admin actual no concede automáticamente acceso al futuro editor.
- **Lectura:** snapshot coherente de borrador/publicado, ausencia explícita mediante `null`, sin escritura lateral. Propuesta `Cache-Control: private, no-store`; no protege por sí sola los bytes de imágenes.
- **Creación:** `expectedDraftRevision: null` explícito, revisión publicada observada explícita y `mutationId`. Validación, comparación e inserción atómicas; no upsert. Dos creaciones distintas no reemplazan el borrador ganador. Copiar publicado o iniciar vacío sigue la propuesta inicial; BE señala como alternativa un documento enviado: **fuente inicial y bootstrap todavía no cerrados**.
- **Guardado:** reemplazo completo, revisión esperada y `mutationId`; no PATCH, mezcla ni last-write-wins. Rechazar campos desconocidos/no editables y referencias ajenas; distinguir ausencia, `null` y colección vacía mediante schema todavía pendiente. Un guardado nuevo genera revisión nueva; replay devuelve la original. El cliente no altera libremente `basePublishedRevision`.
- **Cambio de publicado:** aclaración BE `e7c9d478-0db3-421e-a2ee-19c69801fc2e`: publicar valida y consume Draft atómicamente; con revisiones no reutilizables, un guardado anterior ya falla por CAS. Bajo ese ciclo no hace falta rechazo independiente por base cambiada ni rebase. Escrituras LIVE legacy son un gate de transición, no otro writer de Published autorizado implícitamente. No avanzar la base silenciosamente.
- **Idempotencia:** propuesta de deduplicación por actor, tenant autorizado, producto y operación, con fingerprint canónico de documento/precondiciones. Reautorizar todo replay; resolver replay válido antes de rechazar su revisión consumida. Misma clave/payload retorna resultado original; clave con contenido distinto causa conflicto. Persistir mutación/resultado atómicamente y serializar duplicados concurrentes. Formato, canonicalización, ventana de retención, expiración y resultado en curso siguen pendientes.
- **Errores:** producto inexistente/no accesible con la misma respuesta externa; conflicto detallado solo tras autorizar. Separar entrada inválida, precondición ausente, conflicto, clave incompatible e indisponibilidad, sin filtrar datos ajenos ni mensajes internos. HTTP/códigos estables/envoltorio aún no definidos.
- **Proyección pública:** sin fallback al borrador ni incorporación de sus URLs. Ninguna operación read/create/save altera Product LIVE ni settings, stock o precios. La garantía requiere pruebas futuras.

### Matriz semántica propuesta, no permisos existentes

| Operación | Capacidad propuesta | No equivale automáticamente a |
| --- | --- | --- |
| Leer borrador | Lectura privada del borrador + acceso al producto | `read:Product` |
| Crear/guardar borrador | Editar borrador + acceso al producto | `create:Product` / `update:Product` |
| Publicar, futuro C3.2 | Publicar, diferenciada y combinable con edición | `update:TenantCatalogSettings` |
| Descartar, futuro C3.2 | Autorización explícita del ciclo; mapeo por definir | `delete:Product` |

No se asignan roles ni nombres CASL nuevos. D17 empresarial y medios privados siguen siendo dependencias: esta propuesta no autoriza omitirlos ni entregar un editor sin imágenes como resultado final de D13.

## Estados frontend propuestos

Diseño documental del relevamiento `mvokduy6-2-p0a0`; no UI implementada ni pruebas ejecutadas. Mantener separados publicado observado, borrador confirmado, buffer local, intento inmutable de escritura y estados de autorización/conexión/medios.

| Situación | Respuesta propuesta |
| --- | --- |
| Lectura fallida / sin borrador | No confundir error con ausencia; leer no crea. Iniciar borrador requiere acción explícita. |
| Incompleto válido / captura malformada | Faltantes para publicar no bloquean guardar; una captura malformada se conserva con explicación, sin convertirla silenciosamente. |
| Guardado en curso / confirmado | Congelar contenido, precondiciones y clave del intento. Evitar envíos concurrentes desde la vista. Si se sigue editando, la confirmación no pisa las entradas posteriores ni las marca guardadas. |
| Conflicto | Conservar buffer y último guardado confirmado; leer/comparar sin reemplazo ni mezcla automática. No ofrecer sobrescritura incondicional. |
| Resultado desconocido | Mostrar incertidumbre, no afirmar que no se guardó. Resolver el mismo intento mediante replay; cambios posteriores pertenecen a otro intento. |
| Replay expirado | Releer y reconciliar; contenido parecido no prueba éxito. No generar otra clave automáticamente para repetir la escritura incierta. |
| Sesión / permiso | Suspender operaciones; ante pérdida de permiso retirar presentación privada. No transferir buffer/intentos a otra identidad o tenant. Recuperación en memoria solo tras reautorizar al mismo principal. |
| Medios pendientes / fallidos | No omitirlos silenciosamente al guardar ni persistir URLs locales. Reintentar o retirar explícitamente; un fallo no borra el texto. |
| Acceso efímero vencido | Renovar autorización sin eliminar referencias ni convertirlas en enlaces públicos. |
| Salida | Advertir sobre cambios locales o resultado incierto; salir no descarta el borrador persistido. No prometer recuperación local tras cierre o recarga. |

No hay TTL de borrador aprobado. Expiración de sesión, ventana de replay y acceso temporal a medios son estados distintos. Preview/publicar/descarte siguen en C3.2; proyección pública en C3.3.

**Publicación durante edición:** BE confirmó conceptualmente que publicar consume Draft y el guardado anterior queda invalidado por CAS. FE conserva el buffer y compara contra el nuevo estado autorizado; no ofrece guardar con una revisión consumida. No se introduce rebase ni un bloqueo adicional por base obsoleta. La recuperación de esas entradas hacia un nuevo borrador todavía debe especificarse, con creación explícita y sin sobrescritura. La transición desde writers LIVE legacy sigue abierta.

## Diseño backend de dependencias y secuencia

Fuente: `6f89909d-b9b7-4b57-bbf2-459a5c36433d`, sobre evidencia previa, sin inspecciones nuevas. **Recomendaciones, no schema ni políticas aprobadas.** Este diseño refina alternativas anteriores; no declara cerrados los detalles de implementación.

| Área | Recomendación y límite |
| --- | --- |
| Empresa | Tras confirmar una única empresa con tenants como sucursales, preservar IDs/asignaciones del diccionario común actual y explicitar su semántica empresarial. No exigir jerarquía multiempresa ni duplicar vocabulario. Representación y autorización concretas pendientes; los datos operativos conservan aislamiento tenant. |
| Compatibilidad D17 | Referencias legacy pendientes de conciliación, no declaradas válidas para D17. Publicación con ellas requiere política explícita. No restringir API global existente sin inventario de consumidores y unidad autorizada. |
| Ciclo | Estado durable único por producto con versión de ciclo, Published y cero/un Draft. Token de ciclo evita que un create antiguo atraviese creación→descarte/publicación→ausencia (ABA). No es identidad pública adicional. |
| Bootstrap/create | Baseline descriptivo explícito para productos seleccionados, conservando procedencia y visibilidad LIVE. Bootstrap no crea Draft ni ocurre en GET. BE recomienda que create copie Published preparado y rechace estado sin baseline; sustituye como recomendación las alternativas previas, pero falta precisar productos nuevos/sin descripción y matriz de campos. |
| Descarte | BE recomienda capacidad editar, CAS/idempotencia y liberación de referencias sin borrar bytes inline. Mapeo pendiente; continúa en C3.2, aunque la secuencia BE lo agrupe con primitivas de persistencia. |
| Writers legacy | Para productos activados, campos descriptivos deben bloquearse o rutearse explícitamente; no convertir PATCH en publish ni bloquear operaciones de precio/stock. Operaciones mixtas nunca producen éxito parcial silencioso. Requiere inventario y regresión antes de activar. |
| Storage privado | Capacidad separada del upload público actual; no cambiar ACL de imágenes LIVE. Staging privado validado antes de referenciar; preview autenticado, incluidos range/conditional, sin URL pública al origen. Proveedor/bucket real aún no elegido. |
| Publicación de medios | Promoción lógica recomendada: bytes privados y grants de entrega pública controlada creados con el commit. Preparar storage antes; DB/object store no tienen atomicidad conjunta garantizada. Imágenes legacy públicas no adquieren confidencialidad retroactiva. |
| Referencias/borrado | Ledger Draft/Published y protección de todas las rutas de eliminación antes de compartir referencias. GC destructivo posterior, separado y no autorizado; publicación no depende de activarlo. Referencias históricas no implican grants públicos permanentes. |
| Replay | Ventana configurable de 24 h como propuesta provisional, no aprobada. Vencimiento verificable aun tras purgar receipt; un intento expirado no debe convertirse en operación nueva. Token de intento servidor es una opción técnica, no API existente. Upload tiene idempotencia propia. |

### Orden propuesto, no tareas autorizadas de implementación

1. **U1 — Contrato:** matriz de campos/capacidades, ciclo/CAS, errores, canonicalización, ventana y transición legacy. Escenarios de creación, guardado, publicación, descarte y replay antes de código.
2. **U2 — Empresa:** frontera aditiva y conciliación con mapping autorizado. Verificar aislamiento y rechazo cross-company sin alterar legacy.
3. **U3 — Persistencia:** baseline/read/create/save detrás de habilitación controlada; primitivas de descarte coordinadas con C3.2. Verificar ABA, replay, expiración y ausencia de efectos en Published/stock/precio/visibilidad.
4. **U4 — Medios:** storage privado, staging/preview, ledger y protección de eliminación antes de compartir referencias. Verificar origen privado, aislamiento, fallos y preservación de imágenes existentes; sin GC destructivo.
5. **U5 — Publicación:** depende de U2–U4 y compatibilidad; verificar carreras save/publish, consumo, replay y proyección sin filtraciones ni congelamiento de precios/stock.
6. **U6 — Activación:** productos explícitos, conciliación e inventario de consumidores con regresiones. No lanzar editor parcial como D13 completo.

Estos checks son futuros, no ejecutados. Las unidades se subdividen por riesgo/tamaño al autorizar implementación.

**Agrupación empresarial confirmada por el usuario:** «todos los tenants son sucursales de una misma empresa hermano, todo es de una misma empresa.» Todos los tenants actuales pertenecen a una única empresa; no hace falta solicitar agrupaciones por sucursal. El diccionario común empresarial no comparte productos, asignaciones, stock, precios ni clientes entre tenants. Esta confirmación es un dato del negocio, no autorización de migración ni prueba de un modelo Company existente.

**Pendientes separados:** precisar adopción del vocabulario legacy sin pérdida ni reasignaciones implícitas. La política de futuras entregas de contenido retirado debe decidirse antes de activar grants públicos; historial/retención/borrado irreversible antes de GC, no ahora como bloqueo general. No extender la confirmación de los tenants actuales a una exigencia de soporte multiempresa ni a futuras altas sin contrato explícito.

## Matriz U1 y compatibilidad observada

Informe BE `f9e7bff3-fede-4507-970a-94fb7296691c`, mismo HEAD; inventario focalizado, no exhaustivo, sin pruebas ejecutadas.

| Clasificación | Evidencia / tratamiento |
| --- | --- |
| Título comercial | D13 exige campo editorial separado de `Product.name`. La recomendación BE de snapshot de `Product.name` **no se acepta como escritura editorial sobre el nombre operativo**. Fuente inicial y eventual lectura para baseline deben explicitarse; BE lo corrigió en `1ef113bc-88c3-43b1-8759-fa38368dab1e`: `commercialTitle` independiente; nombre operativo solo contexto de lectura, sin copia inicial asumida. |
| Descripción/asociaciones | `description`, `categoryId`, `brandId` son candidatos del snapshot. Preservar IDs no resuelve rename/delete: `schema.prisma:537–543` usa SetNull. Cierre pendiente de semántica histórica y compatibilidad, sin duplicar diccionario por sucursal. |
| Medios | Referencias identificadas con ámbito product/variant, `isMain`, `sortOrder`; no URLs arbitrarias ni cambios de pertenencia. Desempate estable pendiente. |
| Otros candidatos | `Variant.name/option/value` y `ServiceDetail.notes` requieren cierre; no autorizan crear/eliminar variantes desde Draft. |
| Fuera del documento editorial | SKU/barcode, unidad/fiscalidad, tipo/estructura, capacidad y demás campos operativos; stock, costos, impuestos, precios/listas/tiers y flags LIVE no se congelan ni sobrescriben al publicar. |
| Identidad | IDs, tenant y relaciones padre no editables; timestamps/relaciones transaccionales fuera del documento. |

**Separación editorial corregida con BE:** `prisma-product.repository.ts:100–210` guarda agregado completo y stock lo usa (`products.service.ts:2019–2032`), pero no debe afirmarse que sobrescribe Published si no lo escribe. Recomendación `1ef113bc-88c3-43b1-8759-fa38368dab1e`: publicar solo modifica Published/referencias editoriales y consume Draft, sin proyección inversa a Product. Así se evita esa colisión sin cambiar writers operativos. Verificar aislamiento de persistencia nueva y referencias mutables antes de activar; no ampliar el trabajo a corregir riesgos preexistentes del agregado.

**Consumidores:** `products.service.ts:771–1107` mezcla campos descriptivos/operativos en update; arrays heredados no acreditan semántica replace en PATCH. Variantes también mezclan ámbitos (`:1118–1364`). Catálogo público consulta campos actuales (`prisma-public-catalog.repository.ts:164–279,848–900`); Published debe cubrir búsqueda/filtros/orden, no solo texto de ficha. Admin/POS y Orders conservan nombre operativo, precios y movimientos de stock. No afirmar inventario completo de importadores ni cambiar consumidores fuera de alcance.

**Límite de campos confirmado por la corrección BE:** descripción editorial separada, sin escritura inversa sobre `Product.description`; categoría/marca/labels de variante siguen candidatos no aprobados, no se incorporan automáticamente a Published. Referencias/orden editorial de imágenes no cambian relaciones/main/orden operativos ni borran archivos existentes. Consumidores públicos usan fuente editorial coherente solo para campos aprobados; rama legacy previa a activación explícita, nunca fallback por campo basado en `null`. Precios/stock/visibilidad conservan sus fuentes dinámicas.

**Baseline y productos nuevos:** descripción normalizada a `null` es dato válido, no implica oculto ni permite fabricar texto. Bootstrap no crea Draft ni cambia visibilidad. Crear producto bajo lifecycle nuevo no otorga permiso de publicación automáticamente: baseline técnico, completitud y elegibilidad pública requieren contrato explícito. Mantener comportamiento legacy hasta activación autorizada; no inventar un default oculto.

**Escenarios futuros:** token de ciclo rechaza create demorado tras consumo; save y publish compiten por la revisión y solo el ganador muta; replay tras consumo reautoriza y devuelve receipt sin duplicación; clave incompatible/expirada no se ejecuta como nueva. Ninguno fue ejecutado.

## Cierre de alcance U1 contra requisitos rectores

Reconciliación `mvokykh8-3-wwxp`, contrastada con `product-vocabularies.md:205–243`. Las siguientes precisiones prevalecen sobre candidatos exploratorios anteriores; no crean APIs ni permisos.

- **Contenido D13:** título comercial, descripción, imágenes y atributos de producto/presentaciones. Shape propuesto: `commercialTitle`, descripción común, `mediaRefs` ordenadas, `familyCode` y bindings/valores con dueño explícito `product | sellable`. No inventar variantes ni herencia.
- **Inicialización:** copia explícita opcional del nombre operativo es propuesta existente; nunca sincronización ni escritura inversa. No hacerla automática ni declararla una aprobación comercial específica.
- **Exclusiones:** marca operativa y `option/value` se preservan fuera del documento editorial nuevo. No agregar categoría editorial independiente, alias de variante ni notas públicas de servicio sin requisito; notas internas nunca públicas. Familia no equivale a categoría.
- **Medios:** orden explícito propuesto; no agregar portada ni número mínimo universal de fotos por inferencia.
- **Altas:** D13 admite borrador incompleto tanto en altas como en publicados. Por eso la recomendación previa de exigir baseline Published para todo create queda descartada: debe poder existir `Published = null` con Draft. Bootstrap de existentes es adopción separada, no requisito que impida comenzar una ficha nueva ni permiso de publicación.
- **D14:** mínimos por las siete familias ya aprobados, con condiciones de pertinencia; faltantes impiden publicar, no guardar. No agregar descripción/categoría/marca/fotos como obligatorios universales. Cada presentación ofrecida valida sus requeridos propios. Se corrigió la frase obsoleta del contrato que rebajaba estos mínimos a recomendaciones.
- **Referencias archivadas:** D16 impide nuevas asignaciones y preserva valores/historial; republicar exige corregir conforme D14. No extrapolar conservación de opciones a variantes o medios eliminados. Publicación fallida conserva borrador y publicado.

Quedan detalles técnicos de representación, transporte, capacidades y validación por subtipo; no nuevas preguntas comerciales sobre campos ajenos al alcance. Cierre BE `f50cff5b-3791-42e7-9969-eb7b9f4c39a0`: read devuelve Published/Draft opcionales y ciclo sin escribir. Create inicia documento incompleto cuando Published es `null`, o copia documento editorial publicado cuando existe; ausencia inicial de estado se compara/inicializa atómicamente y el ciclo posterior se conserva contra ABA. La identidad Product debe existir y estar autorizada mediante el flujo de alta pertinente, no un endpoint inventado. Primera publicación desde `null` valida D14 y consume Draft; ningún paso modifica visibilidad o datos operativos. Queda cerrada la inconsistencia conceptual, no implementada.

## Decisiones técnicas todavía abiertas

| Tema | Límite / siguiente definición necesaria |
| --- | --- |
| Identidad | Fuente BE acredita Product con UUID global y tenant propietario. Propuesta FE/BE: `productId` externo bajo contexto tenant autorizado, sin `publicationId` obligatorio; futuro `UNIQUE(productId)` expresa un borrador por producto. No es schema implementado ni prueba de aislamiento de todos los handlers; la excepción global no se hereda automáticamente |
| Documento | Título comercial separado de `Product.name`, descripción, medios ordenados, familia y valores tipados. Normalización `null`/`[]` es propuesta, no schema final; bindings y mínimos dependen de G1 |
| Ownership D17 | Empresa dueña del diccionario resoluble y autorizada desde tenant/contexto. No inferir pertenencia por nombres, categorías globales o un `companyId` enviado en body |
| Permisos | Registrar acciones efectivas para lectura, creación, guardado, descarte y publicación; no heredar excepciones cross-tenant por inferencia. Nombres de subjects sugeridos por BE no son permisos existentes |
| Medios privados | Acreditar ACL, staging, validación tipo/tamaño, acceso, caché, referencias compartidas y promoción al publicar. Retención y recolección diferida requieren diseño propio |
| Idempotencia | Definir retención, expiración y reconciliación fuera de ventana. No prometer recuperación offline durable del buffer FE sin persistencia específica |
| Persistencia/adopción | Unicidad del borrador por producto y acceso tenant autorizado, CAS y transacciones; adopción de productos actuales sin pérdida ni publicación masiva implícita. Esquema y migraciones no autorizados aquí |

## Casos de aceptación futura

1. Guardar un borrador incompleto válido, recargar y recuperar la misma versión; la descripción pública permanece intacta.
2. Dos creaciones simultáneas producen un único borrador; el perdedor recibe conflicto, sin reemplazo.
3. Dos guardados con la misma revisión: solo uno avanza; el otro conserva sus entradas locales para reconciliar.
4. Captura malformada o referencia ajena no cambia contenido ni revisión y no revela datos de otro tenant.
5. Timeout después de commit: repetir clave/payload devuelve resultado original; reutilizar clave con otro payload se rechaza. Fuera de retención no afirmar éxito sin reconciliar.
6. Medio exclusivo del borrador no es accesible anónimamente ni aparece en listado, detalle, caché o índices públicos.
7. Guardar o retomar nunca modifica flags LIVE, precio, stock o identidad operativa. Publicar/descarte no se simulan mediante varios PATCH existentes.

Son casos para pruebas posteriores, **no resultados ejecutados**.

## Procedencia y siguiente paso

- BE principal: HEAD inspeccionado `dee23a1`, informe actual `cb98f501-3988-4ed6-bf12-96b6aae351ae`; propuesta `0540fd29-ce58-4189-bf82-b687832bbf1b`. Lectura acotada, sin DB, pruebas ni cambios de backend; la propuesta posterior no añadió inspecciones.
- FE: relevamiento `mvnlk9pk-d-2mac`; controles existentes y contratos propuestos contrastados. Parent comprobó el `ref` local y las reglas D13/G1 documentadas.
- Reanudación: BE no encontró confirmación histórica posterior. Su mensaje `a10d1190-e91a-4135-beac-325ff47e0e55` aporta la recomendación conceptual nueva sobre identidad registrada arriba, sin inspecciones adicionales ni autorización de implementación.
- Siguiente paso técnico: propuesta compacta de lectura/creación/guardado, lookup autorizado, unicidad y matriz de autoridad, distinguiendo dependencias D17 y medios privados todavía abiertas. No habilita implementación ni un recorte definitivo de D13. Empresa como frontera D17 y permisos diferenciados ya están aprobados: no reabrirlos como elección comercial ni preguntar qué puesto los edita.
- Cualquier decisión comercial nueva o ampliación irreversible se presenta explícitamente al usuario. Esta coordinación no habilita implementar un backend ficticio mientras se espera su revisión visual.
