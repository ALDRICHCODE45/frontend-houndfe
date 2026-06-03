# Requerimiento Backend — Filtros multi-valor y por rango en listado de ventas

## Resumen

Vamos a rediseñar la barra de filtros de la tabla de **Ventas** (`/sales`) para que sea **multi-select** y soporte **rangos** (numéricos y de fecha). Hoy los filtros son de valor único y limitan mucho la operación: el usuario no puede, por ejemplo, ver "todas las ventas Pagadas + en Deuda pagadas por Efectivo o Transferencia en el último mes".

Este documento describe **qué necesitamos del backend** para que el frontend pueda construir esa experiencia. **No prescribe implementación**: la decisión de cómo modelar query params, índices, validaciones y motor de búsqueda queda 100% del lado backend.

Lo único que pedimos es una **convención uniforme entre endpoints de listado**, porque del lado frontend vamos a construir un sistema de filtros **reutilizable y configurable** que pueda activarse en cualquier tabla (Ventas, Clientes, Productos, etc.). Para que ese sistema funcione, los endpoints de listado tienen que hablar el mismo idioma.

---

## 1. Objetivo funcional

El usuario debe poder, en la tabla de Ventas:

1. **Filtrar por múltiples valores** dentro de un mismo campo categórico (ej: Pago = `Pagada` **o** `Deuda`).
2. **Filtrar por rangos** en campos numéricos (Total, Deuda) y de fecha (Fecha de venta, Vencimiento).
3. **Combinar varios filtros simultáneamente**, donde la combinación entre filtros distintos es **AND**, y dentro del mismo filtro es **OR**.
4. **Buscar por texto libre** (ya existe, no cambia el contrato actual de `q`).
5. **Resetear filtros** individualmente o todos a la vez (frontend, no requiere cambios backend).

Ejemplo concreto del comportamiento esperado:

> "Mostrame las ventas **Pagadas o en Deuda** (`paymentStatus = paid OR debt`), pagadas con **Efectivo o Transferencia** (`paymentMethod = cash OR transfer`), con **total entre $500 y $2000**, **vencimiento entre 01/06/2026 y 30/06/2026**, del **cliente Público en General o Juan Pérez**, con productos **Entregados**."

Eso, traducido a lógica de filtros:

```
(paymentStatus IN [paid, debt])
AND (paymentMethod IN [cash, transfer])
AND (total BETWEEN 500 AND 2000)
AND (dueDate BETWEEN 2026-06-01 AND 2026-06-30)
AND (customerId IN [null, 42])
AND (deliveryStatus IN [delivered])
```

---

## 2. Filtros requeridos para la tabla de Ventas

A continuación, los campos que deben poder filtrarse, con el tipo de filtro que aplica. **El backend decide los nombres de query params, los códigos de los enums y el formato exacto**; esto es solo la lista funcional.

| Campo (visible) | Tipo de filtro | Valores / formato |
|---|---|---|
| Número de venta | Multi-valor (lista) | Lista de IDs o folios visibles |
| Cliente | Multi-valor (lista) | Lista de `customerId`. Debe poder incluir "Público en General" (cliente `null`) como un valor seleccionable |
| Fecha de venta | Rango de fecha | `from` y `to` (ambos opcionales, inclusivos) |
| Vencimiento | Rango de fecha | `from` y `to` (ambos opcionales, inclusivos). Debe permitir filtrar también ventas **sin vencimiento** como opción explícita |
| Pago (estado) | Multi-valor (enum) | `paid`, `debt` (y los que existan) |
| Método de pago | Multi-valor (enum) | `cash`, `transfer`, `card_debit`, `card_credit`, etc. Debe permitir filtrar también ventas **sin método** (deuda sin pago todavía) |
| Total | Rango numérico | `min` y `max` (ambos opcionales, inclusivos) |
| Deuda | Rango numérico | `min` y `max` (ambos opcionales, inclusivos). `min=0&max=0` debe devolver ventas sin deuda |
| Productos (entrega) | Multi-valor (enum) | `delivered`, `not_delivered`. Si se eligen los dos, equivale a no filtrar |

**Búsqueda libre `q`**: se mantiene tal como está hoy (ver `sales-list-search-public-customer-and-folio.md`). Debe poder combinarse con los filtros anteriores (AND).

**Ordenamiento**: el parámetro de orden actual (`Más recientes`, etc.) se mantiene tal como está.

**Paginación**: se mantiene tal como está.

---

## 3. Lineamientos transversales (aplican a TODOS los endpoints de listado)

Esto es lo más importante del documento. El frontend va a construir un componente de filtros **reutilizable**, configurable por schema. Para que ese componente pueda servir a cualquier tabla (Ventas, Clientes, Productos, Compras, etc.), todos los endpoints de listado deben seguir la **misma convención**.

No pedimos un motor genérico ni un endpoint universal. Pedimos **una convención consistente** entre endpoints específicos.

### 3.1 Multi-valor en filtros categóricos

Un mismo filtro categórico debe aceptar **varios valores**, y la semántica entre ellos debe ser **OR**.

**Resultado esperado**: si el usuario elige dos estados de pago, la respuesta debe incluir ventas que coincidan con cualquiera de los dos.

El **formato de transporte** (lista separada por comas, parámetro repetido, JSON, etc.) lo define backend, pero debe ser **el mismo formato en todos los endpoints**.

### 3.2 Rangos en filtros numéricos y de fecha

Un mismo filtro de rango debe aceptar **límite inferior**, **límite superior**, o ambos. Cualquiera de los dos puede omitirse y eso significa "sin límite por ese lado".

