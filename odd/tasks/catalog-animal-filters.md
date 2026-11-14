# Catalog animal filters (public catalog, FE)
The animal strip of the public catalog (CatalogFilterRecipientTiles) is redesigned: grouped, compact, with a clean selected state.
Branch `feat/catalog-animal-filters`.

## Specs
- S1 Owner 2026-11-13: «dicha sucursal tiene muchas "categorias" que aparecen como filtros en pequenas cards con el nombre de la categoria y un icono de "garrita", pero estoy notando que, sinceramente, se ve mal cuando hay muchas categorias, y tambien no me gusta el diseno qeu tiene cuando estan seleccionadas y el nombre de la categoria es mas largo de lo comun»
- S2 Owner accepted the proposal («si hermano, por favor. adelante.»): canvas directions first (grouping by animal type with a species row, compact auto-width pills with a «Ver más (n)», or groups with a species menu) plus mobile; owner chooses; then implement. «Todos» is selected only when no animal filter is active.

## Tasks
- T1 | S1, S2 | design worker | in progress — directions in design/catalog-animal-filters (3 + mobile/states)
- T2 | S1, S2 | pending — implement the chosen direction

## Log
- L1 Owner 2026-11-13 (verbatim, with two screenshots of /catalogo/centro): «Bien hermano, perfecto, aprovecho para decirte, que estaba viendo el catalogo en linea y la verdad es que me gusta bastante, sin embargo hay algo que note apenas que no me gusto del todo: en esta imagen puedes ver el catalogo en linea de la sucursal centro, dicha sucursal tiene muchas "categorias" que aparecen como filtros en pequenas cards con el nombre de la categoria y un icono de "garrita", pero estoy notando que, sinceramente, se ve mal cuando hay muchas categorias, y tambien no me gusta el diseno qeu tiene cuando estan seleccionadas y el nombre de la categoria es mas largo de lo comun: si lo alcanzas a ver?? que propones para mejorarlo/solucionarlo?»
- L2 Observed in the screenshots: 20 fixed-width tiles in two rows (Todos 36, Anolis 1, Bettas 1, Canario doméstico 1, Colas de espada 1, Corydoras 1, Diamante mandarín 1, Dragones barbudos 1, Gato 13, Gecko crestado 1, Gecko leopardo 1, Guppy 2, Mollys 2, Ninfa 1, Periquito australiano 1, Perro 26, Platys 2, Serpiente del maíz 1, Tetra neón 2); long names wrap to two lines with the count floating; same paw icon on almost all; selected tile «Canario doméstico» lets its icon and check overflow the border; «Todos» shown selected while «Control de desechos» was active. URL facet values look hierarchical (animal.target:ani.bird_pet.canary, animal.target:ani.freshwater_group.bettas) → grouping may come from the facet data (to confirm).
- L3 Owner: «si hermano, por favor. adelante.» → T1 canvas directions.
