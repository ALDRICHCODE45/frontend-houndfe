# HoundFe design-system pilot: Caja

This bounded integration adapts the existing Caja presentation components to the approved retail reference. It reuses the existing workspace/forms/panels and a scoped token adapter, rather than introducing new component wrappers or duplicate business state. It does not change financial commands or permissions, remove Nuxt UI, or extend the design to other screens.

## Foundation and adapter

- `src/core/shared/design-system/houndfe-theme.css`: opt-in `--hf-*` tokens for light/dark surfaces, text, actions, selection, status, typography, and geometry. Future consumers can use `.hf-theme`.
- `src/features/POS/cash-register/styles/cash-visual.css`: Caja-specific adapter and existing presentation primitives. Existing views already import this stylesheet; no Vue contracts change.
- `.cash-visual` and `.cash-workspace` opt in for this pilot only. Other screens retain the existing theme and Inter font.
- Manrope loads from Google Fonts when available. This is a scoped typography choice, not a package dependency. Offline or blocked-font use falls back to system fonts.
- Primary controls use vivid blue in light mode and a legible light-blue/dark-text pairing in dark mode. Gold is decorative, not a financial status indicator.

Teleported Nuxt UI menus and dialogs outside these scope classes retain the existing theme. Their migration requires a separate owned presentation boundary; this pilot does not claim complete overlay coverage.

## Local preview

For the isolated integration candidate, from the original checkout:

```bash
cd .worktrees/houndfe-caja-integration
npm run dev -- --host 127.0.0.1 --port 5176 --strictPort
```

After the reviewed files are promoted, run the same `npm run dev` command from the original checkout instead, without the `cd` line. Open `http://127.0.0.1:5176/pos/caja`. No `.env` was copied to the isolated candidate. The existing API client defaults to `http://localhost:3000`; set `VITE_API_BASE_URL` explicitly if your development backend uses another address. This preview is a real application, not the offline static specimen: use a test account and test data when exercising commands.

Visual smoke and acceptance belong to the user. Check Caja opening, selected task, inputs, session context, and reception in light/dark mode and narrow layouts. Font loading, overlay appearance, and precise input geometry require this manual review; unit tests do not prove visual fidelity.

## Provenance and scope

`artifacts/houndfe-design-preview/integration-baseline.json` in the original checkout records the actual pre-integration source hashes, the unreviewed baseline commit, and the 24 allowed paths. Imported auth/POS/Caja work is prerequisite context, not new integration authorship. Native review uses the complete integration commit against that explicit baseline; the earlier three-file pilot approval does not approve the rest of Caja. Promotion requires independent verification, the full candidate's native review, and unchanged original-source hashes. This document is not itself evidence of approval or delivery; no publication or global rollout is authorized.
