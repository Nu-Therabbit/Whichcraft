/**
 * Frontend dependency rules for the desktop UI migration (spec "Testing Decisions",
 * architecture.md "Migration order and completion evidence"). Counterpart of the Rust
 * `application/layer_tests.rs`. Test-only code (tests, stories, `src/test/`) is exempt.
 *
 * Inherited Envarly presentation in `components/`, `hooks/` and `lib/` is the documented
 * exception: it may still use native dialog/opener plugins and the compatibility barrel
 * until ticket 21 removes the legacy UI. The one remaining singleton consumer is the
 * legacy-only `AppHeader`.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname);

/** Feature policy and the contracts it is built on. */
const POLICY_DIRS = ["features", "coordination", "contracts", "platform", "shared"];

const SINGLETON = path.join(SRC, "api.ts");
const BARREL = path.join(SRC, "types.ts");

/** Modules allowed to reach the legacy `api` singleton. */
const SINGLETON_ALLOWED = [path.join(SRC, "composition"), path.join(SRC, "components", "AppHeader", "AppHeader.tsx")];

/** Modules allowed to import `@tauri-apps/api` (invoke/listen/isTauri): adapters and launch construction. */
const TAURI_CORE_ALLOWED = [
  path.join(SRC, "transport"),
  path.join(SRC, "composition"),
  path.join(SRC, "demo"),
];

function isTestOnly(file: string): boolean {
  return (
    /\.(test|stories)\.tsx?$/.test(file) || file.startsWith(path.join(SRC, "test") + path.sep)
  );
}

function productionFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...productionFiles(full));
    else if (/\.tsx?$/.test(entry.name) && !isTestOnly(full)) out.push(full);
  }
  return out;
}

/** Module specifiers of static, dynamic and re-export imports. */
function importsOf(file: string): string[] {
  const source = fs.readFileSync(file, "utf8");
  const specs: string[] = [];
  for (const match of source.matchAll(/(?:from|import)\s*\(?\s*"([^"]+)"/g)) specs.push(match[1]);
  return specs;
}

function resolveLocal(file: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = path.resolve(path.dirname(file), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return base;
}

const within = (file: string, roots: string[]) =>
  roots.some((root) => file === root || file.startsWith(root + path.sep));

const rel = (file: string) => path.relative(SRC, file).split(path.sep).join("/");

function violations(files: string[], forbidden: (spec: string, resolved: string | null) => boolean) {
  return files.flatMap((file) =>
    importsOf(file)
      .filter((spec) => forbidden(spec, resolveLocal(file, spec)))
      .map((spec) => `${rel(file)} -> ${spec}`),
  );
}

const policyFiles = POLICY_DIRS.flatMap((dir) => productionFiles(path.join(SRC, dir)));
const allFiles = productionFiles(SRC);

describe("frontend architecture", () => {
  it("scans the policy layers", () => {
    expect(policyFiles.length).toBeGreaterThan(20);
  });

  it("keeps feature policy free of Tauri, transport adapters and demo construction", () => {
    const found = violations(
      policyFiles,
      (spec, resolved) =>
        spec.startsWith("@tauri-apps/") ||
        (resolved !== null &&
          within(resolved, [path.join(SRC, "transport"), path.join(SRC, "demo")])),
    );
    expect(found).toEqual([]);
  });

  it("imports feature types from their owners, not the compatibility barrel", () => {
    expect(violations(policyFiles, (_spec, resolved) => resolved === BARREL)).toEqual([]);
  });

  it("reaches the legacy api singleton only from composition and the legacy header", () => {
    const found = violations(
      allFiles.filter((file) => file !== SINGLETON && !within(file, SINGLETON_ALLOWED)),
      (_spec, resolved) => resolved === SINGLETON,
    );
    expect(found).toEqual([]);
  });

  it("calls Tauri invoke/listen only from adapters and launch construction", () => {
    const found = violations(
      allFiles.filter((file) => !within(file, TAURI_CORE_ALLOWED)),
      (spec) => spec === "@tauri-apps/api" || spec.startsWith("@tauri-apps/api/"),
    );
    expect(found).toEqual([]);
  });
});
