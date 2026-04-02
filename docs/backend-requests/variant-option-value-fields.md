# Request: Agregar campos `option` y `value` al modelo Variant

## Contexto

El sistema legacy maneja variantes con una estructura de **Opción → Valor** (ej: "Color → Rojo", "Tamaño → Mediano"). El modelo actual de `Variant` solo tiene un campo `name` que no distingue entre el tipo de opción y su valor concreto.

El frontend necesita esta distinción para:

- Agrupar variantes visualmente por tipo (ej: mostrar todas las de "Color" juntas)
- Replicar el flujo UX del legacy donde el usuario primero elige la **opción** (Tamaño, Color, Material, Estilo) y luego ingresa el **valor**
- Filtrar variantes por tipo de opción

## Cambios solicitados

### 1. Modelo Prisma — `variants`

Agregar dos campos al modelo `Variant`:

```prisma
model Variant {
  id        String   @id @default(uuid())
  productId String
  name      String   // MANTENER — se puede computar como "{option}: {value}" o dejar libre
  option    String?  // NUEVO — tipo de opción: "Tamaño", "Color", "Material", "Estilo", etc.
  value     String?  // NUEVO — valor concreto: "Mediano", "Rojo", "Algodón", etc.
  sku       String?  @unique
  barcode   String?  @unique
  quantity  Int      @default(0)

  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  // ... resto de relaciones existentes
}
```

**Notas:**

- `option` y `value` son **opcionales** para no romper variantes existentes que solo tengan `name`
- No hace falta enum para `option` — es un string libre, pero el frontend limitará las opciones a: `Tamaño`, `Color`, `Material`, `Estilo` (por ahora)
- `name` se mantiene como campo principal (backward compatible). El frontend puede enviar `name` como `value` si quiere, o como `"{option} - {value}"`

### 2. DTOs

#### `CreateVariantDto`

Agregar campos opcionales:

```typescript
@IsOptional()
@IsString()
@MaxLength(50)
option?: string;

@IsOptional()
@IsString()
@MaxLength(100)
value?: string;
```

#### `UpdateVariantDto`

Mismos campos opcionales (ya hereda de `PartialType(CreateVariantDto)`).

### 3. Response shape

Agregar `option` y `value` al response de variantes:

```json
{
  "id": "uuid",
  "productId": "uuid",
  "name": "Mediano",
  "option": "Tamaño",
  "value": "Mediano",
  "sku": null,
  "barcode": null,
  "quantity": 0,
  "createdAt": "...",
  "updatedAt": "..."
}
```

### 4. Migración

```sql
ALTER TABLE "variants" ADD COLUMN "option" TEXT;
ALTER TABLE "variants" ADD COLUMN "value" TEXT;
```

## Impacto

- **No breaking**: todos los campos son opcionales
- **No afecta lógica existente**: el campo `name` sigue siendo el principal
- **Frontend**: el frontend usará `option` para agrupar y `value` para mostrar, pero siempre enviará `name` también como fallback

## Endpoints afectados

| Endpoint                                  | Cambio                                            |
| ----------------------------------------- | ------------------------------------------------- |
| `POST /products/:id/variants`             | Acepta `option?` y `value?`                       |
| `PATCH /products/:id/variants/:variantId` | Acepta `option?` y `value?`                       |
| `GET /products/:id/variants`              | Devuelve `option` y `value` en response           |
| `GET /products/:id` (detalle)             | Variantes en response incluyen `option` y `value` |
