// Regenerate the WiX and NSIS bitmaps from the Quiet Craft SVG. Needs Windows for Segoe UI.
// WiX draws its titles in black, from 180px across on the dialog and up to 406px on the
// banner, so those areas stay white. All files are 24-bit BMPs, which both installers accept.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("../", import.meta.url));
const logo = readFileSync(join(root, "src-tauri/icons/source/logo.svg")).toString("base64");
const mark = (size, css = "") =>
  `<img src="data:image/svg+xml;base64,${logo}" width="${size}" height="${size}" style="display:block;${css}">`;

const panel = (height) => `
  <div style="width:164px;height:${height}px;background:#30213F;color:#F7EEDC;padding:12px 16px;box-sizing:border-box">
    ${mark(72, "margin-left:-8px")}
    <div style="font-size:24px;font-weight:600;letter-spacing:-.02em;margin-top:8px">Whichcraft</div>
    <div style="font-size:12px;line-height:17px;margin-top:6px;color:#E3D7EC">Developer tool manager for Windows</div>
    <div style="width:32px;height:2px;background:#C5A0F0;margin-top:12px"></div>
  </div>`;

const art = [
  { file: "src-tauri/nsis/sidebar.bmp", width: 164, height: 314, html: panel(314) },
  {
    file: "src-tauri/nsis/header.bmp",
    width: 150,
    height: 57,
    html: `<div style="height:57px;background:#30213F;color:#F7EEDC;display:flex;align-items:center;gap:2px;padding-left:6px">
      ${mark(42)}<span style="font-size:17px;font-weight:600;letter-spacing:-.02em">Whichcraft</span></div>`,
  },
  {
    file: "src-tauri/wix/dialog.bmp",
    width: 493,
    height: 312,
    html: `<div style="height:312px;background:#fff">${panel(312)}</div>`,
  },
  {
    file: "src-tauri/wix/banner.bmp",
    width: 493,
    height: 58,
    html: `<div style="height:58px;background:#fff;display:flex;justify-content:flex-end;align-items:center;padding-right:12px">${mark(40)}</div>`,
  },
];

function toBmp(width, height, rgba) {
  const stride = (width * 3 + 3) & ~3;
  const size = 54 + stride * height;
  const out = Buffer.alloc(size);
  out.write("BM", 0, "latin1");
  out.writeUInt32LE(size, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(width, 18);
  out.writeInt32LE(height, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(stride * height, 34);
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * stride;
    for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 4;
      out[row + x * 3] = rgba[from + 2];
      out[row + x * 3 + 1] = rgba[from + 1];
      out[row + x * 3 + 2] = rgba[from];
    }
  }
  return out;
}

const browser = await chromium.launch();
try {
  for (const { file, width, height, html } of art) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await page.setContent(
      `<!doctype html><body style="margin:0;overflow:hidden;font-family:'Segoe UI'">${html}</body>`,
      { waitUntil: "load" },
    );
    const png = (await page.screenshot({ type: "png" })).toString("base64");
    const rgba = await page.evaluate(async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0);
      return Array.from(context.getImageData(0, 0, image.width, image.height).data);
    }, png);
    writeFileSync(join(root, file), toBmp(width, height, rgba));
    await page.close();
    console.log(`${file} ${width}x${height}`);
  }
} finally {
  await browser.close();
}
