# Espacio editorial de producto

## Publicación pendiente (I3a · S1, S6)

El espacio editorial de producción muestra **Publicación pendiente de habilitación del backend**.
No ofrece publicación ni confirmación de cuidado para publicar, incluso con permisos de publicación.
Esta restricción es de presentación: no agrega permisos, capacidades de backend ni variables de entorno.

- Guardar borrador conserva su operación independiente; no publica ni modifica datos operativos.
- La comparación administrativa usa únicamente el borrador guardado y la versión publicada consultados.
  No es una vista pública ni compara cambios locales o documentos del acuse histórico.
- El descarte del borrador guardado conserva su confirmación y permisos existentes.
- Consultar y conservar cambios y consultar y descartar cambios locales siguen siendo decisiones distintas.
- Los estados de error, conflicto, respuesta ambigua y acuse histórico conservan su tratamiento existente.
- La restricción aplica tanto al Workspace independiente como al integrado.

`EditorialPublication` recibe `publicationAvailable`, opcional y verdadero por defecto,
para conservar el contrato genérico existente. `EditorialWorkspace` pasa `false` y no conecta
el evento `publish`. Cambiar esta propiedad cierra cualquier confirmación abierta y borra el consentimiento.
Los permisos y la elegibilidad del servidor siguen siendo independientes de esta propiedad.

## Evidencia y límites

Las pruebas de disponibilidad cubren el contrato genérico por defecto, la restricción explícita,
la revocación de un consentimiento abierto y la conservación de comparación/descarte.
Las pruebas de integración del publicador usan el componente genérico con `useEditorialEditor` real;
conservan las verificaciones de cuidado, revocación de privilegios, acuse, conflicto y retransmisión ambigua.
No existe un bypass de producción para estas pruebas. La protección de salida continúa probándose
con la vista real y los controles reales del Workspace.

## Navegación y resumen (I3b · S2, S5, S6)

La ruta editorial independiente ofrece Contenido y Revisar sin un orden obligatorio.
La vista es responsable de esa navegación y de la presentación del resumen; Workspace sigue
siendo el único dueño del formulario y del ciclo de vida. Un slot opcional entrega únicamente
el título guardado, las revisiones consultadas y los indicadores de cambios locales y acuse.
Sin ese slot, Workspace conserva su presentación predeterminada y sus propiedades existentes.

Los controles se mantienen montados mediante `v-show`; cambiar de sección no inicia consultas
ni guardados. Los errores de validación quedan fuera del formulario ocultable y los mensajes
de reconciliación, acuse y confirmación de descarte permanecen visibles en ambas secciones.
En modo de consulta, el historial completo sigue visible también en Contenido.

El resumen privado distingue cambios locales, borrador guardado, versión publicada y acuse histórico.
Nunca toma el documento del acuse como estado actual ni presenta una vista pública.
Se retira al perder acceso editorial o fallar la consulta; no consulta datos de Product.
La composición usa tokens HF, navegación con foco visible y una sola columna en pantallas estrechas.

La activación del backend, el despliegue y la disponibilidad pública no forman parte de estas unidades.
La comprobación visual responsiva en navegador corresponde a la integración I4.

Límite de reversión I3a: propiedad de disponibilidad, conexión de presentación en Workspace,
pruebas asociadas y este documento; no requiere revertir cambios de API o ciclo de vida.
