# Public catalog v0 fidelity — T1 shell

T1 implements S1–S2 for the shell only. T2 cards/grid/detail and T3 complete-feature acceptance remain separate. No commerce, filtering, account or checkout capability was added.

## Source and component boundaries

Read the exported `app/globals.css` **including its final corrective media queries**, `app/layout.tsx`, `components/catalog.tsx`, `components/houndfe-store.tsx` and `components/shop-primitives.tsx` in `artifacts/v0-fidelity/reference/`. Compared `.playwright-review/home-390.png` / `home-1440.png` with the previous `artifacts/live-catalog-smoke/final/list-390.png` / `list-1440.png` and the new captures.

- `CatalogHeader`: full existing project image; existing branch dialog and controlled price selector/events. Search/cart removed, not disabled placeholders.
- `CatalogHero`: original local photo, editorial headline and local anchor navigation with listing focus. No request or route ownership.
- `CatalogCategoryBar`: catalog heading and authoritative result total only; no unsupported filter/sort/category buttons.
- `CatalogFooter`: full real logo, reference's companion-oriented sentence and truthful branch-price context; no invented delivery/help/account links.
- `CatalogView`: presentation composition only; hero precedes branch selection states. Existing composables, routing, query authority, detail lifecycle and requests unchanged.
- `catalog.css`: catalog body/portal boundary retained. Existing card/detail rules unchanged. Manrope now names the actual web-loaded family rather than a local-only alias.

## Direct comparison matrix

| Surface           | v0 reference                                                         | T1 readback                                                                                                                     | Intentional difference / remaining work                                                                                                                                                                           |
| ----------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header / logo     | Provisional text wordmark; search, account, cart, demo/category rows | Full mascot + lettering in uncropped 80×80 image; restrained branch action and compact price control                            | Real logo replaces explicitly provisional wordmark. Unsupported rows omitted rather than counterfeit; header is consequently shorter.                                                                             |
| Typography        | Manrope, navy headings, 22px mobile / 26px desktop hero              | Actual anonymous browser reports loaded Manrope; same sizes, weight, tracking and palette                                       | 320px title uses 20px to preserve both animal faces without overlapping copy. No new fonts or dependencies.                                                                                                       |
| Hero desktop      | ~160px high, blue-gray surface, photo at right ~43%, caption         | 160px at 1024/1440; same surface, split and caption                                                                             | Starts y113 rather than reference y179 because unsupported demo/navigation/search rows are absent. Truthful copy replaces purchase promise; link target is ≥44px.                                                 |
| Hero mobile       | x16, ~152px high, narrow original photo right                        | 390px: x16, 148.6px high; original dog and cat visible. 320px: 163.6px high, wider 32% crop                                     | CTA remains a real ≥44px target, not reference's 28px corrective minimum. Narrowest crop is explicitly adjusted for faces; 390 retains 26% photo width.                                                           |
| Tablet hero       | Final 601–900 rule removes fixed max height and keeps 58/42 split    | 768px: 202.9px, 58/42 split, both companions visible                                                                            | No forced desktop height where the reference itself removes it.                                                                                                                                                   |
| Gutters / spacing | 16px mobile, 24px tablet, 32px desktop within max1424 container      | 16px at320/390; 24px at768; 32px at1024; x40 at1440 with centered max1424 container                                             | 1440 reference screenshot has ~32px inset versus this browser's40px: matching CSS max width plus different available scrollbar width. No invented sidebar/species band; listing follows hero with26px separation. |
| Selectors         | Reference has unsupported sort, no real price context                | Real branch modal retained; visible price label integrated horizontally beside a compact selection trigger (stacked only at320) | Price context remains authoritative and controlled; never impersonates sort. Loading, retry, empty/error and unselected states preserved.                                                                         |
| Footer            | Brand sentence plus service promises/account/policy/demo columns     | Same restrained spacing/type, real logo and truthful branch-pricing sentence                                                    | Service strip and unsupported navigation/policies omitted. Screenshot reference stops before footer; footer comparison is against exported source.                                                                |
| Listing / content | 12 fictional products, multiple columns, filters                     | One existing synthetic bowl, unchanged $149 price and availability                                                              | Honest backend content. T2 must replace card/grid/detail styling; one large mobile card is **not** accepted as completed fidelity here.                                                                           |

## Evidence and validation

`artifacts/v0-fidelity/t1/` contains `check.mjs`, `evidence.json` and ten full-page anonymous captures (`entry-*`, `list-*`) at320/390/768/1024/1440. All ten screenshots were read, not merely generated. Matching390/1440 captures were compared directly with the v0 screenshots; other widths checked the responsive rules and crop. No authentication, writes to APIs/DB/CDN, server restart or mock interception was used.

- RED observed: new logo tests failed because header/footer had no image; hero test initially could not resolve the missing component. Integration RED then failed on missing `.catalog-hero img` before implementation.
- GREEN: catalog + layout focused suite passed17 files /364 tests. The first full run exposed nine now-obsolete unscoped heading selectors; tests now address product headings / no-branch state under the listing, preserving their network and state assertions.
- Actual preview: `node artifacts/v0-fidelity/t1/check.mjs` passed all ten route/viewport cases. Hero HTTP200 and natural1264×848, loaded Manrope, ≥44px trigger/CTA geometry, no horizontal overflow, listing CTA focus, branch dialog focus/Escape return, price listbox keyboard opening/Escape return. An initial immediate focus sample ran before Nuxt UI restored focus; waiting on the observable focus state passed.
- Hero SHA256 remains `bd72a36ee63e66c3c5818b09e88af905e0dcd5e73cebbc8ca80b167bd48103ad`; no image overwrite/download occurred.
- `pnpm type-check`, `pnpm type-check:responsive`, `pnpm build` passed. Build reports generated CSS `env(...)` and large-chunk warnings; no config/dependency workaround applied.
- Scoped Prettier and `git diff --check` validate the changed implementation/tests/docs.
- Mocked responsive suites **not run**: existing config owns4173 with `reuseExistingServer:false`; no isolated override exists. Obsolete disabled-placeholder assertions and exact action inventories were updated without weakening network/focus guards. The live preview4173/backend3000 stayed running.

## Limits and rollback

No whole-feature visual approval is claimed. Cards/grid/detail remain T2; existing grid state headings can coexist with the new hero h1 (semantic cleanup belongs with T2's grid). Icon glyph arrival varies with existing runtime icon loading; no icon dependency/config changed. Original source image provenance is parent-provided; production licensing was not independently audited.

Parent can reverse only this T1 work unit's listed source/test/doc changes and remove its new hero/tests through its normal review workflow; preserve the pre-existing original image, reference exports and unrelated research. No commits/staging or destructive rollback commands were executed.

## Key Learnings

- v0's last media queries override its earlier tall hero; copying only initial rules produces the wrong composition.
- A local Manrope alias does not select the existing downloaded family. Anonymous browser font loading was verified after using its actual name.
- Preserving both faces at320 requires considering copy-driven height as well as object-position; shortening truthful copy and widening only the narrowest crop resolved it.
- Real price context has no v0 equivalent: preserve its authority and keyboard behavior without disguising it as sort or filling the header with unavailable tools.
