# UI clarity pass: text diet, row action menus, Geist trial
A system-level UI/UX pass to reduce visual noise and clarify the flow. It starts with a visual before/after comparison before any production code.
Branch: feat/ui-clarity-pass (from main bd2e83f4), same worktree. Delivery: local work-unit commits, no push.

## Specs
S1. User (verbatim): "en algunas secciones hay demasiado texto en un loso lugar, parece un libro, parece que entre a un hospital lleno de pancartas y de promociones, no se que leer, no se a que prestarle atencion, no se que es explicacion , que no, cual es el flujo que tengo que seguir, etc.."
S2. User (verbatim): "me gustaria que las acciones no esten fuera, si hay mas de una accion sobre algo como una tabla, ponla dentro de un dropdown menu mejor, de hecho eso se hace en practicamente todas las tablas, al final una columna de acciones, 3 puntos y salen las acciones posibles, pero no poner dos botones directamente en esa columna de acciones"
S3. User (verbatim): "realmente no me gusta el tipo de letra que estamos ocupando, no me gusta del todo, quisiera probar con Geist de google". Note: Geist is by Vercel and is published on Google Fonts under OFL. The current font is Inter (--font-sans).
S4. User decision: "Comparación visual primero (recomendado)". The parent's description of that option: "Armo en el canvas de diseño un antes y después de la lista y la orden abierta, en celular y escritorio, y decidís viéndolo antes de tocar código."
S5. Standing rules: S8 of procurement-order-confirmation (the MCP checks design, not only function; reusable improvements go to the system design; excellent UX/UI on desktop and mobile) and the no-ids rule.

## Tasks
T1 | S1-S4 | bounded writer (gentle-design) | pending | Canvas: purchase-order list and open order, before vs after, at 1440 and 390.
T2 | S3 | parent MCP | pending | Font comparison on the real app: Inter vs Geist screenshots (canvas artboards cannot load remote fonts).
T3 | S1-S3 | TBD | pending | After the user picks a direction: system design rules, shared components, then the Compras pilot.

## Log
L1. Original request verbatim (excerpt in S1-S3): "Bien hermano, creo que hay dos o tres cosas que vi mientras hacias las pruebas que no me gustaron del todo ... hay que hacer algun rediseno ux/ui, o que consideras que hay que hacer?? puedes investigar en internet lo que quieras para mejorar esto, reglas de ux/ui, ejemplos en dribble por ejemplo o sitios asi."
L2. Parent research: Visa DS (limit inline icon buttons, use row actions), TimelyCare (kebab even for one action; clickable row replaces "Ver detalles"), UXD hub (frequent action may surface, rest in kebab), progressive disclosure and details-on-demand literature ("shorten everything you can"). Geist is OFL, by Vercel, on Google Fonts. Proposal: a text-diet rule set, row click + ⋮ menu, and Geist via the single --font-sans token. The user chose S4 and a separate branch; O3c is merged locally at bd2e83f4.
