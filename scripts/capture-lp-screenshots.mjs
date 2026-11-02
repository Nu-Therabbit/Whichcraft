// Regenerates lp/public/screenshot-*.png from the real desktop shell with the sample data in
// .scratch/windows-workbench. Run on Windows so the screenshots use Segoe UI like the app.
import { readFile } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, resolve } from "node:path";
import { chromium } from "playwright";
import { build } from "vite";

const outDir = mkdtempSync(join(tmpdir(), "whichcraft-lp-capture-"));
const shots = resolve("lp/public");
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png" };

await build({
  configFile: resolve("vite.config.ts"),
  logLevel: "warn",
  build: { outDir, emptyOutDir: true, target: "esnext", rolldownOptions: { input: resolve(".scratch/windows-workbench/index.html") } },
});
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  try {
    const body = await readFile(join(outDir, path));
    res.writeHead(200, { "Content-Type": types[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((ready) => server.listen(0, "127.0.0.1", ready));

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, reducedMotion: "reduce" });
  const shot = async (name) => {
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, `screenshot-${name}.png`) });
    console.log(`lp/public/screenshot-${name}.png`);
  };
  await page.goto(`http://127.0.0.1:${server.address().port}/.scratch/windows-workbench/index.html?theme=dark`);
  await page.locator(".shell-card-head").first().waitFor();
  await shot("tools");

  await page.getByRole("button", { name: /^Use\b/ }).first().click();
  await page.getByRole("dialog").waitFor();
  await shot("plan");
  await page.keyboard.press("Escape");

  await page.getByRole("link", { name: /tool profiles/i }).click();
  await page.getByRole("heading", { name: /tool profiles/i }).waitFor();
  await shot("profiles");
} finally {
  await browser.close();
  server.close();
  rmSync(outDir, { recursive: true, force: true });
}
