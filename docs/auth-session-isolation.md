# Aislamiento de sesión en autenticación compartida

## Regla

Una respuesta pendiente pertenece a la sesión y operación que la inició. No puede
restaurar credenciales o permisos anteriores, cerrar una sesión posterior ni
reenviar una petición protegida bajo otro tenant, aunque se vuelva al mismo tenant
con la misma cuenta (ABA).

## Comportamiento

- El store reutiliza su generación de operaciones de login para invalidar lecturas
  de perfil/permisos, cambios de tenant y logout pendientes al reemplazar o cerrar
  la sesión. La hidratación también invalida operaciones anteriores.
- Cada cambio de tenant toma una operación actual. Solo esa operación puede
  publicar tokens, limpiar consultas, instalar permisos o resolver su fase de auth.
  Al publicar el nuevo tenant se renueva la generación: también quedan invalidadas
  las lecturas iniciadas contra el tenant anterior mientras el intercambio esperaba.
- Login directo, verificación OTP y selección de tenant también renuevan la
  generación después de validar su bootstrap y antes de publicar credenciales.
  Esto retira lecturas de la sesión anterior iniciadas durante esa espera, incluso
  con la misma cuenta y tenant. La operación de prueba conserva su identidad:
  termina normalmente, consume el challenge OTP y libera `loginBusy`.
- Los permisos se limpian antes de publicar los tokens del cambio. Las lecturas
  obsoletas de perfil/permisos devuelven `null`, incluso si fallaron. Los cambios de
  tenant obsoletos rechazan con `Login operation cancelled`, sin modificar la sesión.
- Los errores actuales conservan su tratamiento: los 403 recuperables de cambio de
  tenant mantienen la sesión; los errores no recuperables la limpian. Un fallo
  actual al consultar permisos sigue propagando el error original.
- HTTP captura la generación de `authStorage` antes del transporte. Un 401 de otra
  generación no produce refresh, eventos globales ni limpieza. Se vuelve a comprobar
  la generación después de leer un error Blob asíncrono.
- Refresh comparte una sola rotación entre peticiones de la misma generación.
  `commitRotation` conserva su validación de identidad de cuenta, tenant y claim
  `isSuperAdmin`; un resultado con otro contexto no se instala. La actualización
  reactiva usa el recibo de esa rotación, sin crear otra sesión ni cancelar el
  cambio de tenant actual.
- El éxito y el fallo de un refresh anterior no afectan una sesión nueva. Antes del
  replay y antes de enviarlo, HTTP vuelve a comprobar la generación. No se toma el
  refresh pendiente de otra sesión. Un fallo actual conserva `refresh-failed`;
  la ausencia actual de refresh token conserva `missing-refresh-token`.
- El reemplazo persistido de credenciales/contexto y el cambio o limpieza de tenant
  eliminan permisos anteriores. Una rotación válida conserva permisos y contexto.
  La hidratación posterior a un reemplazo no recupera los grants descartados; una
  sesión actual con permisos cargados continúa hidratándose normalmente.

## Alcance y límites

No cambian endpoints, payloads, roles, asignaciones, reglas editoriales ni permisos
de media. `manage:all` no se convierte en identidad de Super Admin. Esta corrección
no habilita soporte editorial global/null ni acredita integración con el backend.

Las generaciones son del runtime actual. No hay coordinación nueva entre pestañas,
verificación criptográfica de JWT, transacción de localStorage ni publicación
atómica de todos los refs del store. Tampoco se certifica la procedencia histórica
de arrays de permisos escritos antes de esta corrección: la invalidación protege
los reemplazos realizados mediante las APIs corregidas. Los consumidores no deben
mutar directamente los refs para simular una transición de sesión. La autorización
y el ownership de recursos siguen siendo responsabilidad del servidor.

## Evidencia local

Pruebas deterministas con promesas controladas, tokens sintéticos y transporte
mockeado reproducen ABA, logout/relogin, switches superpuestos, lecturas durante el
intercambio, refresh tardío exitoso/fallido y replay. Se conservan pruebas de los
caminos actuales y de los errores recuperables/no recuperables, sin servicios vivos.
La corrección del intervalo de login/OTP/selección añade doce casos: éxito y fallo
obsoletos de perfil y permisos por cada flujo. Comprueban resultados públicos,
estado y storage sin cambios tras la respuesta tardía, finalización de la operación
y consultas legítimas de permisos posteriores.

El diferencial scratch contra `db9cd260ebf948851cb1a7d717d61612605b99d0` comparó
cinco snapshots públicos de estado/storage/ability y diez observaciones de requests:
login, selección pendiente, selectTenant, switchTenant y refresh con replay.
Los resultados fueron idénticos. Es una comparación acotada, no una certificación
de todos los consumidores ni una prueba de integración real.
