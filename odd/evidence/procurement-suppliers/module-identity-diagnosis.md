# Evidence harness module-identity correction

## Observed failure (parent MCP evidence)

The corrected self-contained harness completed POST `/auth/login` 200, GET `/auth/me/permissions` 200 and GET `/auth/me` 200. Its imported router reported `/procurement/suppliers`, but the mounted DOM still displayed `Iniciar sesión`; the supplier search was absent. No supplier requests/mutations, out-of-scope requests or runtime errors were reported. This is the observed failing browser check for this correction, not evidence of a product defect or unavailable MCP. The child did not execute the browser.

## Read-only source and served-module evidence

Production `src/main.ts:9` imports the router through `@/app/router`; `src/main.ts:11` imports the auth store through `@/features/auth/stores/useAuthStore`. `src/main.ts:24,28,32` creates the application's Pinia, installs that router and obtains its auth store with the explicit Pinia instance.

The evidence server changes the Vite root (`start-runtime-server.mjs:10,24`) and maps both `@` and `/src` to the original source tree (`start-runtime-server.mjs:27`). Browsers identify ESM modules by resolved URL, not by equivalent filesystem contents.

Read-only frontend GETs on port 43179 returned 200 and showed:

| Served resource | Line | Actual emitted dependency |
| --- | --- | --- |
| `/` | 18 | Entry script `/src/main.ts` |
| `/src/main.ts` | 8 | Router `/@fs/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/src/app/router/index.ts` |
| `/src/main.ts` | 10 | Store `/@fs/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/src/features/auth/stores/useAuthStore.ts` |
| `/src/main.ts` | 12 | App `/@fs/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/src/App.vue` |
| `/@fs/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/src/features/procurement/suppliers/views/SupplierView.vue` | 22 | Same canonical `/@fs/.../src/features/auth/stores/useAuthStore.ts` URL |
| Same SupplierView | 23 | Adapter `/@fs/home/aldrich_coder45/Desktop/workspace/houndfe/frontend-houndfe/src/features/procurement/suppliers/api/suppliers.api.ts` |

The prior harness instead imported `/src/app/router/index.ts`, `/src/features/auth/stores/useAuthStore.ts` and `/src/features/procurement/suppliers/api/suppliers.api.ts`. Those alternate URLs also return 200, but are different browser module identities. The router module creates a router at evaluation time; importing it again under an alternate URL is not a reference to the router already installed by main. No duplicate auth-store state is independently claimed: Pinia can reuse stores by ID. The fix explicitly selects mounted Pinia rather than relying on active-instance inference.

## Minimal evidence-only correction

- Browser ESM imports now use the exact `/@fs/...` URLs emitted by the real main and SupplierView.
- Before login, wait for the mounted application's router/Pinia to exist. The Vue mount reference is read only; no app state is dumped, patched or replaced.
- Compare the imported canonical router by reference with the router installed in the mounted app's `config.globalProperties.$router`; fail before login if they differ.
- Obtain auth with public `useAuthStore(mountedPinia)` and use the same explicit Pinia for logout. Real login, permissions and transport remain unchanged.
- Require visible supplier heading and search after navigation, before attempting any mutations. All existing CRUD, persistence, permissions, conflict, uncertainty and visual checks remain intact.
- The generator rejects browser imports outside the three exact canonical module URLs and regenerates both self-contained expressions.

Static URL comparisons against the running frontend and empty-VM expression parsing passed. These are not a browser GREEN. Parent must execute the corrected MCP script and inspect the result/screenshots.

No server/config/production changes, credential reread, backend calls or process lifecycle operations were performed by this correction. Existing server ownership was observed as PID 1716749 on 127.0.0.1:43179. No restart is required. The main verification report remains unchanged and no acceptance is issued.
