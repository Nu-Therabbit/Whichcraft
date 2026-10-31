# Whichcraft Windows workbench review — 2026-10-31

Implemented with UI UX Pro Max → Design Taste app screen/redesign → Web Design Guidelines.

Direction: **Framed sheet**, seed **1633219306**, no redraw. Face: Segoe UI, Windows blue, branching-path Whichcraft mark, neutral frame and compact commands. Signature: Selection and Effective Installation readout beside installation roots. No downloaded imagery or new dependencies.

[UX and tokens](../../design-system/whichcraft/MASTER.md) · [Fixture and decisions](design.md)

## Before / after measurements

| Check | Before, both themes | After, both themes |
| --- | --- | --- |
| Tools title at 1440px | 18px | 20px |
| Title at 768 / 390px | 2 lines / 2 lines | 1 line / 1 line |
| Small text | 60% below 13px; includes 10px status | No tiny-text finding; data 13–14px, metadata 12–13px |
| Structural borders | Three heavy SDK panel edges, about 4.2:1 | Quiet semantic structural edges; no heavy-border finding |
| Phone composition, visual check | Sidebar consumes most width; controls clipped | Labelled navigation strip, full-width content and detail pane |
| Product identity | Product name absent from work area | Whichcraft mark/name, Windows platform label |
| Inspector | 0 FAIL, 3 WARN (one is dev-server) | 0 FAIL, 0 WARN on production build |

Inspectors ran at 1440, 768 and 390px. All listed fold images and contact sheets were opened. Before capture used the unmodified app source on Vite; final capture uses a production build of the same components with the isolated service fixture. The inspector contact sheets include grey unused cells; those cells are the inspector's presentation, not application content.

## App critique

Round 1: the product is named and the installation inventory reads as a workbench. Three visible fixes: mobile navigation stayed vertical because a utility overrode the responsive class; metadata was still too small; SDK borders competed with controls. Fixed the conflicting class, increased data type and split structural/control borders.

Round 2: the question is clear in both themes. Three fixes: the title utility overrode the intended scale; details needed keyboard focus restoration; primary-button foreground/background interpolation briefly failed contrast while entering review. Fixed title classes, added focus handling and restricted primary-button transitions to opacity.

Round 3, final app-screen questions:

1. The largest area answers which Tool Installations are effective; detail separates Selection from Effective Installation. The Java mismatch is visible in words and caution color.
2. Content and commands share the working-sheet edges. SDK sections keep their natural content height; long roots wrap and remain readable. Supplemental inventory and Python Launcher remain reachable by scrolling.
3. Color marks status, focus and the reviewed action. Navigation stays neutral. The Whichcraft branching-path mark and Windows type identify the product.
4. Fixture totals reconcile: 2 Java + 2 Node.js + 1 Python + 1 Go + 0 Flutter + 1 Git = 7 installations across 6 tools. The footer derives this total. Both Java versions agree between summary and detail.
5. Flutter prints 0 installations and a dash for the absent effective installation. No invented growth metrics or navigation counts.
6. No charts or legends are required for this task. Status dots have corresponding accessible state text; mismatch also has visible copy.
7. At 390px navigation becomes a labelled strip and installation details use the full working width. The native application's supported minimum remains 900×600; Environment and Settings were checked at that size in both themes.

Remaining visual tradeoffs: long Installation Roots wrap in the narrow detail pane; supplemental inventory needs scrolling, especially at the native minimum. Browser widths below the native minimum were extra Tools-view checks, not a new mobile application contract.

## Final verification

- `npm run build`: pass (existing Hozo candidate fallback and large-chunk advisories remain nonblocking).
- `npm run lint`: pass.
- `npm run test -- --run`: **73 files, 550 tests passed**. Updated one stale test that asserted a pill radius to assert visible noninteractive scope text instead.
- `npm run test:storybook -- --run`: **29 files, 112 tests passed**. `npm run test` excludes this project; the first review missed three stale Badge assertions here that would have failed CI.
- App text below 12px replaced with `text-xs` across Tools and the legacy Environment components (58 occurrences). No text below 12px on Tools or the Environment tabs in either theme at 1440×900 and 900×600. Uppercase tracked labels remain in legacy components.
- Production Playwright journeys + axe WCAG A/AA checks: **38 screen/theme/state combinations, 0 violations**. Includes Tools, detail, plan review, Settings, Profiles, Environment's four workflows, install view, empty/search/error/loading states, reduced motion and native minimum size.
- Verified keyboard skip link, theme toggle, detail focus restoration, search, rescan, navigation and opening the reviewed plan. Native mutations use the existing regression/contract suite; UAC, downloads and actual Windows writes were not re-executed.
- Design Taste production inspector: **0 FAIL / 0 WARN** in each theme at all three widths. Source lint: **0 FAIL**; monospace warnings are intentionally retained for paths, versions and technical values allowed by the app-screen rules.
- Web Design Guidelines: changed-file review completed; no outstanding findings in the reviewed changes. [Source rules](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), [file review](guidelines.md).
- `git diff --check`: pass.

Screenshots and the axe report stayed local and are not in the repository; `verify.mjs` regenerates them under `.taste-skill/`. Service fixture: `.scratch/windows-workbench/preview.ts`. All installations, paths and environment snapshots it displays are fixture data, not claims about this machine. The fixture is not imported by the production entry.

No CONTEXT.md, API, reducer, effects or backend changes. Existing user changes to `src-tauri/Cargo.toml` and `.agents/` were left intact.
