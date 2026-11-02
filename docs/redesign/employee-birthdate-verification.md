# Employee birthdate and reopen verification

## Reproduced defects

In the real collaborator edit form, September1988 showed42 disabled cells and disabled backward navigation. The employee caller passed null minimum; the shared picker intentionally resolves null/omitted minimum to today. Cancelling and reopening the same employee also produced an empty form: reset cleared state but refill watched only the employee reference.

## Correction

- Employee birthdate explicitly uses the supported Gregorian minimum `0001-01-01`, without inventing a business-age cutoff. Other callers retain their existing minimum/default policy; no maximum, hire-date rule or backend validation was added.
- Shared `DateFieldPopover` uses `CalendarDate.toString()` for padded ISO and `toDate(getLocalTimeZone())` for display. This prevents years1–99 becoming1901–1999 through the multi-argument JS Date constructor.
- Edit form refills on opening the same record; a late leave event cannot clear an already reopened form. Cancel remains local and performs no employee mutation.

## Evidence

Native-component RED tests observed a disabled historical date, year0001 displayed as1901, and an empty birthday placeholder after same-record reopening. Job12 passed59 tests across employee integration, existing employee mapper/actions and shared datepicker suites, then Vue-aware test typechecking, full application build and diff checking. Existing build chunk-size warnings remain.

Actual rebuilt preview4173/local API,390/1440px light/dark:23September1988 can be selected into the draft; backward month/year navigation is enabled; Escape preserves the parent; Cancel/reopen restores22September1988 and original name Luis. No save, termination, reactivation or financial write was submitted. Settled calendar dimensions268×328px, contained in all four modes.

Captures: `odd/evidence/hf-ui-complete-audit/employee-birthdate-fixed-{390,1440}-{light,dark}.png`. Mobile-dark and desktop-light inspected visually. Initial geometry captured during animation was discarded in favor of settled captures.

## Limits

Independent verifier `mvypp4nb-d-8ypk` returned bounded PASS:59 tests/3 files in an isolated scratch copy,7.70s; no severe findings. Screenshots and preserved consumer minima were independently inspected. The late leave-event guard is source-verified rather than explicitly race-injected; additional early-year/timezone boundaries remain outside that verification. Risk:item3 — Sales, quotations and employee screens share the datepicker. This does not certify every consumer/date policy or complete collaborator coverage. Other selectors, manager picker and full contrast remain pending.

LSP reports three Vue-import findings and two inconclusive Vue-file checks; Vue-aware test compiler and application build passed. This is not a clean-LSP claim. Native assessment remains unavailable due untracked declaration, not approved.
