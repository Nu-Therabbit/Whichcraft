# Whichcraft desktop UI — tool overview and Environment workspace

Status: ready-for-agent
Date: 2026-10-24

## Problem Statement

ผู้ใช้ต้องการให้ Whichcraft ช่วยค้นหา ติดตั้ง สลับ และถอนการติดตั้งเครื่องมือพัฒนาบน Windows แต่หน้าแรกปัจจุบันยังมีลำดับการใช้งานแบบ Envarly: เริ่มจากตัวแปร Environment และเปิดงานเครื่องมือผ่าน modal ที่รวมหลายคำสั่งไว้ด้วยกัน ผู้ใช้ต้องเข้าใจ PATH และค้นหาปุ่มจำนวนมากก่อนทำงานหลักได้ จึงรู้สึกว่าแอปใช้ยากและไม่มีตัวตนของ Whichcraft ชัดเจน

ผู้ใช้เลือกโครงภาพรวมเครื่องมือแบบ A จาก prototype แต่ต้องการรูปลักษณ์และความหนาแน่นแบบโปรแกรม desktop มากกว่าหน้าเว็บไซต์ และต้องไม่ทำฟีเจอร์เดิมอย่าง Snapshots, Import / Export และ Check command หายไปเมื่อเปลี่ยนหน้าจอ

prototype ล่าสุดแสดงตำแหน่งและ flow ได้ แต่ยังใช้ข้อมูลจำลอง การแก้ Environment แยกจากข้อมูลเครื่องมือ และไม่มีผลต่อ Windows จึงยังใช้แทนแอปจริงไม่ได้

## Solution

ให้ Whichcraft เปิดมาที่ภาพรวมเครื่องมือพัฒนาแบบ desktop ที่กระชับ เห็นการติดตั้งที่มีผลจริงของแต่ละเครื่องมือทันที เลือกเครื่องมือเพื่อดูการติดตั้ง เปรียบเทียบผลที่จะเปลี่ยน และยืนยันก่อนเขียนค่าจริง แยกการเลือกออกจากการติดตั้งที่มีผลจริงและผลใน shell อย่างชัดเจน

ใช้ navigation หลักสี่ส่วน: Developer tools, Tool profiles, Environment และ Settings งานเครื่องมือเป็นหน้าหลัก รายละเอียดอยู่ในแผงด้านข้าง ส่วนงาน Environment รวมไว้ในสี่แท็บ Variables, Snapshots, Import / Export และ Check command โดยยังรักษาความสามารถของแอปเดิม ไม่ลดเหลือความสามารถจำกัดตามข้อมูลจำลองใน prototype

แทน UI เดิมด้วย UI ของ Whichcraft และใช้โค้ดฐานที่ fork จาก Envarly ต่อเฉพาะส่วนที่ยังทำงานจริง เช่น Environment backend, PATH, snapshots, import/export และการตรวจคำสั่ง ผู้ใช้ไม่ต้องติดตั้งหรือเปิดแอป Envarly แยก การเปลี่ยน UI ครั้งนี้ไม่ใช่การเขียน backend ของ Windows ใหม่

## User Stories

