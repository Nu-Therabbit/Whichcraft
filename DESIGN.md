# Whichcraft — Design Notes

Architecture decisions, security model, and data format specs. Not a tutorial; read this when you need to understand *why* something works the way it does.

---

## Architecture

```
src/                    React frontend (TypeScript)
  transport/            Tauri command bridge — all invoke() calls live here
  App.tsx               Root: picks the desktop shell or the legacy presentation
  features/
    shell/              The desktop shell: sidebar, tool cards, tool sheet, plan review
    tools/              Tool inventory, plans, and effects
    environment/        Environment workspace state
  hooks/
    useStaged.ts        Staging area: Map<"Scope:name", StagedChange>; effectiveVars merge
    useUndoStack.ts     Generic undo/redo stack (stage-level Ctrl+Z/Y)
    useStagingHandlers.ts  Orchestrates all stage operations and undo pushes
    useEnvVars.ts       Registry polling + refresh
    useTheme.ts         Dark/light theme persistence
  lib/
    diff.ts             Pure snapshot diff — no side effects
    lint.ts             %VAR% reference lint; Windows built-in allowlist
    secrets.ts          Name-based + value-pattern secret detection (35+ formats)
  components/
    AppHeader/          Top bar: refresh, staged-change count, apply/discard, menu
    Sidebar/            Variable list, search, keyboard nav (ARIA listbox); M/A/D markers
    DetailPanel/        Edit → stage locally; local Ctrl+Z undo before staging
    PathEditor/         Drag-and-drop path list + per-entry validation + %VAR% lint
    ListEditor/         Generic sortable list editor (semicolon or comma separator)
    PathBanner/         Banner shown on launch when Whichcraft is not yet in User/System PATH
    StagedModal/        Apply confirmation: Delta/Full diff view for semicolon-separated values
    NewVarModal/        New variable creation dialog
    DiffPanel/          Unified diff view (external-change detection)
    SnapshotPanel/      Snapshot list (rendered in right sidebar)
    ImportExportPanel/  Import/Export wizard (rendered in modal)
    LicensesPanel/      Envarly MIT license + third-party OSS listing (rendered in modal, loaded on demand)
    ui/                 Atomic components: Button, TextInput, Textarea, Badge, Modal, …

src-tauri/src/          Rust backend
  main.rs               GUI entry point: a GUI launch runs Tauri, a subcommand runs the CLI
  bin/whichcraft-cli.rs Console launcher, installed as bin\whichcraft.exe
  lib.rs                Tauri setup, single-instance handling, and shared entry points
  whichcraft/           Tool inventory, plans, apply and undo, mise, and persistence
  commands/             Tauri command handlers per domain (env, export, launch, path, snapshot, update, users)
  env_store.rs          Registry read/write via winreg; EnvBackend trait + MemBackend for tests
  env_backend.rs        Windows registry implementation (WinregBackend)
  model.rs              Shared domain types and serialization
  path_manage.rs        PATH status check (userHasEntry / systemHasEntry) + propose-add
  path_backend.rs       PATH manipulation backend trait
  snapshot.rs           Snapshot save/list/restore + DPAPI encryption
  crypto.rs             DPAPI wrapper (protect/unprotect)
  export/               JSON, .reg, and IaC format (PS1, DSC v2/v3, Ansible) export implementations
  import.rs             Backend-agnostic diff for `whichcraft import`/`set` (merge/replace, kind inference)
  user_hive.rs          Loading and editing other local accounts' registry hives
  cli.rs                CLI subcommands (clap): get/list/export are read-only; import/set/delete write behind --apply
  error.rs              WhichcraftError (thiserror)
```

### Frontend ↔ Backend boundary

All communication goes through `src/transport/tauriWhichcraftApi.ts`. No real `invoke()` call appears anywhere else in the frontend. This makes the boundary easy to audit, mock in tests, and replace if the IPC layer changes.

### Staging area

