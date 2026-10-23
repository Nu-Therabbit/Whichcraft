# Review disposition — specification and ticket plan

Date: 2026-10-24
Status: resolved-with-document-corrections

The uploaded review was checked against the current repository. It is feedback to verify, not authority to commit unrelated user work. This follow-up changes planning documents and ticket gates; it does not implement the redesign or claim Windows acceptance.

| Review item | Disposition | Verified fact / correction |
| --- | --- | --- |
| 1. D/E/A/etc. acceptance families do not exist | Not upheld as stated; navigation clarified | The [original acceptance criteria](../../docs/acceptance-criteria.md) already contain 74 table-row IDs across D/E/A/U/T/I/S/R/P/F/C/X, under numbered sections 1–11 and the additional-environment section. Q IDs are decision sources. The spec now maps actual section titles and ID ranges to suites 19/20, and those tickets name their case IDs explicitly. No imaginary family or renamed acceptance document was introduced. |
| 2. No early inventory of legacy UI actions | Confirmed and corrected | A [source-audited action/parity baseline](ui-action-inventory.md) now lists observed entry points, destinations, owners and required evidence. Ticket 02 validates and extends it before refactoring. Ticket 18 checks that maintained inventory instead of discovering actions after migration; 21 rechecks affected rows after cleanup. |
| 3. Ticket 18 deletes legacy UI before actual Windows acceptance | Confirmed and corrected | Split the originally combined scope. Ticket 18 enables a candidate default while retaining a documented legacy fallback. Suites 19/20 test that build. New ticket 21 is blocked by both suites and owns final removal plus affected-flow/build verification. Required fail/blocked results do not pass the removal gate. This adds one housekeeping ticket, not a new product feature. |
| 4. Read-only overview is unnecessarily blocked by the write coordinator | Accepted and corrected | Ticket 07 now depends only on 02 and owns its query/account/request isolation without adding a new environment-write path. Tickets 08 and 09 explicitly require 04; writing still waits for coordination. After 02, 03 and 07 can progress independently. |
| 5. Implementation branch origin is ambiguous | Confirmed and corrected | The implementation starts from main and carries reviewed documentation only. At review time main is `7dff397`; starting implementation must check the actual then-current main. A desktop design is referenced at `6bc41ad`; the throwaway branch, app gate, fixture components/styles and prototype script are not merged into production. |

## Smaller comments

- Story 9 now explicitly includes Android/MSVC as Inventory Only alongside the six switchable Tool Kinds, matching the overview and Windows tickets.
- The extensive user stories remain as a record of agreed behaviour; tickets remain the executable-sized handoff, so repetition is not a reason to remove acceptance requirements.
- The original review recommended checking the pre-existing uncommitted Cargo.toml change before committing so it would not be mixed into documentation commits; it did not recommend committing that file. The file was left untouched and excluded from this documentation work.

## Resulting gates

- Initial frontier remains 02, 05, 06.
- After contract expansion 02: read-only overview 07 and Environment migration 03 can proceed independently.
- First new switching write 08 waits for 04, 05, 07; Environment writes 09 wait for 04, 07.
- Installation 13 waits for 04, 06, 07 so app-lifetime progress and coordinated inventory refresh are available explicitly.
- Candidate cutover 18 waits for the feature-complete migrations, but does not remove legacy fallback.
- Candidate fallback is selected by a documented startup flag after closing the existing instance and relaunching. Only one presentation mounts per process, on the shared migrated composition/controllers/coordinator from 03/04; neither mode creates a second bootstrap/listener/write path. Verify both starts and persisted-state/recovery readback; in-memory work does not migrate across restart. Suites 19/20 accept the new UI and record fallback smoke/comparison separately.
- Suites 19 and 20 both wait for candidate 18 and may be verified independently.
- Final contract/removal 21 waits for passing Windows suites 19 and 20.

The published implementation tracker now has 20 tickets, numbered 02–21, plus the existing resolved prototype 01. See the [ticket index](tickets.md), [spec](spec.md), and [architecture review](architecture.md). Link/reference checks, original case-ID coverage, and the ticket graph are validated as documentation checks; no product test execution or implementation completion is claimed here.

## Follow-up review

All three follow-up comments were confirmed: 13 had lost its transitive dependency on 04 when 07 was unblocked; fallback selection/lifetime was unspecified; and the Cargo.toml comment above had mischaracterized the original advice. The dependency, restart-only single-presentation fallback contract, and wording are now corrected in the relevant tickets and source documents.