1. As a Windows developer, I want Whichcraft to open on Developer tools, so that I can manage my toolchain without first navigating an environment-variable editor.
2. As a Windows developer, I want a compact desktop layout without a marketing headline or oversized summary cards, so that the window is used for the work I came to do.
3. As a Windows developer, I want persistent navigation for Developer tools, Tool profiles, Environment, and Settings, so that I can predict where each task belongs.
4. As a Windows developer, I want tool actions in a compact command bar, so that installing, rescanning, checking a shell, and opening a terminal are easy to find.
5. As a Windows developer, I want a status bar with meaningful inventory and operation status, so that I can tell what the app knows and what it is doing.
6. As a Windows developer, I want the UI to work at the existing minimum and default window sizes, so that normal desktop resizing does not hide essential controls.
7. As a keyboard user, I want labelled controls, visible focus, and predictable navigation, so that I can use the app without relying on a mouse.
8. As an existing user, I want supported themes and languages to remain available, so that the redesign preserves my preferences.
9. As a Windows developer, I want an overview of Java, Node.js, Python, Go, Flutter, and Git alongside Inventory Only Android/MSVC details, so that I can see my developer tools together without implying unsupported switching or installation.
10. As a Windows developer, I want each tool to show its Effective Installation, so that I can see what a new Windows process will receive before a shell profile changes it.
11. As a Windows developer, I want my Selection displayed separately when it differs from the Effective Installation, so that the app does not imply that my last choice necessarily wins.
12. As a Windows developer, I want installation counts based on discovered installations, so that two copies of the same version are not collapsed into misleading version-only counts.
13. As a Windows developer, I want to search the tool overview, so that I can quickly find the tool I intend to manage.
14. As a Windows developer, I want rescanning to update inventory and effective results, so that external changes are reflected in the UI.
15. As a Windows developer, I want loading, empty, unavailable, and error states, so that missing data is not presented as a healthy or empty machine.
16. As a Windows developer, I want to select a tool and inspect its installations beside the overview, so that I retain context while choosing a different installation.
17. As a Windows developer, I want each installation to show its vendor, full version, Installation Root, and ownership, so that I can distinguish External Installations from Managed Installations.
18. As a Windows developer, I want an Unavailable Installation to remain visible with a reason, so that a moved folder is not mistaken for an uninstall.
19. As a Windows developer, I want unavailable installations excluded from switching, so that I cannot select an unusable target.
20. As a Windows developer, I want a real change plan before switching an installation, so that I can inspect PATH and other variable changes before confirming.
21. As a Windows developer, I want User and System changes identified in the plan, so that the effects on my account and other users are clear.
22. As a Windows developer, I want paths in my user area written only to User environment, so that other accounts are not given inaccessible paths.
23. As a Windows developer, I want a cancelled UAC prompt or failed apply to leave a coherent environment, so that changing a tool cannot silently leave half a switch behind.
24. As a Windows developer, I want a stale plan rebuilt for review when the environment changed elsewhere, so that another program's edits are not overwritten.
25. As a Windows developer, I want successful changes followed by fresh Effective Installation results, so that the UI reflects Windows rather than an optimistic selection.
26. As a Windows developer, I want Undo to reverse only Whichcraft's changes and report conflicts, so that unrelated external edits are preserved.
27. As a Windows developer, I want unfinished operations to offer the existing recovery actions, so that reopening the redesigned app does not hide recovery work.
28. As a Windows developer, I want Check shell to show Shell Resolution separately from Effective Installation, so that aliases and profile changes are not confused with Windows defaults.
29. As a Windows developer, I want to open a supported terminal with a fresh environment, so that I can use a newly selected installation immediately.
30. As a Windows developer, I want the UI to explain that existing terminals and IDE-specific tool settings may differ, so that I understand the scope of a switch.
31. As a Windows developer, I want to browse and install supported tool versions from Developer tools, so that installation is part of the main workflow.
32. As a Windows developer, I want to confirm the Install Store and see available download/disk information before installation, so that I can choose where files will live.
33. As a Windows developer, I want download and installation progress and errors to remain visible while navigating, so that leaving a panel does not lose the operation.
34. As a Windows developer, I want installing an unselected tool to leave my environment unchanged, so that adding an installation does not unexpectedly switch defaults.
35. As a Windows developer, I want updates to install a newer version in the same line, then review the switch and possible removal of the old installation, so that updates preserve the established workflow.
36. As a Windows developer, I want uninstall actions to show ownership, the removal method, and affected profiles, so that I understand what will be removed.
37. As a Windows developer, I want to choose and review a replacement before removing a selected or effective installation, so that I retain a usable tool.
38. As a Windows developer, I want in-use, protected, refused, and incomplete uninstall states to remain supported, so that the redesign does not bypass existing removal rules.
39. As a Windows developer, I want Git to remain switch-only and Android/MSVC inventories to remain Inventory Only, so that the UI does not offer unsupported actions.
40. As a Windows developer, I want Python launcher and Store-stub information kept separate from the selected Python executable, so that I understand why python and py can differ.
41. As a Windows developer, I want Tool profiles in their own workspace, so that I can manage named groups of selections without opening a tool modal.
42. As a Windows developer, I want a profile to show whether its selections match the Effective Installations, so that I do not confuse it with an active-profile mode.
43. As a Windows developer, I want creating and applying a profile to affect only the tools it includes, so that omitted tools keep their values.
44. As a Windows developer, I want missing profile installations and install-missing actions preserved, so that profiles remain usable after installations change.
45. As a Windows developer, I want affected profiles and repoint choices shown during updates and uninstalls, so that I can keep references useful.
46. As an existing user, I want Variables, Snapshots, Import / Export, and Check command grouped under Environment, so that I can still find the inherited advanced capabilities.
47. As an existing user, I want real User/System variables, values, types, and supported list editors in Variables, so that the redesign can replace the original editor.
48. As an existing user, I want search, filtering, creation, editing, and deletion of variables, so that routine environment work stays available.
49. As an existing user, I want edits, imports, and snapshot restorations staged for review, so that changing tabs does not write to Windows or discard my work.
50. As an existing user, I want to apply or discard pending environment changes explicitly, so that the app cannot silently replace them with another flow.
51. As an existing user, I want the existing account selection and permission behaviour retained in the appropriate Environment context, so that supported account editing remains possible.
52. As an existing user, I want environment diagnostics, PATH cleanup, and externally detected changes to remain accessible, so that reorganizing navigation does not remove maintenance capabilities.
53. As an existing user, I want to save and list named environment Snapshots, so that I can retain a known set of variable values.
54. As an existing user, I want to preview a Snapshot against the current environment and compare saved Snapshots, so that I understand their differences before restoring.
55. As an existing user, I want to rename and delete Snapshots through the existing workflow, so that the saved list remains useful.
56. As an existing user, I want restoration to stage the actual differences and preserve supported value types, so that I can review removals and replacements before applying.
57. As an existing user, I want it clear that a Snapshot does not include tool installation files or act as a Tool Profile, so that I choose the right operation.
58. As an existing user, I want JSON and REG import with preview, selection, and supported merge/replace behaviour, so that the new UI preserves the original import capability.
59. As an existing user, I want file-based import and real export destinations, so that Import / Export is more than the prototype's text preview.
60. As an existing user, I want export scope selection including custom variables and all existing export formats, so that I can continue using existing configuration workflows.
61. As an existing user, I want current validation, legacy-type handling, and secret-related export confirmations preserved, so that moving the UI does not change the existing contracts.
62. As an existing user, I want saved data and supported older import/snapshot formats to keep working, so that adopting the redesign does not require recreating my configuration.
63. As an existing user, I want Check command to accept the currently supported names and full paths, so that I can inspect command lookup without executing a tool.
64. As an existing user, I want ordered PATH hits with source scope and winning/shadowed status, so that I can identify which executable would be found first.
65. As an existing user, I want no-match and full-path status results kept, so that unsuccessful lookups are still useful diagnostics.
66. As a Windows developer, I want Check command and Check shell described as separate checks, so that a PATH result is not passed off as a shell-profile result.
67. As a Windows developer, I want Settings to expose the Install Store, previous-store behaviour, Scan Roots, and terminal preference, so that setup controls have a stable home.
68. As a Windows developer, I want changes in one workspace refreshed in the others, so that a tool switch, imported PATH, or restored Snapshot cannot leave contradictory displays.
69. As a Windows developer, I want pending environment writes and tool-change plans coordinated, so that two incompatible operations cannot silently overwrite one another.
70. As a Windows developer, I want failures and recovery actions to remain visible after navigation, so that a closed panel is not mistaken for a completed operation.
71. As a Windows developer, I want Whichcraft to run independently of any separately installed Envarly app, so that there is one product to install and use.
72. As a maintainer, I want to retain the proven Environment and Windows integration code behind the new UI, so that redesign effort does not create an unnecessary backend rewrite.
73. As a maintainer, I want production UI backed by the real API rather than fixture state, so that the shipped experience reflects the user's machine.
74. As a maintainer, I want unused inherited screens and prototype controls removed from production, so that there is one supported navigation model.
75. As a maintainer, I want behaviour verified through the real app and broader Windows scenarios, so that a visually successful redesign is also functionally reliable.
76. As a maintainer, I want Environment orchestration owned by a feature controller rather than the app root, so that changing presentation does not leave two incompatible application structures side by side.
77. As a maintainer, I want feature-specific API contracts and owned types behind one injection boundary, so that feature tests and production adapters use the same dependencies without importing Tauri into feature policy.
78. As a maintainer, I want application-owned time/ID and installer-lifecycle dependencies, so that the remaining scoped Rust architecture exceptions are closed without rewriting proven integration code.