All edits are **staged locally** via `useStaged` before any registry write. The registry is never touched until the user clicks **Apply N staged changes** in the header.

1. User edits a value in DetailPanel → clicks **Stage** → `stageSet()` called, no IPC
2. Import → click "Stage N variables" → `stageImport()`, no IPC
3. Snapshot → click "Stage restore" → `stageSnapshot()`, no IPC
4. Sidebar shows **M** (modified) / **A** (added) / **D** (to-be-deleted) markers on staged items
5. User clicks **Apply N staged changes** (header) → unified diff modal → click **Apply to registry** → batch `api.setEnvVar`/`api.deleteEnvVar` + `WM_SETTINGCHANGE` broadcast → `clearStaged()`

`effectiveVars` (from `useStaged`) merges registry vars with staged changes; Sidebar and DetailPanel always display this merged view. Staged-deleted vars remain visible with a D marker so they can be unstaged.

### Local pre-stage undo

DetailPanel maintains a second, independent undo stack (`localHistory` ref) for edits that have not yet been staged. Ctrl+Z fires `handleDiscard`, which works at two granularities:

- **Text edits** — revert to the last structural checkpoint (drag/add/remove outcome)
- **Structural ops** (drag reorder, add, remove) — undo the operation itself, one step at a time

Pre-op and post-op values are both pushed as checkpoints when a structural change is confirmed (in `handleValueChange`, triggered after `onBeforeReorder`). This gives independent undo for interleaved text-then-drag sequences. The local stack is cleared whenever the selected variable changes or a change is staged.

---

## Security model

### Read-only until confirmed

**GUI writes require explicit confirmation.** Import preview is parsed into a structure staged locally; the user must click "Apply N staged changes" and confirm in the diff modal before any write happens. No GUI mutation escapes the `commands::set_env_var` / `commands::delete_env_var` / `commands::apply_env_changes` handlers — the latter is what "Apply N staged changes" actually calls.

The CLI's `get`/`list`/`export` are read-only. `import`/`set`/`delete` are a separate, intentional write path — see [CLI mode](#cli-mode) — gated by an explicit `--apply` flag instead of a confirmation dialog, since there's no GUI to show one.

### Content Security Policy

`tauri.conf.json` uses a strict CSP. `default-src 'self'` is intentional — Whichcraft handles environment variables which may contain secrets (API keys, tokens), so no external resource loading is allowed.

### External links

Links to GitHub or other external URLs must use `tauri_plugin_opener::open_url()` (Rust) / `api.openUrl()` (TS), never `<a href>` with a bare URL. This keeps the webview's navigation policy intact.

### Secret detection

Name-based heuristics (`*_KEY`, `*_TOKEN`, `*_SECRET`, `*_PASSWORD`, …) plus value-pattern matching across 35+ token formats detect likely secrets. Detection runs client-side and is advisory only — it never blocks operations.

---

## Snapshot format

### File location

```
%LOCALAPPDATA%\Whichcraft\snapshots\<id>.snap
```

### Encryption

Each `.snap` file is a DPAPI-encrypted blob (`CryptProtectData`, `CRYPTPROTECT_UI_FORBIDDEN`). The plaintext is UTF-8 JSON. Only the Windows user account that created the snapshot on the same machine can decrypt it.

Non-Windows builds (CI) use a passthrough (no encryption) so tests can run without the DPAPI subsystem.

### Versioning

The JSON payload contains a `version` field. Current version is **1**.

| Version | Format | Notes |
|---------|--------|-------|
| 0 | Plaintext `.json` | Pre-encryption era; `.snap` filter ignores these files |
| 1 | DPAPI-encrypted `.snap` | Current |

**Migration policy:**

- Reading: check `meta.version` in `read_snap`. If `version == 0`, the file has the old extension (`.json`) and will never be listed since `list_snapshots_from` filters for `.snap`. No active migration needed.
- Writing: always write `SNAPSHOT_FORMAT_VERSION` (currently 1).
- On format change: increment `SNAPSHOT_FORMAT_VERSION`, add a migration branch in `read_snap` that converts the old shape to the current struct before returning it. Keep the constant and the version history table above up to date.

