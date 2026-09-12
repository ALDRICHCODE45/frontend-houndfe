```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:9f500e7215100e8401810474e7a2faddf5679837a231d39769d68f7349e2a420
verdict: fail
blockers: 1
critical_findings: 2
requirements: 0/8
scenarios: 0/12
test_command: pnpm test:unit --run src/app/router/__tests__/router.spec.ts src/main.spec.ts src/features/catalog/views/__tests__/CatalogView.spec.ts
test_exit_code: 0
test_output_hash: sha256:6a8795fe9538e42388c1b36d6fb009b3265beb004d3277b99cc389a481e625a3
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:8ce16f4ffa2fc744450115ecb6444abc88b3ddc34621a33324a4500150528ccd
```
# Historical broad-D1 verification
- P0.1 scoped checks passed: focused unit 21/21, responsive 2/2, both type checks, build, and diff checks.
- Whole-change verification failed because D1 discovery requirements remain unimplemented; this change is not archive-ready.
- The full suite passed 6107 assertions but exited 1 on two uncaught Reka toast timer errors in unchanged `SaleDetailView.test.ts`; causality remains unknown.
- Aggregate TDD evidence, an inherited router-test tautology, and mocked cleanup internals remain recorded limitations, not proven P0.1 production defects.
- P0.1 ownership moved to `../public-catalog-anonymous-bootstrap/`; this report remains historical evidence only.