## Implementation Decisions

### Product and visual structure

- Use the selected A desktop revision as the design reference: compact navigation, plain page titles, a command bar, compact tool tiles, a docked installation inspector, and a bottom status bar. Do not restore the initial prototype's marketing headline, large statistics, oversized cards, or account-avatar decoration.
- Keep Tauri, React, TypeScript, and the existing styling/component system. Desktop appearance does not require replacing the frontend with native Windows widgets or changing the application framework. The existing OS window chrome remains responsible for native window controls.
- Preserve the existing default window size of 1200 × 760 and minimum of 900 × 600. Review the normal desktop sizes directly; the in-app browser's narrow prototype view is not the sole visual acceptance reference. Use independent content/detail scrolling rather than one website-style long page.
- The primary navigation is Developer tools, Tool profiles, Environment, Settings. The existing application opens into Developer tools without a prototype query parameter. Environment contains Variables, Snapshots, Import / Export, Check command. Accessible tab selection, focus, and URL/deep-link handling must agree with the visible workspace; prototype query values are not production data contracts.
- Installation details dock beside the overview where space permits. Closing details returns to the overview. If a narrower layout is retained for previews, details may replace the content area while keeping navigation and a return action.
- Give installation, update, uninstall, shell check, terminal, Undo, and cleanup actions visible homes in their relevant workspaces; moving a feature out of the old header/modal must not make it unreachable. Diagnostics and unfinished-operation recovery stay discoverable independently of an open tool inspector.
- Preserve supported themes, translations, accessible names, keyboard operation, and reduced-motion behaviour. Resolve titles and counts from real state rather than static sample text.

### Reuse and application architecture