**Resultado esperado**:

- Solo `min` definido → todo lo `>= min`.
- Solo `max` definido → todo lo `<= max`.
- Ambos definidos → todo lo que esté entre `min` y `max` inclusive.
- Ninguno definido → no filtrar por ese campo.

La **convención de nombres** (`*Min`/`*Max` para numéricos, `*From`/`*To` para fechas, u otra) la define backend, pero debe ser **idéntica en todos los endpoints**.

### 3.3 Combinación entre filtros

- **Distintos filtros se combinan con AND**.
- **Múltiples valores dentro del mismo filtro se combinan con OR**.

Esa es la única semántica que necesitamos. **No** necesitamos soportar expresiones booleanas arbitrarias, paréntesis, NOT, ni operadores comparativos configurables. Si el negocio en el futuro pide algo más complejo, lo discutimos por separado.

### 3.4 Valores especiales

Algunos filtros deben poder representar conceptos como:

- **"Sin valor"** (ej: ventas sin cliente → "Público en General"; ventas sin método de pago; ventas sin vencimiento).
- **"Cualquier valor"** (equivalente a no enviar el filtro).

Cómo se representa "sin valor" en el query (token especial, `null` literal, parámetro aparte) lo define backend, pero debe ser **consistente entre endpoints**.

### 3.5 Respuesta del endpoint

El contrato de respuesta **no cambia**: misma estructura, misma paginación, mismos campos. Solo cambia el set de query params aceptados.

### 3.6 Catálogos para poblar los filtros

Para los filtros de tipo "lista" (Cliente, por ejemplo) el frontend necesita poder **poblar las opciones**. Hoy ya existen endpoints de listado de clientes; el frontend los va a consumir tal como están.

Si para algún filtro futuro el set de valores es muy grande, vamos a necesitar **búsqueda incremental** en ese filtro (typeahead). Para Ventas en esta primera iteración no es bloqueante: el filtro de Cliente puede cargar la lista actual de clientes del tenant.

### 3.7 Validación y errores

- Si el usuario manda un valor inválido en un enum (ej: `paymentStatus=invented`), el backend debe responder con un error claro indicando el campo y los valores aceptados.
- Si un rango es inverso (`min > max`), el backend puede responder error o devolver lista vacía. Preferimos **error explícito** para que el frontend pueda mostrar el mensaje al usuario.
- Fechas inválidas → error explícito.

---

## 4. Resultado esperado (experiencia de usuario)

Una vez backend implemente esto, frontend va a construir:

1. Una barra de filtros multi-select en la tabla de Ventas, con popovers en desktop y un sheet/drawer en mobile.
2. Chips visibles de los filtros activos, con la opción de removerlos individualmente.
3. Botón "Limpiar filtros".
4. Sincronización con la URL (los filtros activos quedan en query params para poder compartir el link).
5. Persistencia opcional de los filtros del usuario (a decidir más adelante, no es parte de este pedido).

Y, en una segunda etapa, **el mismo componente reutilizable** lo vamos a activar en otras tablas (Clientes, Productos, Compras, etc.) sin que backend tenga que cambiar nada **siempre y cuando esos endpoints sigan la misma convención** descripta en la sección 3.

---

## 5. Fuera de alcance (qué NO estamos pidiendo)

- **No** pedimos un motor genérico de filtros tipo `?filters=[{field,op,value}]`. Eso es un anti-patrón conocido (difícil de validar, autorizar, indexar y mantener). Preferimos endpoints específicos con query params explícitos y tipados.
- **No** prescribimos tecnología: ORM, base de datos, índices, full-text search, todo es decisión backend.
- **No** pedimos soporte para AND/OR arbitrario entre filtros distintos, ni NOT, ni operadores configurables. Solo `AND entre filtros, OR dentro del filtro`.
- **No** pedimos que se exponga un endpoint de "metadata de filtros" para que el frontend descubra qué se puede filtrar. La configuración la mantiene el frontend por tabla.
- **No** estamos pidiendo cambios en el contrato de respuesta, ni en paginación, ni en ordenamiento.

---

## 6. Orden de trabajo sugerido

1. Backend define la **convención** (sección 3): nombres de params, formato multi-valor, formato de rangos, representación de "sin valor", manejo de errores.
2. Backend documenta esa convención (un README corto o un punto en la spec de la API).
3. Backend implementa los filtros listados en la sección 2 sobre el endpoint `GET /sales`.
4. Frontend implementa el componente reutilizable y lo integra en la tabla de Ventas.
5. En iteraciones siguientes, backend aplica la misma convención a los demás endpoints de listado a medida que las tablas las vayamos migrando.

---

## 7. Checklist backend

- [ ] Definida y documentada la convención transversal: multi-valor, rangos, "sin valor", manejo de errores.
- [ ] `GET /sales` acepta múltiples valores en: número de venta, cliente, estado de pago, método de pago, productos (entrega).
- [ ] `GET /sales` acepta rangos en: fecha de venta, vencimiento, total, deuda.
- [ ] Filtro de cliente permite seleccionar "Público en General" (cliente `null`).
- [ ] Filtro de vencimiento permite seleccionar "sin vencimiento".
- [ ] Filtro de método de pago permite seleccionar "sin método".
- [ ] Combinación: AND entre filtros distintos, OR dentro del mismo filtro.
- [ ] Compatibilidad con `q` (búsqueda libre): se combinan con AND.
- [ ] Errores explícitos en enums inválidos, rangos inversos y fechas mal formadas.
- [ ] La paginación, el ordenamiento y el contrato de respuesta no se modifican.
