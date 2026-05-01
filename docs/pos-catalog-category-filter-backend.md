# POS Catalog — Category Filter Support

## Context

The frontend POS sales view now displays products in a card grid layout with category filter chips. The frontend derives categories from the items returned by the existing `GET /sales/pos-catalog` endpoint, but for proper filtering we need backend support.

## Current Endpoint

```
GET /sales/pos-catalog?q=&limit=24&offset=0&categoryId=&brandId=
```

**Status**: The endpoint already accepts `categoryId` and `brandId` as query parameters (defined in `PosCatalogSearchParams`).

## What the Frontend Needs

### 1. Confirm `categoryId` filter works (likely already done)

When the frontend sends:
```
GET /sales/pos-catalog?limit=24&offset=0&categoryId=cat-123
```

The backend should return ONLY products that belong to category `cat-123`. The `total` field should reflect the filtered count.

**Frontend sends**: `categoryId` as a single UUID string.

### 2. (Nice-to-have) Category list with product counts

Currently the frontend derives category chips from the loaded items, which means:
- Only categories present in the first 24 results appear as filters
- Counts are only for the loaded page, not the full catalog

For a better UX, a dedicated endpoint would help:

```
GET /sales/pos-catalog/categories
```

**Response shape**:
```json
{
  "categories": [
    {
      "id": "cat-uuid-1",
      "name": "Alimento",
      "productCount": 15
    },
    {
      "id": "cat-uuid-2",
      "name": "Accesorios",
      "productCount": 8
    }
  ]
}
```

**Rules**:
- Only include categories that have at least 1 product enabled for POS (`enabledForPos = true`)
- `productCount` = number of POS-enabled products in that category
- Sort by `productCount` DESC (most products first)
- No pagination needed (categories are typically < 50)

### 3. (Nice-to-have) Default sort order for browsing

When no `q` is provided (user is browsing, not searching), ideally products should be sorted by `updatedAt DESC` so the most recently updated products appear first — this makes the "Productos recientes" label accurate.

Currently the frontend labels the initial product list as "Productos recientes". If the backend sorts by `createdAt` or `name` by default, the label is misleading but not broken.

**Suggestion**: Add an optional `sortBy` parameter:
```
GET /sales/pos-catalog?limit=24&offset=0&sortBy=updatedAt
```

## Priority

| Item | Priority | Notes |
|------|----------|-------|
| `categoryId` filter | **High** | Likely already works — just verify |
| Category list endpoint | **Medium** | Frontend works without it (derives from items) but UX is better with it |
| Sort by `updatedAt` | **Low** | Nice-to-have for "recientes" accuracy |

## Frontend Implementation Status

- Category filter chips: **Implemented** (derives from loaded items)
- `categoryId` sent in API call: **Implemented**
- Card grid layout: **Implemented**
- Full-width search input: **Implemented**

The frontend is fully functional and will work correctly as soon as `categoryId` filtering is confirmed working on the backend. The category list endpoint and sort order are enhancements.
