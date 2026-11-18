# Selection without checkboxes + system-wide design compliance (FE)

Migrate every remaining checkbox to «Selección sin checkboxes» (docs/design-system.md §Selección sin checkboxes, pending P1 of catalog-settings-rows.md), then bring every screen up to the design system, starting with the screens below the public catalog's level (notifications settings named by the owner).

## Specs
- S1 «inicia por pasar los checboxes a "Seleccion sin checkboxes"»: no classic checkbox remains in the app (UCheckbox / input type=checkbox / table selection column / HfCombobox multiple options / EditorialAttributeCell lists / ~20 feature screens), each replaced by the pattern the rule table assigns (switch row, radio card, selectable rows with mark, toggle chips, segmented control, row mark, HfCombobox, explicit button / ConfirmModal), meeting the rule's accessibility checklist.
- S2 «y de paso te fijas que toda la ui del sistema cumpla con tu system design»: every screen complies with docs/design-system.md (tokens, inputs, tables, states, light/dark, mobile).
- S3 «tambien hay pantallas muy bonitas y otras no tanto, como por ejemplo, el catalogo en linea, es muy bonita, y aunque la pantalla de configuracion de notificaciones no es mala, no eseta al nivel ni de chiste»: screens below the public catalog's level are raised to it; notifications settings first.

## Tasks
- T1 | S1–S3 | explore | done — map in L2 (explorer mwliwpym-3-4sgz)
- T2 | S1 | worker | shared selection primitives in src/core/shared/components/selection/: HfSwitchRow (promote profile/PreferenceSwitchRow), HfRadioCards (promote catalog-settings CatalogStockPresentationField), HfSelectableRows (listbox multiselect, round mark, live count), HfToggleChips (one of the five copies), HfRowMark (24px mark, 44px hit, mixed)
- T3 | S1 | worker | core uses: DataTable SelectColumn → HfRowMark (EmployeesListView, PromotionsView); HfCombobox multiple → trailing check (EditorialAttributeField, EditorialPresentationSection); DateRangeFilter «incluir sin fecha» → switch; dropdown checkbox items (page size, theme → segmented; tenant → menu check)
- T4a | S1 | worker | admin/roles RolePermissionsSlideover (selectable rows + mixed group mark); customers CustomerUpsertSlideover; cash CashOpenSessionForm (explicit confirm); refunds SettleRefundSlideover
- T4b | S1 | worker | promotions PromotionForm, PromotionConditionsSection (switch rows + weekday toggle chips), VariantAccordionRow, FlatChecklistPanel (selectable rows)
- T4c | S1 | worker | products ProductUpsertSlideover (switch rows), EditorialPublication (explicit confirm), EditorialCareReviewDrawer (toggle chips); delivery-routes EligibleSalesPicker (selectable rows)
- T5 | S3 | design + worker | notifications settings redesign (canvas directions, then implement)
- T6 | S2–S3 | workers | design-compliance pass on the screens T1 ranks lowest
- T7 | S1–S3 | verify + browser | live check light/dark, 1440/390; full suite

## Log
- L1 Owner 2026-11-17 (verbatim): «Todos por favor, inicia por pasar los checboxes a "Seleccion sin checkboxes" y de paso te fijas que toda la ui del sistema cumpla con tu system design, tambien hay pantallas muy bonitas y otras no tanto, como por ejemplo, el catalogo en linea, es muy bonita, y aunque la pantalla de configuracion de notificaciones no es mala, no eseta al nivel ni de chiste. por ahora haz eso por favor.»
- L2 T1 map: 21 UCheckbox in 12 files + 2 native + HfCombobox multiple box (3 consumers) + 2 tables with selection column (EmployeesListView, PromotionsView) + 5 dropdown checkbox items. No EditorialAttributeCell exists (lists render via EditorialAttributeField → HfCombobox). Reusable: switch row ×3 feature-local (PreferenceSwitchRow most complete), radio card in catalog-settings, selectable rows in public catalog, toggle chips ×5 copies, HfSegmented in core. Notifications gaps: no subtitle/grouping, switch only on the control and three nested card levels, single-open accordion, raw USelectMenu recipients, bare sticky save button instead of HfSaveBar, own skeleton color, 1320px width. Lowest other screens: ProductDetailView UCard stack, PromotionForm, RolePermissionsSlideover, ProductUpsertSlideover, AssignCustomerSlideover, employee panels, VariantDetailModal, SaleDetail cards, CustomerUpsertSlideover, EligibleSalesPicker; raw Tailwind palette colors appear once (LoginOtpForm:67).
