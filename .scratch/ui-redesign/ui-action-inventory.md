# Legacy UI action inventory and parity map

Date: 2026-10-24
Status: validated-at-expand-02
Production baseline observed: `main` at `7dff397`; legacy entry points re-audited on branch `feat/ui-redesign-02-feature-contracts` before contract refactor (2026-10-24).

This is an early source-based inventory, not a claim of tested production parity. Ticket 02 owns validating/extending the baseline against the implementation starting point before behaviour changes. Tickets that migrate a flow attach verification evidence to its rows. Ticket 18 checks this existing list for candidate cutover; ticket 21 checks it again after removal. Neither late ticket starts the audit from scratch.

Use the current implementation behaviour, the [spec](spec.md), and the original acceptance criteria together. This map does not override existing validation, permission, journal, or rollback contracts. Header and overflow entries for the same action count as one capability with multiple discovery points. If source behaviour differs from requirements, record the discrepancy rather than silently treating the defect as parity.

## Observed actions and owners

Ticket 02 re-checked every row against current production source (`App.tsx`, `AppHeader`, `Sidebar`, `DetailPanel`, `ToolsPanel`, `SnapshotPanel*`, `ImportExportPanel`, `CheckCommandPanel`, modals). Legacy entry points remain reachable; migration evidence for new UI homes is still pending on owner tickets. Owners below identify who must preserve the capability, not whether the ticket is unblocked.

