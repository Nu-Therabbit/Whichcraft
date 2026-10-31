import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const dir = fileURLToPath(new URL('./', import.meta.url));
await mkdir(dir, { recursive: true });
const concepts = [
  {
    id: 'A', name: 'Switch W', file: 'a-switch-w', bg: '#075BD8', ink: '#FFFFFF',
    idea: 'W + เส้นทางที่เลือก', detail: 'ตรงไปตรงมา คมชัด เหมาะกับแอป Windows',
    mark: '<path d="M24 30 37 70 50 45 63 70 71 45" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="77" cy="27" r="6" fill="currentColor"/>',
  },
  {
    id: 'B', name: 'Quiet Craft', file: 'b-quiet-craft', bg: '#30213F', ink: '#F7EEDC',
    idea: 'หมวกแม่มดแบบพับกระดาษ', detail: 'เล่นกับชื่อ Whichcraft มีบุคลิกและจำง่าย',
    mark: '<path d="M29 65 47 26Q50 20 56 23L76 35 58 33 67 65Z" fill="currentColor"/><path d="M19 69Q49 60 81 70Q89 74 80 78Q49 85 19 78Q11 74 19 69Z" fill="currentColor"/><path d="m33 55 29-2 3 9-36 3Z" fill="var(--detail, #C5A0F0)"/>',
  },
  {
    id: 'C', name: 'Version Stack', file: 'c-version-stack', bg: '#AEF0CA', ink: '#173E32',
    idea: 'หลายเวอร์ชัน เลือกใช้หนึ่งเดียว', detail: 'สื่อหน้าที่ของแอปผ่านชั้นเครื่องมือและเครื่องหมายเลือก',
    mark: '<rect x="29" y="22" width="42" height="13" rx="4" fill="currentColor" opacity=".34"/><rect x="23" y="41" width="54" height="13" rx="4" fill="currentColor" opacity=".60"/><rect x="17" y="60" width="66" height="20" rx="5" fill="currentColor"/><path d="m43 69 5 5 10-10" fill="none" stroke="var(--cutout, #AEF0CA)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  },
  {
    id: 'D', name: 'Prompt Rune', file: 'd-prompt-rune', bg: '#D6F35A', ink: '#242C1C',
    idea: 'Terminal prompt + อักษรรูน', detail: 'กลิ่นอายเครื่องมือ dev สีสด เห็นเด่นบน taskbar',
    mark: '<path d="m28 29 22 21-22 21" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="square" stroke-linejoin="miter"/><path d="M57 70h20" fill="none" stroke="currentColor" stroke-width="9"/><path d="m65 24-4 14 14-4-14-4 4 14 4-14-14 4 14 4Z" fill="currentColor"/>',
  },
];

function svg(c, mono = false) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Whichcraft — ${c.name}" style="color:${mono ? 'currentColor' : c.ink};${mono ? '--detail:var(--mono-bg,#ffffff);--cutout:var(--mono-bg,#ffffff)' : ''}">${mono ? '' : `<rect width="100" height="100" rx="23" fill="${c.bg}"/>`}${c.mark}</svg>`;
}
for (const c of concepts) {
  await writeFile(`${dir}${c.file}.svg`, svg(c));
  await writeFile(`${dir}${c.file}-mono.svg`, svg(c, true));
}
const cards = concepts.map(c => `<article><header><span class="letter">${c.id}</span><h2>${c.name}</h2></header><div class="hero">${svg(c)}</div><h3>${c.idea}</h3><p>${c.detail}</p><div class="sizes"><span>ขนาดจริง</span>${[16,24,32,48].map(s => `<div class="size"><div style="width:${s}px;height:${s}px">${svg(c)}</div><small>${s}</small></div>`).join('')}</div><div class="contexts"><div class="light">${svg(c,true)}<span>Whichcraft</span></div><div class="dark">${svg(c,true)}<span>Whichcraft</span></div></div></article>`).join('');
const html = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Whichcraft — Icon directions</title><style>
*{box-sizing:border-box}body{margin:0;background:#eeeae3;color:#22251f;font-family:'Segoe UI',Tahoma,sans-serif;padding:42px 44px 26px}main{max-width:1312px;margin:auto}.top{display:flex;align-items:baseline;justify-content:space-between;border-bottom:1px solid #c8c5bc;padding-bottom:20px;margin-bottom:28px}.brand{font-size:28px;font-weight:650;letter-spacing:-1px}.sub{font-size:13px;color:#55594e}.intro{display:flex;justify-content:space-between;align-items:end;margin-bottom:26px}h1{font-size:32px;letter-spacing:-1px;font-weight:500;line-height:1.2;margin:0}.intro p{font-size:14px;margin:0;color:#55594e}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}article{background:#faf9f5;border:1px solid #d7d3ca;padding:20px 18px 18px;border-radius:5px}header{display:flex;align-items:center;gap:10px}.letter{display:inline-grid;place-items:center;background:#e9e6dd;border-radius:50%;width:28px;height:28px;font-size:14px;font-weight:650}h2{font-size:18px;letter-spacing:-.4px;margin:0;font-weight:600}.hero{height:210px;display:grid;place-items:center}.hero svg{width:152px;height:152px}svg{display:block;width:100%;height:100%}h3{font-size:15px;margin:4px 0 8px;font-weight:600}p{font-size:13px;line-height:1.7;margin:0;min-height:45px;color:#5b5e55}.sizes{display:flex;align-items:center;justify-content:space-between;height:96px;border-top:1px solid #dedbd2;margin-top:18px;gap:10px}.sizes>span{font-size:12px;color:#5b5e55}.size{display:flex;align-items:center;justify-content:end;flex-direction:column;height:70px;gap:7px}small{font-size:10px;color:#696d61}.contexts{display:flex;flex-direction:column;gap:8px}.contexts>div{display:flex;align-items:center;gap:10px;padding:11px 13px;border-radius:3px;font-size:13px;font-weight:600}.contexts svg{width:24px;height:24px}.light{color:#222a21;background:#ebece7;--mono-bg:#ebece7}.dark{color:#eef0e9;background:#232820;--mono-bg:#232820}footer{display:flex;justify-content:space-between;font-size:12px;color:#62665b;margin-top:23px}@media(max-width:900px){.grid{grid-template-columns:repeat(2,1fr)}.intro{align-items:start;gap:15px;flex-direction:column}}@media(max-width:500px){body{padding:24px 18px}.grid{grid-template-columns:1fr}.top{gap:10px}.sub{font-size:11px}.hero{height:200px}}
</style><main><div class="top"><div class="brand">Whichcraft</div><div class="sub">ICON EXPLORATION / 01 NOV 2026</div></div><div class="intro"><h1>ไอคอนใหม่ 4 ทิศทาง</h1><p>เลือกจากรูปทรงก่อน · ทุกแบบมีสีและขาวดำ</p></div><div class="grid">${cards}</div><footer><span>แบบร่างสำหรับเลือกแนวทาง</span><span>SVG originals · 16 / 24 / 32 / 48 px</span></footer></main></html>`;
await writeFile(`${dir}preview.html`, html);
const browser = await chromium.launch({headless:true, channel:'msedge'});
try {
  const page = await browser.newPage({viewport:{width:1400,height:850},deviceScaleFactor:1.5});
  await page.goto(new URL('./preview.html',import.meta.url).href);
  await page.screenshot({path:`${dir}icon-directions.png`,fullPage:true});
  console.log(JSON.stringify({preview:`${dir}preview.html`,image:`${dir}icon-directions.png`,options:concepts.map(c=>c.file)}));
} finally { await browser.close(); }
