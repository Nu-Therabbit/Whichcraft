# Whichcraft Windows workbench

## UX foundation

Preserve routes, native commands, MVI state/effects, plan review, Apply/Undo and all CONTEXT.md terminology. This work changes presentation only.

UI UX Pro Max: verified product match `Developer Tool / IDE` from `desktop developer tool --domain product`: flat hierarchy, blue focus, developer data. The aggregate design-system search mixed in documentation landing patterns and a dark-only recommendation; reject those as incompatible with the app brief and Light/Dark parity. React search confirms focus management and accessible role queries. Apply the desktop 24px minimum pointer target, not native mobile dimensions; prefer 32px command controls.

## Inventory and jobs

- Windows developers inspect six developer tools during long desktop sessions.
- Tool Installation identity is vendor + full version + Installation Root.
- Multiple installations can share a version; retain every root.
- Selection and Effective Installation may differ; show both, never imply an active profile.
- Shell Resolution is checked separately after a shell profile loads.
- Tool Profiles contain named selections; preserve their independent workflow.
- Environment contains variables, snapshots, import/export and command checks.
- Inventory Only Android/MSVC/Windows SDK information cannot be selected.
- Install Store and Scan Roots remain editable in Settings.
- The main job is inspect an installation and review its selection plan, then Apply.
- Loading, scan errors, unavailable installations and empty results keep their states and labels.
- Validation uses the existing production-service injection seam and a separate in-memory fixture; it does not touch Windows registry, files or installed tools.

## Direction

Design Taste app/redesign draw: `framed-sheet`, seed `1633219306`, no redraw. Keep palette/type roles and adapt the blue to Windows. One low-chroma neutral frame, an inset working sheet, no shadows at rest. Dark uses neutral charcoal tone steps with the same geometry. Segoe UI (installed Windows system font), Cascadia/Consolas only for paths and versions.

Face: Windows blue on the Whichcraft branching-path mark and focus; neutral navigation, compact commands, crisp 4–6px controls.
Signature: installation readout with Selection and Effective Installation in aligned wells beside the installation list. This is the product's Windows resolution model, not a dashboard chart.

Screen questions: Tools — which installation will a new Windows process receive? Detail — does Selection match Effective Installation, and what changes if I choose another? Environment — which scoped values will change? Profiles — which named selections should I review? Settings — where are Managed Installations stored and which roots are scanned?

Frame arithmetic at 1440: 216px navigation + 1216px workspace + 8px outer inset. Workspace padding 24px each; detail pane 368px when open. At narrow widths navigation becomes a labelled horizontal strip and details get the full working width; no icon-only mystery navigation.