| ID | Existing entry / capability observed in source | New home | Implementation owner | Evidence to attach |
| --- | --- | --- | --- | --- |
| UI-01 | AppHeader Refresh; ToolsPanel Refresh and focus refresh | Developer tools command bar; scoped refresh | 07, 04 | 02: legacy refresh in `AppHeader` / `ToolsPanel` confirmed; post-migration TBD |
| UI-02 | AppHeader Tools entry opens the tool modal | Developer tools overview and inspector | 07 | Six Tool Kinds, roots/ownership/counts, unavailable and mismatch states |
| UI-03 | Sidebar search, scope, sorting, secrets filter, variable selection | Environment / Variables | 09 | Equivalent filtering/selection and supported account context |
| UI-04 | Sidebar copy and secret-value display treatment | Environment / Variables | 09 | Correct value copied and existing secret-display behaviour preserved |
| UI-05 | New-variable action and NewVarModal | Environment / Variables | 09 | Validation and staged creation retain value kind/scope |
| UI-06 | DetailPanel edit/type/separator/list/PATH editors | Environment / Variables | 09 | String/expand-string/list editing, entry validation/reordering and metadata |
| UI-07 | DetailPanel stage delete, stage edit, unstage/discard | Environment / Variables | 09 | No Registry writes before explicit apply; no silent loss across navigation |
| UI-08 | Local editor history and global Ctrl+Z/redo handling | Contextual edit undo/redo | 09 | Editor undo and staged-history semantics remain distinct from tool Apply Undo |
| UI-09 | AppHeader staged count; StagedModal review, discard and apply | Environment pending-changes review | 09 | Actual diff, progress, error, types, scopes and atomic apply contract |
| UI-10 | AppHeader external-changes entry and DiffPanel | Environment external-change review/status | 17 | Accepted/reverted changes and fresh baseline preserve external edits |
| UI-11 | DiagnosticsPanel stage actions | Environment diagnostics | 17 | Findings and action scope, refreshed read models |
| UI-12 | PathBanner / DetailPanel add-app-directory-to-PATH and dismiss | Environment PATH maintenance | 09, 17 | Applicable account/scope, proposal and explicit staging/dismissal |
| UI-13 | AppHeader Snapshots toggle; resizable SnapshotPanelDock | Environment / Snapshots | 10 | Capability remains discoverable without requiring the old dock layout |
| UI-14 | Snapshot save/list/rename/delete | Environment / Snapshots | 10 | Existing saved data and confirmation/error/loading behaviour |
| UI-15 | Snapshot preview, saved-snapshot comparison and stage restore | Environment / Snapshots | 10 | Value kinds, additions/removals, legacy formats and explicit apply |
| UI-16 | AppHeader or overflow Import / Export | Environment / Import / Export | 11 | Both entry modes and real file interactions reachable |
| UI-17 | Import file/text, format, selection, merge/replace, stage | Environment / Import / Export | 11 | Parser, validation, legacy-kind handling and no premature writes |
| UI-18 | Export All/User/System/Custom, format and secret confirmation | Environment / Import / Export | 11 | All existing formats, produced files, cancellation and confirmations |
| UI-19 | AppHeader or overflow Check command | Environment / Check command | 12 | Name/full-path/PATHEXT, ordered hits, full-path status and no-match |
| UI-20 | AppHeader run-as-admin/status and local-account picker | Environment account/permission controls | 09, 18 | Preserve supported account editing; tool UAC remains operation-scoped rather than requiring whole-app elevation |
| UI-21 | AppHeader theme and language controls, including overflow | Shell preferences / Settings | 07, 18 | Existing supported themes/languages, accessibility and persistence |
| UI-22 | App update availability/link | Shell status / About or Settings | 18 | Production update status and destination remain reachable |
| UI-23 | GitHub/upstream link and LicensesPanel | About / source / licences | 18 | Useful product source and inherited attribution remain reachable |
| UI-24 | Tool tab/installation selection, plan preview, dismiss and apply | Developer tools inspector and plan review | 08 | Exact reviewed plan, stale/cancel/UAC/error paths and actual readback |
| UI-25 | ToolsPanel Undo last apply | Developer tools / operation status | 08 | Whichcraft-only reversal and conflict handling |
| UI-26 | ToolsPanel Check in shell and Open terminal | Developer tools command/inspector actions | 12 | Shell Resolution is separate; launched processes get fresh environment |
| UI-27 | Install version, remote versions, choose version/store and install | Developer tools installation flow | 13 | Download/disk/mise status, first-use confirmation and progress |
| UI-28 | Check updates, update/repoint and old-installation removal offer | Developer tools update flow | 15 | Same-line install → switch → profile handling → removal offer |
| UI-29 | Uninstall, choose replacement, confirm, open folder/rescan | Developer tools removal flow | 14 | Actual removal method, refusal/in-use, affected profiles and incomplete/cancelled outcomes |
| UI-30 | SDK tab and supplemental Python information | Developer tools / Inventory Only details | 07 | Android/MSVC display only; Python launcher/Store stub remain separate |
| UI-31 | Profile list/create/delete/check-missing/apply/install-missing | Tool profiles | 16 | Partial pins, match status, missing installations and real apply |
| UI-32 | Tool settings: store, history, Scan Roots and terminal | Settings | 13 | Existing saved settings and old stores remain usable |
| UI-33 | Plan PATH cleanup and summary | Environment PATH maintenance | 17 | Preview/Apply/Undo; expanded variable entries not falsely removed |
| UI-34 | RecoveryBanner resume/roll back; unfinished removal notices | App-lifetime operation status and recovery | 17, 14 | Reopen/readback/recovery remains accessible outside a tool modal |
| UI-35 | Loading, Registry/account errors and apply/install failure status | Owning workspace and shared status | 03, 04, 07, 18 | Failures do not hide behind unmounted panels or leave busy/write admission stuck |
| UI-36 | Sidebar/dock resizing, keyboard focus and responsive header overflow | Desktop pane/layout and accessible navigation | 07, 18 | Equivalent access at 900×600 and 1200×760, no requirement to retain obsolete dock geometry |

## How to maintain this baseline

- Before migration, ticket 02 checks source and reachable UI at the chosen `main` base, captures any omitted action, and assigns it an owner. Completing this inventory and characterization is part of the first ticket, not deferred to cutover.
- Each migration ticket records its corresponding rows as verified or identifies a concrete unresolved regression; do not use an unchecked row as proof of parity. Record build/environment details when verification uses Windows.
- Ticket 18 requires every capability to have a working destination or an explicit documented disposition. It enables the new default in a candidate build while retaining the legacy fallback for acceptance.
- Tickets 19/20 use the candidate build and the explicit case mapping in the spec. Required failures or blocked cases do not count as passing the removal gate.
- Ticket 21 removes legacy presentation only after both Windows suites pass, then rechecks the relevant parity rows and packaged build. Preserve backend services, persisted data and any compatibility surface still required by supported callers.
