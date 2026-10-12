# Unified application shell

The dashboard shell follows the approved [v0 reference](https://v0.app/bdps-projects/chat/fKd2DWdQ6EU): a Manrope navbar/sidebar, restrained geometry, and coherent blue-grey light/dark surfaces. Routed page content is not globally rethemed; Products has an explicit palette bridge. Automated source and functional evidence does not establish rendered fidelity.

## Review path

1. Open Products in light and dark mode; compare the shell and workspace with the approved screenshots.
2. Expand and close sidebar groups, then collapse the sidebar and open a group popover.
3. Open global search, tenant/account menus and Products forms/menus; check surface consistency and readable focus states.
4. Check mobile navigation, scrolling and sidebar resizing. Visual review remains user-owned; no browser or live API checks were performed by the implementation agents.

## Theme boundaries

| Boundary                                  | Purpose                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `hf-shell`                                | Declares shell tokens without globally replacing Nuxt UI aliases.           |
| `hf-shell-*` chrome hooks                 | Paint only navbar/sidebar/workspace surfaces.                               |
| `hf-shell-portal`                         | Repeats the shell palette and Nuxt UI aliases on teleported shell surfaces. |
| `hf-shell-nav-portal`                     | Styles compact-navigation popup rows and their icon nodes.                  |
| `.hf-shell .products-visual`              | Maps Products presentation roles to the shell palette.                      |
| `hf-theme hf-ui hf-shell-products-portal` | Applies the same Products palette outside the shell ancestor.               |

CSS lives in `src/app/layouts/styles/unified-shell.css`; composition lives in `src/app/layouts/DashboardLayout.vue`. Products portal markers are additive; their existing foundation classes and business behavior remain intact. Caja and other legacy page controls retain their own boundaries.

## Palette and geometry

| Role              | Light     | Dark      |
| ----------------- | --------- | --------- |
| Workspace         | `#F3F6FA` | `#101720` |
| Navigation chrome | `#F9FBFD` | `#151E2B` |
| Panels/menus      | `#FFFFFF` | `#1B2736` |
| Main text         | `#1E3555` | `#E4EBF5` |
| Secondary text    | `#63748B` | `#9AAAC0` |
| Borders           | `#DCE3ED` | `#2D3B4D` |
| Action            | `#315CE7` | `#91B0FF` |

Native sidebar sizing uses pixels: default 256, minimum 232, maximum 320, compact 76. Navbar height is 65px, or 60px below the stylesheet's 700px breakpoint; the native mobile toggle retains a 44px hit area. Controls use 6px corners; panels use 12px. Products input-border tokens retain their foundation contrast instead of inheriting subtle chrome borders.

## Persistence change

The user authorized a one-time reset of historical sidebar width/collapse preferences. The fixed sidebar identifier `shell` uses the native key `hound-dashboard-sidebar-shell`. Historical generated keys are not migrated or deleted. New preferences use the stable key. Tenant selection, theme preference and application data are not reset.

## Functional constraints

Permission filtering and navigation destinations remain in the existing registry/access layer. Collapsed groups retain only their authorized children and expose them through Nuxt UI's native popover. The mobile drawer renders expanded regardless of desktop collapse state. Existing theme shortcuts, search, tenant actions and account handlers remain connected; no v0 demonstration controls or fake counters were added.

## User-feedback corrections

The brand row now reuses `/hounfeLogos/primary.png`, the actual asset used by the login screen, instead of v0's artificial wordmark. Sidebar groups start closed, including the group containing the current route; users can still expand or close them normally. Registry defaults are unchanged for other consumers, and permission-filtered compact popup destinations remain available.

The existing global-search trigger now has explicit shell background, border, icon/label, keycap and focus styles. A later selected-group hover rule fixes the POS heading's cascade while preserving its quiet resting state and the active destination's blue treatment.

The requested correction pass passed 148 focused tests across six files and 8,734 full-suite tests across 510 files, plus typecheck, build and diff checks. Scoped formatting passed afterward. Independent verification passed the closed-group, actual-logo and POS-hover requirements (148 tests across six files). It identified a remaining native UKbd background/ring leak; an observed RED regression preceded a scoped two-declaration keycap fix, after which 58 tests across two files passed. A targeted independent cascade recheck closed that final issue and passed those 58 tests once. Rendered light/dark review remains user-owned.

## Verification status

Before portal corrections, parent checks passed 129 focused tests, 8,712 full-suite tests, and the build. An observed missing desktop `inDrawer` prop caused a typecheck failure; passing explicit `false` resolved it, with typecheck and 129 focused tests passing afterward.

The first independent check passed 129 tests but blocked acceptance on compact popup ownership, direct icon colors and Products portal palette divergence. These findings prompted marker and stylesheet corrections with observed RED/GREEN tests. The corrected integration passed 183 focused tests across nine files and 8,723 full-suite tests across 510 files, with typecheck, build and diff checks passing. Independent targeted verification closed all three original blockers and passed the same 183 focused tests once. Build retains a nonblocking large-chunk advisory; LSP coverage was inconclusive on two paths and reported a deprecated alias hint/auxiliary warning, so no clean LSP result is claimed. Scoped formatting and the post-format check passed (183 tests across nine files). See `odd/tasks/unified-shell-v0.md` for current progress. No native review approval, commit or publication is claimed.
