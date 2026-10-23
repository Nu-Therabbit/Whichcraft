# Explore a tool-first Whichcraft home

Type: prototype
Status: resolved

## Question

Which information hierarchy makes it easiest to see the effective Windows tool installation and switch to another one, without understanding environment variables first?

The current home renders the inherited Envarly environment editor. Developer tools are hidden behind a modal with tool tabs and many competing actions. The user reports that it feels like Envarly and is hard to use.

## Prototype

Primary source: branch `codex/prototype-tools-redesign`.

Run `npm run prototype:ui`. Existing `/` route; development-only `?variant=A|B|C` rendering alternatives. No new production route or dependencies.

- A — Desktop overview: compact app navigation and command bar, effective versions on compact tool tiles, mismatch strip, docked installation details, status bar. Original web-style A is preserved in commit `e20ffee`.
- B — Workbench: compact inventory table, always-visible installation inspector, Windows resolution preview.
- C — Guided switch: tool → installation → review; fewer simultaneous decisions.

Shared: sample data, in-memory reducer, disabled unavailable installations, effective/selection distinction, illustrative change preview, simulated apply and undo, sample install catalog, shell-check simulation, URL switcher with arrow keys, expandable full state.

All data are deliberately fixtures. No API or real mutations are connected to the prototype. The original app remains available at `/` without `variant`. Existing app initialization and tool effects only mount in that original view. This isolates the throwaway study from startup effects such as preparing mise.

## Verdict

The user chose A's information hierarchy, requested a desktop treatment, reviewed the Environment tab grouping, and accepted replacing the inherited presentation while retaining useful backend code. These decisions are captured in the ready-for-agent implementation spec.

Revision: remove the marketing headline, eyebrow, large statistics, card footers, floating drawer, and account avatar. Use a compact Windows-style navigation pane, page title, command bar (install, rescan, shell check, search), smaller tool tiles, docked details, inventory-only SDK entries, and a bottom status bar. Content and details scroll independently. At narrow widths the details pane takes the content area; closing it restores the overview. This is a visual prototype, not a switch to native platform widgets.

Implement the accepted direction according to the published spec using the existing MVI store and real plan/apply flow. Keep these alternatives on the prototype branch; retain only the production implementation and its documentation in main.

## Answer

Use A's compact desktop tool overview with docked details and navigation for Developer tools, Tool profiles, Environment, and Settings. Environment groups Variables, Snapshots, Import / Export, and Check command; Check shell remains distinct. Reuse the real Envarly-derived infrastructure behind the new UI; do not require Envarly as a separate app or rewrite Windows integration for appearance alone.

Implementation handoff: [Whichcraft desktop UI spec](../spec.md), status `ready-for-agent`. The user requested broader actual Windows integration/acceptance coverage in addition to app-level tests against the existing API seam. Primary source stays on `codex/prototype-tools-redesign` at `e20ffee`, `dc985b2`, and `6bc41ad`.

## Validation

- `npm run build` passes; existing Hozo dynamic class and bundle size warnings remain.
- Biome checks pass for all four touched frontend files.
- Production assets contain no prototype component, switcher, or design-study banner.
- Browser checked A/B/C at the in-app browser's narrow viewport. Fixed review dialog overflow during visual inspection.
- Manually exercised tool search, variant cycling, unavailable installation disabling, selection/review/simulated switch/undo in A and C, and sample catalog. Undo restores both effective installations and prior selections.
- Desktop layout is implemented with responsive breakpoints; no desktop-width browser capture was available in this session.

## Comments

- User feedback: “เราชอบ A แต่ UI มันดูเป็นเว็บไป” — keep A, refine the appearance and density for a desktop utility.
- Desktop revision remains fixture-only. Install, rescan, SDK inventory, shell check, switch, and undo operate within the preview.
- Desktop revision: build and focused Biome checks pass. Browser inspected the compact overview and details at narrow width; confirmed the switch preview, simulated apply/undo, search, and returning to the overview. The production build continues to exclude prototype components.
- User asked where the inherited Snapshots, Import / Export, and Check command features moved. The earlier prototype omitted them. User requested trying the proposed Environment grouping.
- Added Environment tabs: Variables, Snapshots, Import / Export, Check command. Variables support scope/filter/edit/stage; snapshots save in memory and compare/stage restoration; transfer previews JSON/REG (simple string values, merge-only import); command checking shows fixture PATH hits in System-then-User order, separately from Check shell.
- Environment workflows have their own fixture reducer nested in the visible prototype state. These previews do not execute commands, access files, download exports, or modify Windows. Environment edits are an independent sample sandbox and do not re-probe the tool inventory. Full production semantics remain in the original app.
- Direct links: `/?variant=A&section=environment&tab=variables`, `tab=snapshots`, `tab=import-export`, `tab=check-command`. Selected tabs survive reload through URL params; all sample edits reset.
- Environment validation: build and focused Biome checks pass. Manually exercised snapshot compare/stage/discard/save, JSON import/apply with the new variable visible in the table, variable edit/stage/apply, REG preview, and Java PATH ordering in the browser. No automated tests were added for this throwaway prototype.
- 2026-10-24: User accepted the design/reuse direction and invoked to-spec. Published the implementation spec with `ready-for-agent`; explicitly expanded real-Windows testing following the user's seam-feedback reply. Prototype question resolved; production implementation is not yet done.
- 2026-10-24: User requested architecture coverage. Reviewed production wiring against ADR-0005 and added [architecture evidence and target boundaries](../architecture.md). The spec now requires Environment controller extraction, narrow injected API/type ownership, app-lifetime coordination, and scoped Rust time/ID plus mise-lifecycle corrections. These are planned implementation requirements, not completed refactoring.