- Whichcraft replaces the inherited Envarly application presentation, not every inherited module. Reuse the production environment store, registry/PATH access, value types, snapshot persistence, import/export support, command lookup, staging, validation, and applicable diff/apply code. Keep required upstream provenance and existing notices accessible without making Envarly a separate runtime dependency.
- Follow ADR-0001 through ADR-0005. Windows defaults remain the product scope; tool paths point to actual installations; user-area paths stay in User environment; Rust use cases retain the existing port/adapter boundaries; the tool frontend retains immutable MVI state, intents, a pure reducer, and effect-driven API calls.
- Adapt the existing ToolsStore and effect runner to the new views. Do not move API calls into rendering, copy the prototype reducer into production, or introduce a replacement state library. Encapsulate Environment workflows in a feature controller with a state/actions/outcomes boundary; retain tested hooks and pure helpers inside it rather than leaving their orchestration in the app root. This is not a compulsory merger of all inherited state into the tool reducer.
- Preserve the existing API and Tauri wire/use-case behaviour while separating feature contracts, transport adapters, and launch/demo construction. Internal compatibility names such as EnvarlyApi may remain during migration. Contract separation is required; cosmetic renaming alone is not a substitute and must not trigger a public/schema migration or backend rewrite.
- The overview needs all supported tool inventories while the existing tool state primarily represents one tool. Extend the read model/composition to load through the existing per-tool inventory APIs, retain identity for each Tool Kind and Installation Root, and prevent late results from being shown under another tool. No new aggregate backend endpoint is required solely to draw the overview.
- Production inventory, effective values, profiles, and environment variables come from backend results. After relevant mutations or detected external changes, refresh the affected read models and invalidate old shell-check results. Do not preserve the prototype's separate, contradictory tool/environment sandboxes or assume applying a selection proves the effective result.
- Preserve Selection, Effective Installation, and Shell Resolution as distinct concepts. Preserve the meaning of Tool Profile, External Installation, Managed Installation, Install Store, Scan Root, Unavailable Installation, and Inventory Only throughout UI copy and state.
- Keep existing settings, saved profiles, snapshots, install stores, selection history, and recovery information readable. No data migration is expected for a presentation change; any implementation-discovered need for one must preserve compatibility and be stated explicitly.

### Required architecture boundaries

- The current production code has two orchestration styles: Tools uses a feature store/effects while Environment hooks and modal setters are composed in the app root. Resolve the ownership boundary during implementation; do not merely move the old root's JSX into new navigation. The desktop shell composes app-lifetime controllers and presentation; the Environment feature owns variables, account context, staging, baseline/diff, apply progress, snapshots, transfer and command lookup.
- Environment's public interface exposes feature state and actions/outcomes. Remove dialog/tab/selection setters from the boundary of apply/import/restore orchestration. Presentation responds to completion or error; closing or switching a view cannot dispose an operation or its subscriptions. Internal hook reuse is allowed and does not itself violate ADR-0005.
- Keep Tools MVI and Environment ownership separate, sharing app-lifetime write coordination and read invalidation through explicit callbacks/contracts. Do not introduce one giant app reducer, a new state library, an event-bus framework, or direct imports of another feature's private state.
- The coordinator admits conflicting UI writes, tracks account/environment revisions, and invalidates affected read models on success, external change, stale-plan failure or recovery readback. Keys include the target account/scope and request identity so stale account/tool responses cannot replace current data. Tool operations retain their existing account semantics independently of an OtherUser editor view. Backend validation/journal/UAC/rollback remains authoritative.
- Existing inherited components and hooks currently import the global API directly. Migrate every consumer used by the new shell, including snapshot/transfer/command panels and progress subscriptions, to app-injected Environment, Tools or platform contracts. Feature policy must not depend on Tauri invoke/listen, demo selection, or an unreplaced singleton. One app-level factory/provider selects real or fake adapters and supplies narrower capabilities to each feature.
- Give Environment types, tool installation/planning types, profiles, settings/platform types, and truly shared transport values explicit owners. Keep a compatibility barrel if needed while migrating imports, but move actual declarations to their owners; do not create several wrappers around the same all-purpose runtime module. Preserve serialized shapes and supported Environment value kinds.
- Close the recorded application-to-persistence dependency for operation IDs and direct wall-clock reads with a small application-owned Time/Operation IDs capability, injected through Rust composition. Production application code must not import concrete persistence to obtain IDs, and use-case tests must control recorded IDs/time. Preserve existing stored identifiers/timestamps and recovery compatibility.
- Route installer lifecycle status and preparation through application methods and an injected capability instead of calling concrete mise helpers from commands. Keep pinned mise behaviour, preparation progress/offline behaviour and work off the UI thread; concrete installer/download code remains an adapter. The inherited Environment adapter/type exception in ADR-0005 remains intentional.
- These scoped changes strengthen the existing ADR; they do not mean every inherited hook or helper is an architectural violation. Test-only filesystem/adapter references are not evidence of production I/O bypasses, and the current ID-generation import is not evidence of direct journal-file writes in those use cases.
- Ticket 02 records and maintains the legacy action/parity inventory before refactoring, using the source-audited baseline as a starting point. Every action needs its old entry, new destination, owning migration ticket, and verification evidence. Candidate cutover checks that inventory; it does not discover the old feature list for the first time.
- Migrate in behaviour-preserving increments. Read-only overview work in 07 may start after contracts/injection 02 while Environment controller/coordinator work 03/04 proceeds independently. New environment-writing entry points in 08 and 09 still wait for 04; query/account isolation in the read-only view does not require the complete write coordinator.
- Installation ticket 13 also waits for 04: progress/error/cancellation belongs to the app-lifetime ToolsStore, and install completion/failure/cancellation invalidates and refreshes inventory through the shared coordinator with request/revision checks.
- Prefactor time/IDs before the switching flow and installer lifecycle before installation. Connect the remaining production flows, enable a candidate default in 18 while preserving legacy fallback, run Windows suites 19/20, then remove unused presentation in 21 only after both suites pass. The final integration/removal gate is after Windows verification, not candidate cutover.

