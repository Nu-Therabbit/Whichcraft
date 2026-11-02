// Builds the console launcher and places it as bin\whichcraft.exe for the installers.
// Only bin goes on PATH, so `whichcraft <command>` in a terminal runs the console program (the
// shell waits for it) while Explorer and the Start menu run the GUI whichcraft.exe above it.
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const manifest = join("src-tauri", "Cargo.toml");
const build = spawnSync("cargo", ["build", "--release", "--bin", "whichcraft-cli", "--manifest-path", manifest], {
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);

const release = join("src-tauri", "target", "release");
mkdirSync(join(release, "bin"), { recursive: true });
copyFileSync(join(release, "whichcraft-cli.exe"), join(release, "bin", "whichcraft.exe"));
console.log("bin\\whichcraft.exe ready in", release);

// A successful Rust invocation alone does not prove the GUI embedded this Vite build.
const verified = spawnSync(process.execPath, [join("scripts", "check-embedded-frontend.mjs")], { stdio: "inherit" });
if (verified.status !== 0) process.exit(verified.status ?? 1);
