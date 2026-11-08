# Detail page frame and mobile navbar

One shared frame for every detail page: header pinned at the top with no strip above it, and a full-width scroll area so the page scrolls from anywhere. Hide the desktop sidebar-collapse button on mobile so the breadcrumb gets its room back.

## Specs
- S1 «arriba del header en donde dice el numero de la venta y esta el boton de accion para volver atras, hay un espacio en blanco, una linea que se ve muy mal» — no strip above the detail header (sale).
- S2 «para hacer scroll del detalle solo lo puedo hacer dentro de un ancho maximo» — the scroll area spans the full content width; the max-width only centres the content (product, promotion).
- S3 «Todos los detalles iguales (Recomendado)» — sale, product, promotion, quotation, employee and delivery-route details share one frame: header pinned (not scrolling away), page scrolls from anywhere; rule written in the design system.
- S4 «en la vista mobile, hay algunas paginas que el breadcrum esta amontonado y se ve muy mal» + «Sí, es eso» — the desktop sidebar-collapse button is hidden below lg, next to the mobile menu toggle.

## Tasks
- [x] T1 S4 Navbar: hide the collapse button below lg — parent — 6858ce77
- [x] T2 S1-S3 Shared DetailPageFrame (src/core/shared/components/DetailPageFrame.vue) (header slot pinned, full-width scroller, inner max-width, bottom slot) — parent
- [ ] T3 S1-S3 Migrate sale, product, promotion — worker
- [ ] T4 S3 Migrate quotation, employee, delivery route — worker
- [ ] T5 S1-S4 Design-system rule, browser checks (1440, 1920, 390, light/dark), full suite — parent

## Log
- L1 User: «hay algunas pantallas, en especial pantallas de "detalles" como detalles de ventas y detalles de productos, etc.. en las hay un error o algo molesto con lo que vengo lidiando desde hace tiempo, y eso es que no puede haber scroll completo de toda la pagina sin que haya un margin arriba, te explico: [Image#1] mira eso, si notas, arriba del header en donde dice el numero de la venta y esta el boton de accion para volver atras, hay un espacio en blanco, una linea que se ve muy mal, pero puedo hacer scroll por toda la pagina sin ningun problema, y ahora en el detalle del producto: [Image#2] si te das cuenta, no existe esa linea arriba del header con el nombre, el estado la fecha de actualizacion y el boton para volver, peroo para hacer scroll del detalle solo lo puedo hacer dentro de un ancho maximo, me sigues?? eso es el primer problema y el segundo es que en la vista mobile, hay algunas paginas que el breadcrum esta amontonado y se ve muy mal, por favor investigalo hermano. alguna duda?»
- L2 Explorer findings: shell body (vite.config.ts:112-115) scrolls with p-4/sm:p-6; sale/product/promotion cancel it with -m-4 sm:-m-6 h-[calc(100%+…)]. Sale header is sticky top-0 inside the padded body → offset by the padding (strip). Product (:2124) and promotion (:254) make the max-width column the scroller. Quotation, employee, route scroll the body and their headers scroll away. Navbar: unlayered .hf-shell-icon-button {display:inline-flex} (unified-shell.css:557) beats Nuxt UI's `hidden lg:flex` on the collapse button.
- L3 Owner decisions: «Todos los detalles iguales (Recomendado)»; breadcrumb cause «Sí, es eso».
- L4 T1 done (6858ce77): .hf-shell-collapse hidden below 1023.98px; browser 390 «Reembolsos pendientes» complete, collapse visible at 1440. Browser proof of the strip: sale header top 89 with sticky, 65 (flush under the 65px navbar) after removing sticky; it also overlapped the scroller by 24px.
- L5 T2 done: DetailPageFrame.vue — root -m-4 sm:-m-6 h-[calc(100%+2rem)] sm:h-[calc(100%+3rem)] flex flex-col min-h-0; [data-slot=header] w-full shrink-0 (never sticky); [data-slot=scroll] w-full min-h-0 flex-1 overflow-y-auto overflow-x-hidden with prop scrollTestid; [data-slot=footer] for the mobile bar; header/footer wrappers only when the slot is used; attrs/classes fall through to the root. 6 tests.
