# Requerimiento Backend — Ajustar búsqueda de ventas por cliente público y número visible

## Resumen

El endpoint `GET /sales?q=...` debe buscar sobre lo que el usuario ve en la tabla de ventas. Hoy hay dos inconsistencias visibles:

1. Buscar `Público` no encuentra ventas que el frontend muestra como **Público en General**.
2. Buscar `2` puede devolver ventas inesperadas porque el folio real contiene año/mes (`A-202605-000002`), no solo el número visible (`#2`).

## Contexto frontend

La tabla de ventas muestra:

| Columna | Ejemplo visible |
|---|---|
| Venta | `#2` |
| Cliente | `Público en General` |
| Cajero | `Super Admin` |
| Vendedor | vacío o nombre |

El contrato actual dice que `q` busca en:

- folio
- nombre de cliente
- cajero
- vendedor

Pero el usuario no ve el folio técnico completo. Ve `#2`, derivado desde `A-202605-000002`.

---

## Problema 1 — `Público en General` no matchea

### Caso actual

Cuando una venta no tiene cliente explícito, el backend puede devolver:

```json
{
  "customer": null
}
```

El frontend muestra ese caso como:

```txt
Público en General
```

Pero si el usuario busca:

```http
GET /sales?q=Público
```

el backend no encuentra nada porque `customer.name` es `null`.

### Cambio requerido

La búsqueda debe tratar ventas con `customer = null` como si tuvieran el texto buscable:

```txt
Público en General
```

### Criterio de aceptación

- `GET /sales?q=publico` devuelve ventas con `customer = null`.
- `GET /sales?q=público` devuelve ventas con `customer = null`.
- `GET /sales?q=general` devuelve ventas con `customer = null`.
- La búsqueda debe ser case-insensitive y tolerante a acentos si el backend ya normaliza texto.

---

## Problema 2 — búsqueda por folio visible vs folio técnico

### Caso actual

El backend guarda folios así:

```txt
A-202605-000001
A-202605-000002
```

El frontend los muestra así:

```txt
#1
#2
```

Si el backend hace `LIKE '%2%'` sobre el folio completo, buscar `2` puede matchear todas las ventas de 2026/202605, no solo la venta `#2`.

### Cambio requerido

Cuando `q` sea numérico, la búsqueda debe matchear contra el **consecutivo visible** del folio, no contra cualquier dígito del año/mes.

Ejemplos:

| `q` | Debe matchear | No debería matchear solo por |
|---|---|---|
| `1` | `A-202605-000001` | año/mes |
| `2` | `A-202605-000002` | `202605` |
| `12` | `A-202605-000012` | `2026` |

### Criterio de aceptación

- `GET /sales?q=1` devuelve la venta con consecutivo `000001` / display `#1`.
- `GET /sales?q=2` devuelve la venta con consecutivo `000002` / display `#2`.
- `GET /sales?q=2026` NO debe devolver todas las ventas solo porque el folio contiene el año, salvo que exista una decisión explícita de buscar por año.
- Si `q` incluye prefijo o formato completo (`A-202605-000002`), puede seguir matcheando por folio técnico completo.

---

## Sugerencia de implementación

### Cliente público

Agregar una condición especial para `customer IS NULL` cuando `q` normalizado matchee alguno de estos tokens:

```txt
publico, público, general, publico en general, público en general
```

### Folio visible

Extraer el consecutivo del folio (`000002`) y compararlo contra el número normalizado (`2`).

Opciones:

1. **SQL expression**: comparar `q` contra el último segmento del folio, casteado/normalizado.
2. **Campo derivado/indexado**: guardar `folio_sequence` como número entero por tenant y buscar por ese campo.

La opción 2 es más limpia para performance y futuras búsquedas exactas por número de venta.

---

## Impacto esperado

- Solo afecta `GET /sales?q=...`.
- No cambia el contrato de response.
- Mejora la búsqueda para que coincida con lo que el usuario ve en la tabla.

## Checklist backend

- [ ] `q=Público`, `q=publico` y `q=general` encuentran ventas sin cliente explícito.
- [ ] `q=1` encuentra `#1`.
- [ ] `q=2` encuentra `#2`.
- [ ] `q=2026` no devuelve todas las ventas por accidente.
- [ ] Se mantienen búsquedas por cliente real, cajero y vendedor.
