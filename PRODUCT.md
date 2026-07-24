# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: cashiers and sellers serving customers at a physical branch counter, from a desktop computer. This is the principal, time-pressured interaction.

Secondary: inventory managers (products, promotions), HR staff (colaboradores, documents, time-off approvals), tenant administrators (users, roles, notification config), and super admins who manage multiple branches/sucursales and memberships across the account.

## Product Purpose

HoundFe is a multi-branch point-of-sale (POS) and retail back-office system with unified human-resources (RR.HH.) management. It exists so a business operating several sucursales can run sales, inventory, promotions, customers, and employees from one platform instead of disjointed tools. Success means: the cashier checks out fast at the counter, and the administrator controls every branch without switching platforms.

## Positioning

Two mechanisms a neighboring product could not truthfully copy:

1. **Native multi-branch (multi-tenant):** one account administers multiple sucursales and memberships out of the box — not a workaround.
2. **Unified POS + HR:** point of sale and employee management (documents, leave, salaries, expiry tracking) live in a single product, not two bolted together.

Beyond these, HoundFe bundles further capabilities the owner considers differentiating.

## Operating Context

- **Environment:** physical branch counter, desktop, web browser (SPA).
- **Flow:** login -> tenant/sucursal selection -> dashboard -> POS / HR / Admin workflows.
- **Core workflows:** new sale, sales list, sale detail (with PDF receipt download), products, promotions, customers, orders; HR (colaboradores, expiring documents, pending approvals); admin (users, roles, tenants/memberships, notifications).
- **UI language:** Rioplatense Spanish with voseo throughout.
- **Navigation:** sidebar + command palette driven by a single registry (`navigation.registry.ts`). Groups: POS, RR.HH., Admin, Sistema.

## Capabilities and Constraints

- **Stack:** Vue 3.5 SPA + Vite 7 (not Nuxt); Nuxt UI 4 used as a Vite plugin; Tailwind v4 CSS-first (`@theme`); Pinia; TanStack Vue Query + Vue Table; CASL for authorization.
- **Palette:** primary = amber, secondary = rose, neutral = zinc (source of truth: `vite.config.ts`).
- **Font:** Outfit (Google Fonts), set as `--font-sans`.
- **Auth:** JWT, multi-tenant with memberships; permission-based via CASL (`AppAction` x `AppSubject`), not hardcoded role names.
- **Public surface:** customer catalog per branch (`/catalogo/:branchSlug`).
- **No i18n framework:** UI strings are hardcoded Spanish.
- **a11y:** inherits accessible primitives from Nuxt UI 4 (Radix-based: ARIA, keyboard nav, focus management); no custom a11y configuration.

## Brand Commitments

- **Name:** "HoundFe" (never "Hounde"). Logo assets at `public/hounfeLogos/primary.png` and `secondary.png`.
- **Primary color:** amber (fixed).
- **Voice:** Rioplatense Spanish with voseo.
- **Fixed stack:** Nuxt UI 4 + Tailwind v4.
- **Authorization model:** CASL permission-based (do not revert to hardcoded roles).

## Evidence on Hand

- Specs under `openspec/specs/` (`notification-config`, `promotions`, `sales`) and `openspec/changes/` (`pos-price-list-tiers`, archived `bxgy-reward-badge-label`).
- `README.md` is the default Vue+Vite starter boilerplate (no product information).

## Product Principles

1. **Counter first:** the cashier checks out fast; everything else serves that moment.
2. **One platform for many branches:** multi-tenant is native, never a workaround.
3. **POS and HR as one product:** commercial operation and people management share context.
4. **Permissions over roles:** authorization is modeled by actions and subjects, not by role names.

## Accessibility & Inclusion

- Accessibility inherited from Nuxt UI 4 primitives (Radix-based: ARIA roles, keyboard navigation, focus management).
- No product-specific a11y requirement established yet. UI is Spanish-only for now (not user-configurable).