### Implementation branch and design source

Integration update (26 October 2026): implementation through `4a12a9f` is merged into `main`. Design history is retained under tag `archive/ui-redesign-prototype-2026-10-26`; the former feature/prototype branches and temporary worktrees have been removed. See [integration status and retained evidence](integration.md). The instructions below record the original implementation plan.

- Start the implementation branch from `main` at implementation time, using the normal `codex/` branch prefix. At this review, the production baseline on main is `7dff397`; check the actual main state when starting rather than silently losing newer production changes.
- Carry the reviewed spec, architecture, tickets and baseline inventory into that branch as documentation only. Do not merge the throwaway prototype branch or cherry-pick its UI changes into production. The selected A desktop/Environment design is viewed from prototype source commit `6bc41ad` (with its earlier design history), then rewritten as production components.
- Do not copy prototype components, fixture CSS/state, the prototype app gate or prototype task-runner wiring into the implementation branch. Retaining the tested legacy production UI as a temporary fallback is separate from importing throwaway prototype code.

### Flows and feature parity

- Switching uses the actual plan/diff, confirmation, stale-plan handling, User/System permission paths, readback, journal, recovery, and Undo contracts. Preserve ADR-0004 warnings and scope rules. Do not implement the prototype's illustrative diff as the authoritative plan.
- Installation, same-line update, uninstall, profile application, profile repointing, PATH cleanup, terminal launching, and shell probing use their existing effects and use cases. Git remains switch-only; Android and MSVC remain Inventory Only; Python launcher and Store-stub information remain supplemental. Preserve pinned mise behaviour and the separate treatment of external installers.
- A Tool Profile is a named set of selections, not an active mode or an environment snapshot. Applying one changes only included tools; missing installations and affected profiles retain their current review/confirmation flows.
- Variables must retain the production editor's supported types, list/PATH handling, creation/deletion, staged diff/apply, undo behaviour, diagnostics, and available account context. Retain account-switch restrictions while changes are pending; retain the existing supported account/elevation contracts rather than inventing cross-account behaviour in the UI.
- Snapshots reuse real persistence and the existing save, list, rename, delete, compare, preview, and stage-restore behaviour. Preserve supported snapshot versions and value kinds. The backend's existing pre-apply snapshots must not be duplicated by a new frontend save effect.
- Import uses the existing parser, file picker, preview, selection, merge/replace, validation, and staging. Export uses real destinations, All/User/System/Custom scopes, and the existing JSON, REG, PowerShell, DSC v2, DSC v3, and Ansible formats. Preserve existing handling for values whose type is unknown and existing secret-related confirmation. The simple prototype string parser, merge-only mode, and preview-only export are not production specifications.
- Check command reuses the existing read-only lookup, including supported full-path input, PATHEXT handling, ordered source-scope hits, shadowed results, no-match results, and full-path status. It does not execute the command and must not claim to measure the shell after profile loading. Check shell remains a separate action with the existing actual shell-probing behaviour.
- Pending environment edits survive navigation until explicitly applied or discarded. Opening another tab cannot silently replace them. Before a tool/profile/cleanup operation would write a conflicting environment, require the pending changes to be resolved; installation-only work may continue under its existing contract. Do not invent one combined transaction spanning unrelated tool and environment operations.
- Conflicting writes cannot run concurrently. Keep the plan being confirmed tied to what was shown; navigating, refreshing, or receiving a late result must not apply a different plan. Navigation must not dispose active progress, failure state, or recovery actions. Cancelling a plan has no write effect; cancelling after an operation has begun follows that operation's existing contract.
- Audit remaining header/menu functions, including external-change review, refresh, update notice, theme/language controls, and licences/attribution. Assign them a reachable place rather than deleting them merely because they did not appear in the prototype.
- Keep the old full-screen environment-first application and tools-as-one-large-modal entry available as a fallback through candidate testing. After Windows suites 19 and 20 pass, ticket 21 removes those obsolete entries and genuinely unused dependencies, reusing useful subcomponents and rechecking parity. Do not delete working backend features to make the UI appear independent of Envarly.
- Ticket 18 selects the presentation via a documented startup flag, defaulting to the new UI. Switching to or from legacy fallback requires closing the existing instance and relaunching; do not run the two modes simultaneously. Select and mount only one presentation before bootstrap, using the migrated shared composition/controllers/coordinator from 03/04 without a second service/listener/write path. Verify both startup modes and persisted-state/recovery readback; in-memory pending edits or operations are not transferred across restart. Windows acceptance 19/20 runs through the new UI; fallback smoke/comparison evidence is recorded separately.
- Rewrite the selected design as production components. Keep A/B/C fixture views, the floating switcher, state inspector, and simulated actions on the throwaway prototype branch rather than shipping them in the production implementation.

