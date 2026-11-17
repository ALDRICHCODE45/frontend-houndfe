# chatbot-receipt-zoom live check (mocked API)
No backend was running (3000/3003 closed, needs a DB), so Vite (repo root, port 5198, `VITE_API_BASE_URL=http://127.0.0.1:3999`)
runs against a Playwright-intercepted API: synthetic auth session in localStorage (same contract as e2e/responsive/fixtures/auth.ts),
detail of a TRANSFER_RECEIPT request (IN_PROGRESS, assigned to the session user, RESOLVE allowed), receipt preview (jpeg rendered by
make-receipt.mjs), GET /sales/sale-1 (3 lines, one with a variant).  Run: `node run.mjs <1440|390> [provided]`; logs in run-*.log, shots in shots/.
Every non-GET is aborted. Source untouched.
