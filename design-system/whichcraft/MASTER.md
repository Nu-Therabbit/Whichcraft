# Whichcraft interface tokens and UX

The implementation source is `src/index.css`. Keep the existing semantic token names so both the desktop shell and legacy Environment components share the same themes. This specification adapts UI UX Pro Max's verified Developer Tool / IDE guidance and Design Taste's app-screen `framed-sheet` direction (seed 1633219306).

## Windows workbench

Use one quiet frame around the working sheet. Product identity comes from Segoe UI, the Quiet Craft witch-hat icon, Windows blue, compact commands and the installation resolution readout. The icon uses a plum tile (#30213F), cream hat (#F7EEDC) and lilac band (#C5A0F0); these brand colors do not replace the interface's semantic colors. The canonical artwork is `src-tauri/icons/source/logo.svg`, with a transparent monochrome counterpart in `logo-mono.svg`. No decorative charts, gradients, entrance animations or shadows at rest. Paths and full versions use Cascadia Code/Consolas; other text uses Segoe UI Variable Text/Segoe UI.

Preserve CONTEXT.md's distinctions: Selection, Effective Installation, Shell Resolution, Managed Installation, External Installation, Unavailable Installation, Install Store, Scan Root and Tool Profile. Never introduce an active profile or describe Undo as reverting Selection. Domain operations, routes, state/effects and API contracts retain their behavior.

## Color roles

| Existing / added token | Light | Dark | Role |
| --- | --- | --- | --- |
| canvas | #ffffff | #202020 | Working sheet |
| panel | #f7f7f7 | #272727 | Grouped secondary surface |
| surface | #f0f0f0 | #303030 | Nested surface |
| frame (added) | #f3f3f3 | #191919 | Navigation and title bar |
| field (added) | #ffffff | #242424 | Form controls |
| selection (added) | #eaeaea | #373737 | Selected navigation/list row |
| hover | #e9e9e9 | #383838 | Pointer feedback |
| rim-subtle | #e5e5e5 | #3a3a3a | Quiet structural edges |
| rim | #858585 | #858585 | Control boundaries |
| fg | #202020 | #f3f3f3 | Primary text |
| muted | #5c5c5c | #bcbcbc | Secondary text |
| dim | #616161 | #ababab | Metadata |
| accent | #005a9e | #75bfff | Primary action and focus |
| accent-hi | #004578 | #a4d5ff | Primary hover |
| on-accent (added) | #ffffff | #102235 | Explicit primary-action text |
| success | #216638 | #83cf9a | Successful/effective state |
| danger | #b4231d | #ffaaa5 | Errors and destructive actions |
| warn | #805600 | #edc579 | Mismatch and caution |
| violet | #62517c | #c4b9df | Existing System scope identity |

Use hue with a written state, not as its only indicator. A selected tool row uses the same neutral fill as selected navigation; the mismatch sentence carries caution color. Keep the existing System scope color role without using it on chrome.

## Geometry and type

- Spacing uses the existing 4px base. Desktop content inset 24px; narrow inset 16px.
- Navigation 216px; workspace inset 8px from right/bottom; sheet radius 16px.
- Controls radius 4px; panels radius 6px. Commands 32px; small controls at least 28px; icon controls 32px.
- Title 20px, section 16px, body/nav 14px, version/data 13px, metadata 12–13px. No 10px status copy or uppercase tracked labels.
- Tool rows 66px minimum; installation details 368px. Below 900px, details occupy the working width. Below 700px, navigation becomes a labelled strip.
- Native application minimum remains 900×600. Browser Tools view is additionally inspected at 768px and 390px; this does not change the native window contract.
- Use tabular figures for versions, paths and changing counts. Let paths wrap; do not discard root identity.

## Interaction

Keep one primary action in each workflow and visible secondary commands. Keyboard focus has a 2px accent outline. A skip link reaches the workspace. Opening details focuses its heading; closing restores the source tool. Page changes focus the new title. Native selects use explicit field/ink colors and theme `color-scheme`.

Feedback uses 120ms ease-out, with reduced motion support. Primary buttons transition opacity only, so a secondary-to-primary state change does not interpolate foreground/background through a low-contrast pair. Keep loading, disabled, empty and error states readable and retain all existing review/Apply/Undo and confirmation flows.

## Validation

Run `npm run build`, `npm run lint`, the existing unit suite and `npm run test:storybook`, which `npm run test` does not include. Visual fixtures and the production-build browser/a11y runner live in `.scratch/windows-workbench/`; screenshots and measurements are written locally to `.taste-skill/`, which is not committed. The fixture is separate from the production entry and uses in-memory data only. Review both Light and Dark, including plan review, Environment, Profiles, Settings and the app's minimum window size.