## Testing Decisions

### Primary seam and prior art

- The main automated integration seam is the production app composition rendered through its UI with real state, hooks/reducer, and effects, replacing only the existing API facade with a controlled in-memory implementation. Add one app-level API injection point if needed and pass it through existing stores/services; prefer this over mocking every hook or inventing separate seams for every workspace.
- The app-level test must exercise the narrower injected feature contracts through their real controllers. Verify that migrated Environment subpanels and progress subscriptions cannot escape to a global production API; mock replacement of one root module is insufficient if nested views import a hidden singleton.
- Assert visible behaviour and observable API effects: what is displayed, which plan is confirmed, when writes happen, and how navigation changes the experience. Do not assert private state layout, CSS class names, component nesting, hook counts, or snapshots that merely mirror the implementation.
- Use the existing fake API and reducer/effect harness as prior art for controlled backend results, stale plans, delayed responses, updates, uninstall replacement, and profile repointing. The existing ToolsPanel interaction tests and ImportExportPanel, SnapshotPanel, and CheckCommandPanel tests establish feature parity. Reuse their cases where appropriate; add app-level journeys to cover composition and cross-workspace consistency.
- Keep the existing Rust application/use-case tests and opt-in Windows adapter contract tests as supporting evidence. Add lower-level tests only when a behaviour cannot be exercised clearly at the app/API boundary or existing domain seam.
- Extend the existing architecture dependency checks to feature/transport boundaries and production application dependencies, excluding test-only code and documenting the inherited adapter/type exception. Do not test folder names, file length, or private reducer layouts as architecture. Use fake time/ID and installer lifecycle capabilities at the Rust application seam; verify status/preparation, ID/time use and existing external outcomes without patching concrete persistence/mise helpers.
- Verify account changes and out-of-order replies, shared write admission across both workspaces, and progress-subscription setup failure. All completion/error/cancellation paths must release the write gate and leave enough state for readback/recovery; switching tabs cannot lose staged edits or start a duplicate write.
- Required app-level journeys cover initial real-data inventory; selection/effective mismatch; switching and refresh; stale or failed apply; cancellation without writes; missing/unavailable installation; retained progress during navigation; environment staging across tabs; snapshot restore; file transfer; command lookup; and a tool/environment mutation updating the other workspace. Include out-of-order responses and pending-change conflicts.
- App/API-fake tests validate UI orchestration, not actual Registry permissions, shell inheritance, native dialogs, installers, or UAC. They cannot substitute for the Windows verification below.

### Broader real-Windows verification — requested by the user

The user requested broader real-Windows coverage instead of limiting it to a small smoke test. The production redesign therefore requires a recorded Windows integration/acceptance run through the built application as well as the automated app tests. Reuse the actual case IDs in the [original acceptance criteria](../../docs/acceptance-criteria.md), mapped below; retain their established expectations rather than weakening them to match the prototype. The letter prefixes identify table-row case IDs, while numbered sections identify topic groups. Q1–Q34 refer to requirements decisions/sources, not replacement test IDs.

| Original numbered section | Actual existing case IDs | Primary Windows suite |
| --- | --- | --- |
| 1. การค้นหา | D-1–D-7 | 20 |
| 2. การติดตั้งที่มีผลจริงและการแสดงผล | E-1–E-2, E-5 | 20 |
| 2. การติดตั้งที่มีผลจริงและการแสดงผล | E-3–E-4 | 19 |
| 3. Apply | A-1–A-9 | 19; 20 links to the resulting tool-switch evidence |
| 4. Undo | U-1–U-4 | 19 |
| 5. Terminal | T-1–T-4 | 19 |
| 6. ติดตั้ง | I-1–I-17 | 20 |
| 7. ที่เก็บการติดตั้ง | S-1–S-2 | 20 |
| 8. ถอน | R-1–R-13 | 20 |
| 9. อัปเดต | P-1 | 20 |
| 10. โปรไฟล์ | F-1–F-6 | 20 |
| 11. ทำความสะอาด PATH | C-1–C-2 | 19 |
| ทดสอบบนเครื่องนี้ไม่ได้ (ต้องหาสภาพแวดล้อมอื่น) | X-1–X-4 | 19 records actual supported execution or a blocked result with the reason |

