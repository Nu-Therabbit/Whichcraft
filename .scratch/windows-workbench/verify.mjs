import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const out = '.taste-skill/after/journeys';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const base = 'http://127.0.0.1:4173/.scratch/windows-workbench/index.html';
try {
  for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const audit = async (screen) => {
      await page.waitForTimeout(200);
      await page.addScriptTag({ path: require.resolve('axe-core/axe.min.js') });
      const axe = await page.evaluate(async () => (await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } })).violations.map(({ id, nodes }) => ({ id, nodes: nodes.map((n) => ({ html: n.html, summary: n.failureSummary })) })));
      results.push({ theme, screen, violations: axe });
    };
    await page.goto(`${base}?theme=${theme}`);
    await page.getByRole('button', { name: /Java.*21.0.8/ }).waitFor();
    await audit('tools');
    await page.getByRole('searchbox').fill('nonexistent-tool');
    assert.equal(await page.locator('.shell-tool-row').count(), 0);
    await page.screenshot({ path: `${out}/${theme}-search-empty.png` });
    await page.getByRole('searchbox').fill('');
    await page.getByRole('button', { name: /^Rescan$/ }).click();
    await page.getByRole('button', { name: /Java.*21.0.8/ }).click();
    const detail = page.getByRole('complementary', { name: /installation details/i });
    await detail.getByRole('button', { name: /Switch to.*17.0.16/i }).waitFor();
    assert.match(await detail.innerText(), /Selection[\s\S]*17\.0\.16[\s\S]*Effective installation[\s\S]*21\.0\.8/);
    await page.screenshot({ path: `${out}/${theme}-detail.png` });
    await audit('detail');
    await detail.getByRole('button', { name: /Switch to.*17.0.16/i }).click();
    await detail.getByRole('button', { name: /Apply.*plan/i }).waitFor();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${out}/${theme}-plan.png` });
    await audit('plan-review');
    // Native mutation flow is covered by the existing unit/contract suite; don't simulate successful writes.
    await page.getByRole('button', { name: /close.*details/i }).click();
    assert.match(await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), /Java/);
    await page.getByRole('link', { name: /^Settings$/ }).click();
    await page.getByTestId('shell-settings-ready').waitFor();
    await page.screenshot({ path: `${out}/${theme}-settings.png` });
    await audit('settings');
    await page.getByRole('link', { name: /^Tool profiles$/ }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${out}/${theme}-profiles.png` });
    await audit('profiles');
    await page.getByRole('link', { name: /^Environment$/ }).click();
    await page.getByRole('tab', { name: /^Variables$/ }).waitFor();
    await page.screenshot({ path: `${out}/${theme}-environment.png` });
    await audit('environment');
    for (const tab of ['Snapshots', 'Import / Export', 'Check command']) {
      const target = page.getByRole('tab', { name: tab, exact: true });
      if (await target.count()) { await target.click(); await audit(`environment-${tab}`); }
    }
    await page.getByRole('link', { name: /^Developer tools$/ }).click();
    await page.getByRole('button', { name: /install tool/i }).click();
    await page.screenshot({ path: `${out}/${theme}-install.png` });
    await audit('install');
    await page.goto(`${base}?theme=${theme}`);
    await page.getByRole('button', { name: /Java.*21.0.8/ }).waitFor();
    await page.keyboard.press('Tab');
    assert.equal(await page.locator('.shell-skip-link').evaluate((el) => el === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'shell-workspace');
    await page.getByRole('button', { name: /toggle theme/i }).click();
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('light')), theme !== 'light');
    for (const width of [1200, 900, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${base}?theme=${theme}`);
      await page.getByRole('button', { name: /Java.*21.0.8/ }).click();
      await page.screenshot({ path: `${out}/${theme}-detail-${width}.png` });
      await audit(`detail-${width}`);
      await page.getByRole('button', { name: /close.*details/i }).click();
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 900, height: 600 });
    await page.goto(`${base}?theme=${theme}&page=environment`);
    await page.getByRole('tab', { name: /^Variables$/ }).waitFor();
    await page.screenshot({ path: `${out}/${theme}-environment-minimum.png` });
    await audit('environment-minimum-900x600');
    await page.getByRole('link', { name: /^Settings$/ }).click();
    await page.getByTestId('shell-settings-ready').waitFor();
    await page.screenshot({ path: `${out}/${theme}-settings-minimum.png` });
    await audit('settings-minimum-900x600');
    await page.goto(`${base}?theme=${theme}&state=loading`);
    await page.getByRole('heading', { name: /^Developer tools$/ }).waitFor();
    await page.screenshot({ path: `${out}/${theme}-loading.png` });
    await audit('loading');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${base}?theme=${theme}&state=empty`);
    await page.getByRole('button', { name: /Java/ }).waitFor();
    await page.screenshot({ path: `${out}/${theme}-empty.png` });
    await audit('empty-reduced-motion');
    await page.goto(`${base}?theme=${theme}&state=error`);
    await page.getByRole('button', { name: /Java.*scan failed/i }).waitFor({ timeout: 2000 }).catch(() => {});
    await page.screenshot({ path: `${out}/${theme}-error.png` });
    await audit('scan-error');
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally {
  await writeFile(`${out}/accessibility.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
const violations = results.flatMap((r) => r.violations.map((v) => `${r.theme}/${r.screen}: ${v.id}`));
console.log(JSON.stringify({ screens: results.length, violations }, null, 2));
assert.equal(violations.length, 0, 'Resolve accessibility violations before delivery');
