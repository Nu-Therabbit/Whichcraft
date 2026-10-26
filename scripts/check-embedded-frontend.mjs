// Fail packaging if Rust retained a previous Vite entry after hashed assets changed.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const [htmlPath = join("dist", "index.html"), binaryPath = join("src-tauri", "target", "release", "whichcraft.exe")] = process.argv.slice(2);
const html = readFileSync(htmlPath, "utf8");
const moduleTag = html.match(/<script\b[^>]*\btype=["']module["'][^>]*>/)?.[0];
const entry = moduleTag?.match(/\bsrc=["']\/?([^"']+)["']/)?.[1];
if (!entry) throw new Error(`No production module entry in ${htmlPath}`);
if (!readFileSync(binaryPath).includes(Buffer.from(entry))) {
  throw new Error(`Stale embedded frontend in ${binaryPath}: expected ${entry}. Rebuild the GUI before packaging.`);
}
console.log(`Embedded frontend verified: ${entry}`);