Environment editing, Snapshots, Import / Export, navigation/accessibility and composition-specific journeys below extend that original matrix; they are not claimed to have existing D/E/etc. IDs. The Windows suite reports map original IDs and added scenario names to evidence explicitly. Use ticket 18's candidate build with legacy fallback retained; ticket 21 cannot remove it while required Windows outcomes are failed or blocked.

| Area | Required Windows scenarios | Evidence to record |
| --- | --- | --- |
| Launch and navigation | Built Whichcraft opens tool-first; all four workspaces and Environment tabs are reachable; minimum/default/resized window, supported light/dark themes, keyboard operation | App build/version, OS, screenshots and navigation results |
| Discovery | Discover multiple tools and duplicate-version installations, external and managed copies, additional Scan Roots, unavailable locations; exclude junction duplicates; open Inventory Only SDK details | Actual roots, vendors/versions, ownership, per-tool counts and probe results |
| Effective results | System PATH shadows a different User PATH; saved Selection differs; refresh after a manual external change | Registry input, independently resolved new-process result, and displayed Effective Installation |
| User/System writes and UAC | User-only switch, mixed-scope switch, consent, cancelled UAC, write failure and rollback; user-area paths never enter System environment | Before/after values and registry types for the affected account and scopes |
| Account boundaries | Normal user, administrator with UAC, and alternate administrator credentials where required; supported other-account editing and pending-change restrictions | Which account's HKCU changed and evidence that unrelated accounts were not modified |
| Stale plans and Undo | Modify variables/PATH while a plan is open or waiting for UAC; Undo after an unrelated external addition; conflicting variable change | Rebuilt plan or conflict, preservation of external entries, readback and UI result |
| Recovery | Interrupt a controlled operation after journalling; reopen, inspect unfinished work, resume or roll back | Journal/recovery state, offered actions, final actual environment and UI consistency |
| Variables and diagnostics | Edit supported string/expand-string/list values, create/delete variables, stage/discard/apply, review external changes and diagnostics | Actual values/types, pending changes, error/progress behaviour and refreshed displays |
| Snapshots | Save, rename, compare and delete; restore changed values/types and removals through staged review; load supported existing snapshots | Saved data, real diff, explicit apply, Registry result and refreshed tool overview |
| Import / Export | Real file dialogs; JSON/REG import; merge and replace; scope/custom-variable selection; all existing export formats; legacy-type and secret confirmation behaviour | Files produced/read, parsed values/types, scopes, cancellation/no-write results |
| Command lookup | Name, extension/full path, multiple System/User matches, shadowed target, not-on-effective-PATH, unknown command | Actual matching files and order; no command execution side effect |
| Shell and terminal | Shell profile changes PATH or alias; compare to Effective Installation; Windows Terminal already open; open a fresh terminal, PowerShell/cmd options, supported special-character handling | Actual executable paths and versions inside the launched process and probed shell |
| Managed installation | Supported Java/Node/Python/Go/Flutter flows; first-use store confirmation and mise preparation; failed/cancelled download; install without selecting | Actual executable/version, store identity, progress/error state, unchanged environment when unselected |
| Store/update compatibility | Change Install Store while older stores still contain installations; same-line update; select new installation, profile repoint choice and old-installation removal offer | Inventories across stores, old/new roots, actual selection/effective results and profile references |
| Uninstall | Managed uninstall; representative supported external installer and folder-only cases; replacement preview; refused/in-use/incomplete/cancelled removal | Actual removal method, remaining files, replacement result, affected profiles and refusal reasons |
| Tool profiles | Apply a partial profile without changing omitted tools; unavailable/missing pins; install missing then apply; matching status after external edits | Saved pins, plan, real resulting tool installations and correct match indicators |
| PATH cleanup | Duplicates and unavailable directories, expanded variable-based entries, preview, apply and Undo | Exact PATH entries/types before/after and preservation of usable expanded entries |
| Persistence and branding | Restart with saved settings/profiles/snapshots/recovery data; run without a separately installed Envarly app; confirm no fixture/switcher view in the production build | Restart results, packaged-app screenshots, preserved data and absence of prototype assets |

