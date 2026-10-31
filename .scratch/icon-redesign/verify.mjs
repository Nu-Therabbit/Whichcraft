import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('./', import.meta.url));
const browser = await chromium.launch({headless:true,channel:'msedge'});
try {
  const page = await browser.newPage({viewport:{width:1200,height:760}, deviceScaleFactor:1});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  for (const theme of ['light','dark']) {
    await page.goto(`http://127.0.0.1:4173/.scratch/windows-workbench/index.html?theme=${theme}`);
    const icon = page.locator('.shell-brand img');
    await icon.waitFor();
    await page.getByRole('button',{name:/Java.*21.0.8/}).waitFor();
    assert.equal(await icon.evaluate(img => img.complete && img.naturalWidth > 0),true);
    assert.equal(await icon.getAttribute('alt'),'');
    await page.screenshot({path:`${dir}applied-${theme}.png`});
    await page.setViewportSize({width:900,height:600});
    assert.equal(await icon.evaluate(img => img.getBoundingClientRect().width),28);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
    await page.setViewportSize({width:1200,height:760});
  }
  assert.deepEqual(errors,[]);
  const assets = ['../../src-tauri/wix/banner.bmp','../../src-tauri/wix/dialog.bmp','../../src-tauri/nsis/header.bmp','../../src-tauri/nsis/sidebar.bmp'];
  const html = `<html><body style="background:#ddd;font-family:Segoe UI;display:flex;gap:15px;flex-wrap:wrap">${assets.map(p=>`<div><p>${p}</p><img src="${p}"></div>`).join('')}</body></html>`;
  await writeFile(`${dir}installers.html`,html);
  await page.goto(new URL('./installers.html',import.meta.url).href);
  await page.screenshot({path:`${dir}installer-artwork.png`,fullPage:true});
  const source = await readFile(new URL('../../src-tauri/icons/source/logo.svg',import.meta.url));
  assert.deepEqual(await readFile(new URL('../../lp/public/favicon.svg',import.meta.url)),source);
  assert.deepEqual(await readFile(new URL('../../public/icon.svg',import.meta.url)),source);
  console.log('Brand image loaded in light/dark themes and at minimum window width; no browser errors; SVG copies match.');
} finally { await browser.close(); }
