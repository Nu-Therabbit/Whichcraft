import type { APIRoute } from "astro";
import {
  enCopy,
  GITHUB_URL,
  RELEASE_PUBLISHED,
  RELEASE_URL,
  REPORTS_URL,
  BUILD_URL,
  STORYBOOK_URL,
  VERSION,
} from "../lib/lpContent";

// https://llmstxt.org/ — a curated summary for LLMs/AI agents, kept separate
// from robots.txt (crawl rules) and sitemap.xml (page list for search
// engines). Hand-authored English content; not localized like the LP itself,
// matching how CLI output and DESIGN.md also stay English-only in this repo.
export const GET: APIRoute = ({ site }) => {
  const base = import.meta.env.BASE_URL;
  const url = (path: string) => new URL(`${base}${path}`, site).toString();
  // STORYBOOK_URL/REPORTS_URL are already origin-relative ("/Whichcraft/...").
  const absolute = (path: string) => new URL(path, site).toString();

  const body = `# Whichcraft

> ${enCopy.description}

Whichcraft is a free, open-source GUI (desktop app) for Windows 10/11 (Tauri v2 + React + Rust) that lets developers manage versions of Java, Node.js, Python, Go, Flutter, and Git, and choose which installation Windows uses by default. It writes paths directly with no shims, shows every environment change as a plan before applying it, and can undo it. Named tool profiles apply several selections together. Git is switch-only; Android SDK and NDK, MSVC, and the Windows SDK are inventory only. Per-project versions are out of scope. It also includes an environment variable editor with secret detection, encrypted snapshots, and a dry-run-by-default CLI for environment variables. Git configuration shows repository commit identity, source precedence, and includeIf rules. SSH configuration shows hosts, source files, and key references. Supported existing values and global include rules follow preview, Apply, readback, and selective Undo. SSH inspection is static and does not test authentication. No telemetry in the app itself.

## Docs

- [Landing page](${url("")}): Overview and screenshots${RELEASE_PUBLISHED ? ", download links" : ""}. Also available in 日本語, 简体中文, Русский, 한국어, and Tiếng Việt.
- [GitHub repository](${GITHUB_URL}): Source, DESIGN.md architecture notes, issue tracker.
- [Git and SSH guide](${GITHUB_URL}/blob/main/docs/configuration.md): Supported configuration edits, impact preview, Undo, and limits.
${
  RELEASE_PUBLISHED
    ? `- [Latest release](${RELEASE_URL}): Windows installer (.exe), MSI, and portable .zip downloads. Current version: ${VERSION}.`
    : `- [Build from source](${BUILD_URL}): No release has been published yet, so there is no installer to download. Build version ${VERSION} from source on Windows; builds are not code signed.`
}
- [Component Storybook](${absolute(STORYBOOK_URL)}): Interactive UI component explorer, not the app itself.
- [CI test reports](${absolute(REPORTS_URL)}): Automated test/lint report archive, not user-facing documentation.

`;

  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