### Struct shape (v1)

```json
{
  "version": 1,
  "id": "20240615T120000Z",
  "createdAt": "2024-06-15T12:00:00Z",
  "label": "before npm install",
  "snapshot": {
    "user": {
      "VAR": { "value": "my_value", "kind": "String" }
    },
    "system": {
      "PATH": { "value": "C:\\Tools;...", "kind": "ExpandString" }
    },
    "otherUser": null
  }
}
```

---

## Data directories

| Purpose | Path |
|---------|------|
| Settings | `%LOCALAPPDATA%\Whichcraft\settings.json` |
| Selections | `%LOCALAPPDATA%\Whichcraft\selection.json` |
| Tool Profiles | `%LOCALAPPDATA%\Whichcraft\profiles.json` |
| Apply journal, for Undo and recovery | `%LOCALAPPDATA%\Whichcraft\journal\` |
| Snapshots | `%LOCALAPPDATA%\Whichcraft\snapshots\` |
| Elevation requests, removed after use | `%LOCALAPPDATA%\Whichcraft\elevation-*.json` |
| Default Install Store | `%LOCALAPPDATA%\Whichcraft\installs\` |
| Pinned mise | `%LOCALAPPDATA%\Whichcraft\mise\` |
| WebView data | `%LOCALAPPDATA%\com.whichcraft.app\` |

A per-user NSIS install also places the app in `%LOCALAPPDATA%\Whichcraft`, so this folder holds both. Uninstalling keeps the data. Ticking "Delete the application data" removes everything above except `installs` and `mise`, which hold tools that PATH or a project may still use. The MSI has no such option.

---

## CLI mode

Terminals reach the console program `bin\whichcraft.exe`, because only `bin` goes on PATH ([ADR-0006](docs/adr/0006-cli-in-bin-folder-not-com.md)). With a subcommand it runs the command and exits. With no subcommand, or only GUI flags such as `--legacy-ui`, it starts the GUI one folder up and returns. The GUI `whichcraft.exe` given a subcommand also runs it, which the installers use for `path-cleanup`.

`get`/`list`/`export` call `env_store::read_all()` / `export::*` directly and never write. `import`/`set`/`delete` are dry-run by default and only call `env_store::apply_changes()` when `--apply` is passed. This is the GUI's shared apply path with best-effort rollback of completed mutations. Restoration checks for conflicting external changes and reports unresolved entries; it does not provide crash safety or transactional isolation.

```
whichcraft get <NAME> [--scope user|system]
whichcraft list [--scope user|system] [--format text|json]
whichcraft export [--scope user|system] [--format json|reg|ps1|dsc-v2|dsc-v3|ansible] [--output <path>]
whichcraft import <file> [--format json|reg] [--scope user|system] [--strategy merge|replace] [--apply]
whichcraft set <NAME> <VALUE> [--scope user|system] [--kind auto|string|expand-string] [--apply]
whichcraft delete <NAME> [--scope user|system] [--apply]
```

---

## Single instance

Release builds run one GUI at a time through `tauri-plugin-single-instance`, so two instances never write the same settings and journal. A second launch brings the open window forward and exits. Subcommands, `--demo` runs, and debug builds are not limited. Run as admin passes `--replaces-pid` so the elevated instance waits for the old one to exit before taking the lock.

---

## Visual system

Tokens, type, spacing, and interaction rules live in [design-system/whichcraft/MASTER.md](design-system/whichcraft/MASTER.md), and their implementation in `src/index.css`.

---

## Storybook

Deployed to GitHub Pages at `/Whichcraft/storybook/` on push to `main` (handled by `pages.yml`). The multi-language landing page (built with Astro in `lp/`) lives at the `/Whichcraft/` root. Theme toggle (dark/light) uses `globalTypes` — the `backgrounds` addon is not used.
