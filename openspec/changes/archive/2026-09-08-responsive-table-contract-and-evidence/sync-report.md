# Post-archive Canonical Sync Report — `responsive-table-contract-and-evidence`

> Phase: `sdd-sync` · Store: `openspec` · Date: 2026-09-08
> Source: archived change at `openspec/changes/archive/2026-09-08-responsive-table-contract-and-evidence/`
> Authorization: the parent explicitly authorized the separately deferred post-archive sync by selecting **“Sync OpenSpec primero”**. No Git delivery was authorized or performed.

## Status

**synced.** Three new canonical domains were created by byte-identical copies of their archived source specifications. This is a documentation-only canonical merge; the archived delta specifications remain unchanged.

## Source-to-canonical mappings

| Domain | Source | Canonical destination | Requirements | Scenarios | SHA-256 source/canonical |
|---|---|---|---:|---:|---|
| `browser-responsive-evidence` | `specs/browser-responsive-evidence/spec.md` | `openspec/specs/browser-responsive-evidence/spec.md` | 8 | 16 | `b700526407cee8a237af7a69321786102b539c4093df785c07646532a3ec9526` |
| `responsive-table-policy` | `specs/responsive-table-policy/spec.md` | `openspec/specs/responsive-table-policy/spec.md` | 8 | 14 | `d85e397568319918262b7e9249d7f22c1b5b67d4d80fa0abf8cebe63e3790c2c` |
| `test-evidence-boundary` | `specs/test-evidence-boundary/spec.md` | `openspec/specs/test-evidence-boundary/spec.md` | 5 | 10 | `6132565aa6310b8834e555be797224e4586b618983fcb958276ef7aec5f4bbc7` |
| **Total** | | | **21** | **40** | |

## Delta summary

**21 ADDED / 0 MODIFIED / 0 REMOVED.**

- `browser-responsive-evidence`: BRE-REQ-001 through BRE-REQ-008 added.
- `responsive-table-policy`: RT-REQ-001 through RT-REQ-008 added.
- `test-evidence-boundary`: TEB-REQ-001 through TEB-REQ-005 added.

The canonical domains did not exist before this sync. There are no `## RENAMED Requirements` deltas, no destructive operations, and no same-domain active-change collisions.

## Guardrails and verification

- Parent-provided status selected archived change `responsive-table-contract-and-evidence`, store `openspec`, with `apply`, `verify`, and `archive` all `all_done`.
- `actionContext.mode` is `repo-local`; all writes are under the supplied workspace and allowed edit root.
- Archived `verify-report.md` is a valid `pass_with_warnings` result with 0 blockers, 0 critical findings, 21/21 requirements, and 40/40 scenarios.
- Exactly three authorized canonical `spec.md` files were created. Each is byte-identical to its archived source; no canonical wrapper was added.
- Canonical headings total 21 `### Requirement:` and 40 `#### Scenario:` entries.
- No tests, builds, installs, or runtime commands were run. Verification is structural plus the already-complete archived verification evidence.
- `git diff --check`, Git status, HEAD, test-results integrity, and native archived status are checked after this report is written.

## Preserved warning disposition

The evidence contract remains **pass_with_warnings**. Product conformance remains **RED by design**, 25 inventory surfaces remain unverified, and deferred advisories remain deferred. This canonical sync does not change, mitigate, or relabel those dispositions.

## Next recommended

No further SDD phase is required for this archived change. Any product remediation, inventory coverage, or advisory work requires a separate authorized change.
