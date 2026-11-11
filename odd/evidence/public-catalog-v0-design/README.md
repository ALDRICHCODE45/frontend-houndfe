# Public catalog v0: mock API for design checks

The v0 backend (`feat/public-catalog-v0`) is not deployed and its migration must not touch the shared dev DB.
`mock-api.mjs` stands in for the public catalog API so the real FE can render every state of the design.
It is plain Node (`node:http`), has no dependencies and its fixtures are sample data that never ship in the app.

## Start

From the project root (the vite root must be the project root so Tailwind scans `src`). Two terminals:

```bash
# 1. mock API on :3999 (PORT overrides; CORS allows http://localhost:5199)
node odd/evidence/public-catalog-v0-design/mock-api.mjs

# 2. FE dev server on :5199 pointed at the mock
VITE_API_BASE_URL=http://localhost:3999 pnpm exec vite --port 5199 --strictPort
```

Then open `http://localhost:5199/catalogo/centro`. Stop both with Ctrl+C.

## Modes

| Mode | How | Effect |
| --- | --- | --- |
| `ok` | default | normal responses |
| `error` | `MOCK_MODE=error node …/mock-api.mjs` | `GET …/products` answers 500 (listing error state) |
| `slow` | `MOCK_MODE=slow node …/mock-api.mjs` | every response waits 2.5 s (skeletons) |

The mode can also change without restarting: `curl 'http://localhost:3999/__mock/mode?value=error'` (`ok`, `error`, `slow`).

## Routes and states

| Route | Notes |
| --- | --- |
| `GET /public/catalog/branches` | `centro` (WhatsApp, address, phone) and `norte` (no phone) |
| `GET /public/catalog/:slug/price-contexts` | `centro`: Público (default) + Mayoreo; `norte`: Público only |
| `GET /public/catalog/:slug/products` | 26 products; `q` (name/brand), `categoryId`, repeated `facet=<def>:<option>`, `sort` (`newest`, `price_asc`, `price_desc`), `page`, `limit` (default 20 as in the backend, so 2 pages), `priceListId` |
| `GET /public/catalog/:slug/products/:id?priceListId=` | detail; unknown id 404 |
| `GET /public/catalog/:slug/branch` | `centro` card with hours; `norte` 404 |

Facet counts follow handoff 07: category counts apply `q` and the facets (not the category itself); attribute counts apply every
other filter and exclude the definition's own selection; zero-count options are omitted unless selected. An unknown facet token is a
400 `FACET_NOT_AVAILABLE`.

States to look at:

- Branch without catalog: `http://localhost:5199/catalogo/sur` (`sur` is not listed and answers 404, like an unpublished branch).
- Branch without WhatsApp card: `/catalogo/norte` (404 on `/branch`, no price-list selector since it has one list).
- Price list selector and ~10 % cheaper prices: `centro` with Mayoreo (`priceListId=9e1c0000-0000-4000-8000-000000000002`). The product «Bolsas biodegradables» is not sold in Mayoreo, so `excludedCount` is 1 there.
- No results: `?q=zzz`. Recipient tiles: the `animal.target` facet (`ani.dom.dog`, `ani.dom.cat`). «Ver más»: the «Etapa de vida» group has 6 options.
- Error / loading: the modes above.

## Product ids for the detail page (`/catalogo/centro/p/:id`)

| Case | id | Product |
| --- | --- | --- |
| Variants, unit price and «Ahorras» (2 / 8 / 20 kg; 2 kg low stock «Quedan 3», 20 kg out of stock; with images) | `0b2f0000-0000-4000-8000-000000000001` | Croquetas adulto raza mediana |
| Variants, cat food (1.5 / 4 / 9 kg, 9 kg «Quedan 2») | `0b2f0000-0000-4000-8000-000000000007` | Croquetas gato adulto pollo |
| Fully out of stock | `0b2f0000-0000-4000-8000-000000000011` | Croquetas gato esterilizado |
| Hidden price | `0b2f0000-0000-4000-8000-000000000006` | Dieta veterinaria renal perro |
| Simple, low stock «Quedan 4», 3 kg | `0b2f0000-0000-4000-8000-000000000003` | Croquetas senior sin cereales |
| No image (fallback) | `0b2f0000-0000-4000-8000-000000000012` | Galletas de avena y miel |
| 404 («ya no está») | `0b2f0000-0000-4000-8000-000000000999` | unknown |

Images use `http://localhost:5199/images/catalog-companions.png` (served by vite from `public/`) for a few products; the rest have none.

## Contract rules that shaped the fixtures

- Detail requires `priceContext.priceListId` to equal the `priceListId` the FE sent, and `excludedCount` to be `0`.
- Price list rows must have exactly `priceListId`, `name`, `isCatalogDefault`; names must be unique and at most one default.
- A hidden price needs `fromPriceCents` and `priceCents` both `null` in the list (and `priceCents` null in the detail); a visible price needs a positive integer.
- `availability` must equal `stockPresentation.status`; `rating` and `featuredLabel` must be `null`; list `slug` nullable, detail `slug` must be `null`.
- A detail variant needs exactly one `availabilityByBranch` entry, selected, with the same availability as its `stockPresentation.status`.
- Unit price and «Ahorras» need every presentation to carry `measure.net_mass` as a `number` with the same unit, so those attributes live on the variants (and on simple products at the top level).
- `exactQuantity` is only meaningful on `low_stock`; a variant product's top-level stock presentation always has `exactQuantity: null` (handoff 15 §3).