- Use the existing acceptance document's backup/readback/restore procedure for mutation suites. Compare Registry data and value kinds after cleanup, preserving changes only where the case deliberately requires them to remain. Prefer the established test machine baseline for representative discovery and isolated/disposable Windows fixtures or accounts for controlled mutation, interruption, and uninstall cases. Do not automate removal of the developer's working tool installations just to obtain coverage.
- Verify new-process environment using the existing non-inherited environment resolver, rather than trusting the test runner's inherited PATH. Compare those results with the app's Effective Installation and separately with Shell Resolution.
- Use another Windows environment for cases unavailable on the primary machine, especially alternate-credential UAC and configured shell variants. Record OS, account/elevation model, tool versions, scopes, and terminal configuration. Do not hard-code prototype versions or sample installation paths as Windows acceptance expectations.
- The Windows adapter contract suite can automate supported Registry/process/file observations. Exercise native UAC, file dialogs, and installer interactions manually or with supported UI automation where required; report that distinction honestly. No new general-purpose automation framework is required by this spec.
- Run representative real install/update/uninstall journeys for the supported backends and ownership classes affected by the new UI. Reuse existing proven backend coverage for unchanged combinations, but do not substitute a fake API for the UI's actual installer integration. Network-dependent or environment-specific scenarios must be recorded as pass/fail/blocked with the reason, not reported as passed when skipped.
- Retain meaningful existing frontend and Rust checks, compile/build the production application, and inspect both default/minimum desktop sizes. Review tests should demonstrate parity and correct integration rather than adding repetitive tests for every layout-only change.
- Completion requires evidence that the tested production UI and actual Windows state agree. If a required case fails or cannot be exercised, report the remaining limitation explicitly; a green fixture prototype is not acceptance. Preserve legacy fallback during suites 19/20. Ticket 21 runs only after both required suites pass, removes the fallback, and rechecks the affected flows/build; do not silently convert blocked or failed outcomes into permission to remove it.

## Out of Scope

- Building or running this implementation as part of writing this spec. This document records the agreed implementation work and acceptance requirements; it does not claim that real Windows verification has already happened.
- Shipping alternative B/C designs, prototype state inspectors, mock inventory, illustrative plans, simulated apply/install, or the prototype's minimal import parser.
- Rewriting the entire Envarly-derived backend, removing its proven utilities because of their origin, renaming every internal legacy identifier, or installing/running Envarly as a separate dependency.
- A broad architecture rewrite beyond the feature/API/type ownership, cross-workspace coordination, and scoped Rust Time/IDs plus installer-lifecycle corrections specified above. In particular, no mandatory global frontend store or migration of inherited Environment transport value types into Whichcraft domain is required.
- Migrating from Tauri/React to WinUI or another native widget framework; pixel-identical imitation of every Windows system control.
- Adding per-project tool versions, active-profile mode, a shim/junction strategy, a new installation manager, cloud sync, teams, or accounts beyond existing capabilities.
- Expanding Git installation/update support, Android/MSVC switching, or other tool/backend support beyond the existing product scope.
- Redefining snapshot/import/export schemas or breaking existing saved data merely to match the prototype representation.
- Dropping existing advanced features or weakening permission, journal, recovery, Undo, validation, and conflict handling to simplify navigation.
- Refactoring unrelated landing pages, media, reporting infrastructure, or existing user work outside the UI integration.

## Further Notes

- The user selected A, requested a desktop treatment, reviewed the restored Environment feature placement, and accepted the direction of replacing the UI while reusing useful Envarly-derived code. The later testing clarification explicitly requests broader real-Windows coverage; the matrix above reflects that choice.
- Primary design evidence is branch `codex/prototype-tools-redesign`: `e20ffee` captures A/B/C; `dc985b2` captures the compact desktop A revision; `6bc41ad` captures the four Environment tabs. These commits are reference material, not production-ready implementations.
- The prototype demonstrates layout and navigation. Its sample versions, independently editable environment state, hard-coded counts, fake shell results, simple value kinds, sample file parser, and illustrative diffs are known limitations and must not become production behaviour.
- This spec complements the existing Whichcraft v1 requirements and acceptance criteria and respects ADR-0001 through ADR-0005. It changes presentation and integration, not the established domain rules. Existing backend defects discovered during integration should be fixed or tracked with evidence rather than disguised by UI labels.
- At spec publication, frontend builds and focused checks had passed for the prototype and selected interactions had been exercised in a narrow browser view. No production wiring, packaged Windows acceptance run, or broad Windows test result is claimed here.
- The agreed outcome is one Whichcraft product with a tool-first desktop UI and an advanced Environment workspace. Keep the full throwaway prototype history as the design source and carry only the production implementation and its documentation into the implementation branch.
- Review corrections define the implementation base as main, put the action inventory in the first ticket, let the read-only overview start after contract expansion, and split candidate cutover from post-Windows legacy removal. Ticket 21 is the deferred contract/removal portion of the originally combined ticket 18, not a new product feature.
- Architecture follow-up: the user asked to include architecture after noting mixed root/feature orchestration, broad API/type modules and application/persistence coupling. The companion [architecture review](architecture.md) records current-code evidence, the distinction between documented exceptions and new work, target ownership, and migration/acceptance criteria. Its conclusions are mandatory in the architecture boundaries and testing decisions above; this spec does not claim that refactoring has already been implemented.
