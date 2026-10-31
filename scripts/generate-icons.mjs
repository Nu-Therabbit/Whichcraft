// Regenerate application and website icons from the approved Quiet Craft SVG.
import { copyFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = join(root, "src-tauri/icons/source/logo.svg");
const icons = join(root, "src-tauri/icons");
const result = spawnSync(
  process.execPath,
  [join(root, "node_modules/@tauri-apps/cli/tauri.js"), "icon", source, "--output", icons],
  { cwd: root, stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// `tauri icon` always writes mobile sets, and this app only targets Windows.
for (const platform of ["android", "ios"]) {
  rmSync(join(icons, platform), { recursive: true, force: true });
}

copyFileSync(source, join(root, "public/icon.svg"));
copyFileSync(source, join(root, "lp/public/favicon.svg"));
for (const [from, to] of [
  ["32x32.png", "icon-32.png"],
  ["128x128.png", "icon-128.png"],
  ["icon.ico", "favicon.ico"],
]) {
  copyFileSync(join(icons, from), join(root, "lp/public", to));
}
console.log("Updated desktop and website icons from Quiet Craft.");
