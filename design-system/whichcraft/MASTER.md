# Whichcraft interface tokens and UX

The implementation source is `src/index.css`. Keep the existing semantic token names so both the desktop shell and legacy Environment components share the same themes. This is the S2 direction: zinc neutrals with one accent, tool cards that carry each tool's own colour in their header, and a tool sheet over the workspace.

## Identity

One sidebar and a flat workspace. Product identity comes from the Quiet Craft witch-hat icon, real tool logos on white tiles, each tool's colour in its card and sheet header, and the Selection versus Effective Installation readout. The icon uses a plum tile (#30213F), cream hat (#F7EEDC) and lilac band (#C5A0F0); these brand colors do not replace the interface's semantic colors. The canonical artwork is `src-tauri/icons/source/logo.svg`, with a transparent monochrome counterpart in `logo-mono.svg`. Tool logos are in `src/assets/tool-logos/`, from Devicon v2.16.0 (MIT, listed in Licenses); the marks belong to their projects. Paths and full versions use Cascadia Mono/Consolas; other text uses Segoe UI Variable Text/Segoe UI.

Preserve CONTEXT.md's distinctions: Selection, Effective Installation, Shell Resolution, Managed Installation, External Installation, Unavailable Installation, Install Store, Scan Root and Tool Profile. Never introduce an active profile or describe Undo as reverting Selection. Domain operations, routes, state/effects and API contracts retain their behavior.

## Color roles

| Token | Light | Dark | Role |
| --- | --- | --- | --- |
| frame | #fafafa | #0c0c0f | Workspace ground |
| canvas | #ffffff | #131317 | Cards, panels and dialogs |
| panel | #f4f4f5 | #0f0f13 | Sidebar, tool sheet and footer |
| surface | #f4f4f5 | #17171e | Nested surface |
| field | #ffffff | #131317 | Form controls |
| selection | #e4e4e7 | #1e1e28 | Selected navigation, row or segment |
| hover | #f4f4f5 | #17171e | Pointer feedback, and the row Windows uses |
| rim-subtle | #e4e4e7 | #222229 | Quiet structural edges |
| rim | #d4d4d8 | #2c2c35 | Stronger edges and scrollbars |
| fg | #18181b | #f4f4f5 | Primary text |
| muted | #52525b | #a1a1aa | Secondary text |
| dim | #606068 | #8e8e96 | Metadata |
| accent | #03694c | #34d399 | Accent text, selected icons and focus |
| primary | #047857 | #047857 | Primary button fill, with white text |
| destructive | #b91c1c | #b91c1c | Destructive button fill, with white text |
| success | #047857 | #34d399 | Successful state |
| danger | #b91c1c | #f87171 | Errors |
| warn | #a8380a | #fb923c | Mismatch and caution |
| violet | #62517c | #c4b9df | System scope identity |

The accent is a setting in Settings (emerald, blue, plum, pink, graphite; `html[data-accent]`, stored like the theme). It changes accent and primary only. Status colors and tool colors stay as they are.

Each tool has a fixed colour on `[data-tool]`: Java #e0364c, Node.js #46a341, Python #f2c230, Go #12b5d9, Flutter #3b7bea, Git #f4722b. It is identity, never status: it fades out of the top-right corner of the card and sheet header (20% in dark, 16% in light, ending inside the card), paints the logo's silhouette in the header, and marks In use with a dot beside the words. Text never takes a tool's colour.

Use hue with a written state, not as its only indicator.

## Geometry and type

- Sidebar 208px. Page inset 24px. Tool cards in a grid of at least 290px columns.
- Controls radius 8px; panels and cards 12px. Commands 32px; small controls 28px.
- Page title 17px, sheet title 28px, card name 15px, body and navigation 13px, metadata 12px. Section labels are 12px, uppercase and tracked.
- Native application minimum remains 900×600. Below 700px, a browser preview stacks the sidebar above the workspace; this does not change the native window contract.
- Use tabular figures for versions, paths and changing counts. Let paths wrap; do not discard root identity.

## Interaction

One primary action in each workflow. Keyboard focus has a 2px accent outline. A skip link reaches the workspace. Page changes focus the new title.

A tool opens in a sheet over the workspace, with the sidebar still usable so another tool opens directly from it. Opening focuses the sheet's title, Escape closes it unless a dialog is above it, and closing restores focus to what opened it. Install, plan review, uninstall and deleting a profile are dialogs, with the action on the left. Every tool card has the same height and the same two lines. The first shows what Windows uses; with neither on PATH it shows the Selection or else the newest usable version. The second, on a quieter band, shows the Selection with Use when it differs, and otherwise a count of the other versions that opens the sheet. A card with nothing to list has one body with its action. Each row of the Other SDKs listing keeps to one line, and what a narrow window cuts stays readable in its tooltip. Use on a card opens the sheet with the review above it. After an Apply, the notice states what the readback found, and only claims new processes get a version when the Effective Installation is that version. PATH cleanup stays in the Environment workspace.

A rescan keeps the last result on screen, and Rescan stays focusable while it runs. Apply is offered only when a profile differs. Motion stays quiet: colour for feedback, a short fade and rise for a page or sheet, a tint on the row that just became effective, with reduced motion support. Keep loading, disabled, empty and error states readable and retain all existing review/Apply/Undo and confirmation flows.

## Validation

Run `npm run build`, `npm run lint`, the existing unit suite and `npm run test:storybook`, which `npm run test` does not include. Visual fixtures and the production-build browser/a11y runner live in `.scratch/windows-workbench/`; screenshots and measurements are written locally to `.taste-skill/`, which is not committed. The fixture is separate from the production entry and uses in-memory data only. Review both Light and Dark, including plan review, Environment, Profiles, Settings and the app's minimum window size.
