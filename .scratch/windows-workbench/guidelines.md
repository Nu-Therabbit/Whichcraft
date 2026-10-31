# Web Design Guidelines final review

Reviewed against the [fresh source rules](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md) on 2026-10-31. Scope is the changed application UI and shared controls, supported by browser checks of their consuming screens.

## src/features/shell/DesktopShellApp.tsx

✓ pass — semantic navigation/region, skip link, labelled controls, decorative SVGs, keyboard focus, modified-click links, overflow-safe list and details.

## src/features/shell/ShellAppHeaderActions.tsx

✓ pass

## src/features/shell/ShellEnvironmentWorkspace.tsx

✓ pass — scrollable tab strip retains existing ARIA/keyboard behavior.

## src/features/shell/ShellInstallationDetail.tsx

✓ pass — sentence-case installation heading; unchanged review/write behavior.

## src/features/shell/ShellSettingsView.tsx

✓ pass

## src/components/ToolsPanel/ToolsSettings.tsx

✓ pass — path input names, autocomplete/spellcheck, accessible names and heading hierarchy.

## src/components/ToolsPanel/SupplementalInfo.tsx

✓ pass — real definition-list data, root wrapping and semantic caution token.

## src/components/ui/Button.tsx

✓ pass — native button, focus replacement, disabled/press states; primary contrast verified during review.

## src/components/ui/IconButton.tsx

✓ pass — required accessible name and 32px target.

## src/components/ui/Badge.tsx

✓ pass — noninteractive, readable labels with no forced uppercase; no chip squeezing.

## src/components/ui/Select.tsx

✓ pass — native select, explicit field/ink colors, visible focus, 28px minimum target.

## src/index.css

✓ pass — Light/Dark semantics, native color-scheme, focus indicators, reduced motion and sheet overscroll containment. Existing snapshot width animation remains unchanged to preserve the dock's resizing behavior.

## src/lib/themeDocument.ts

✓ pass — theme-color follows the application frame.
